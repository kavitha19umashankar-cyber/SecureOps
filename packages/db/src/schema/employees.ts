import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  date,
  pgEnum,
  real,
  jsonb,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'

export const employeeStatusEnum = pgEnum('employee_status', [
  'active',
  'on_leave',
  'suspended',
  'terminated',
])

export const employeeTypeEnum = pgEnum('employee_type', [
  'security_guard',
  'armed_guard',
  'supervisor',
  'housekeeper',
  'housekeeping_supervisor',
])

export const documentTypeEnum = pgEnum('document_type', [
  'aadhaar',
  'pan',
  'passport',
  'driving_license',
  'voter_id',
  'police_verification',
  'security_license',
  'educational_certificate',
  'training_certificate',
  'medical_certificate',
  'employment_contract',
  'bank_passbook',
])

export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'verified',
  'rejected',
  'expired',
])

export const backgroundVerificationEnum = pgEnum('background_verification_status', [
  'pending',
  'cleared',
  'flagged',
])

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeCode: varchar('employee_code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  photoUrl: text('photo_url'),
  dob: date('dob'),
  gender: varchar('gender', { length: 10 }),
  phone: varchar('phone', { length: 20 }).notNull(),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 20 }),
  employeeType: employeeTypeEnum('employee_type').notNull(),
  status: employeeStatusEnum('status').notNull().default('active'),
  joiningDate: date('joining_date').notNull(),
  terminationDate: date('termination_date'),
  skills: jsonb('skills').$type<string[]>().default([]),
  performanceScore: real('performance_score').notNull().default(0),
  backgroundVerificationStatus: backgroundVerificationEnum('background_verification_status')
    .notNull()
    .default('pending'),
  bankAccountNumber: varchar('bank_account_number', { length: 30 }),
  bankIfsc: varchar('bank_ifsc', { length: 15 }),
  bankName: varchar('bank_name', { length: 100 }),
  uanNumber: varchar('uan_number', { length: 20 }),
  esiNumber: varchar('esi_number', { length: 20 }),
  salaryStructureId: uuid('salary_structure_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const employeeDocuments = pgTable('employee_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  docType: documentTypeEnum('doc_type').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  expiryDate: date('expiry_date'),
  status: documentStatusEnum('status').notNull().default('pending'),
  verifiedBy: uuid('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Employee = typeof employees.$inferSelect
export type NewEmployee = typeof employees.$inferInsert
export type EmployeeDocument = typeof employeeDocuments.$inferSelect
export type NewEmployeeDocument = typeof employeeDocuments.$inferInsert
