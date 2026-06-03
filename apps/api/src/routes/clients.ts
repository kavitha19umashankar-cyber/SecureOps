import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { getDb, clients } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { notFound, forbidden } from '../lib/errors.js'

const clientSchema = z.object({
  name: z.string().min(2),
  gstNumber: z.string().optional(),
  billingAddress: z.string().min(5),
  billingState: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  contactPersonName: z.string().optional(),
})

const ALLOWED_ROLES = [
  UserRole.AGENCY_ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SUPER_ADMIN,
]

export const clientRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (!ALLOWED_ROLES.includes(role as UserRole)) forbidden()

    const rows = await db.select().from(clients).where(eq(clients.tenantId, tenantId))
    return { success: true, data: rows }
  })

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user
    const { id } = req.params as { id: string }

    // Clients can only view their own record
    if (role === UserRole.CLIENT && clientId !== id) forbidden()

    const client = await db.query.clients.findFirst({
      where: and(eq(clients.id, id), eq(clients.tenantId, tenantId)),
    })
    if (!client) notFound('Client')

    return { success: true, data: client }
  })

  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!ALLOWED_ROLES.includes(role as UserRole)) forbidden()

    const body = clientSchema.parse(req.body)
    const [created] = await db.insert(clients).values({ tenantId, ...body }).returning()

    return reply.status(201).send({ success: true, data: created })
  })

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!ALLOWED_ROLES.includes(role as UserRole)) forbidden()

    const { id } = req.params as { id: string }
    const body = clientSchema.partial().parse(req.body)

    const [updated] = await db.update(clients)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning()

    if (!updated) notFound('Client')
    return reply.send({ success: true, data: updated })
  })

  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (role !== UserRole.AGENCY_ADMIN && role !== UserRole.SUPER_ADMIN) forbidden()

    const { id } = req.params as { id: string }
    await db.update(clients)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))

    return reply.send({ success: true })
  })
}
