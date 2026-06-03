'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

const statusVariant = {
  present: 'success',
  absent: 'danger',
  half_day: 'warning',
  on_leave: 'info',
  holiday: 'default',
  weekly_off: 'default',
} as const

export default function AttendancePage() {
  const [siteId, setSiteId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/sites').then((r) => r.data.data),
  })

  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance', siteId, date],
    queryFn: () =>
      api.get<{ success: boolean; data: unknown[] }>(`/attendance/site/${siteId}`, { params: { date } })
        .then((r) => r.data.data),
    enabled: !!siteId,
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Select Site</option>
          {sites?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {!siteId ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p>Select a site to view attendance</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Late</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Geofence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : (records as Array<{
                    id: string
                    status: keyof typeof statusVariant
                    clockInTime?: string
                    clockOutTime?: string
                    overtimeMinutes: number
                    lateMinutes: number
                    verifiedInGeofence: boolean
                    isMockLocationFlagged: boolean
                  }>)?.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">—</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {rec.clockInTime ? format(new Date(rec.clockInTime), 'hh:mm a') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {rec.clockOutTime ? format(new Date(rec.clockOutTime), 'hh:mm a') : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {rec.overtimeMinutes > 0 ? `${Math.floor(rec.overtimeMinutes / 60)}h ${rec.overtimeMinutes % 60}m` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {rec.lateMinutes > 0 ? <span className="text-orange-600">{rec.lateMinutes}m late</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {rec.isMockLocationFlagged
                          ? <Badge variant="danger">Mock</Badge>
                          : rec.verifiedInGeofence
                            ? <Badge variant="success">OK</Badge>
                            : <Badge variant="warning">Outside</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[rec.status] ?? 'default'}>{rec.status.replace('_', ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!isLoading && !records?.length && (
            <div className="text-center py-10 text-gray-400 text-sm">No records for this date</div>
          )}
        </div>
      )}
    </div>
  )
}
