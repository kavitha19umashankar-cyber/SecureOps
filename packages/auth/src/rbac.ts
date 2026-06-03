import { UserRole } from '@secureops/types'

type Action = 'read' | 'write' | 'delete' | 'approve'

type Resource =
  | 'employees'
  | 'employee_documents'
  | 'clients'
  | 'sites'
  | 'shifts'
  | 'allocations'
  | 'attendance'
  | 'photo_checkins'
  | 'patrol_routes'
  | 'incidents'
  | 'leaves'
  | 'payroll'
  | 'invoices'
  | 'reports'
  | 'tenants'
  | 'users'
  | 'settings'
  | 'salary_structures'

type PermissionMap = Partial<Record<Resource, Action[]>>

const permissions: Record<UserRole, PermissionMap> = {
  [UserRole.SUPER_ADMIN]: {
    tenants: ['read', 'write', 'delete'],
    users: ['read', 'write', 'delete'],
    employees: ['read', 'write', 'delete'],
    clients: ['read', 'write', 'delete'],
    sites: ['read', 'write', 'delete'],
    shifts: ['read', 'write', 'delete'],
    allocations: ['read', 'write', 'delete'],
    attendance: ['read', 'write', 'delete', 'approve'],
    photo_checkins: ['read', 'delete'],
    patrol_routes: ['read', 'write', 'delete'],
    incidents: ['read', 'write', 'delete', 'approve'],
    leaves: ['read', 'write', 'delete', 'approve'],
    payroll: ['read', 'write', 'delete', 'approve'],
    invoices: ['read', 'write', 'delete', 'approve'],
    reports: ['read'],
    settings: ['read', 'write'],
    salary_structures: ['read', 'write', 'delete'],
    employee_documents: ['read', 'write', 'delete', 'approve'],
  },
  [UserRole.AGENCY_ADMIN]: {
    users: ['read', 'write', 'delete'],
    employees: ['read', 'write', 'delete'],
    employee_documents: ['read', 'write', 'approve'],
    clients: ['read', 'write', 'delete'],
    sites: ['read', 'write', 'delete'],
    shifts: ['read', 'write', 'delete'],
    allocations: ['read', 'write', 'delete'],
    attendance: ['read', 'write', 'approve'],
    photo_checkins: ['read'],
    patrol_routes: ['read', 'write', 'delete'],
    incidents: ['read', 'write', 'approve'],
    leaves: ['read', 'write', 'approve'],
    payroll: ['read', 'write', 'approve'],
    invoices: ['read', 'write', 'approve'],
    reports: ['read'],
    settings: ['read', 'write'],
    salary_structures: ['read', 'write', 'delete'],
  },
  [UserRole.HR_MANAGER]: {
    employees: ['read', 'write'],
    employee_documents: ['read', 'write', 'approve'],
    attendance: ['read', 'write'],
    leaves: ['read', 'write', 'approve'],
    payroll: ['read', 'write', 'approve'],
    reports: ['read'],
    salary_structures: ['read', 'write'],
    users: ['read'],
  },
  [UserRole.OPERATIONS_MANAGER]: {
    employees: ['read'],
    clients: ['read', 'write'],
    sites: ['read', 'write'],
    shifts: ['read', 'write', 'delete'],
    allocations: ['read', 'write', 'delete'],
    attendance: ['read', 'approve'],
    photo_checkins: ['read'],
    patrol_routes: ['read', 'write', 'delete'],
    incidents: ['read', 'write', 'approve'],
    invoices: ['read', 'write'],
    reports: ['read'],
  },
  [UserRole.SITE_SUPERVISOR]: {
    employees: ['read'],
    attendance: ['read', 'approve'],
    photo_checkins: ['read'],
    patrol_routes: ['read'],
    incidents: ['read', 'write'],
    leaves: ['read', 'approve'],
    shifts: ['read'],
    allocations: ['read'],
    reports: ['read'],
  },
  [UserRole.EMPLOYEE]: {
    attendance: ['read', 'write'],
    photo_checkins: ['write'],
    incidents: ['read', 'write'],
    leaves: ['read', 'write'],
    employees: ['read'],  // own record only — enforced at route level
    payroll: ['read'],    // own payslips only — enforced at route level
    patrol_routes: ['read'],
  },
  [UserRole.CLIENT]: {
    attendance: ['read'],  // own sites only
    photo_checkins: ['read'],
    incidents: ['read', 'write'],  // write = raise complaint
    invoices: ['read'],
    reports: ['read'],
    sites: ['read'],
  },
}

export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action,
): boolean {
  const rolePerms = permissions[role]
  if (!rolePerms) return false
  const resourcePerms = rolePerms[resource]
  if (!resourcePerms) return false
  return resourcePerms.includes(action)
}

/** Returns all roles that have a given permission. */
export function rolesWithPermission(resource: Resource, action: Action): UserRole[] {
  return (Object.entries(permissions) as [UserRole, PermissionMap][])
    .filter(([, perms]) => perms[resource]?.includes(action))
    .map(([role]) => role)
}

/** Role hierarchy — higher index = more privileged. Used for UI display, not auth. */
export const ROLE_HIERARCHY: UserRole[] = [
  UserRole.EMPLOYEE,
  UserRole.CLIENT,
  UserRole.SITE_SUPERVISOR,
  UserRole.HR_MANAGER,
  UserRole.OPERATIONS_MANAGER,
  UserRole.AGENCY_ADMIN,
  UserRole.SUPER_ADMIN,
]
