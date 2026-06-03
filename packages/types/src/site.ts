import { ShiftTemplate, SiteType } from './enums'

export interface Client {
  id: string
  tenantId: string
  name: string
  gstNumber?: string
  billingAddress: string
  contactEmail?: string
  contactPhone?: string
  contactPersonName?: string
  logoUrl?: string
  isActive: boolean
  createdAt: string
}

export interface Site {
  id: string
  tenantId: string
  clientId: string
  name: string
  address: string
  lat: number
  lng: number
  radiusMeters: number
  photoCheckinIntervalMinutes: number
  siteType: SiteType
  photoUrls: string[]
  postOrders?: string
  emergencyContacts?: SiteEmergencyContact[]
  isActive: boolean
  createdAt: string
}

export interface SiteEmergencyContact {
  name: string
  phone: string
  role: string
}

export interface Contract {
  id: string
  siteId: string
  clientId: string
  tenantId: string
  startDate: string
  endDate?: string
  billingRatePerDay: number
  overtimeBillingRate?: number
  currency: string
  requiredHeadcount: number
  isActive: boolean
  createdAt: string
}

export interface Shift {
  id: string
  siteId: string
  tenantId: string
  template: ShiftTemplate
  startTime: string  // HH:MM format
  endTime: string
  date: string       // YYYY-MM-DD
  requiredCount: number
  createdAt: string
}

export interface Allocation {
  id: string
  employeeId: string
  shiftId: string
  siteId: string
  tenantId: string
  role: string
  status: 'assigned' | 'confirmed' | 'cancelled'
  createdAt: string
  employee?: Pick<import('./employee').Employee, 'id' | 'name' | 'employeeType' | 'photoUrl'>
}
