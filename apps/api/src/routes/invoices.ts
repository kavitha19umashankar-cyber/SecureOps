import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { getDb, invoices, invoicePayments, contracts, allocations, attendances, employees } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { buildLineItems, computeInvoiceGst, generateInvoiceNumber } from '@secureops/utils'
import { notFound, forbidden, badRequest } from '../lib/errors.js'

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  const OPS_ROLES = [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN]

  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user

    const conditions = [eq(invoices.tenantId, tenantId)]
    if (role === UserRole.CLIENT) conditions.push(eq(invoices.clientId, clientId!))

    const rows = await db.select().from(invoices).where(and(...conditions))
    return { success: true, data: rows }
  })

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user
    const { id } = req.params as { id: string }

    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
    })
    if (!invoice) notFound('Invoice')
    if (role === UserRole.CLIENT && invoice!.clientId !== clientId) forbidden()

    return { success: true, data: invoice }
  })

  // Generate invoice for a site+period from attendance data
  fastify.post('/generate', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!OPS_ROLES.includes(role as UserRole)) forbidden()

    const body = z.object({
      siteId: z.string().uuid(),
      periodStart: z.string(),
      periodEnd: z.string(),
      isInterState: z.boolean().default(false),
      dueInDays: z.number().default(30),
      notes: z.string().optional(),
    }).parse(req.body)

    // Get active contract
    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.siteId, body.siteId), eq(contracts.tenantId, tenantId), eq(contracts.isActive, true)),
    })
    if (!contract) badRequest('No active contract found for this site')

    // Get all allocations for the site in the period
    const siteAllocations = await db.select({
      employee: employees,
      allocation: allocations,
    })
      .from(allocations)
      .leftJoin(employees, eq(allocations.employeeId, employees.id))
      .where(and(eq(allocations.siteId, body.siteId), eq(allocations.tenantId, tenantId)))

    // Count attendance days per employee
    const lineInputs = await Promise.all(
      siteAllocations.map(async ({ employee, allocation }) => {
        if (!employee) return null

        const empAttendance = await db.select().from(attendances).where(
          and(
            eq(attendances.employeeId, employee.id),
            eq(attendances.siteId, body.siteId),
            eq(attendances.tenantId, tenantId),
          ),
        )

        const daysWorked = empAttendance.filter((a) =>
          a.date >= body.periodStart && a.date <= body.periodEnd && a.status === 'present',
        ).length

        const overtimeHours = empAttendance
          .filter((a) => a.date >= body.periodStart && a.date <= body.periodEnd)
          .reduce((sum, a) => sum + (a.overtimeMinutes ?? 0) / 60, 0)

        return {
          employeeId: employee.id,
          employeeName: employee.name,
          designation: employee.employeeType,
          daysWorked,
          dailyRate: Number(contract!.billingRatePerDay),
          overtimeHours,
          overtimeRate: contract!.overtimeBillingRate ? Number(contract!.overtimeBillingRate) : undefined,
        }
      }),
    )

    const validInputs = lineInputs.filter((l) => l !== null && l.daysWorked > 0) as NonNullable<(typeof lineInputs)[0]>[]
    if (validInputs.length === 0) badRequest('No attendance records found for this period')

    const lineItems = buildLineItems(validInputs)
    const gst = computeInvoiceGst(lineItems, body.isInterState)

    // Generate sequential invoice number
    const [{ total }] = await db.select({ total: count() }).from(invoices).where(eq(invoices.tenantId, tenantId))
    const invoiceNum = generateInvoiceNumber(new Date().getFullYear(), Number(total ?? 0) + 1)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + body.dueInDays)

    const [invoice] = await db.insert(invoices).values({
      tenantId,
      clientId: contract!.clientId,
      siteId: body.siteId,
      invoiceNumber: invoiceNum,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      lineItems,
      subtotal: String(gst.subtotal),
      cgst: String(gst.cgst),
      sgst: String(gst.sgst),
      igst: String(gst.igst),
      totalAmount: String(gst.totalAmount),
      status: 'draft',
      dueDate: dueDate.toISOString().split('T')[0]!,
      notes: body.notes,
    }).returning()

    return reply.status(201).send({ success: true, data: invoice })
  })

  // Update invoice status
  fastify.patch('/:id/status', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!OPS_ROLES.includes(role as UserRole)) forbidden()

    const { id } = req.params as { id: string }
    const { status } = z.object({
      status: z.enum(['pending_approval','approved','sent','cancelled']),
    }).parse(req.body)

    const [updated] = await db.update(invoices)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning()

    if (!updated) notFound('Invoice')
    return reply.send({ success: true, data: updated })
  })

  // Record payment
  fastify.post('/:id/payments', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!OPS_ROLES.includes(role as UserRole)) forbidden()

    const { id } = req.params as { id: string }
    const body = z.object({
      amount: z.number().positive(),
      paidAt: z.string(),
      method: z.enum(['bank_transfer','cheque','upi','cash','other']),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body)

    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)),
    })
    if (!invoice) notFound('Invoice')

    const [payment] = await db.insert(invoicePayments).values({
      invoiceId: id,
      tenantId,
      amount: String(body.amount),
      paidAt: new Date(body.paidAt),
      method: body.method,
      reference: body.reference,
      notes: body.notes,
    }).returning()

    const newPaidAmount = Number(invoice!.paidAmount) + body.amount
    const newStatus = newPaidAmount >= Number(invoice!.totalAmount) ? 'paid' : 'partially_paid'
    await db.update(invoices)
      .set({ paidAmount: String(newPaidAmount), status: newStatus, updatedAt: new Date() })
      .where(eq(invoices.id, id))

    return reply.status(201).send({ success: true, data: payment })
  })
}
