import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  date,
  real,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { employees } from './employees'
import { sites } from './sites'
import { shifts } from './sites'

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'absent',
  'half_day',
  'on_leave',
  'holiday',
  'weekly_off',
])

export const leaveTypeEnum = pgEnum('leave_type', [
  'earned_leave',
  'casual_leave',
  'sick_leave',
  'loss_of_pay',
  'weekly_off',
  'public_holiday',
])

export const leaveStatusEnum = pgEnum('leave_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
])

export const attendances = pgTable('attendances', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id),
  date: date('date').notNull(),
  status: attendanceStatusEnum('status').notNull().default('present'),
  clockInTime: timestamp('clock_in_time', { withTimezone: true }),
  clockOutTime: timestamp('clock_out_time', { withTimezone: true }),
  clockInLat: real('clock_in_lat'),
  clockInLng: real('clock_in_lng'),
  clockOutLat: real('clock_out_lat'),
  clockOutLng: real('clock_out_lng'),
  clockInAccuracy: real('clock_in_accuracy'),
  verifiedInGeofence: boolean('verified_in_geofence').notNull().default(false),
  isMockLocationFlagged: boolean('is_mock_location_flagged').notNull().default(false),
  overtimeMinutes: integer('overtime_minutes').notNull().default(0),
  lateMinutes: integer('late_minutes').notNull().default(0),
  earlyDepartureMinutes: integer('early_departure_minutes').notNull().default(0),
  supervisorNote: text('supervisor_note'),
  overriddenBy: uuid('overridden_by'),
  deviceId: varchar('device_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const photoCheckins = pgTable('photo_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id),
  photoUrl: text('photo_url').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  lat: real('lat'),
  lng: real('lng'),
  isLate: boolean('is_late').notNull().default(false),
  isLiveCaptured: boolean('is_live_captured').notNull().default(true),
  intervalNumber: integer('interval_number').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const patrolRoutes = pgTable('patrol_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  checkpoints: jsonb('checkpoints').$type<
    Array<{
      id: string
      name: string
      lat?: number
      lng?: number
      qrCode?: string
      nfcTagId?: string
      expectedMinuteFromStart: number
      order: number
    }>
  >().default([]),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const patrolLogs = pgTable('patrol_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  routeId: uuid('route_id').references(() => patrolRoutes.id, { onDelete: 'cascade' }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id),
  checkpointsVisited: jsonb('checkpoints_visited').$type<
    Array<{
      checkpointId: string
      scannedAt: string
      lat?: number
      lng?: number
      onTime: boolean
    }>
  >().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completionRate: real('completion_rate').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leaves = pgTable('leaves', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  leaveType: leaveTypeEnum('leave_type').notNull(),
  fromDate: date('from_date').notNull(),
  toDate: date('to_date').notNull(),
  days: integer('days').notNull(),
  reason: text('reason').notNull(),
  status: leaveStatusEnum('status').notNull().default('pending'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  substituteEmployeeId: uuid('substitute_employee_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Attendance = typeof attendances.$inferSelect
export type NewAttendance = typeof attendances.$inferInsert
export type PhotoCheckin = typeof photoCheckins.$inferSelect
export type NewPhotoCheckin = typeof photoCheckins.$inferInsert
export type PatrolRoute = typeof patrolRoutes.$inferSelect
export type PatrolLog = typeof patrolLogs.$inferSelect
export type Leave = typeof leaves.$inferSelect
export type NewLeave = typeof leaves.$inferInsert
