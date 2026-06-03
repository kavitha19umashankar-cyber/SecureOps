'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart3, Users, TrendingUp, DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface EmployeeSummary {
  employeeId: string; name?: string; employeeCode?: string; employeeType?: string
  present: number; absent: number; halfDay: number; onLeave: number; lop: number
  totalWorkingDays: number; attendanceRate: number
  totalOvertimeHours: string; totalLateMinutes: number
}

interface PayrollRecord {
  employeeId: string; name?: string | null; employeeCode?: string | null; employeeType?: string | null
  daysPresent: number; lopDays: number; grossSalary: number; totalDeductions: number; netSalary: number
}

interface AgingItem {
  id: string; invoiceNumber: string; clientId: string; totalAmount: string
  paidAmount: string; dueDate: string; status: string; balance: number; daysOverdue: number; bucket: string
}

interface AgingBuckets { current: number; '1_30': number; '31_60': number; '61_90': number; over90: number }

interface Site { id: string; name: string }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const inr = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN')

export default function ReportsPage() {
  const now = new Date()
  const [tab, setTab] = useState<'attendance' | 'payroll' | 'invoices'>('attendance')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [siteId, setSiteId] = useState('')

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: (): Promise<Site[]> => api.get<{ success: boolean; data: Site[] }>('/sites').then(r => r.data.data),
  })

  // Attendance report
  const { data: report, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance-report', month, year, siteId],
    queryFn: () => api.get<{
      success: boolean
      data: { month: number; year: number; totalWorkingDays: number; employees: EmployeeSummary[] }
    }>('/reports/attendance/monthly', { params: { month, year, siteId: siteId || undefined } }).then(r => r.data.data),
    enabled: tab === 'attendance',
  })

  // Payroll summary
  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ['payroll-report', month, year],
    queryFn: () => api.get<{
      success: boolean
      data: {
        run: { id: string; month: number; year: number; status: string; totalEmployees: number }
        summary: { totalGross: number; totalNet: number; totalDeductions: number; totalPf: number; totalEsi: number; totalPt: number }
        records: PayrollRecord[]
      } | null
    }>('/reports/payroll/summary', { params: { month, year } }).then(r => r.data.data),
    enabled: tab === 'payroll',
  })

  // Invoice aging
  const { data: agingData, isLoading: agingLoading } = useQuery({
    queryKey: ['invoice-aging'],
    queryFn: () => api.get<{
      success: boolean
      data: { items: AgingItem[]; buckets: AgingBuckets }
    }>('/reports/invoices/aging').then(r => r.data.data),
    enabled: tab === 'invoices',
  })

  const exportAttendanceCSV = () => {
    if (!report?.employees.length) return
    const headers = ['Code', 'Name', 'Type', 'Working Days', 'Present', 'Absent', 'Half Day', 'Leave', 'LOP', 'OT (hrs)', 'Rate %']
    const rows = report.employees.map(e => [
      e.employeeCode ?? '', e.name ?? '', e.employeeType?.replace('_', ' ') ?? '',
      report.totalWorkingDays, e.present, e.absent, e.halfDay, e.onLeave, e.lop,
      e.totalOvertimeHours, `${e.attendanceRate}%`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `attendance_${MONTHS[month - 1]}_${year}.csv`
    a.click()
  }

  const exportPayrollCSV = () => {
    if (!payrollData?.records.length) return
    const headers = ['Code', 'Name', 'Type', 'Days Present', 'LOP Days', 'Gross', 'Deductions', 'Net Pay']
    const rows = payrollData.records.map(r => [
      r.employeeCode ?? '', r.name ?? '', r.employeeType?.replace('_', ' ') ?? '',
      r.daysPresent, r.lopDays, r.grossSalary.toFixed(2), r.totalDeductions.toFixed(2), r.netSalary.toFixed(2),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `payroll_${MONTHS[month - 1]}_${year}.csv`
    a.click()
  }

  const avgAttendance = report?.employees.length
    ? Math.round(report.employees.reduce((s, e) => s + e.attendanceRate, 0) / report.employees.length) : 0

  const bucketLabels: Record<string, string> = {
    current: 'Not Yet Due', '1_30': '1–30 Days', '31_60': '31–60 Days', '61_90': '61–90 Days', over90: '90+ Days'
  }
  const bucketColors: Record<string, string> = {
    current: 'text-green-700 bg-green-50', '1_30': 'text-yellow-700 bg-yellow-50',
    '31_60': 'text-orange-700 bg-orange-50', '61_90': 'text-red-600 bg-red-50', over90: 'text-red-800 bg-red-100'
  }

  return (
    <div className="space-y-5">
      {/* Tab selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['attendance', 'payroll', 'invoices'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'attendance' ? 'Attendance' : t === 'payroll' ? 'Payroll Summary' : 'Invoice Aging'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-end gap-2 flex-wrap">
          {tab !== 'invoices' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
          {tab === 'attendance' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Site</label>
              <select value={siteId} onChange={e => setSiteId(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">All Sites</option>
                {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {tab === 'attendance' && (
            <Button variant="secondary" onClick={exportAttendanceCSV} disabled={!report?.employees.length}>
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
          {tab === 'payroll' && payrollData?.records.length ? (
            <Button variant="secondary" onClick={exportPayrollCSV}>
              <Download className="w-4 h-4" /> Export
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <>
          {report && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Working Days', value: report.totalWorkingDays, icon: BarChart3, color: 'text-blue-600' },
                { label: 'Employees', value: report.employees.length, icon: Users, color: 'text-gray-700' },
                { label: 'Avg Attendance', value: `${avgAttendance}%`, icon: TrendingUp, color: avgAttendance >= 90 ? 'text-green-600' : avgAttendance >= 75 ? 'text-yellow-600' : 'text-red-600' },
                { label: 'Total OT (hrs)', value: report.employees.reduce((s, e) => s + Number(e.totalOvertimeHours), 0).toFixed(1), icon: BarChart3, color: 'text-purple-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <div><p className="text-xs text-gray-500">{s.label}</p><p className={`text-xl font-bold ${s.color}`}>{s.value}</p></div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Monthly Attendance Register — {MONTHS[month - 1]} {year}</h3>
              {report && <span className="text-xs text-gray-500">{report.employees.length} employees</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>{['Code','Employee','Type','Present','Absent','Half Day','Leave','LOP','OT (hrs)','Late (min)','Rate'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attendanceLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}</tr>
                    ))
                    : report?.employees.map(emp => (
                      <tr key={emp.employeeId} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-xs font-mono text-gray-500">{emp.employeeCode ?? '—'}</td>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">{emp.name ?? '—'}</td>
                        <td className="px-3 py-3 text-xs text-gray-500 capitalize">{emp.employeeType?.replace('_',' ') ?? '—'}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-green-700">{emp.present}</td>
                        <td className="px-3 py-3 text-sm text-red-600">{emp.absent}</td>
                        <td className="px-3 py-3 text-sm text-yellow-600">{emp.halfDay}</td>
                        <td className="px-3 py-3 text-sm text-blue-600">{emp.onLeave}</td>
                        <td className="px-3 py-3 text-sm text-orange-600">{emp.lop}</td>
                        <td className="px-3 py-3 text-sm text-purple-600">{emp.totalOvertimeHours}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{emp.totalLateMinutes}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${emp.attendanceRate}%`, background: emp.attendanceRate >= 90 ? '#059669' : emp.attendanceRate >= 75 ? '#d97706' : '#dc2626' }} />
                            </div>
                            <span className={`text-xs font-semibold ${emp.attendanceRate >= 90 ? 'text-green-700' : emp.attendanceRate >= 75 ? 'text-yellow-700' : 'text-red-600'}`}>{emp.attendanceRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!attendanceLoading && !report?.employees.length && (
                <div className="text-center py-10 text-gray-400 text-sm">No attendance data for this period</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── PAYROLL SUMMARY TAB ── */}
      {tab === 'payroll' && (
        <>
          {payrollLoading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="bg-white rounded-xl border h-24 animate-pulse" />)}</div>
          ) : !payrollData ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No payroll run found for {MONTHS[month - 1]} {year}</p>
              <p className="text-xs mt-1">Run payroll from the Payroll page first</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Employees', value: payrollData.run.totalEmployees, color: 'text-gray-700' },
                  { label: 'Total Gross', value: inr(payrollData.summary.totalGross), color: 'text-blue-700' },
                  { label: 'Net Payable', value: inr(payrollData.summary.totalNet), color: 'text-green-700' },
                  { label: 'PF (Employee)', value: inr(payrollData.summary.totalPf), color: 'text-purple-700' },
                  { label: 'ESI', value: inr(payrollData.summary.totalEsi), color: 'text-orange-600' },
                  { label: 'Prof. Tax', value: inr(payrollData.summary.totalPt), color: 'text-red-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border px-4 py-3">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Run status:</span>
                <Badge variant={payrollData.run.status === 'locked' || payrollData.run.status === 'paid' ? 'success' : 'warning'}>
                  {payrollData.run.status}
                </Badge>
              </div>

              {/* Per-employee table */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Employee Payroll Breakdown — {MONTHS[month - 1]} {year}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>{['Code','Name','Type','Days Present','LOP','Gross','Deductions','Net Pay'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {payrollData.records.map(r => (
                        <tr key={r.employeeId} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-xs font-mono text-gray-500">{r.employeeCode ?? '—'}</td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900">{r.name ?? '—'}</td>
                          <td className="px-3 py-3 text-xs text-gray-500 capitalize">{r.employeeType?.replace('_',' ') ?? '—'}</td>
                          <td className="px-3 py-3 text-sm text-green-700 font-semibold">{r.daysPresent}</td>
                          <td className="px-3 py-3 text-sm text-orange-600">{r.lopDays}</td>
                          <td className="px-3 py-3 text-sm text-blue-700">{inr(r.grossSalary)}</td>
                          <td className="px-3 py-3 text-sm text-red-600">{inr(r.totalDeductions)}</td>
                          <td className="px-3 py-3 text-sm font-bold text-green-700">{inr(r.netSalary)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── INVOICE AGING TAB ── */}
      {tab === 'invoices' && (
        <>
          {agingLoading ? (
            <div className="bg-white rounded-xl border h-64 animate-pulse" />
          ) : (
            <>
              {/* Aging buckets */}
              {agingData && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {(Object.entries(agingData.buckets) as [string, number][]).map(([bucket, amount]) => (
                    <div key={bucket} className={`rounded-xl border px-4 py-3 ${bucketColors[bucket] ?? 'bg-white'}`}>
                      <p className="text-xs font-medium">{bucketLabels[bucket]}</p>
                      <p className="text-lg font-bold mt-0.5">{inr(amount)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Total outstanding */}
              {agingData && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span>Total outstanding: <strong className="text-gray-900">{inr(agingData.items.reduce((s, i) => s + i.balance, 0))}</strong></span>
                  <span className="text-gray-400">({agingData.items.length} invoices)</span>
                </div>
              )}

              {/* Invoice table */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Outstanding Invoices</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>{['Invoice #','Due Date','Days Overdue','Total','Paid','Balance','Status','Age'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {agingData?.items.map(inv => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm font-mono text-brand-600">{inv.invoiceNumber}</td>
                          <td className="px-3 py-3 text-sm text-gray-600">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="px-3 py-3 text-sm">
                            {inv.daysOverdue === 0 ? (
                              <span className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Current</span>
                            ) : (
                              <span className={`font-semibold ${inv.daysOverdue > 60 ? 'text-red-600' : inv.daysOverdue > 30 ? 'text-orange-600' : 'text-yellow-600'}`}>
                                {inv.daysOverdue}d
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900">{inr(Number(inv.totalAmount))}</td>
                          <td className="px-3 py-3 text-sm text-green-600">{inr(Number(inv.paidAmount))}</td>
                          <td className="px-3 py-3 text-sm font-bold text-red-600">{inr(inv.balance)}</td>
                          <td className="px-3 py-3">
                            <Badge variant={inv.status === 'overdue' ? 'danger' : inv.status === 'partially_paid' ? 'warning' : 'default'}>
                              {inv.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bucketColors[inv.bucket] ?? 'bg-gray-100 text-gray-600'}`}>
                              {bucketLabels[inv.bucket]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!agingLoading && !agingData?.items.length && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      No outstanding invoices
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
