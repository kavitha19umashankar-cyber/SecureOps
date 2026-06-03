import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { getDb, users, tenants, otpTokens, refreshTokens } from '@secureops/db'
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  createTokenPair,
  verifyRefreshToken,
} from '@secureops/auth'
import { UserRole } from '@secureops/types'
import { notFound, unauthorized, badRequest } from '../lib/errors.js'

const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().optional(),
  otp: z.string().length(6).optional(),
  tenantSubdomain: z.string().optional(),
})

const otpRequestSchema = z.object({
  phone: z.string().min(10),
  tenantSubdomain: z.string(),
})

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getDb()
  const tokenConfig = {
    jwtSecret: process.env['JWT_SECRET']!,
    jwtRefreshSecret: process.env['JWT_REFRESH_SECRET']!,
    accessExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  }

  // Email/password login (for agency staff via web dashboard)
  fastify.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body)

    if (!body.email || !body.password) {
      badRequest('Email and password are required')
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email!),
    })

    if (!user || !user.passwordHash) {
      unauthorized('Invalid credentials')
    }

    const valid = await verifyPassword(body.password!, user!.passwordHash!)
    if (!valid) unauthorized('Invalid credentials')

    if (!user!.isActive) unauthorized('Account is disabled')

    const tokens = createTokenPair(
      {
        sub: user!.id,
        tenantId: user!.tenantId ?? 'super',
        role: user!.role as UserRole,
        employeeId: user!.employeeId ?? undefined,
        clientId: user!.clientId ?? undefined,
      },
      tokenConfig,
    )

    await db.insert(refreshTokens).values({
      userId: user!.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    return reply.send({
      success: true,
      data: {
        tokens,
        user: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          role: user!.role,
          tenantId: user!.tenantId,
        },
      },
    })
  })

  // Send OTP (for mobile employee login)
  fastify.post('/otp/send', async (req, reply) => {
    const body = otpRequestSchema.parse(req.body)

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.subdomain, body.tenantSubdomain),
    })
    if (!tenant) notFound('Tenant')

    const user = await db.query.users.findFirst({
      where: and(eq(users.phone, body.phone), eq(users.tenantId, tenant!.id)),
    })
    if (!user) notFound('User')

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)  // 10 minutes

    await db.insert(otpTokens).values({
      phone: body.phone,
      tenantId: tenant!.id,
      otp,
      expiresAt,
    })

    // TODO: Send OTP via MSG91
    fastify.log.info({ phone: body.phone, otp }, 'OTP generated')

    return reply.send({ success: true, message: 'OTP sent successfully' })
  })

  // Verify OTP and issue tokens
  fastify.post('/otp/verify', async (req, reply) => {
    const body = z.object({ phone: z.string(), otp: z.string(), tenantSubdomain: z.string() }).parse(req.body)

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.subdomain, body.tenantSubdomain),
    })
    if (!tenant) notFound('Tenant')

    const otpRecord = await db.query.otpTokens.findFirst({
      where: and(
        eq(otpTokens.phone, body.phone),
        eq(otpTokens.otp, body.otp),
        eq(otpTokens.tenantId, tenant!.id),
      ),
    })

    if (!otpRecord || otpRecord.usedAt || otpRecord.expiresAt < new Date()) {
      unauthorized('Invalid or expired OTP')
    }

    await db.update(otpTokens)
      .set({ usedAt: new Date() })
      .where(eq(otpTokens.id, otpRecord!.id))

    const user = await db.query.users.findFirst({
      where: and(eq(users.phone, body.phone), eq(users.tenantId, tenant!.id)),
    })
    if (!user) notFound('User')

    const tokens = createTokenPair(
      {
        sub: user!.id,
        tenantId: user!.tenantId ?? tenant!.id,
        role: user!.role as UserRole,
        employeeId: user!.employeeId ?? undefined,
      },
      tokenConfig,
    )

    await db.insert(refreshTokens).values({
      userId: user!.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    return reply.send({
      success: true,
      data: {
        tokens,
        user: {
          id: user!.id,
          name: user!.name,
          phone: user!.phone,
          role: user!.role,
          tenantId: user!.tenantId,
          employeeId: user!.employeeId,
        },
      },
    })
  })

  // Refresh token
  fastify.post('/refresh', async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)

    let decoded: { sub: string; tenantId: string }
    try {
      decoded = verifyRefreshToken(refreshToken, tokenConfig.jwtRefreshSecret)
    } catch {
      unauthorized('Invalid refresh token')
    }

    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, refreshToken),
    })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      unauthorized('Refresh token is invalid or expired')
    }

    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored!.id))

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded!.sub),
    })
    if (!user || !user.isActive) unauthorized('User not found or disabled')

    const tokens = createTokenPair(
      {
        sub: user!.id,
        tenantId: user!.tenantId ?? decoded!.tenantId,
        role: user!.role as UserRole,
        employeeId: user!.employeeId ?? undefined,
      },
      tokenConfig,
    )

    await db.insert(refreshTokens).values({
      userId: user!.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    return reply.send({ success: true, data: { tokens } })
  })

  // Logout — revoke refresh token
  fastify.post('/logout', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)

    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.token, refreshToken))

    return reply.send({ success: true })
  })

  // Get current user
  fastify.get('/me', { preHandler: fastify.authenticate }, async (req, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.sub),
    })
    if (!user) notFound('User')

    return reply.send({ success: true, data: user })
  })

  // Update profile (name, email, phone)
  fastify.patch('/profile', { preHandler: fastify.authenticate }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }).parse(req.body)

    const [updated] = await db.update(users)
      .set(body)
      .where(eq(users.id, req.user.sub))
      .returning()

    return reply.send({
      success: true,
      data: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, role: updated.role, tenantId: updated.tenantId },
    })
  })

  // Change password
  fastify.post('/change-password', { preHandler: fastify.authenticate }, async (req, reply) => {
    const body = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }).parse(req.body)

    const user = await db.query.users.findFirst({ where: eq(users.id, req.user.sub) })
    if (!user || !user.passwordHash) unauthorized('No password set for this account')

    const valid = await verifyPassword(body.currentPassword, user!.passwordHash!)
    if (!valid) unauthorized('Current password is incorrect')

    const newHash = await hashPassword(body.newPassword)
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, req.user.sub))

    return reply.send({ success: true, message: 'Password updated successfully' })
  })
}
