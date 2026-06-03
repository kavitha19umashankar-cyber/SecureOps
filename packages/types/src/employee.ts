import { DocumentStatus, DocumentType, EmployeeStatus, EmployeeType } from './enums.js'

export interface Employee {
  id: string
  tenantId: string
  employeeCode: string
  name: string
  photoUrl?: string
  dob?: string
  gender?: 'male' | 'female' | 'other'
  phone: string
  email?: string
  address?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  employeeType: EmployeeType
  status: EmployeeStatus
  joiningDate: string
  skills: string[]
  performanceScore: number
  backgroundVerificationStatus: 'pending' | 'cleared' | 'flagged'
  bankAccountNumber?: string
  bankIfsc?: string
  bankName?: string
  uanNumber?: string
  esiNumber?: string
  createdAt: string
  updatedAt: string
}

export interface EmployeeDocument {
  id: string
  employeeId: string
  docType: DocumentType
  fileUrl: string
  fileName: string
  fileSize: number
  expiryDate?: string
  status: DocumentStatus
  verifiedBy?: string
  verifiedAt?: string
  rejectionReason?: string
  createdAt: string
}

export interface CreateEmployeeRequest {
  name: string
  phone: string
  email?: string
  dob?: string
  gender?: 'male' | 'female' | 'other'
  address?: string
  employeeType: EmployeeType
  joiningDate: string
  skills?: string[]
  emergencyContactName?: string
  emergencyContactPhone?: string
  bankAccountNumber?: string
  bankIfsc?: string
  bankName?: string
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  status?: EmployeeStatus
  performanceScore?: number
}
