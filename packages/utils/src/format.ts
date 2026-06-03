/** Formats a number as Indian Rupees currency string. */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Generates a sequential invoice number, e.g. "INV-2025-0042". */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(4, '0')}`
}

/** Generates an employee code, e.g. "EMP-00123". */
export function generateEmployeeCode(sequence: number): string {
  return `EMP-${String(sequence).padStart(5, '0')}`
}

/** Masks a bank account number for display, e.g. "XXXX XXXX 1234". */
export function maskAccountNumber(account: string): string {
  if (account.length < 4) return '****'
  return 'X'.repeat(account.length - 4) + account.slice(-4)
}

/** Formats minutes as "Xh Ym", e.g. 90 → "1h 30m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
