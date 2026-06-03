import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  pgEnum,
  date,
  numeric,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'
import { clients } from './clients.js'
import { employees } from './employees.js'

export const siteTypeEnum = pgEnum('site_type', [
  'office',
  'factory',
  'hospital',
  'mall',
  'residential',
  'educational',
  'warehouse',
  'bank',
  'hotel',
  'other',
])

export const shiftTemplateEnum = pgEnum('shift_template', [
  'morning',
  'afternoon',
  'night',
  'custom',
])

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  radiusMeters: integer('radius_meters').notNull().default(100),
  siteType: siteTypeEnum('site_type').notNull().default('office'),
  photoUrls: jsonb('photo_urls').$type<string[]>().default([]),
  postOrders: text('post_orders'),
  emergencyContacts: jsonb('emergency_contacts').$type<
    Array<{ name: string; phone: string; role: string }>
  >().default([]),
  photoCheckinIntervalMinutes: integer('photo_checkin_interval_minutes').notNull().default(120),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  billingRatePerDay: numeric('billing_rate_per_day', { precision: 10, scale: 2 }).notNull(),
  overtimeBillingRate: numeric('overtime_billing_rate', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  requiredHeadcount: integer('required_headcount').notNull().default(1),
  agencyState: varchar('agency_state', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  template: shiftTemplateEnum('template').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),  // HH:MM
  endTime: varchar('end_time', { length: 5 }).notNull(),
  date: date('date').notNull(),
  requiredCount: integer('required_count').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const allocations = pgTable('allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 100 }).notNull().default('guard'),
  status: varchar('status', { length: 20 }).notNull().default('assigned'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Site = typeof sites.$inferSelect
export type NewSite = typeof sites.$inferInsert
export type Contract = typeof contracts.$inferSelect
export type NewContract = typeof contracts.$inferInsert
export type Shift = typeof shifts.$inferSelect
export type NewShift = typeof shifts.$inferInsert
export type Allocation = typeof allocations.$inferSelect
export type NewAllocation = typeof allocations.$inferInsert
