import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  real,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'
import { sites } from './sites.js'
import { employees } from './employees.js'
import { clients } from './clients.js'

export const incidentCategoryEnum = pgEnum('incident_category', [
  'theft',
  'fire',
  'medical',
  'harassment',
  'trespass',
  'equipment_damage',
  'fight',
  'suspicious_activity',
  'accident',
  'other',
])

export const incidentSeverityEnum = pgEnum('incident_severity', [
  'low',
  'medium',
  'high',
  'critical',
])

export const incidentStatusEnum = pgEnum('incident_status', [
  'raised',
  'acknowledged',
  'under_investigation',
  'resolved',
  'escalated',
  'closed',
])

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id),
  reportedByClientId: uuid('reported_by_client_id').references(() => clients.id),
  category: incidentCategoryEnum('category').notNull(),
  severity: incidentSeverityEnum('severity').notNull(),
  status: incidentStatusEnum('status').notNull().default('raised'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  mediaUrls: jsonb('media_urls').$type<string[]>().default([]),
  lat: real('lat'),
  lng: real('lng'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  assignedTo: uuid('assigned_to'),
  correctiveAction: text('corrective_action'),
  clientVisible: boolean('client_visible').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const incidentTimeline = pgTable('incident_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  note: text('note'),
  performedBy: uuid('performed_by').notNull(),
  performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Incident = typeof incidents.$inferSelect
export type NewIncident = typeof incidents.$inferInsert
export type IncidentTimeline = typeof incidentTimeline.$inferSelect
