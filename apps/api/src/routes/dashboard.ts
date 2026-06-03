import type { FastifyPluginAsync } from 'fastify'
import { eq, and, count, sql, gte, lte } from 'drizzle-orm'
import { getDb, employees, attendances, incidents, invoices, sites } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { forbidden } from '../lib/errors.js'

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // Agency admin overview
  fastify.get('/overview', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user

    const today = new Date().toISOString().split('T')[0]!
    const monthStart = today.slice(0, 7) + '-01'

    if (role === UserRole.CLIENT) {
      // Client sees only their sites
      const [
        siteCount,
        todayAttendance,
        openIncidents,
        pendingInvoices,
      ] = await Promise.all([
        db.select({ total: count() }).from(sites).where(and(eq(sites.tenantId, tenantId), eq(sites.clientId, clientId!))),
        db.select({ total: count() }).from(attendances).where(and(
          eq(attendances.tenantId, tenantId),
          eq(attendances.date, today),
          eq(attendances.status, 'present'),
        )),
        db.select({ total: count() }).from(incidents).where(and(
          eq(incidents.tenantId, tenantId),
          sql`${incidents.status} NOT IN ('resolved','closed')`,
          eq(incidents.clientVisible, true),
        )),
        db.select({ total: count() }).from(invoices).where(and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.clientId, clientId!),
          sql`${invoices.status} IN ('sent','overdue','partially_paid')`,
        )),
      ])

      return {
        success: true,
        data: {
          activeSites: siteCount[0]?.total ?? 0,
          guardsOnDutyToday: todayAttendance[0]?.total ?? 0,
          openIncidents: openIncidents[0]?.total ?? 0,
          pendingInvoices: pendingInvoices[0]?.total ?? 0,
        },
      }
    }

    if (role === UserRole.EMPLOYEE) forbidden()

    const [
      totalEmployees,
      activeEmployees,
      todayPresent,
      openIncidentsCount,
      pendingInvoicesCount,
      activeSites,
    ] = await Promise.all([
      db.select({ total: count() }).from(employees).where(eq(employees.tenantId, tenantId)),
      db.select({ total: count() }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.status, 'active'))),
      db.select({ total: count() }).from(attendances).where(and(
        eq(attendances.tenantId, tenantId),
        eq(attendances.date, today),
        eq(attendances.status, 'present'),
      )),
      db.select({ total: count() }).from(incidents).where(and(
        eq(incidents.tenantId, tenantId),
        sql`${incidents.status} NOT IN ('resolved','closed')`,
      )),
      db.select({ total: count() }).from(invoices).where(and(
        eq(invoices.tenantId, tenantId),
        sql`${invoices.status} IN ('sent','overdue','partially_paid','pending_approval')`,
      )),
      db.select({ total: count() }).from(sites).where(and(eq(sites.tenantId, tenantId), eq(sites.isActive, true))),
    ])

    return {
      success: true,
      data: {
        totalEmployees: totalEmployees[0]?.total ?? 0,
        activeEmployees: activeEmployees[0]?.total ?? 0,
        attendanceRateToday: totalEmployees[0]?.total
          ? Math.round(((todayPresent[0]?.total ?? 0) / (totalEmployees[0].total)) * 100)
          : 0,
        guardsOnDutyToday: todayPresent[0]?.total ?? 0,
        openIncidents: openIncidentsCount[0]?.total ?? 0,
        pendingInvoices: pendingInvoicesCount[0]?.total ?? 0,
        activeSites: activeSites[0]?.total ?? 0,
      },
    }
  })

  // Today's live attendance (for live map)
  fastify.get('/live-attendance', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE) forbidden()

    const today = new Date().toISOString().split('T')[0]!

    const rows = await db.select({
      attendance: attendances,
      employee: {
        id: employees.id,
        name: employees.name,
        photoUrl: employees.photoUrl,
        employeeType: employees.employeeType,
      },
    })
      .from(attendances)
      .leftJoin(employees, eq(attendances.employeeId, employees.id))
      .where(and(
        eq(attendances.tenantId, tenantId),
        eq(attendances.date, today),
        eq(attendances.status, 'present'),
      ))

    return { success: true, data: rows }
  })
}
