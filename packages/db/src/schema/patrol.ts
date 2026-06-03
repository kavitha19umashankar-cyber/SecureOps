import { pgTable, uuid, varchar, text, timestamp, boolean, integer, real, pgEnum } from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'
import { sites } from './sites.js'
import { employees } from './employees.js'

export const patrolStatusEnum = pgEnum('patrol_status', ['pending', 'in_progress', 'completed', 'missed'])

export const patrolRoutes = pgTable('patrol_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  estimatedDurationMinutes: integer('estimated_duration_minutes').notNull().default(60),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const patrolCheckpoints = pgTable('patrol_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').references(() => patrolRoutes.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  radiusMeters: integer('radius_meters').notNull().default(30),
  orderIndex: integer('order_index').notNull().default(0),
  qrCode: varchar('qr_code', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const patrolLogs = pgTable('patrol_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').references(() => patrolRoutes.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  status: patrolStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  totalCheckpoints: integer('total_checkpoints').notNull().default(0),
  scannedCheckpoints: integer('scanned_checkpoints').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const checkpointScans = pgTable('checkpoint_scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  logId: uuid('log_id').references(() => patrolLogs.id, { onDelete: 'cascade' }).notNull(),
  checkpointId: uuid('checkpoint_id').references(() => patrolCheckpoints.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  scannedAt: timestamp('scanned_at', { withTimezone: true }).notNull().defaultNow(),
  lat: real('lat'),
  lng: real('lng'),
  isInRadius: boolean('is_in_radius').notNull().default(false),
  notes: text('notes'),
})

export type PatrolRoute = typeof patrolRoutes.$inferSelect
export type NewPatrolRoute = typeof patrolRoutes.$inferInsert
export type PatrolCheckpoint = typeof patrolCheckpoints.$inferSelect
export type PatrolLog = typeof patrolLogs.$inferSelect
