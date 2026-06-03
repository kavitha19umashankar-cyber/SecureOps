import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { employees } from './employees'

export const payrollStatusEnum = pgEnum('payroll_status', [
  'draft',
  'processing',
  'locked',
  'paid',
])

export const salaryStructures = pgTable('salary_structures', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  components: jsonb('components').$type<
    Array<{
      name: string
      type: 'earning' | 'deduction'
      calculationType: 'fixed' | 'percentage_of_basic' | 'percentage_of_gross'
      value: number
      isStatutory: boolean
    }>
  >().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  status: payrollStatusEnum('status').notNull().default('draft'),
  totalEmployees: integer('total_employees').notNull().default(0),
  totalGross: numeric('total_gross', { precision: 12, scale: 2 }).notNull().default('0'),
  totalDeductions: numeric('total_deductions', { precision: 12, scale: 2 }).notNull().default('0'),
  totalNetPay: numeric('total_net_pay', { precision: 12, scale: 2 }).notNull().default('0'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: uuid('locked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const payrollRecords = pgTable('payroll_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  totalWorkingDays: integer('total_working_days').notNull(),
  daysPresent: integer('days_present').notNull().default(0),
  daysAbsent: integer('days_absent').notNull().default(0),
  lopDays: integer('lop_days').notNull().default(0),
  overtimeHours: numeric('overtime_hours', { precision: 6, scale: 2 }).notNull().default('0'),
  grossSalary: numeric('gross_salary', { precision: 10, scale: 2 }).notNull(),
  basicSalary: numeric('basic_salary', { precision: 10, scale: 2 }).notNull(),
  hra: numeric('hra', { precision: 10, scale: 2 }).notNull().default('0'),
  conveyance: numeric('conveyance', { precision: 10, scale: 2 }).notNull().default('0'),
  otherAllowances: numeric('other_allowances', { precision: 10, scale: 2 }).notNull().default('0'),
  pfEmployee: numeric('pf_employee', { precision: 10, scale: 2 }).notNull().default('0'),
  pfEmployer: numeric('pf_employer', { precision: 10, scale: 2 }).notNull().default('0'),
  esi: numeric('esi', { precision: 10, scale: 2 }).notNull().default('0'),
  professionalTax: numeric('professional_tax', { precision: 10, scale: 2 }).notNull().default('0'),
  advanceDeduction: numeric('advance_deduction', { precision: 10, scale: 2 }).notNull().default('0'),
  otherDeductions: numeric('other_deductions', { precision: 10, scale: 2 }).notNull().default('0'),
  totalDeductions: numeric('total_deductions', { precision: 10, scale: 2 }).notNull(),
  netSalary: numeric('net_salary', { precision: 10, scale: 2 }).notNull(),
  payslipUrl: text('payslip_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SalaryStructure = typeof salaryStructures.$inferSelect
export type NewSalaryStructure = typeof salaryStructures.$inferInsert
export type PayrollRun = typeof payrollRuns.$inferSelect
export type PayrollRecord = typeof payrollRecords.$inferSelect
export type NewPayrollRecord = typeof payrollRecords.$inferInsert
