import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDb, leaves } from '@secureops/db'
import { UserRole } from '@secureops/types'
import { notFound, forbidden } from '../lib/errors.js'

export const leaveRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()

  fastify.get('/my', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE || !employeeId) forbidden()

    const rows = await db.select().from(leaves)
      .where(and(eq(leaves.employeeId, employeeId), eq(leaves.tenantId, tenantId)))

    return { success: true, data: rows }
  })

  fastify.get('/', { preHandler: fastify.authenticate }, async (req) => {
    const { tenantId, role } = req.user
    if (role === UserRole.EMPLOYEE || role === UserRole.CLIENT) forbidden()

    const query = req.query as { employeeId?: string; status?: string }
    const conditions = [eq(leaves.tenantId, tenantId)]
    if (query.employeeId) conditions.push(eq(leaves.employeeId, query.employeeId))
    if (query.status) conditions.push(eq(leaves.status, query.status as 'pending'))

    const rows = await db.select().from(leaves).where(and(...conditions))
    return { success: true, data: rows }
  })

  fastify.post('/', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE || !employeeId) forbidden()

    const body = z.object({
      leaveType: z.enum(['earned_leave','casual_leave','sick_leave','loss_of_pay','weekly_off','public_holiday']),
      fromDate: z.string(),
      toDate: z.string(),
      reason: z.string().min(5),
    }).parse(req.body)

    const from = new Date(body.fromDate)
    const to = new Date(body.toDate)
    const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const [leave] = await db.insert(leaves).values({
      tenantId,
      employeeId,
      ...body,
      days,
    }).returning()

    return reply.status(201).send({ success: true, data: leave })
  })

  // Cancel own leave (employee)
  fastify.patch('/:id/cancel', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, employeeId, role } = req.user
    if (role !== UserRole.EMPLOYEE || !employeeId) forbidden()
    const { id } = req.params as { id: string }

    const leave = await db.query.leaves.findFirst({
      where: and(eq(leaves.id, id), eq(leaves.employeeId, employeeId), eq(leaves.tenantId, tenantId)),
    })
    if (!leave) notFound('Leave')
    if (leave!.status !== 'pending') forbidden()

    const [updated] = await db.update(leaves).set({ status: 'cancelled' })
      .where(eq(leaves.id, id)).returning()
    return reply.send({ success: true, data: updated })
  })

  fastify.patch('/:id/approve', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { tenantId, role, sub } = req.user
    const allowed = [UserRole.SITE_SUPERVISOR, UserRole.HR_MANAGER, UserRole.AGENCY_ADMIN, UserRole.SUPER_ADMIN]
    if (!allowed.includes(role as UserRole)) forbidden()

    const { id } = req.params as { id: string }
    const body = z.object({
      status: z.enum(['approved', 'rejected']),
      rejectionReason: z.string().optional(),
      substituteEmployeeId: z.string().uuid().optional(),
    }).parse(req.body)

    const [updated] = await db.update(leaves).set({
      status: body.status,
      approvedBy: sub,
      approvedAt: new Date(),
      rejectionReason: body.rejectionReason,
      substituteEmployeeId: body.substituteEmployeeId,
    }).where(and(eq(leaves.id, id), eq(leaves.tenantId, tenantId))).returning()

    if (!updated) notFound('Leave')
    return reply.send({ success: true, data: updated })
  })
}
