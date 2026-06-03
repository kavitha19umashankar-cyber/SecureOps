import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Server as SocketIOServer } from 'socket.io'
import { verifyAccessToken } from '@secureops/auth'

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer
  }
}

const realtimePlugin: FastifyPluginAsync = async (fastify) => {
  const io = new SocketIOServer({
    cors: {
      origin: process.env['WEB_URL'] ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
  })

  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    const token = (socket.handshake.auth as Record<string, string>)['token']
    if (!token) return next(new Error('Authentication required'))
    const secret = process.env['JWT_SECRET']
    if (!secret) return next(new Error('Server misconfigured'))
    try {
      const payload = verifyAccessToken(token, secret)
      socket.data['user'] = payload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data['user'] as { tenantId: string; sub: string; role: string }

    socket.on('location:ping', (data: { siteId: string; lat: number; lng: number; employeeName: string }) => {
      // Broadcast live location to ops dashboard watchers
      io.to(`tenant:${user.tenantId}`).emit('guard:location', { ...data, userId: user.sub })
    })

    socket.on('watch:tenant', () => {
      socket.join(`tenant:${user.tenantId}`)
    })

    socket.on('watch:site', (siteId: string) => {
      socket.join(`tenant:${user.tenantId}:site:${siteId}`)
    })

    socket.on('disconnect', () => {
      fastify.log.debug(`Socket disconnected: ${user.sub}`)
    })
  })

  fastify.decorate('io', io)

  // Attach after server is ready
  fastify.addHook('onReady', async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      io.attach(fastify.server as any)
      fastify.log.info('Socket.IO attached to HTTP server on /socket.io/')
    } catch (err) {
      fastify.log.warn({ err }, 'Socket.IO attach failed — realtime disabled')
    }
  })

  // Clean up on close
  fastify.addHook('onClose', async () => {
    io.close()
  })
}

export default fp(realtimePlugin, { name: 'realtime' })
