import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte } from 'drizzle-orm'
import { getDb, attendances, sites } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { isWithinGeofence, checkVelocity } from '@secureops/utils'
import { notFound, forbidden, badRequest } from '../lib/errors.js'
import { writeAuditLog } from '../lib/audit.js'

export const attendanceRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // Clock in — validates geofence server-side
  fastify.post('/clock-in', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE) forbidden()
    if (!employeeId) forbidden()

    const body = z.object({
      siteId: z.string().uuid(),
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number(),
      isMockLocation: z.boolean().default(false),
      shiftId: z.string().uuid().optional(),
      deviceId: z.string(),
    }).parse(req.body)

    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, body.siteId), eq(sites.tenantId, tenantId)),
    })
    if (!site) notFound('Site')

    // Geofence check
    const inGeofence = isWithinGeofence(body.lat, body.lng, site!.lat, site!.lng, site!.radiusMeters)
    if (!inGeofence) {
      const dist = Math.round(
        Math.sqrt(
          Math.pow((body.lat - site!.lat) * 111320, 2) +
          Math.pow((body.lng - site!.lng) * 111320, 2),
        ),
      )
      badRequest(`You are ${dist}m from the site. Must be within ${site!.radiusMeters}m to clock in.`)
    }

    // Check for existing open attendance today
    const today = new Date().toISOString().split('T')[0]!
    const existing = await db.query.attendances.findFirst({
      where: and(
        eq(attendances.employeeId, employeeId),
        eq(attendances.siteId, body.siteId),
        eq(attendances.date, today),
      ),
    })
    if (existing?.clockInTime && !existing.clockOutTime) {
      badRequest('Already clocked in. Please clock out first.')
    }

    const [attendance] = await db.insert(attendances).values({
      tenantId,
      employeeId,
      siteId: body.siteId,
      shiftId: body.shiftId,
      date: today,
      status: 'present',
      clockInTime: new Date(),
      clockInLat: body.lat,
      clockInLng: body.lng,
      clockInAccuracy: body.accuracy,
      verifiedInGeofence: inGeofence,
      isMockLocationFlagged: body.isMockLocation,
      deviceId: body.deviceId,
    }).returning()

    return reply.status(201).send({
      success: true,
      data: attendance,
      message: `Clock-in recorded at ${site!.name}`,
    })
  })

  // Clock out
  fastify.post('/clock-out', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE) forbidden()
    if (!employeeId) forbidden()

    const body = z.object({
      attendanceId: z.string().uuid(),
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number(),
    }).parse(req.body)

    const attendance = await db.query.attendances.findFirst({
      where: and(
        eq(attendances.id, body.attendanceId),
        eq(attendances.employeeId, employeeId),
        eq(attendances.tenantId, tenantId),
      ),
    })
    if (!attendance) notFound('Attendance record')
    if (attendance!.clockOutTime) badRequest('Already clocked out')

    const clockOutTime = new Date()
    const minutesWorked = Math.floor(
      (clockOutTime.getTime() - attendance!.clockInTime!.getTime()) / (1000 * 60),
    )
    const overtimeMinutes = Math.max(0, minutesWorked - 8 * 60)

    const [updated] = await db.update(attendances).set({
      clockOutTime,
      clockOutLat: body.lat,
      clockOutLng: body.lng,
      overtimeMinutes,
      updatedAt: new Date(),
    })
      .where(eq(attendances.id, body.attendanceId))
      .returning()

    return reply.send({
      success: true,
      data: updated,
      message: `Clock-out recorded. Total: ${Math.floor(minutesWorked / 60)}h ${minutesWorked % 60}m`,
    })
  })

  // Get my attendance
  fastify.get('/my', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE || !employeeId) forbidden()

    const query = req.query as { from?: string; to?: string }
    const conditions = [
      eq(attendances.employeeId, employeeId),
      eq(attendances.tenantId, tenantId),
    ]
    if (query.from) conditions.push(gte(attendances.date, query.from))
    if (query.to) conditions.push(lte(attendances.date, query.to))

    const rows = await db.select().from(attendances).where(and(...conditions))
    return { success: true, data: rows }
  })

  // Get attendance by site (supervisor/admin)
  fastify.get('/site/:siteId', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE || role === UserRole.CLIENT) forbidden()

    const { siteId } = req.params as { siteId: string }
    const query = req.query as { date?: string; from?: string; to?: string }

    const conditions = [
      eq(attendances.siteId, siteId),
      eq(attendances.tenantId, tenantId),
    ]
    if (query.date) conditions.push(eq(attendances.date, query.date))
    if (query.from) conditions.push(gte(attendances.date, query.from))
    if (query.to) conditions.push(lte(attendances.date, query.to))

    const rows = await db.select().from(attendances).where(and(...conditions))
    return { success: true, data: rows }
  })

  // Manual override by supervisor
  fastify.patch('/:id/override', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role, sub } = req.user
    const allowedRoles = [UserRole.SITE_SUPERVISOR, UserRole.OPERATIONS_MANAGER, UserRole.AGENCY_ADMIN, UserRole.SUPER_ADMIN]
    if (!allowedRoles.includes(role as UserRole)) forbidden()

    const { id } = req.params as { id: string }
    const body = z.object({
      status: z.enum(['present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekly_off']).optional(),
      clockInTime: z.string().optional(),
      clockOutTime: z.string().optional(),
      supervisorNote: z.string().min(5),
    }).parse(req.body)

    const existing = await db.query.attendances.findFirst({
      where: and(eq(attendances.id, id), eq(attendances.tenantId, tenantId)),
    })
    if (!existing) notFound('Attendance record')

    const [updated] = await db.update(attendances).set({
      ...(body.status ? { status: body.status } : {}),
      ...(body.clockInTime ? { clockInTime: new Date(body.clockInTime) } : {}),
      ...(body.clockOutTime ? { clockOutTime: new Date(body.clockOutTime) } : {}),
      supervisorNote: body.supervisorNote,
      overriddenBy: sub,
      updatedAt: new Date(),
    }).where(and(eq(attendances.id, id), eq(attendances.tenantId, tenantId))).returning()

    await writeAuditLog(db, {
      tenantId,
      userId: sub,
      action: 'UPDATE',
      tableName: 'attendances',
      recordId: id,
      oldValues: existing,
      newValues: body,
      ipAddress: req.ip,
    })

    return reply.send({ success: true, data: updated })
  })
}
