'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart3, Users, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface EmployeeSummary {
  employeeId: string; name?: string; employeeCode?: string; employeeType?: string
  present: number; absent: number; halfDay: number; onLeave: number; lop: number
  totalWorkingDays: number; attendanceRate: number
  totalOvertimeHours: string; totalLateMinutes: number
}

interface Site { id: string; name: string }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [siteId, setSiteId] = useState('')

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ success: boolean; data: Site[] }>('/sites').then(r => r.data.data),
  })

  const { data: report, isLoading } = useQuery({
    queryKey: ['attendance-report', month, year, siteId],
    queryFn: () => api.get<{
      success: boolean
      data: { month: number; year: number; totalWorkingDays: number; employees: EmployeeSummary[] }
    }>('/reports/attendance/monthly', { params: { month, year, siteId: siteId || undefined } })
      .then(r => r.data.data),
  })

  const exportCSV = () => {
    if (!report?.employees.length) return

    const headers = ['Employee Code', 'Name', 'Type', 'Working Days', 'Present', 'Absent', 'Half Day', 'On Leave', 'LOP', 'Overtime (hrs)', 'Attendance %']
    const rows = report.employees.map(e => [
      e.employeeCode ?? '',
      e.name ?? '',
      e.employeeType?.replace('_', ' ') ?? '',
      report.totalWorkingDays,
      e.present,
      e.absent,
      e.halfDay,
      e.onLeave,
      e.lop,
      e.totalOvertimeHours,
      `${e.attendanceRate}%`,
    ])

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${MONTHS[month - 1]}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const avgAttendance = report?.employees.length
    ? Math.round(report.employees.reduce((s, e) => s + e.attendanceRate, 0) / report.employees.length)
    : 0

  const totalOvertime = report?.employees.reduce((s, e) => s + Number(e.totalOvertimeHours), 0) ?? 0

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
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
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Site (optional)</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Sites</option>
            {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <Button variant="secondary" onClick={exportCSV} disabled={!report?.employees.length}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Working Days', value: report.totalWorkingDays, icon: BarChart3, color: 'text-blue-600' },
            { label: 'Employees', value: report.employees.length, icon: Users, color: 'text-gray-700' },
            { label: 'Avg Attendance', value: `${avgAttendance}%`, icon: TrendingUp, color: avgAttendance >= 90 ? 'text-green-600' : avgAttendance >= 75 ? 'text-yellow-600' : 'text-red-600' },
            { label: 'Total OT (hrs)', value: totalOvertime.toFixed(1), icon: BarChart3, color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance register table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Monthly Attendance Register — {MONTHS[month - 1]} {year}
          </h3>
          {report && <span className="text-xs text-gray-500">{report.employees.length} employees</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Code', 'Employee', 'Type', 'Present', 'Absent', 'Half Day', 'Leave', 'LOP', 'OT (hrs)', 'Late (min)', 'Rate'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : report?.employees.map(emp => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-xs font-mono text-gray-500">{emp.employeeCode ?? '—'}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900">{emp.name ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-500 capitalize">{emp.employeeType?.replace('_', ' ') ?? '—'}</td>
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
                            <div className="h-full rounded-full"
                              style={{ width: `${emp.attendanceRate}%`, background: emp.attendanceRate >= 90 ? '#059669' : emp.attendanceRate >= 75 ? '#d97706' : '#dc2626' }} />
                          </div>
                          <span className={`text-xs font-semibold ${emp.attendanceRate >= 90 ? 'text-green-700' : emp.attendanceRate >= 75 ? 'text-yellow-700' : 'text-red-600'}`}>
                            {emp.attendanceRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!isLoading && !report?.employees.length && (
            <div className="text-center py-10 text-gray-400 text-sm">No attendance data for this period</div>
          )}
        </div>
      </div>
    </div>
  )
}
