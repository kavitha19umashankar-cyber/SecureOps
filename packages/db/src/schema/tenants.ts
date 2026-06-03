import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core'

export const tenantPlanEnum = pgEnum('tenant_plan', [
  'trial',
  'starter',
  'growth',
  'business',
  'enterprise',
])

export const tenantStatusEnum = pgEnum('tenant_status', [
  'trial',
  'active',
  'suspended',
  'cancelled',
])

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 100 }).unique().notNull(),
  logoUrl: text('logo_url'),
  plan: tenantPlanEnum('plan').notNull().default('trial'),
  status: tenantStatusEnum('status').notNull().default('trial'),
  maxEmployees: integer('max_employees').notNull().default(50),
  gstNumber: varchar('gst_number', { length: 20 }),
  address: text('address'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  settings: jsonb('settings').default({}),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  subscriptionId: varchar('subscription_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
