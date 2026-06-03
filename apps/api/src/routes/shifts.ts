import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb, shifts, allocations, employees } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { notFound, forbidden, badRequest } from '../lib/errors.js'

export const shiftRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  const shiftSchema = z.object({
    siteId: z.string().uuid(),
    template: z.enum(['morning', 'afternoon', 'night', 'custom']),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    date: z.string(),
    requiredCount: z.number().min(1).default(1),
  })

  const OPS_ROLES = [
    UserRole.AGENCY_ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.SUPER_ADMIN,
  ]

  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId } = req.user
    const query = req.query as { siteId?: string; from?: string; to?: string }

    const conditions = [eq(shifts.tenantId, tenantId)]
    if (query.siteId) conditions.push(eq(shifts.siteId, query.siteId))
    if (query.from) conditions.push(gte(shifts.date, query.from))
    if (query.to) conditions.push(lte(shifts.date, query.to))

    const rows = await db.select().from(shifts).where(and(...conditions))
    return { success: true, data: rows }
  })

  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!OPS_ROLES.includes(role as UserRole)) forbidden()

    const body = shiftSchema.parse(req.body)
    const [shift] = await db.insert(shifts).values({ tenantId, ...body }).returning()

    return reply.status(201).send({ success: true, data: shift })
  })

  // Assign employee to shift
  fastify.post('/:shiftId/allocate', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!OPS_ROLES.includes(role as UserRole)) forbidden()

    const { shiftId } = req.params as { shiftId: string }
    const body = z.object({
      employeeId: z.string().uuid(),
      role: z.string().default('guard'),
    }).parse(req.body)

    const shift = await db.query.shifts.findFirst({
      where: and(eq(shifts.id, shiftId), eq(shifts.tenantId, tenantId)),
    })
    if (!shift) notFound('Shift')

    const employee = await db.query.employees.findFirst({
      where: and(eq(employees.id, body.employeeId), eq(employees.tenantId, tenantId)),
    })
    if (!employee) notFound('Employee')
    if (employee.status !== 'active') badRequest('Employee is not active')

    // Check for double booking on same date
    const existingAlloc = await db.query.allocations.findFirst({
      where: and(
        eq(allocations.employeeId, body.employeeId),
        eq(allocations.shiftId, shiftId),
      ),
    })
    if (existingAlloc) badRequest('Employee is already allocated to this shift')

    const [alloc] = await db.insert(allocations).values({
      tenantId,
      employeeId: body.employeeId,
      shiftId,
      siteId: shift!.siteId,
      role: body.role,
    }).returning()

    return reply.status(201).send({ success: true, data: alloc })
  })

  // Get allocations for a shift
  fastify.get('/:shiftId/allocations', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId } = req.user
    const { shiftId } = req.params as { shiftId: string }

    const rows = await db.select({
      allocation: allocations,
      employee: { id: employees.id, name: employees.name, employeeType: employees.employeeType, photoUrl: employees.photoUrl, phone: employees.phone },
    })
      .from(allocations)
      .leftJoin(employees, eq(allocations.employeeId, employees.id))
      .where(and(eq(allocations.shiftId, shiftId), eq(allocations.tenantId, tenantId)))

    return { success: true, data: rows }
  })

  fastify.delete('/:shiftId/allocations/:allocationId', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!OPS_ROLES.includes(role as UserRole)) forbidden()

    const { allocationId } = req.params as { shiftId: string; allocationId: string }
    await db.update(allocations)
      .set({ status: 'cancelled' })
      .where(and(eq(allocations.id, allocationId), eq(allocations.tenantId, tenantId)))

    return reply.send({ success: true })
  })
}
