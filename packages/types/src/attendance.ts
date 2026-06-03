import { AttendanceStatus, LeaveStatus, LeaveType } from './enums.js'

export interface Attendance {
  id: string
  employeeId: string
  shiftId?: string
  siteId: string
  tenantId: string
  date: string
  status: AttendanceStatus
  clockInTime?: string
  clockOutTime?: string
  clockInLat?: number
  clockInLng?: number
  clockOutLat?: number
  clockOutLng?: number
  clockInAccuracy?: number
  verifiedInGeofence: boolean
  isMockLocationFlagged: boolean
  overtimeMinutes: number
  lateMinutes: number
  earlyDepartureMinutes: number
  supervisorNote?: string
  overriddenBy?: string
  createdAt: string
}

export interface PhotoCheckin {
  id: string
  employeeId: string
  siteId: string
  shiftId?: string
  tenantId: string
  photoUrl: string
  capturedAt: string
  lat?: number
  lng?: number
  isLate: boolean
  isLiveCaptured: boolean
  intervalNumber: number
  createdAt: string
}

export interface PatrolRoute {
  id: string
  siteId: string
  tenantId: string
  name: string
  checkpoints: PatrolCheckpoint[]
  isActive: boolean
  createdAt: string
}

export interface PatrolCheckpoint {
  id: string
  name: string
  lat?: number
  lng?: number
  qrCode?: string
  nfcTagId?: string
  expectedMinuteFromStart: number
  order: number
}

export interface PatrolLog {
  id: string
  employeeId: string
  routeId: string
  shiftId?: string
  tenantId: string
  checkpointsVisited: PatrolCheckpointVisit[]
  startedAt: string
  completedAt?: string
  completionRate: number
  createdAt: string
}

export interface PatrolCheckpointVisit {
  checkpointId: string
  scannedAt: string
  lat?: number
  lng?: number
  onTime: boolean
}

export interface ClockInRequest {
  siteId: string
  lat: number
  lng: number
  accuracy: number
  isMockLocation: boolean
  shiftId?: string
  deviceId: string
}

export interface ClockOutRequest {
  attendanceId: string
  lat: number
  lng: number
  accuracy: number
  deviceId: string
}

export interface Leave {
  id: string
  employeeId: string
  tenantId: string
  leaveType: LeaveType
  fromDate: string
  toDate: string
  days: number
  reason: string
  status: LeaveStatus
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
  substituteEmployeeId?: string
  createdAt: string
}
