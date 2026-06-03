import type { FastifyPluginAsync } from 'fastify'
import { eq, and, gte } from 'drizzle-orm'
import { getDb, photoCheckins, sites } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { uploadFile, fileUrl } from '../lib/storage.js'
import { notFound, forbidden, badRequest } from '../lib/errors.js'

export const photoCheckinRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // Submit photo check-in (employee)
  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE || !employeeId) forbidden()

    const query = req.query as { siteId: string; shiftId?: string; lat?: string; lng?: string; intervalNumber?: string }
    if (!query.siteId) badRequest('siteId is required')

    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, query.siteId), eq(sites.tenantId, tenantId)),
    })
    if (!site) notFound('Site')

    const data = await req.file()
    if (!data) badRequest('No photo uploaded')

    // Ensure it is an image
    if (!data!.mimetype.startsWith('image/')) badRequest('Only image files are accepted')

    const buffer = await data!.toBuffer()
    const key = await uploadFile(tenantId, `photo-checkins/${query.siteId}`, data!.filename, buffer, data!.mimetype)

    const capturedAt = new Date()
    const intervalNum = Number(query.intervalNumber ?? 1)

    // Check if this interval was already submitted in the last 30 minutes (duplicate guard)
    const thirtyMinAgo = new Date(capturedAt.getTime() - 30 * 60 * 1000)
    const recent = await db.query.photoCheckins.findFirst({
      where: and(
        eq(photoCheckins.employeeId, employeeId),
        eq(photoCheckins.siteId, query.siteId),
        gte(photoCheckins.capturedAt, thirtyMinAgo),
      ),
    })
    if (recent) badRequest('Photo check-in already submitted recently. Wait before submitting again.')

    const intervalMinutes = site!.photoCheckinIntervalMinutes
    const minutesSinceLastExpected = (capturedAt.getMinutes() + capturedAt.getHours() * 60) % intervalMinutes
    const isLate = minutesSinceLastExpected > 10  // 10-minute grace period

    const [checkin] = await db.insert(photoCheckins).values({
      tenantId,
      employeeId,
      siteId: query.siteId,
      shiftId: query.shiftId,
      photoUrl: key,
      capturedAt,
      lat: query.lat ? parseFloat(query.lat) : undefined,
      lng: query.lng ? parseFloat(query.lng) : undefined,
      isLate,
      isLiveCaptured: true,
      intervalNumber: intervalNum,
    }).returning()

    return reply.status(201).send({
      success: true,
      data: { ...checkin!, photoUrl: fileUrl(key) },
    })
  })

  // List photo check-ins for a site (supervisor/admin/client)
  fastify.get('/site/:siteId', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user
    const { siteId } = req.params as { siteId: string }

    if (role === UserRole.EMPLOYEE) forbidden()

    // Clients can only see their own sites
    if (role === UserRole.CLIENT) {
      const site = await db.query.sites.findFirst({
        where: and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)),
      })
      if (!site || site.clientId !== clientId) forbidden()
    }

    const query = req.query as { date?: string }
    const conditions = [eq(photoCheckins.siteId, siteId), eq(photoCheckins.tenantId, tenantId)]
    if (query.date) {
      const start = new Date(query.date + 'T00:00:00Z')
      conditions.push(gte(photoCheckins.capturedAt, start))
    }

    const rows = await db.select().from(photoCheckins).where(and(...conditions))
    return { success: true, data: rows.map((r) => ({ ...r, photoUrl: fileUrl(r.photoUrl) })) }
  })

  // Get my photo check-ins
  fastify.get('/my', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE || !employeeId) forbidden()

    const query = req.query as { date?: string }
    const conditions = [eq(photoCheckins.employeeId, employeeId), eq(photoCheckins.tenantId, tenantId)]
    if (query.date) {
      const start = new Date(query.date + 'T00:00:00Z')
      conditions.push(gte(photoCheckins.capturedAt, start))
    }

    const rows = await db.select().from(photoCheckins).where(and(...conditions))
    return { success: true, data: rows.map((r) => ({ ...r, photoUrl: fileUrl(r.photoUrl) })) }
  })
}
