import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import sensible from '@fastify/sensible'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import authPlugin from './plugins/auth.js'
// Socket.IO (realtime) — enabled when ENABLE_REALTIME=true
// import realtimePlugin from './plugins/realtime.js'
import { authRoutes } from './routes/auth.js'
import { employeeRoutes } from './routes/employees.js'
import { clientRoutes } from './routes/clients.js'
import { siteRoutes } from './routes/sites.js'
import { shiftRoutes } from './routes/shifts.js'
import { attendanceRoutes } from './routes/attendance.js'
import { photoCheckinRoutes } from './routes/photo-checkins.js'
import { incidentRoutes } from './routes/incidents.js'
import { leaveRoutes } from './routes/leaves.js'
import { payrollRoutes } from './routes/payroll.js'
import { invoiceRoutes } from './routes/invoices.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { tenantRoutes } from './routes/tenants.js'
import { reportRoutes } from './routes/reports.js'
import { notificationRoutes } from './routes/notifications.js'
import { patrolRouteAPI } from './routes/patrol.js'

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] === 'development'
          ? { target: 'pino-pretty' }
          : undefined,
    },
    trustProxy: true,
  })

  await server.register(sensible)
  await server.register(helmet, { contentSecurityPolicy: false })
  await server.register(cors, {
    origin: [
      process.env['WEB_URL'] ?? 'http://localhost:3000',
      'http://localhost:3000',
    ],
    credentials: true,
  })
  await server.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  })
  await server.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  })

  if (process.env['NODE_ENV'] !== 'production') {
    await server.register(swagger, {
      openapi: {
        info: { title: 'SecureOps API', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    })
    await server.register(swaggerUi, { routePrefix: '/docs' })
  }

  await server.register(authPlugin)
  // await server.register(realtimePlugin)  // enable when Socket.IO is needed

  await server.register(authRoutes, { prefix: '/api/v1/auth' })
  await server.register(tenantRoutes, { prefix: '/api/v1/tenants' })
  await server.register(employeeRoutes, { prefix: '/api/v1/employees' })
  await server.register(clientRoutes, { prefix: '/api/v1/clients' })
  await server.register(siteRoutes, { prefix: '/api/v1/sites' })
  await server.register(shiftRoutes, { prefix: '/api/v1/shifts' })
  await server.register(attendanceRoutes, { prefix: '/api/v1/attendance' })
  await server.register(photoCheckinRoutes, { prefix: '/api/v1/photo-checkins' })
  await server.register(incidentRoutes, { prefix: '/api/v1/incidents' })
  await server.register(leaveRoutes, { prefix: '/api/v1/leaves' })
  await server.register(payrollRoutes, { prefix: '/api/v1/payroll' })
  await server.register(invoiceRoutes, { prefix: '/api/v1/invoices' })
  await server.register(dashboardRoutes, { prefix: '/api/v1/dashboard' })

  await server.register(reportRoutes, { prefix: '/api/v1/reports' })
  await server.register(notificationRoutes, { prefix: '/api/v1/notifications' })
  await server.register(patrolRouteAPI, { prefix: '/api/v1/patrol-routes' })

  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return server
}
