import type { FastifyPluginAsync } from 'fastify'
import { eq, and, gte, lte, count, sql, desc } from 'drizzle-orm'
import { getDb, attendances, employees, sites, incidents, leaves, payrollRuns, payrollRecords, invoices } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { getWorkingDaysInMonth } from '@secureops/utils'
import { forbidden } from '../lib/errors.js'

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // Monthly attendance summary — one row per employee
  fastify.get('/attendance/monthly', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE || role === UserRole.CLIENT) forbidden()

    const q = req.query as { month?: string; year?: string; siteId?: string }
    const now = new Date()
    const month = Number(q.month ?? now.getMonth() + 1)
    const year = Number(q.year ?? now.getFullYear())
    const totalWorkingDays = getWorkingDaysInMonth(year, month)

    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const fromDate = `${monthStr}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const toDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`

    const conditions = [
      eq(attendances.tenantId, tenantId),
      gte(attendances.date, fromDate),
      lte(attendances.date, toDate),
    ]
    if (q.siteId) conditions.push(eq(attendances.siteId, q.siteId))

    const rows = await db
      .select({
        employeeId: attendances.employeeId,
        status: attendances.status,
        overtimeMinutes: sql<number>`sum(${attendances.overtimeMinutes})`,
        lateMinutes: sql<number>`sum(${attendances.lateMinutes})`,
        recordCount: count(),
      })
      .from(attendances)
      .where(and(...conditions))
      .groupBy(attendances.employeeId, attendances.status)

    // Pivot by employee
    const pivot: Record<string, {
      employeeId: string
      present: number; absent: number; halfDay: number; onLeave: number; lop: number
      totalOvertimeMinutes: number; totalLateMinutes: number
    }> = {}

    for (const row of rows) {
      if (!pivot[row.employeeId]) {
        pivot[row.employeeId] = {
          employeeId: row.employeeId,
          present: 0, absent: 0, halfDay: 0, onLeave: 0, lop: 0,
          totalOvertimeMinutes: 0, totalLateMinutes: 0,
        }
      }
      const p = pivot[row.employeeId]!
      if (row.status === 'present') p.present = row.recordCount
      else if (row.status === 'absent') p.absent = row.recordCount
      else if (row.status === 'half_day') p.halfDay = row.recordCount
      else if (row.status === 'on_leave') p.onLeave = row.recordCount
      else if ((row.status as string) === 'loss_of_pay') p.lop = row.recordCount
      p.totalOvertimeMinutes += Number(row.overtimeMinutes ?? 0)
      p.totalLateMinutes += Number(row.lateMinutes ?? 0)
    }

    const empIds = Object.keys(pivot)
    const empDetails = empIds.length > 0
      ? await db.select({
          id: employees.id,
          name: employees.name,
          employeeCode: employees.employeeCode,
          employeeType: employees.employeeType,
        }).from(employees).where(
          and(eq(employees.tenantId, tenantId), sql`${employees.id} = ANY(${empIds})`)
        )
      : []

    const empMap = Object.fromEntries(empDetails.map(e => [e.id, e]))

    const summary = Object.values(pivot).map(p => ({
      ...p,
      ...empMap[p.employeeId],
      totalWorkingDays,
      attendanceRate: totalWorkingDays > 0
        ? Math.round((p.present / totalWorkingDays) * 100)
        : 0,
      totalOvertimeHours: (p.totalOvertimeMinutes / 60).toFixed(1),
    }))

    return { success: true, data: { month, year, totalWorkingDays, employees: summary } }
  })

  // Incident trend — daily counts for last 30 days
  fastify.get('/incidents/trend', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE) forbidden()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', ${incidents.occurredAt})::date`,
        severity: incidents.severity,
        total: count(),
      })
      .from(incidents)
      .where(and(
        eq(incidents.tenantId, tenantId),
        gte(incidents.occurredAt, thirtyDaysAgo),
      ))
      .groupBy(
        sql`date_trunc('day', ${incidents.occurredAt})::date`,
        incidents.severity,
      )

    return { success: true, data: rows }
  })

  // Attendance trend — daily presence rate for last 30 days
  fastify.get('/attendance/trend', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE) forbidden()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0]!

    const rows = await db
      .select({
        date: attendances.date,
        status: attendances.status,
        total: count(),
      })
      .from(attendances)
      .where(and(
        eq(attendances.tenantId, tenantId),
        gte(attendances.date, fromDate),
      ))
      .groupBy(attendances.date, attendances.status)

    // Pivot: date → { present, absent }
    const byDate: Record<string, { date: string; present: number; absent: number; total: number }> = {}
    for (const r of rows) {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date, present: 0, absent: 0, total: 0 }
      byDate[r.date]!.total += r.total
      if (r.status === 'present') byDate[r.date]!.present += r.total
      else if (r.status === 'absent') byDate[r.date]!.absent += r.total
    }

    const trend = Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
      }))

    return { success: true, data: trend }
  })

  // Site-wise headcount summary for today
  fastify.get('/sites/headcount', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE) forbidden()

    const today = new Date().toISOString().split('T')[0]!

    const rows = await db
      .select({
        siteId: attendances.siteId,
        total: count(),
      })
      .from(attendances)
      .where(and(
        eq(attendances.tenantId, tenantId),
        eq(attendances.date, today),
        eq(attendances.status, 'present'),
      ))
      .groupBy(attendances.siteId)

    const siteList = await db.select({
      id: sites.id,
      name: sites.name,
      lat: sites.lat,
      lng: sites.lng,
      radiusMeters: sites.radiusMeters,
    }).from(sites).where(and(eq(sites.tenantId, tenantId), eq(sites.isActive, true)))

    const countMap = Object.fromEntries(rows.map(r => [r.siteId, r.total]))

    return {
      success: true,
      data: siteList.map(s => ({
        ...s,
        guardsOnDuty: countMap[s.id] ?? 0,
      })),
    }
  })

  // Payroll summary — totals and per-employee breakdown for a run
  fastify.get('/payroll/summary', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE || role === UserRole.CLIENT) forbidden()

    const q = req.query as { month?: string; year?: string }
    const now = new Date()
    const month = Number(q.month ?? now.getMonth() + 1)
    const year = Number(q.year ?? now.getFullYear())

    // Find the payroll run for this month/year
    const run = await db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.tenantId, tenantId),
        eq(payrollRuns.month, month),
        eq(payrollRuns.year, year),
      ),
    })

    if (!run) return { success: true, data: null }

    // Get records with employee info
    const records = await db
      .select({
        id: payrollRecords.id,
        employeeId: payrollRecords.employeeId,
        grossSalary: payrollRecords.grossSalary,
        basicSalary: payrollRecords.basicSalary,
        hra: payrollRecords.hra,
        conveyance: payrollRecords.conveyance,
        otherAllowances: payrollRecords.otherAllowances,
        pfEmployee: payrollRecords.pfEmployee,
        esi: payrollRecords.esi,
        professionalTax: payrollRecords.professionalTax,
        totalDeductions: payrollRecords.totalDeductions,
        netSalary: payrollRecords.netSalary,
        daysPresent: payrollRecords.daysPresent,
        lopDays: payrollRecords.lopDays,
        name: employees.name,
        employeeCode: employees.employeeCode,
        employeeType: employees.employeeType,
      })
      .from(payrollRecords)
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id))
      .where(eq(payrollRecords.payrollRunId, run.id))

    const totalGross = records.reduce((s, r) => s + Number(r.grossSalary), 0)
    const totalNet = records.reduce((s, r) => s + Number(r.netSalary), 0)
    const totalDeductions = records.reduce((s, r) => s + Number(r.totalDeductions), 0)
    const totalPf = records.reduce((s, r) => s + Number(r.pfEmployee), 0)
    const totalEsi = records.reduce((s, r) => s + Number(r.esi), 0)
    const totalPt = records.reduce((s, r) => s + Number(r.professionalTax), 0)

    return {
      success: true,
      data: {
        run: { id: run.id, month, year, status: run.status, totalEmployees: run.totalEmployees },
        summary: { totalGross, totalNet, totalDeductions, totalPf, totalEsi, totalPt },
        records: records.map(r => ({
          employeeId: r.employeeId,
          name: r.name,
          employeeCode: r.employeeCode,
          employeeType: r.employeeType,
          daysPresent: r.daysPresent,
          lopDays: r.lopDays,
          grossSalary: Number(r.grossSalary),
          totalDeductions: Number(r.totalDeductions),
          netSalary: Number(r.netSalary),
        })),
      },
    }
  })

  // Invoice aging — outstanding invoices grouped by age bucket
  fastify.get('/invoices/aging', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE) forbidden()

    const outstanding = await db.select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      dueDate: invoices.dueDate,
      status: invoices.status,
      createdAt: invoices.createdAt,
    })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        sql`${invoices.status} NOT IN ('paid', 'cancelled')`,
      ))
      .orderBy(desc(invoices.dueDate))

    const today = new Date()

    const buckets = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, over90: 0 }
    const items = outstanding.map(inv => {
      const due = new Date(inv.dueDate)
      const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      const balance = Number(inv.totalAmount) - Number(inv.paidAmount)

      let bucket: keyof typeof buckets
      if (daysOverdue <= 0) bucket = 'current'
      else if (daysOverdue <= 30) bucket = '1_30'
      else if (daysOverdue <= 60) bucket = '31_60'
      else if (daysOverdue <= 90) bucket = '61_90'
      else bucket = 'over90'

      buckets[bucket] += balance

      return { ...inv, balance, daysOverdue: Math.max(0, daysOverdue), bucket }
    })

    return { success: true, data: { items, buckets } }
  })
}
