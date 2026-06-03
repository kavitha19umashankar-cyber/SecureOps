import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDb, incidents, incidentTimeline, sites, users } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { notFound, forbidden } from '../lib/errors.js'
import { emailService } from '../lib/email.js'

const createIncidentSchema = z.object({
  siteId: z.string().uuid(),
  category: z.enum(['theft','fire','medical','harassment','trespass','equipment_damage','fight','suspicious_activity','accident','other']),
  severity: z.enum(['low','medium','high','critical']),
  title: z.string().min(5),
  description: z.string().min(10),
  mediaUrls: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  occurredAt: z.string().optional(),
})

export const incidentRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role, clientId } = req.user
    const query = req.query as { siteId?: string; status?: string }

    const conditions = [eq(incidents.tenantId, tenantId)]
    if (query.siteId) conditions.push(eq(incidents.siteId, query.siteId))
    if (query.status) conditions.push(eq(incidents.status, query.status as 'raised'))
    if (role === UserRole.CLIENT) conditions.push(eq(incidents.clientVisible, true))

    const rows = await db.select().from(incidents).where(and(...conditions))
    return { success: true, data: rows }
  })

  fastify.get('/:id', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    const { id } = req.params as { id: string }

    const incident = await db.query.incidents.findFirst({
      where: and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)),
    })
    if (!incident) notFound('Incident')
    if (role === UserRole.CLIENT && !incident!.clientVisible) forbidden()

    const timeline = await db.select().from(incidentTimeline)
      .where(eq(incidentTimeline.incidentId, id))

    return { success: true, data: { ...incident, timeline } }
  })

  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, sub, role, employeeId, clientId } = req.user
    const body = createIncidentSchema.parse(req.body)

    // Verify access to site
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, body.siteId), eq(sites.tenantId, tenantId)),
    })
    if (!site) notFound('Site')
    if (role === UserRole.CLIENT && site!.clientId !== clientId) forbidden()

    const [incident] = await db.insert(incidents).values({
      tenantId,
      siteId: body.siteId,
      employeeId: role === UserRole.EMPLOYEE ? employeeId : undefined,
      reportedByClientId: role === UserRole.CLIENT ? clientId : undefined,
      category: body.category,
      severity: body.severity,
      title: body.title,
      description: body.description,
      mediaUrls: body.mediaUrls ?? [],
      lat: body.lat,
      lng: body.lng,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
      clientVisible: true,
    }).returning()

    // Add timeline entry
    await db.insert(incidentTimeline).values({
      incidentId: incident!.id,
      tenantId,
      action: 'RAISED',
      note: `Incident raised by ${role}`,
      performedBy: sub,
    })

    // Email notification to agency admins (fire-and-forget)
    if (body.severity === 'high' || body.severity === 'critical') {
      db.select({ email: users.email }).from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, 'agency_admin'), eq(users.isActive, true)))
        .limit(5)
        .then(admins => {
          const emails = admins.map(a => a.email).filter(Boolean) as string[]
          if (emails.length > 0) {
            emailService.incidentReported({
              to: emails, incidentTitle: body.title, category: body.category,
              severity: body.severity, siteName: site!.name,
            }).catch(console.error)
          }
        }).catch(console.error)
    }

    return reply.status(201).send({ success: true, data: incident })
  })

  // Update incident status
  fastify.patch('/:id/status', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role, sub } = req.user
    if ([UserRole.EMPLOYEE, UserRole.CLIENT].includes(role as UserRole)) forbidden()

    const { id } = req.params as { id: string }
    const body = z.object({
      status: z.enum(['acknowledged','under_investigation','resolved','escalated','closed']),
      note: z.string().optional(),
      correctiveAction: z.string().optional(),
      assignedTo: z.string().uuid().optional(),
    }).parse(req.body)

    const existing = await db.query.incidents.findFirst({
      where: and(eq(incidents.id, id), eq(incidents.tenantId, tenantId)),
    })
    if (!existing) notFound('Incident')

    const now = new Date()
    const [updated] = await db.update(incidents).set({
      status: body.status,
      ...(body.status === 'acknowledged' ? { acknowledgedAt: now } : {}),
      ...(body.status === 'resolved' || body.status === 'closed' ? { resolvedAt: now } : {}),
      ...(body.correctiveAction ? { correctiveAction: body.correctiveAction } : {}),
      ...(body.assignedTo ? { assignedTo: body.assignedTo } : {}),
      updatedAt: now,
    }).where(and(eq(incidents.id, id), eq(incidents.tenantId, tenantId))).returning()

    await db.insert(incidentTimeline).values({
      incidentId: id,
      tenantId,
      action: body.status.toUpperCase(),
      note: body.note,
      performedBy: sub,
    })

    return reply.send({ success: true, data: updated })
  })
}
