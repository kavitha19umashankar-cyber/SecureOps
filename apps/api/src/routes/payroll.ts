import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { getDb, payrollRuns, payrollRecords, employees, attendances, salaryStructures } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { computePayroll, getWorkingDaysInMonth } from '@secureops/utils'
import { notFound, forbidden, badRequest } from '../lib/errors.js'

export const payrollRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  const HR_ROLES = [UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]

  // List payroll runs
  fastify.get('/runs', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE || role === UserRole.CLIENT) forbidden()

    const rows = await db.select().from(payrollRuns).where(eq(payrollRuns.tenantId, tenantId))
    return { success: true, data: rows }
  })

  // Initiate a payroll run for a month
  fastify.post('/runs', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!HR_ROLES.includes(role as UserRole)) forbidden()

    const body = z.object({ month: z.number().min(1).max(12), year: z.number().min(2020) }).parse(req.body)

    const existing = await db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.tenantId, tenantId),
        eq(payrollRuns.month, body.month),
        eq(payrollRuns.year, body.year),
      ),
    })
    if (existing) badRequest(`Payroll run for ${body.month}/${body.year} already exists`)

    const [run] = await db.insert(payrollRuns).values({
      tenantId,
      month: body.month,
      year: body.year,
      status: 'draft',
    }).returning()

    return reply.status(201).send({ success: true, data: run })
  })

  // Compute payroll for a run (generates/refreshes payroll records)
  fastify.post('/runs/:runId/compute', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!HR_ROLES.includes(role as UserRole)) forbidden()

    const { runId } = req.params as { runId: string }
    const run = await db.query.payrollRuns.findFirst({
      where: and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId)),
    })
    if (!run) notFound('Payroll run')
    if (run!.status === 'locked' || run!.status === 'paid') badRequest('Cannot recompute a locked or paid payroll run')

    await db.update(payrollRuns).set({ status: 'processing' }).where(eq(payrollRuns.id, runId))

    const allEmployees = await db.select().from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.status, 'active')))

    const totalWorkingDays = getWorkingDaysInMonth(run!.year, run!.month)
    const monthStart = `${run!.year}-${String(run!.month).padStart(2, '0')}-01`
    const monthEnd = `${run!.year}-${String(run!.month).padStart(2, '0')}-${new Date(run!.year, run!.month, 0).getDate()}`

    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0
    const records = []

    for (const emp of allEmployees) {
      // Fetch attendance for this month
      const empAttendance = await db.select().from(attendances).where(
        and(
          eq(attendances.employeeId, emp.id),
          eq(attendances.tenantId, tenantId),
        ),
      )

      const daysPresent = empAttendance.filter((a) => a.status === 'present').length
      const lopDays = empAttendance.filter((a) => a.status === 'on_leave' || a.status === 'absent').length
      const overtimeMinutes = empAttendance.reduce((sum, a) => sum + (a.overtimeMinutes ?? 0), 0)
      const overtimeHours = overtimeMinutes / 60

      // Get salary structure (use default CTC if no structure assigned)
      let ctcMonthly = 15000  // default minimum
      let basicPercent = 0.5
      let hraPercent = 0.2
      let conveyanceFixed = 1600
      const pfApplicable = true
      const esiApplicable = true
      const professionalTaxMonthly = 200

      if (emp.salaryStructureId) {
        const structure = await db.query.salaryStructures.findFirst({
          where: eq(salaryStructures.id, emp.salaryStructureId),
        })
        if (structure) {
          const basicComp = structure.components.find((c) => c.name.toLowerCase() === 'basic')
          if (basicComp && basicComp.calculationType === 'fixed') {
            ctcMonthly = basicComp.value / basicPercent
          }
        }
      }

      const result = computePayroll({
        ctcMonthly,
        basicPercent,
        hraPercent,
        conveyanceFixed,
        totalWorkingDays,
        daysPresent,
        lopDays,
        overtimeHours,
        overtimeMultiplier: 1.5,
        pfApplicable,
        esiApplicable,
        professionalTaxMonthly,
        advanceDeduction: 0,
        otherDeductions: 0,
      })

      records.push({
        payrollRunId: runId,
        employeeId: emp.id,
        tenantId,
        month: run!.month,
        year: run!.year,
        totalWorkingDays,
        daysPresent,
        daysAbsent: totalWorkingDays - daysPresent - lopDays,
        lopDays,
        overtimeHours: String(overtimeHours.toFixed(2)),
        grossSalary: String(result.grossEarnings),
        basicSalary: String(result.basicSalary),
        hra: String(result.hra),
        conveyance: String(result.conveyance),
        otherAllowances: String(result.otherEarnings),
        pfEmployee: String(result.pfEmployee),
        pfEmployer: String(result.pfEmployer),
        esi: String(result.esi),
        professionalTax: String(result.professionalTax),
        advanceDeduction: '0',
        otherDeductions: '0',
        totalDeductions: String(result.totalDeductions),
        netSalary: String(result.netSalary),
      })

      totalGross += result.grossEarnings
      totalDeductions += result.totalDeductions
      totalNet += result.netSalary
    }

    // Upsert records (delete old, insert new)
    if (records.length > 0) {
      await db.delete(payrollRecords).where(eq(payrollRecords.payrollRunId, runId))
      await db.insert(payrollRecords).values(records)
    }

    await db.update(payrollRuns).set({
      status: 'draft',
      totalEmployees: allEmployees.length,
      totalGross: String(totalGross.toFixed(2)),
      totalDeductions: String(totalDeductions.toFixed(2)),
      totalNetPay: String(totalNet.toFixed(2)),
    }).where(eq(payrollRuns.id, runId))

    return reply.send({ success: true, message: `Computed payroll for ${allEmployees.length} employees` })
  })

  // Lock payroll run
  fastify.post('/runs/:runId/lock', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role, sub } = req.user
    if (!HR_ROLES.includes(role as UserRole)) forbidden()

    const { runId } = req.params as { runId: string }
    const run = await db.query.payrollRuns.findFirst({
      where: and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId)),
    })
    if (!run) notFound('Payroll run')
    if (run!.status === 'locked') badRequest('Already locked')

    await db.update(payrollRuns).set({
      status: 'locked',
      lockedAt: new Date(),
      lockedBy: sub,
    }).where(eq(payrollRuns.id, runId))

    return reply.send({ success: true, message: 'Payroll run locked. Payslips can now be generated.' })
  })

  // Get payroll records for a run
  fastify.get('/runs/:runId/records', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE || role === UserRole.CLIENT) forbidden()

    const { runId } = req.params as { runId: string }
    const rows = await db.select({
      record: payrollRecords,
      employee: { id: employees.id, name: employees.name, employeeCode: employees.employeeCode, employeeType: employees.employeeType },
    })
      .from(payrollRecords)
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id))
      .where(and(eq(payrollRecords.payrollRunId, runId), eq(payrollRecords.tenantId, tenantId)))

    return { success: true, data: rows }
  })

  // My payslips (employee)
  fastify.get('/my-payslips', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, employeeId } = req.user
    if (role !== UserRole.EMPLOYEE || !employeeId) forbidden()

    const rows = await db.select().from(payrollRecords)
      .where(and(eq(payrollRecords.employeeId, employeeId), eq(payrollRecords.tenantId, tenantId)))

    return { success: true, data: rows }
  })

  // Salary structures
  fastify.get('/salary-structures', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (!HR_ROLES.includes(role as UserRole)) forbidden()

    const rows = await db.select().from(salaryStructures).where(eq(salaryStructures.tenantId, tenantId))
    return { success: true, data: rows }
  })

  fastify.post('/salary-structures', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!HR_ROLES.includes(role as UserRole)) forbidden()

    const body = z.object({
      name: z.string().min(2),
      components: z.array(z.object({
        name: z.string(),
        type: z.enum(['earning', 'deduction']),
        calculationType: z.enum(['fixed', 'percentage_of_basic', 'percentage_of_gross']),
        value: z.number(),
        isStatutory: z.boolean(),
      })),
    }).parse(req.body)

    const [created] = await db.insert(salaryStructures).values({ tenantId, ...body }).returning()
    return reply.status(201).send({ success: true, data: created })
  })
}
