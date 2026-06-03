import type { InvoiceLineItem } from '@secureops/types'

const GST_RATE_INTRA = 0.18  // CGST 9% + SGST 9% for intra-state
const GST_RATE_INTER = 0.18  // IGST 18% for inter-state

export interface InvoiceGstResult {
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  totalAmount: number
}

/** Computes GST for invoice. Uses CGST+SGST for intra-state, IGST for inter-state. */
export function computeInvoiceGst(
  lineItems: InvoiceLineItem[],
  isInterState: boolean,
): InvoiceGstResult {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + item.subtotal + (item.overtimeAmount ?? 0)
  }, 0)

  if (isInterState) {
    const igst = Math.round(subtotal * GST_RATE_INTER * 100) / 100
    return { subtotal, cgst: 0, sgst: 0, igst, totalAmount: subtotal + igst }
  }

  const cgst = Math.round(subtotal * (GST_RATE_INTRA / 2) * 100) / 100
  const sgst = cgst
  return { subtotal, cgst, sgst, igst: 0, totalAmount: subtotal + cgst + sgst }
}

/** Builds invoice line items from allocation records. */
export function buildLineItems(
  allocations: Array<{
    employeeId: string
    employeeName: string
    designation: string
    daysWorked: number
    dailyRate: number
    overtimeHours?: number
    overtimeRate?: number
  }>,
): InvoiceLineItem[] {
  return allocations.map((a) => ({
    employeeId: a.employeeId,
    employeeName: a.employeeName,
    designation: a.designation,
    daysWorked: a.daysWorked,
    dailyRate: a.dailyRate,
    subtotal: a.daysWorked * a.dailyRate,
    overtimeHours: a.overtimeHours,
    overtimeAmount:
      a.overtimeHours && a.overtimeRate
        ? Math.round(a.overtimeHours * a.overtimeRate * 100) / 100
        : undefined,
  }))
}
