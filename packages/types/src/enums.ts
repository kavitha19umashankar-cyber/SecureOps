export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  AGENCY_ADMIN = 'agency_admin',
  HR_MANAGER = 'hr_manager',
  OPERATIONS_MANAGER = 'operations_manager',
  SITE_SUPERVISOR = 'site_supervisor',
  EMPLOYEE = 'employee',
  CLIENT = 'client',
}

export enum EmployeeStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export enum EmployeeType {
  SECURITY_GUARD = 'security_guard',
  ARMED_GUARD = 'armed_guard',
  SUPERVISOR = 'supervisor',
  HOUSEKEEPER = 'housekeeper',
  HOUSEKEEPING_SUPERVISOR = 'housekeeping_supervisor',
}

export enum DocumentType {
  AADHAAR = 'aadhaar',
  PAN = 'pan',
  PASSPORT = 'passport',
  DRIVING_LICENSE = 'driving_license',
  VOTER_ID = 'voter_id',
  POLICE_VERIFICATION = 'police_verification',
  SECURITY_LICENSE = 'security_license',
  EDUCATIONAL_CERTIFICATE = 'educational_certificate',
  TRAINING_CERTIFICATE = 'training_certificate',
  MEDICAL_CERTIFICATE = 'medical_certificate',
  EMPLOYMENT_CONTRACT = 'employment_contract',
  BANK_PASSBOOK = 'bank_passbook',
}

export enum DocumentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum SiteType {
  OFFICE = 'office',
  FACTORY = 'factory',
  HOSPITAL = 'hospital',
  MALL = 'mall',
  RESIDENTIAL = 'residential',
  EDUCATIONAL = 'educational',
  WAREHOUSE = 'warehouse',
  BANK = 'bank',
  HOTEL = 'hotel',
  OTHER = 'other',
}

export enum ShiftTemplate {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  NIGHT = 'night',
  CUSTOM = 'custom',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  HALF_DAY = 'half_day',
  ON_LEAVE = 'on_leave',
  HOLIDAY = 'holiday',
  WEEKLY_OFF = 'weekly_off',
}

export enum IncidentCategory {
  THEFT = 'theft',
  FIRE = 'fire',
  MEDICAL = 'medical',
  HARASSMENT = 'harassment',
  TRESPASS = 'trespass',
  EQUIPMENT_DAMAGE = 'equipment_damage',
  FIGHT = 'fight',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ACCIDENT = 'accident',
  OTHER = 'other',
}

export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum IncidentStatus {
  RAISED = 'raised',
  ACKNOWLEDGED = 'acknowledged',
  UNDER_INVESTIGATION = 'under_investigation',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
}

export enum LeaveType {
  EARNED_LEAVE = 'earned_leave',
  CASUAL_LEAVE = 'casual_leave',
  SICK_LEAVE = 'sick_leave',
  LOSS_OF_PAY = 'loss_of_pay',
  WEEKLY_OFF = 'weekly_off',
  PUBLIC_HOLIDAY = 'public_holiday',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum PayrollStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  LOCKED = 'locked',
  PAID = 'paid',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum TenantPlan {
  STARTER = 'starter',
  GROWTH = 'growth',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  TRIAL = 'trial',
}
