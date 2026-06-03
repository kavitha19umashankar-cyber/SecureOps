import { PayrollStatus } from './enums.js'

export interface SalaryComponent {
  name: string
  type: 'earning' | 'deduction'
  calculationType: 'fixed' | 'percentage_of_basic' | 'percentage_of_gross'
  value: number
  isStatutory: boolean
}

export interface SalaryStructure {
  id: string
  tenantId: string
  name: string
  components: SalaryComponent[]
  createdAt: string
}

export interface PayrollRun {
  id: string
  tenantId: string
  month: number
  year: number
  status: PayrollStatus
  totalEmployees: number
  totalGross: number
  totalDeductions: number
  totalNetPay: number
  lockedAt?: string
  lockedBy?: string
  createdAt: string
}

export interface PayrollRecord {
  id: string
  payrollRunId: string
  employeeId: string
  tenantId: string
  month: number
  year: number
  totalWorkingDays: number
  daysPresent: number
  daysAbsent: number
  lopDays: number
  overtimeHours: number
  grossSalary: number
  basicSalary: number
  hra: number
  conveyance: number
  otherAllowances: number
  pfEmployee: number
  pfEmployer: number
  esi: number
  professionalTax: number
  advanceDeduction: number
  otherDeductions: number
  totalDeductions: number
  netSalary: number
  payslipUrl?: string
  createdAt: string
  employee?: {
    name: string
    employeeCode: string
    employeeType: string
    bankAccountNumber?: string
    bankIfsc?: string
  }
}

export interface PayslipData {
  employee: {
    name: string
    employeeCode: string
    designation: string
    department?: string
    joiningDate: string
    uan?: string
    esi?: string
    bank: string
    accountNumber: string
    ifsc: string
  }
  period: { month: number; year: number }
  attendance: {
    workingDays: number
    present: number
    absent: number
    lop: number
    overtime: number
  }
  earnings: Array<{ label: string; amount: number }>
  deductions: Array<{ label: string; amount: number }>
  grossEarnings: number
  totalDeductions: number
  netPay: number
  tenantName: string
  tenantLogo?: string
}
