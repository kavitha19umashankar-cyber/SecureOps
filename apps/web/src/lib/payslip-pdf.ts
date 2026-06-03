// Client-side payslip PDF generator using jsPDF
// eslint-disable-next-line @typescript-eslint/no-require-imports
import jsPDF from 'jspdf'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import autoTable from 'jspdf-autotable'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface PayslipData {
  employeeName: string
  employeeCode: string
  designation: string
  joiningDate?: string
  month: number
  year: number
  workingDays: number
  daysPresent: number
  overtimeHours: number
  basicSalary: number
  hra: number
  conveyance: number
  otherAllowances: number
  grossSalary: number
  pfEmployee: number
  esi: number
  professionalTax: number
  otherDeductions: number
  totalDeductions: number
  netSalary: number
  tenantName: string
  bankName?: string
  accountNumber?: string
}

export function generatePayslipPDF(data: PayslipData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(data.tenantName, 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('PAYSLIP', 14, 20)
  doc.text(`${MONTHS[data.month - 1]} ${data.year}`, pageW - 14, 20, { align: 'right' })

  // Reset text color
  doc.setTextColor(17, 24, 39)

  // Employee info box
  doc.setFillColor(249, 250, 251)
  doc.rect(14, 36, pageW - 28, 28, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('EMPLOYEE DETAILS', 18, 43)
  doc.setFont('helvetica', 'normal')
  const col1 = 18, col2 = 80
  doc.text(`Name: ${data.employeeName}`, col1, 51)
  doc.text(`Code: ${data.employeeCode}`, col2, 51)
  doc.text(`Designation: ${data.designation.replace(/_/g, ' ')}`, col1, 57)
  if (data.joiningDate) doc.text(`Joining Date: ${data.joiningDate}`, col2, 57)
  if (data.bankName) doc.text(`Bank: ${data.bankName}`, col1, 63)
  if (data.accountNumber) doc.text(`Account: ****${data.accountNumber.slice(-4)}`, col2, 63)

  // Attendance box
  doc.setFillColor(239, 246, 255)
  doc.rect(14, 70, pageW - 28, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('ATTENDANCE SUMMARY', 18, 77)
  doc.setFont('helvetica', 'normal')
  doc.text(`Working Days: ${data.workingDays}`, 18, 83)
  doc.text(`Days Present: ${data.daysPresent}`, 65, 83)
  doc.text(`Overtime: ${data.overtimeHours.toFixed(1)} hrs`, 115, 83)
  doc.text(`LOP Days: ${Math.max(0, data.workingDays - data.daysPresent)}`, 160, 83)

  // Earnings & Deductions
  const inr = (v: number) => `INR ${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  autoTable(doc, {
    startY: 94,
    head: [['EARNINGS', 'Amount', 'DEDUCTIONS', 'Amount']],
    body: [
      ['Basic Salary', inr(data.basicSalary), 'PF (Employee)', inr(data.pfEmployee)],
      ['HRA', inr(data.hra), 'ESI', inr(data.esi)],
      ['Conveyance', inr(data.conveyance), 'Professional Tax', inr(data.professionalTax)],
      ['Other Allowances', inr(data.otherAllowances), 'Other Deductions', inr(data.otherDeductions)],
      [{ content: 'GROSS EARNINGS', styles: { fontStyle: 'bold' } }, { content: inr(data.grossSalary), styles: { fontStyle: 'bold' } },
       { content: 'TOTAL DEDUCTIONS', styles: { fontStyle: 'bold' } }, { content: inr(data.totalDeductions), styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fillColor: [249, 250, 251] }, 2: { fillColor: [249, 250, 251] } },
  })

  // Net pay banner
  const afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFillColor(5, 150, 105)
  doc.rect(14, afterTableY, pageW - 28, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('NET SALARY', 18, afterTableY + 10)
  doc.text(inr(data.netSalary), pageW - 14, afterTableY + 10, { align: 'right' })

  // Footer
  doc.setTextColor(156, 163, 175)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('This is a computer-generated payslip. No signature required.', pageW / 2, afterTableY + 26, { align: 'center' })
  doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, pageW / 2, afterTableY + 32, { align: 'center' })

  doc.save(`payslip_${data.employeeCode}_${MONTHS[data.month - 1]}_${data.year}.pdf`)
}
