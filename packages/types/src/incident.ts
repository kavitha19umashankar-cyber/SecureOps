import { IncidentCategory, IncidentSeverity, IncidentStatus } from './enums'

export interface Incident {
  id: string
  tenantId: string
  siteId: string
  employeeId?: string
  reportedByClientId?: string
  category: IncidentCategory
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  mediaUrls: string[]
  lat?: number
  lng?: number
  occurredAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  assignedTo?: string
  correctiveAction?: string
  clientVisible: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateIncidentRequest {
  siteId: string
  category: IncidentCategory
  severity: IncidentSeverity
  title: string
  description: string
  mediaUrls?: string[]
  lat?: number
  lng?: number
  occurredAt?: string
}

export interface IncidentTimeline {
  id: string
  incidentId: string
  action: string
  note?: string
  performedBy: string
  performedAt: string
}
