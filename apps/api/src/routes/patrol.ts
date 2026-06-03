import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { getDb, patrolRoutes, patrolLogs } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { notFound, forbidden } from '../lib/errors.js'
import { haversineDistance } from '@secureops/utils'

const MANAGER_ROLES = [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SITE_SUPERVISOR, UserRole.SUPER_ADMIN]

const checkpointSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  qrCode: z.string().optional(),
  nfcTagId: z.string().optional(),
  expectedMinuteFromStart: z.number().min(0).default(0),
  order: z.number().min(0).default(0),
})

export const patrolRouteAPI: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // List patrol routes
  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId } = req.user
    const q = req.query as { siteId?: string }
    const conditions = [eq(patrolRoutes.tenantId, tenantId)]
    if (q.siteId) conditions.push(eq(patrolRoutes.siteId, q.siteId))
    const rows = await db.select().from(patrolRoutes).where(and(...conditions))
    return { success: true, data: rows }
  })

  // Get single route
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId } = req.user
    const { id } = req.params as { id: string }
    const route = await db.query.patrolRoutes.findFirst({
      where: and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)),
    })
    if (!route) notFound('Patrol route')
    return { success: true, data: route }
  })

  // Create route
  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()

    const body = z.object({
      siteId: z.string().uuid(),
      name: z.string().min(2),
      checkpoints: z.array(checkpointSchema).optional().default([]),
      isActive: z.boolean().optional().default(true),
    }).parse(req.body)

    const checkpointsWithIds = (body.checkpoints ?? []).map((cp, i) => ({
      ...cp,
      id: cp.id ?? crypto.randomUUID(),
      order: cp.order ?? i,
    }))

    const [route] = await db.insert(patrolRoutes).values({
      tenantId,
      siteId: body.siteId,
      name: body.name,
      checkpoints: checkpointsWithIds,
      isActive: body.isActive,
    }).returning()

    return reply.status(201).send({ success: true, data: route })
  })

  // Update route
  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()
    const { id } = req.params as { id: string }

    const body = z.object({
      name: z.string().min(2).optional(),
      checkpoints: z.array(checkpointSchema).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body)

    const setValues: Record<string, unknown> = {}
    if (body.name !== undefined) setValues['name'] = body.name
    if (body.isActive !== undefined) setValues['isActive'] = body.isActive
    if (body.checkpoints !== undefined) setValues['checkpoints'] = body.checkpoints

    const [updated] = await db.update(patrolRoutes)
      .set(setValues as never)
      .where(and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)))
      .returning()
    if (!updated) notFound('Patrol route')
    return reply.send({ success: true, data: updated })
  })

  // Delete route
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
    const newCheckpoint = { ...body, id: crypto.randomUUID(), order: (route!.checkpoints?.length ?? 0) }
    const updated = [...(route!.checkpoints ?? []), newCheckpoint]

    const [saved] = await db.update(patrolRoutes)
      .set({ checkpoints: updated })
      .where(eq(patrolRoutes.id, id))
      .returning()

    return reply.status(201).send({ success: true, data: newCheckpoint, route: saved })
  })

  // Remove checkpoint
  fastify.delete('/:id/checkpoints/:cpId', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!MANAGER_ROLES.includes(role as UserRole)) forbidden()
    const { id, cpId } = req.params as { id: string; cpId: string }

    const route = await db.query.patrolRoutes.findFirst({
      where: and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)),
    })
    if (!route) notFound('Patrol route')

    const filtered = (route!.checkpoints ?? []).filter(cp => cp.id !== cpId)
    await db.update(patrolRoutes).set({ checkpoints: filtered }).where(eq(patrolRoutes.id, id))
    return reply.send({ success: true })
  })

  // Start patrol log (mobile — employee starts a patrol)
  fastify.post('/:id/logs', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId } = req.user
    if (!employeeId) forbidden()
    const { id } = req.params as { id: string }

    const route = await db.query.patrolRoutes.findFirst({
      where: and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)),
    })
    if (!route) notFound('Patrol route')

    const [log] = await db.insert(patrolLogs).values({
      tenantId,
      employeeId: employeeId!,
      routeId: id,
      startedAt: new Date(),
      checkpointsVisited: [],
      completionRate: 0,
    }).returning()

    return reply.status(201).send({ success: true, data: log })
  })

  // Scan checkpoint (mobile — employee scans a checkpoint)
  fastify.post('/:id/logs/:logId/scans', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId } = req.user
    if (!employeeId) forbidden()
    const { id, logId } = req.params as { id: string; logId: string }

    const body = z.object({
      checkpointId: z.string(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }).parse(req.body)

    const route = await db.query.patrolRoutes.findFirst({
      where: and(eq(patrolRoutes.id, id), eq(patrolRoutes.tenantId, tenantId)),
    })
    if (!route) notFound('Patrol route')

    const checkpoint = route!.checkpoints?.find(cp => cp.id === body.checkpointId)
    if (!checkpoint) notFound('Checkpoint')

    let onTime = true
    if (body.lat !== undefined && body.lng !== undefined && checkpoint!.lat && checkpoint!.lng) {
      const dist = haversineDistance(body.lat, body.lng, checkpoint!.lat, checkpoint!.lng)
      onTime = dist <= 50
    }

    const log = await db.query.patrolLogs.findFirst({ where: eq(patrolLogs.id, logId) })
    if (!log) notFound('Patrol log')

    const visited = [...(log!.checkpointsVisited ?? []), {
      checkpointId: body.checkpointId,
      scannedAt: new Date().toISOString(),
      lat: body.lat, lng: body.lng,
      onTime,
    }]

    const totalCheckpoints = route!.checkpoints?.length ?? 1
    const completionRate = visited.length / totalCheckpoints
    const isComplete = completionRate >= 1

    await db.update(patrolLogs).set({
      checkpointsVisited: visited,
      completionRate,
      ...(isComplete ? { completedAt: new Date() } : {}),
    }).where(eq(patrolLogs.id, logId))

    return reply.status(201).send({ success: true, data: { checkpointId: body.checkpointId, onTime, completionRate } })
  })

  // Get patrol logs for a route
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
