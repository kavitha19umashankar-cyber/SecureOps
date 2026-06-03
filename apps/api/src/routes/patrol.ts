import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { getDb, patrolRoutes, patrolCheckpoints, patrolLogs, checkpointScans } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { notFound, forbidden } from '../lib/errors.js'
import { haversineDistance } from '@secureops/utils'

const MANAGER_ROLES = [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SITE_SUPERVISOR, UserRole.SUPER_ADMIN]

const checkpointSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(5).max(200).default(30),
  orderIndex: z.number().min(0).default(0),
})

export const patrolRouteAPI: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // List patrol routes for a site or all
  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId } = req.user
    const q = req.query as { siteId?: string }

    const conditions = [eq(patrolRoutes.tenantId, tenantId)]
    if (q.siteId) conditions.push(eq(patrolRoutes.siteId, q.siteId))

    const rows = await db.select().from(patrolRoutes).where(and(...conditions))
    return { success: true, data: rows }
  })

  // Get route with checkpoints
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId } = req.user
    const { id } = req.params as { id: string }

    const route = await db.query.patrolRoutes.findFirst({
      where: and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)),
    })
    if (!route) notFound('Patrol route')

    const checkpoints = await db.select().from(patrolCheckpoints)
      .where(and(eq(patrolCheckpoints.routeId, id), eq(patrolCheckpoints.tenantId, tenantId)))

    return { success: true, data: { ...route, checkpoints } }
  })

  // Create patrol route
  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()

    const body = z.object({
      siteId: z.string().uuid(),
      name: z.string().min(2),
      description: z.string().optional(),
      estimatedDurationMinutes: z.number().min(5).default(60),
      checkpoints: z.array(checkpointSchema).optional(),
    }).parse(req.body)

    const { checkpoints: cps, ...routeData } = body
    const [route] = await db.insert(patrolRoutes).values({ tenantId, ...routeData }).returning()

    if (cps && cps.length > 0) {
      await db.insert(patrolCheckpoints).values(
        cps.map((cp, i) => ({ ...cp, routeId: route!.id, tenantId, orderIndex: i })),
      )
    }

    return reply.status(201).send({ success: true, data: route })
  })

  // Update patrol route
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()
    const { id } = req.params as { id: string }

    const body = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      estimatedDurationMinutes: z.number().min(5).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body)

    const [updated] = await db.update(patrolRoutes)
      .set(body)
      .where(and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)))
      .returning()
    if (!updated) notFound('Patrol route')
    return reply.send({ success: true, data: updated })
  })

  // Delete patrol route
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()
    const { id } = req.params as { id: string }
    await db.delete(patrolRoutes).where(and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)))
    return reply.send({ success: true })
  })

  // Add checkpoint to route
  fastify.post('/:id/checkpoints', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()
    const { id } = req.params as { id: string }

    const route = await db.query.patrolRoutes.findFirst({
      where: and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)),
    })
    if (!route) notFound('Patrol route')

    const body = checkpointSchema.parse(req.body)
    const [cp] = await db.insert(patrolCheckpoints)
      .values({ ...body, routeId: id, tenantId })
      .returning()
    return reply.status(201).send({ success: true, data: cp })
  })

  // Delete checkpoint
  fastify.delete('/:id/checkpoints/:cpId', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()
    const { cpId } = req.params as { id: string; cpId: string }
    await db.delete(patrolCheckpoints)
      .where(and(eq(patrolCheckpoints.id, cpId), eq(patrolCheckpoints.tenantId, tenantId)))
    return reply.send({ success: true })
  })

  // Start a patrol log
  fastify.post('/:id/logs', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId } = req.user
    if (!employeeId) forbidden()
    const { id } = req.params as { id: string }

    const route = await db.query.patrolRoutes.findFirst({
      where: and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)),
    })
    if (!route) notFound('Patrol route')

    const totalCheckpoints = await db.select().from(patrolCheckpoints)
      .where(eq(patrolCheckpoints.routeId, id))

    const [log] = await db.insert(patrolLogs).values({
      routeId: id,
      tenantId,
      employeeId: employeeId!,
      status: 'in_progress',
      startedAt: new Date(),
      totalCheckpoints: totalCheckpoints.length,
    }).returning()

    return reply.status(201).send({ success: true, data: log })
  })

  // Scan checkpoint during patrol
  fastify.post('/:id/logs/:logId/scans', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId } = req.user
    if (!employeeId) forbidden()
    const { logId } = req.params as { id: string; logId: string }

    const body = z.object({
      checkpointId: z.string().uuid(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      notes: z.string().optional(),
    }).parse(req.body)

    const checkpoint = await db.query.patrolCheckpoints.findFirst({
      where: and(eq(patrolCheckpoints.id, body.checkpointId), eq(patrolCheckpoints.tenantId, tenantId)),
    })
    if (!checkpoint) notFound('Checkpoint')

    let isInRadius = false
    if (body.lat !== undefined && body.lng !== undefined) {
      const dist = haversineDistance(body.lat, body.lng, checkpoint!.lat, checkpoint!.lng)
      isInRadius = dist <= checkpoint!.radiusMeters
    }

    const [scan] = await db.insert(checkpointScans).values({
      logId,
      checkpointId: body.checkpointId,
      tenantId,
      employeeId: employeeId!,
      lat: body.lat,
      lng: body.lng,
      isInRadius,
      notes: body.notes,
    }).returning()

    // Update scanned count
    const scanned = await db.select().from(checkpointScans).where(eq(checkpointScans.logId, logId))
    const log = await db.query.patrolLogs.findFirst({ where: eq(patrolLogs.id, logId) })

    const isDone = scanned.length >= (log?.totalCheckpoints ?? 0)
    await db.update(patrolLogs).set({
      scannedCheckpoints: scanned.length,
      ...(isDone ? { status: 'completed', completedAt: new Date() } : {}),
    }).where(eq(patrolLogs.id, logId))

    return reply.status(201).send({ success: true, data: scan })
  })

  // List patrol logs for a route
  fastify.get('/:id/logs', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId } = req.user
    const { id } = req.params as { id: string }

    const logs = await db.select().from(patrolLogs)
      .where(and(eq(patrolLogs.routeId, id), eq(patrolLogs.tenantId, tenantId)))
      .orderBy(desc(patrolLogs.createdAt))
      .limit(50)

    return { success: true, data: logs }
  })
}
