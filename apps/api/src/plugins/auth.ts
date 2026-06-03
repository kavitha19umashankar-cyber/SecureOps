import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { verifyAccessToken } from '@secureops/auth'
import type { JwtPayload } from '@secureops/types'
import { UserRole } from '@secureops/types'

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>
    requireRole: (...roles: UserRole[]) => (req: FastifyRequest) => Promise<void>
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET is not set')

  fastify.decorate('authenticate', async (req: FastifyRequest) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      const err = Object.assign(new Error('Missing or invalid Authorization header'), { statusCode: 401 })
      throw err
    }

    const token = header.slice(7)
    try {
      req.user = verifyAccessToken(token, secret)
    } catch {
      const err = Object.assign(new Error('Invalid or expired token'), { statusCode: 401 })
      throw err
    }
  })

  fastify.decorate('requireRole', (...roles: UserRole[]) => {
    return async (req: FastifyRequest) => {
      await fastify.authenticate(req)
      if (!roles.includes(req.user.role)) {
        const err = Object.assign(new Error('Insufficient permissions'), { statusCode: 403 })
        throw err
      }
    }
  })
}

// fp wrapping ensures decorators are accessible in parent/sibling scopes
export default fp(authPlugin, { name: 'auth' })
