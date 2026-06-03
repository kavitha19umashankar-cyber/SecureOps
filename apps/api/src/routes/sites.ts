import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDb, sites, contracts } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { notFound, forbidden } from '../lib/errors.js'

const siteSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(2),
  address: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(50).max(1000).default(100),
  siteType: z.enum(['office','factory','hospital','mall','residential','educational','warehouse','bank','hotel','other']).default('office'),
  postOrders: z.string().optional(),
  photoCheckinIntervalMinutes: z.number().min(30).max(480).default(120),
  emergencyContacts: z.array(z.object({
    name: z.string(),
    phone: z.string(),
    role: z.string(),
  })).optional(),
})

const contractSchema = z.object({
  startDate: z.string(),
  endDate: z.string().optional(),
  billingRatePerDay: z.number().positive(),
  overtimeBillingRate: z.number().positive().optional(),
  currency: z.string().default('INR'),
  requiredHeadcount: z.number().min(1).default(1),
  agencyState: z.string().optional(),
})

const ALLOWED_ROLES = [
  UserRole.AGENCY_ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.SUPER_ADMIN,
]

export const siteRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user

    let rows
    if (role === UserRole.CLIENT) {
      // Client sees only their sites
      rows = await db.select().from(sites)
        .where(and(eq(sites.tenantId, tenantId), eq(sites.clientId, clientId!)))
    } else {
      const query = req.query as { clientId?: string }
      const conditions = [eq(sites.tenantId, tenantId)]
      if (query.clientId) conditions.push(eq(sites.clientId, query.clientId))
      rows = await db.select().from(sites).where(and(...conditions))
    }

    return { success: true, data: rows }
  })

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user
    const { id } = req.params as { id: string }

    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, id), eq(sites.tenantId, tenantId)),
    })
    if (!site) notFound('Site')

    if (role === UserRole.CLIENT && site!.clientId !== clientId) forbidden()

    return { success: true, data: site }
  })

  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!ALLOWED_ROLES.includes(role as UserRole)) forbidden()

    const body = siteSchema.parse(req.body)
    const [created] = await db.insert(sites).values({
      tenantId,
      ...body,
      photoUrls: [],
      emergencyContacts: body.emergencyContacts ?? [],
    }).returning()

    return reply.status(201).send({ success: true, data: created })
  })

  fastify.patch('/:id', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!ALLOWED_ROLES.includes(role as UserRole)) forbidden()

    const { id } = req.params as { id: string }
    const body = siteSchema.partial().parse(req.body)

    const [updated] = await db.update(sites)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(sites.id, id), eq(sites.tenantId, tenantId)))
      .returning()

    if (!updated) notFound('Site')
    return reply.send({ success: true, data: updated })
  })

  // Add/update contract for a site
  fastify.post('/:siteId/contracts', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role } = req.user
    if (!ALLOWED_ROLES.includes(role as UserRole)) forbidden()

    const { siteId } = req.params as { siteId: string }
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)),
    })
    if (!site) notFound('Site')

    const body = contractSchema.parse(req.body)
    const [created] = await db.insert(contracts).values({
      tenantId,
      siteId,
      clientId: site!.clientId,
      ...body,
      billingRatePerDay: String(body.billingRatePerDay),
      overtimeBillingRate: body.overtimeBillingRate != null ? String(body.overtimeBillingRate) : undefined,
    }).returning()

    return reply.status(201).send({ success: true, data: created })
  })

  // Get contracts for a site
  fastify.get('/:siteId/contracts', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    const { siteId } = req.params as { siteId: string }

    const rows = await db.select().from(contracts)
      .where(and(eq(contracts.siteId, siteId), eq(contracts.tenantId, tenantId)))

    return { success: true, data: rows }
  })
}
