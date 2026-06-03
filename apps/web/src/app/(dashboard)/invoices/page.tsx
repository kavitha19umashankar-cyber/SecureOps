'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Send, CheckCircle, CreditCard } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface Invoice {
  id: string; invoiceNumber: string; clientId: string; siteId: string
  periodStart: string; periodEnd: string
  subtotal: string; cgst: string; sgst: string; igst: string; totalAmount: string
  status: string; dueDate: string; paidAmount: string
  lineItems: Array<{ employeeName: string; daysWorked: number; dailyRate: number; subtotal: number }>
  createdAt: string
  client?: { name: string }
}

interface Site { id: string; name: string; clientId: string }
interface Client { id: string; name: string; billingState?: string }

const statusBadge: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  draft: 'default', pending_approval: 'warning', approved: 'info',
  sent: 'info', partially_paid: 'warning', paid: 'success', overdue: 'danger', cancelled: 'default',
}

export default function InvoicesPage() {
  const qc = useQueryClient()
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showGenForm, setShowGenForm] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [genForm, setGenForm] = useState({ siteId: '', periodStart: '', periodEnd: '', isInterState: false })
  const [payForm, setPayForm] = useState({ amount: '', paidAt: format(new Date(), 'yyyy-MM-dd'), method: 'bank_transfer', reference: '' })

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<{ success: boolean; data: Invoice[] }>('/invoices').then(r => r.data.data),
  })

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ success: boolean; data: Site[] }>('/sites').then(r => r.data.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => api.post('/invoices/generate', genForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowGenForm(false) },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/invoices/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })

  const recordPayment = useMutation({
    mutationFn: () => api.post(`/invoices/${selectedInvoice!.id}/payments`, {
      amount: Number(payForm.amount),
      paidAt: payForm.paidAt,
      method: payForm.method,
      reference: payForm.reference,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowPayForm(false) },
  })

  const inr = (v: string | number) => '₹' + Number(v).toLocaleString('en-IN')

  const outstanding = invoices?.reduce((sum, inv) => {
    if (!['paid', 'cancelled'].includes(inv.status)) return sum + Number(inv.totalAmount) - Number(inv.paidAmount)
    return sum
  }, 0) ?? 0

  return (
    <div className="space-y-5">
      {/* Summary + action */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500">Total Outstanding</p>
            <p className="text-2xl font-bold text-red-600">{inr(outstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Invoices This Month</p>
            <p className="text-2xl font-bold text-gray-900">{invoices?.length ?? 0}</p>
          </div>
        </div>
        <Button onClick={() => setShowGenForm(true)}>
          <Plus className="w-4 h-4" /> Generate Invoice
        </Button>
      </div>

      {/* Generate invoice form */}
      {showGenForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Generate Invoice from Attendance</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Site *</label>
              <select value={genForm.siteId} onChange={e => setGenForm(f => ({ ...f, siteId: e.target.value }))}
                className="input">
                <option value="">Select site</option>
                {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Period Start *</label>
              <input type="date" value={genForm.periodStart}
                onChange={e => setGenForm(f => ({ ...f, periodStart: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Period End *</label>
              <input type="date" value={genForm.periodEnd}
                onChange={e => setGenForm(f => ({ ...f, periodEnd: e.target.value }))} className="input" />
            </div>
            <div className="col-span-2 sm:col-span-4 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={genForm.isInterState}
                  onChange={e => setGenForm(f => ({ ...f, isInterState: e.target.checked }))}
                  className="rounded" />
                <span className="text-gray-700">Inter-state (apply IGST instead of CGST+SGST)</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowGenForm(false)}>Cancel</Button>
            <Button onClick={() => generateMutation.mutate()} loading={generateMutation.isPending}
              disabled={!genForm.siteId || !genForm.periodStart || !genForm.periodEnd}>
              Generate
            </Button>
          </div>
          {generateMutation.isError && (
            <p className="text-red-500 text-sm mt-2">
              {(generateMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to generate invoice'}
            </p>
          )}
        </div>
      )}

      {/* Invoice list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Invoice #', 'Client / Site', 'Period', 'Amount', 'GST', 'Total', 'Due Date', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
              ))}</tr>
            )) : invoices?.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedInvoice(selectedInvoice?.id === inv.id ? null : inv)}>
                <td className="px-4 py-3 text-sm font-mono font-medium text-brand-600">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{inv.client?.name ?? 'Client'}</td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {format(parseISO(inv.periodStart), 'dd MMM')} – {format(parseISO(inv.periodEnd), 'dd MMM yy')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{inr(inv.subtotal)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {Number(inv.igst) > 0 ? `IGST ${inr(inv.igst)}` : `${inr(Number(inv.cgst) + Number(inv.sgst))}`}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">{inr(inv.totalAmount)}</td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{format(parseISO(inv.dueDate), 'dd MMM yy')}</td>
                <td className="px-4 py-3"><Badge variant={statusBadge[inv.status] ?? 'default'}>{inv.status.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                    {inv.status === 'draft' && (
                      <button onClick={() => updateStatus.mutate({ id: inv.id, status: 'sent' })}
                        className="p-1 text-blue-500 hover:text-blue-700 rounded" title="Mark as Sent">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {['sent', 'partially_paid', 'overdue'].includes(inv.status) && (
                      <button onClick={() => { setSelectedInvoice(inv); setShowPayForm(true) }}
                        className="p-1 text-green-500 hover:text-green-700 rounded" title="Record Payment">
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !invoices?.length && (
          <div className="text-center py-10 text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No invoices yet</p>
          </div>
        )}
      </div>

      {/* Invoice detail */}
      {selectedInvoice && !showPayForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</h3>
              <p className="text-sm text-gray-500">Line items breakdown</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Paid: {inr(selectedInvoice.paidAmount)} / {inr(selectedInvoice.totalAmount)}</p>
              <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1.5">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (Number(selectedInvoice.paidAmount) / Number(selectedInvoice.totalAmount)) * 100)}%` }} />
              </div>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="pb-2 text-left text-xs text-gray-500">Employee</th>
              <th className="pb-2 text-right text-xs text-gray-500">Days</th>
              <th className="pb-2 text-right text-xs text-gray-500">Rate/Day</th>
              <th className="pb-2 text-right text-xs text-gray-500">Amount</th>
            </tr></thead>
            <tbody>{selectedInvoice.lineItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-2 text-gray-900">{item.employeeName}</td>
                <td className="py-2 text-right text-gray-600">{item.daysWorked}</td>
                <td className="py-2 text-right text-gray-600">{inr(item.dailyRate)}</td>
                <td className="py-2 text-right font-medium">{inr(item.subtotal)}</td>
              </tr>
            ))}</tbody>
            <tfoot>
              <tr><td colSpan={3} className="pt-3 text-right text-xs text-gray-500">Subtotal</td><td className="pt-3 text-right text-sm">{inr(selectedInvoice.subtotal)}</td></tr>
              <tr><td colSpan={3} className="text-right text-xs text-gray-500">GST</td><td className="text-right text-sm text-gray-600">{inr(Number(selectedInvoice.cgst) + Number(selectedInvoice.sgst) + Number(selectedInvoice.igst))}</td></tr>
              <tr><td colSpan={3} className="text-right font-semibold">Total</td><td className="text-right font-bold text-brand-700">{inr(selectedInvoice.totalAmount)}</td></tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Record payment modal */}
      {showPayForm && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-4">Record Payment — {selectedInvoice.invoiceNumber}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹) *</label>
                <input type="number" value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="input" placeholder={String(Number(selectedInvoice.totalAmount) - Number(selectedInvoice.paidAmount))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                <input type="date" value={payForm.paidAt}
                  onChange={e => setPayForm(f => ({ ...f, paidAt: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={payForm.method}
                  onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} className="input">
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reference #</label>
                <input value={payForm.reference}
                  onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                  className="input" placeholder="UTR / Cheque number" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowPayForm(false)}>Cancel</Button>
              <Button className="flex-1" loading={recordPayment.isPending}
                disabled={!payForm.amount}
                onClick={() => recordPayment.mutate()}>
                <CheckCircle className="w-4 h-4" /> Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
