'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Play, Lock, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { generatePayslipPDF } from '@/lib/payslip-pdf'
import { useAuthStore } from '@/store/auth'

interface PayrollRun {
  id: string; month: number; year: number; status: string
  totalEmployees: number; totalGross: string; totalDeductions: string; totalNetPay: string
  lockedAt?: string; createdAt: string
}

interface PayrollRecord {
  record: {
    id: string; employeeId: string; month: number; year: number
    grossSalary: string; totalDeductions: string; netSalary: string
    daysPresent: number; totalWorkingDays: number; lopDays: number; overtimeHours: string
    basicSalary: string; hra: string; conveyance: string; otherAllowances: string
    pfEmployee: string; esi: string; professionalTax: string; otherDeductions: string
  }
  employee: { id: string; name: string; employeeCode: string; employeeType: string } | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const statusBadge: Record<string, 'default' | 'warning' | 'info' | 'success'> = {
  draft: 'default', processing: 'warning', locked: 'info', paid: 'success',
}

export default function PayrollPage() {
  const qc = useQueryClient()
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const now = new Date()
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1)
  const [newYear, setNewYear] = useState(now.getFullYear())

  const { data: runs, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get<{ success: boolean; data: PayrollRun[] }>('/payroll/runs').then(r => r.data.data),
  })

  const { data: records } = useQuery({
    queryKey: ['payroll-records', expandedRun],
    queryFn: () => api.get<{ success: boolean; data: PayrollRecord[] }>(`/payroll/runs/${expandedRun}/records`).then(r => r.data.data),
    enabled: !!expandedRun,
  })

  const createRun = useMutation({
    mutationFn: () => api.post('/payroll/runs', { month: newMonth, year: newYear }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
  })

  const computeRun = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/compute`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-runs'] }); qc.invalidateQueries({ queryKey: ['payroll-records'] }) },
  })

  const lockRun = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/runs/${id}/lock`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
  })

  const { user } = useAuthStore()

  const inr = (v: string | number) =>
    '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0 })

  const downloadPayslip = (record: PayrollRecord, runMonth: number, runYear: number) => {
    const r = record.record
    const e = record.employee
    generatePayslipPDF({
      employeeName: e?.name ?? 'Employee',
      employeeCode: e?.employeeCode ?? '—',
      designation: e?.employeeType ?? '—',
      month: runMonth,
      year: runYear,
      workingDays: r.totalWorkingDays,
      daysPresent: r.daysPresent,
      overtimeHours: Number(r.overtimeHours),
      basicSalary: Number(r.basicSalary),
      hra: Number(r.hra),
      conveyance: Number(r.conveyance),
      otherAllowances: Number(r.otherAllowances),
      grossSalary: Number(r.grossSalary),
      pfEmployee: Number(r.pfEmployee),
      esi: Number(r.esi),
      professionalTax: Number(r.professionalTax),
      otherDeductions: Number(r.otherDeductions),
      totalDeductions: Number(r.totalDeductions),
      netSalary: Number(r.netSalary),
      tenantName: user?.tenantId ? 'SecureOps Agency' : 'Agency',
    })
  }

  return (
    <div className="space-y-5">
      {/* Initiate new payroll */}
      <Card>
        <CardHeader><CardTitle>Initiate Payroll Run</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
              <select value={newMonth} onChange={e => setNewMonth(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
              <select value={newYear} onChange={e => setNewYear(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <Button onClick={() => createRun.mutate()} loading={createRun.isPending}>
              <Play className="w-4 h-4" /> Create Run
            </Button>
            {createRun.isError && (
              <p className="text-red-500 text-sm self-center">
                {(createRun.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payroll runs list */}
      <div className="space-y-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
        )) : runs?.sort((a, b) => b.year - a.year || b.month - a.month).map(run => (
          <div key={run.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Run header */}
            <div className="flex items-center px-5 py-4 gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">{MONTHS[run.month - 1]} {run.year}</span>
                  <Badge variant={statusBadge[run.status] ?? 'default'}>{run.status}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{run.totalEmployees} employees</p>
              </div>

              {/* Totals */}
              <div className="hidden sm:grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xs text-gray-500">Gross</p>
                  <p className="text-sm font-semibold text-gray-900">{inr(run.totalGross)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Deductions</p>
                  <p className="text-sm font-semibold text-red-600">{inr(run.totalDeductions)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net Pay</p>
                  <p className="text-sm font-bold text-green-700">{inr(run.totalNetPay)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {run.status === 'draft' && (
                  <Button size="sm" variant="secondary" loading={computeRun.isPending}
                    onClick={() => computeRun.mutate(run.id)}>
                    <Play className="w-3 h-3" /> Compute
                  </Button>
                )}
                {run.status === 'draft' && Number(run.totalEmployees) > 0 && (
                  <Button size="sm" variant="danger" loading={lockRun.isPending}
                    onClick={() => { if (confirm('Lock payroll? This cannot be undone.')) lockRun.mutate(run.id) }}>
                    <Lock className="w-3 h-3" /> Lock
                  </Button>
                )}
                <button onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                  {expandedRun === run.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Employee records table */}
            {expandedRun === run.id && (
              <div className="border-t border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-50">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Employee', 'Code', 'Days', 'OT (hrs)', 'Gross', 'Deductions', 'Net Pay', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records?.map(({ record, employee }) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{employee?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500">{employee?.employeeCode ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="text-green-600 font-medium">{record.daysPresent}</span>
                          <span className="text-gray-400">/{record.totalWorkingDays}</span>
                          {record.lopDays > 0 && <span className="text-red-500 ml-1">(-{record.lopDays})</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{Number(record.overtimeHours).toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{inr(record.grossSalary)}</td>
                        <td className="px-4 py-3 text-sm text-red-600">-{inr(record.totalDeductions)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-700">{inr(record.netSalary)}</td>
                      <td className="px-4 py-3">
                        {run.status === 'locked' || run.status === 'paid' ? (
                          <button onClick={() => downloadPayslip({ record, employee }, run.month, run.year)}
                            className="p-1.5 text-brand-600 hover:bg-brand-50 rounded" title="Download Payslip">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </td>
                      </tr>
                    ))}
                    {!records?.length && (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                        Run "Compute" to generate payroll records
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {!isLoading && !runs?.length && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No payroll runs yet. Create one above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
