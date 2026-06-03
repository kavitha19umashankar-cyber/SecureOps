// Client-side invoice PDF generator using jsPDF
// eslint-disable-next-line @typescript-eslint/no-require-imports
import jsPDF from 'jspdf'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import autoTable from 'jspdf-autotable'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface InvoiceLineItem {
  employeeName: string
  designation?: string
  daysWorked: number
  dailyRate: number
  subtotal: number
  overtimeHours?: number
  overtimeAmount?: number
}

interface InvoicePDFData {
  invoiceNumber: string
  periodStart: string   // YYYY-MM-DD
  periodEnd: string     // YYYY-MM-DD
  issueDate: string     // YYYY-MM-DD
  dueDate: string       // YYYY-MM-DD
  clientName: string
  clientAddress?: string
  clientGst?: string
  agencyName: string
  agencyGst?: string
  lineItems: InvoiceLineItem[]
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  totalAmount: number
  paidAmount?: number
  notes?: string
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function generateInvoicePDF(data: InvoicePDFData) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.width
  const margin = 14

  // Header bar
  doc.setFillColor(30, 64, 175) // brand blue
  doc.rect(0, 0, pageW, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('TAX INVOICE', margin, 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(data.agencyName, margin, 20)
  if (data.agencyGst) doc.text(`GSTIN: ${data.agencyGst}`, margin, 25)

  // Invoice details box (right)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  const details = [
    ['Invoice #', data.invoiceNumber],
    ['Issue Date', fmtDate(data.issueDate)],
    ['Due Date', fmtDate(data.dueDate)],
    ['Period', `${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`],
  ]
  let ry = 8
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label + ':', 135, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 162, ry)
    ry += 5.5
  })

  // Bill To
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Bill To', margin, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(data.clientName, margin, 44)
  if (data.clientAddress) {
    const lines = doc.splitTextToSize(data.clientAddress, 80)
    doc.text(lines, margin, 50)
  }
  if (data.clientGst) doc.text(`GSTIN: ${data.clientGst}`, margin, 62)

  // Line items table
  autoTable(doc, {
    startY: 70,
    head: [['Employee', 'Designation', 'Days', 'Rate/Day', 'OT Hrs', 'OT Amount', 'Amount']],
    body: data.lineItems.map(item => [
      item.employeeName,
      item.designation ?? 'Security Guard',
      item.daysWorked,
      fmt(item.dailyRate),
      item.overtimeHours ? item.overtimeHours.toFixed(1) : '—',
      item.overtimeAmount ? fmt(item.overtimeAmount) : '—',
      fmt(item.subtotal + (item.overtimeAmount ?? 0)),
    ]),
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 42 }, 1: { cellWidth: 30 }, 2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' }, 4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 26, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })

  const afterTable = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  // Totals box
  const taxRows = [
    ['Subtotal', fmt(data.subtotal)],
    ...(data.cgst > 0 ? [['CGST (9%)', fmt(data.cgst)]] : []),
    ...(data.sgst > 0 ? [['SGST (9%)', fmt(data.sgst)]] : []),
    ...(data.igst > 0 ? [['IGST (18%)', fmt(data.igst)]] : []),
    ['Total Amount', fmt(data.totalAmount)],
    ...(data.paidAmount && data.paidAmount > 0 ? [['Amount Paid', fmt(data.paidAmount)]] : []),
    ...(data.paidAmount && data.paidAmount > 0 ? [['Balance Due', fmt(data.totalAmount - data.paidAmount)]] : []),
  ]

  const boxX = pageW - margin - 70
  let ty = afterTable
  taxRows.forEach((row, i) => {
    const isTotal = row[0] === 'Total Amount'
    const isBalance = row[0] === 'Balance Due'
    if (isTotal || isBalance) {
      doc.setFillColor(isBalance ? 254 : 30, isBalance ? 242 : 64, isBalance ? 242 : 175)
      doc.rect(boxX - 2, ty - 4, 72, 7, 'F')
      doc.setTextColor(isBalance ? 185 : 255, isBalance ? 28 : 255, isBalance ? 28 : 255)
    } else {
      doc.setTextColor(100, 116, 139)
    }
    doc.setFontSize(9)
    doc.setFont('helvetica', isTotal || isBalance ? 'bold' : 'normal')
    doc.text(row[0]!, boxX, ty)
    doc.text(row[1]!, pageW - margin, ty, { align: 'right' })
    ty += 7
  })

  // Notes
  if (data.notes) {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Notes: ' + data.notes, margin, afterTable)
  }

  // Footer
  const pageH = doc.internal.pageSize.height
  doc.setFillColor(248, 250, 252)
  doc.rect(0, pageH - 15, pageW, 15, 'F')
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('This is a computer-generated invoice. No signature required.', pageW / 2, pageH - 8, { align: 'center' })
  doc.text(data.agencyName, pageW / 2, pageH - 4, { align: 'center' })

  doc.save(`invoice_${data.invoiceNumber}.pdf`)
}
