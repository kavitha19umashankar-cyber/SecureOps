import { InvoiceStatus } from './enums'

export interface InvoiceLineItem {
  employeeId: string
  employeeName: string
  designation: string
  daysWorked: number
  dailyRate: number
  subtotal: number
  overtimeHours?: number
  overtimeAmount?: number
}

export interface Invoice {
  id: string
  tenantId: string
  clientId: string
  siteId: string
  invoiceNumber: string
  periodStart: string
  periodEnd: string
  lineItems: InvoiceLineItem[]
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  totalAmount: number
  status: InvoiceStatus
  dueDate: string
  paidAmount: number
  notes?: string
  createdAt: string
  updatedAt: string
  client?: {
    name: string
    billingAddress: string
    gstNumber?: string
  }
}

export interface InvoicePayment {
  id: string
  invoiceId: string
  amount: number
  paidAt: string
  method: 'bank_transfer' | 'cheque' | 'upi' | 'cash' | 'other'
  reference?: string
  notes?: string
}
