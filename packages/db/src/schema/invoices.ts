import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  date,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'
import { clients } from './clients.js'
import { sites } from './sites.js'

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
])

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 30 }).notNull().unique(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  lineItems: jsonb('line_items').$type<
    Array<{
      employeeId: string
      employeeName: string
      designation: string
      daysWorked: number
      dailyRate: number
      subtotal: number
      overtimeHours?: number
      overtimeAmount?: number
    }>
  >().notNull().default([]),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  cgst: numeric('cgst', { precision: 10, scale: 2 }).notNull().default('0'),
  sgst: numeric('sgst', { precision: 10, scale: 2 }).notNull().default('0'),
  igst: numeric('igst', { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  dueDate: date('due_date').notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const invoicePayments = pgTable('invoice_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  method: varchar('method', { length: 30 }).notNull(),
  reference: varchar('reference', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoicePayment = typeof invoicePayments.$inferSelect
