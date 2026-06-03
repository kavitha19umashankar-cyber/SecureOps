import type { FastifyPluginAsync } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { getDb, notifications } from '@secureops/db'

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, sub } = req.user
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, sub)))
      .orderBy(desc(notifications.createdAt))
      .limit(30)
    return { success: true, data: rows }
  })

  fastify.patch('/:id/read', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, sub } = req.user
    const { id } = req.params as { id: string }
    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, sub), eq(notifications.tenantId, tenantId)))
    return reply.send({ success: true })
  })

  fastify.patch('/read-all', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, sub } = req.user
    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.userId, sub)))
    return reply.send({ success: true })
  })
}
