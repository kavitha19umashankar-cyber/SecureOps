import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb, tenants, users } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { hashPassword } from '@secureops/auth'
import { forbidden, notFound, conflict } from '../lib/errors.js'

export const tenantRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  // Super admin only — list all tenants
  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    if (req.user.role !== UserRole.SUPER_ADMIN) forbidden()

    const rows = await db.select().from(tenants)
    return { success: true, data: rows }
  })

  // Create a new agency tenant (super admin provisions)
  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    if (req.user.role !== UserRole.SUPER_ADMIN) forbidden()

    const body = z.object({
      name: z.string().min(2),
      subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/),
      plan: z.enum(['trial', 'starter', 'growth', 'business', 'enterprise']).default('trial'),
      adminName: z.string(),
      adminEmail: z.string().email(),
      adminPassword: z.string().min(8),
      adminPhone: z.string().optional(),
      gstNumber: z.string().optional(),
      address: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
    }).parse(req.body)

    const existing = await db.query.tenants.findFirst({ where: eq(tenants.subdomain, body.subdomain) })
    if (existing) conflict('Subdomain is already taken')

    const [tenant] = await db.insert(tenants).values({
      name: body.name,
      subdomain: body.subdomain,
      plan: body.plan as 'starter',
      status: 'trial',
      gstNumber: body.gstNumber,
      address: body.address,
      contactEmail: body.contactEmail ?? body.adminEmail,
      contactPhone: body.contactPhone ?? body.adminPhone,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    }).returning()

    const passwordHash = await hashPassword(body.adminPassword)
    const [adminUser] = await db.insert(users).values({
      tenantId: tenant!.id,
      role: 'agency_admin',
      name: body.adminName,
      email: body.adminEmail,
      phone: body.adminPhone,
      passwordHash,
      isActive: true,
    }).returning()

    return reply.status(201).send({
      success: true,
      data: { tenant, adminUser: { ...adminUser, passwordHash: undefined } },
    })
  })

  // Get tenant details (own tenant or super admin)
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { role, tenantId } = req.user
    const { id } = req.params as { id: string }

    if (role !== UserRole.SUPER_ADMIN && tenantId !== id) forbidden()

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) })
    if (!tenant) notFound('Tenant')

    return { success: true, data: tenant }
  })

  // Update tenant status (super admin)
  fastify.patch('/:id/status', { preHandler: fastify.authenticate }, async (req, reply) => {
    if (req.user.role !== UserRole.SUPER_ADMIN) forbidden()

    const { id } = req.params as { id: string }
    const { status } = z.object({ status: z.enum(['active', 'suspended', 'cancelled']) }).parse(req.body)

    const [updated] = await db.update(tenants)
      .set({ status, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning()

    if (!updated) notFound('Tenant')
    return reply.send({ success: true, data: updated })
  })
}
