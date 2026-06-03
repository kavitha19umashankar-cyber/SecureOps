'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users, MapPin, AlertTriangle, FileText,
  CheckCircle, Clock, TrendingUp, ShieldCheck,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

interface OverviewData {
  totalEmployees: number; activeEmployees: number
  attendanceRateToday: number; guardsOnDutyToday: number
  openIncidents: number; pendingInvoices: number; activeSites: number
}

interface TrendPoint { date: string; present: number; absent: number; rate: number }
interface IncidentTrend { date: string; severity: string; total: number }
interface LiveRow {
  attendance: { clockInTime?: string; siteId: string }
  employee: { name: string; employeeType: string } | null
}

export default function DashboardPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get<{ success: boolean; data: OverviewData }>('/dashboard/overview').then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: attendanceTrend } = useQuery({
    queryKey: ['attendance-trend'],
    queryFn: () => api.get<{ success: boolean; data: TrendPoint[] }>('/reports/attendance/trend').then(r => r.data.data),
    refetchInterval: 300_000,
  })

  const { data: incidentTrend } = useQuery({
    queryKey: ['incident-trend'],
    queryFn: () => api.get<{ success: boolean; data: IncidentTrend[] }>('/reports/incidents/trend').then(r => r.data.data),
    refetchInterval: 300_000,
  })

  const { data: liveAttendance } = useQuery({
    queryKey: ['live-attendance'],
    queryFn: () => api.get<{ success: boolean; data: LiveRow[] }>('/dashboard/live-attendance').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: recentIncidents } = useQuery({
    queryKey: ['recent-incidents'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ id: string; title: string; severity: string; status: string; occurredAt: string; category: string }> }>('/incidents?pageSize=5').then(r => r.data.data),
  })

  // Prepare 14-day attendance trend (last 14 days)
  const trendData = attendanceTrend?.slice(-14).map(d => ({
    day: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    rate: d.rate,
    present: d.present,
  })) ?? []

  // Aggregate incident trend by day
  const incidentByDay: Record<string, number> = {}
  for (const row of incidentTrend ?? []) {
    const day = new Date(String(row.date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    incidentByDay[day] = (incidentByDay[day] ?? 0) + row.total
  }
  const incidentData = Object.entries(incidentByDay).slice(-14).map(([day, total]) => ({ day, total }))

  const severityColor: Record<string, string> = {
    low: 'text-green-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600',
  }
  const severityBadge: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
    low: 'success', medium: 'warning', high: 'danger', critical: 'danger',
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard title="Total Employees" value={overview?.totalEmployees ?? 0}
          subtitle={`${overview?.activeEmployees ?? 0} active`} icon={Users} color="blue" />
        <StatCard title="On Duty Today" value={overview?.guardsOnDutyToday ?? 0}
          subtitle="Clocked in" icon={CheckCircle} color="green" />
        <StatCard title="Attendance Rate" value={`${overview?.attendanceRateToday ?? 0}%`}
          subtitle="Today" icon={TrendingUp} color="purple" />
        <StatCard title="Active Sites" value={overview?.activeSites ?? 0}
          icon={MapPin} color="blue" />
        <StatCard title="Open Incidents" value={overview?.openIncidents ?? 0}
          subtitle="Needs attention" icon={AlertTriangle} color="yellow" />
        <StatCard title="Pending Invoices" value={overview?.pendingInvoices ?? 0}
          icon={FileText} color="red" />
        <StatCard title="Guards Compliant" value={`${overview?.guardsOnDutyToday ?? 0}`}
          subtitle="BGV cleared" icon={ShieldCheck} color="green" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Attendance Rate</h3>
              <p className="text-xs text-gray-400">Last 14 days</p>
            </div>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
              {trendData.at(-1)?.rate ?? 0}% today
            </span>
          </div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Rate']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2}
                  fill="url(#attGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">No data yet</div>
          )}
        </div>

        {/* Incident trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Incidents</h3>
              <p className="text-xs text-gray-400">Last 14 days</p>
            </div>
            <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full font-medium">
              {incidentData.reduce((s, d) => s + d.total, 0)} total
            </span>
          </div>
          {incidentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={incidentData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="total" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">No incidents reported</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Live attendance */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Guards On Duty</h3>
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </div>
          <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))
            ) : !liveAttendance?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No guards clocked in today</p>
            ) : (
              liveAttendance.map((row, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {row.employee?.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{row.employee?.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{row.employee?.employeeType?.replace('_', ' ')}</p>
                  </div>
                  <span className="text-xs text-green-600 font-medium shrink-0">
                    {row.attendance?.clockInTime
                      ? new Date(row.attendance.clockInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent incidents */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Recent Incidents</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
            {!recentIncidents?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No incidents reported</p>
            ) : (
              recentIncidents.map(inc => (
                <div key={inc.id} className="flex items-start gap-3 px-5 py-3">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${severityColor[inc.severity] ?? 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{inc.title}</p>
                    <p className="text-xs text-gray-500 capitalize">{inc.category.replace('_', ' ')} · {new Date(inc.occurredAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <Badge variant={severityBadge[inc.severity] ?? 'default'}>{inc.severity}</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
