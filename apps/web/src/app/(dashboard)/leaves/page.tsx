'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface Leave {
  id: string
  employeeId: string
  leaveType: string
  fromDate: string
  toDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approvedAt?: string
  rejectionReason?: string
}

const statusBadge: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
}

const leaveTypeLabel: Record<string, string> = {
  earned_leave: 'Earned Leave',
  casual_leave: 'Casual Leave',
  sick_leave: 'Sick Leave',
  loss_of_pay: 'Loss of Pay',
  weekly_off: 'Weekly Off',
  public_holiday: 'Public Holiday',
}

export default function LeavesPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['leaves', statusFilter],
    queryFn: () =>
      api.get<{ success: boolean; data: Leave[] }>('/leaves', { params: { status: statusFilter || undefined } })
        .then(r => r.data.data),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: 'approved' | 'rejected'; rejectionReason?: string }) =>
      api.patch(`/leaves/${id}/approve`, { status, rejectionReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); setRejectId(null); setRejectReason('') },
  })

  const pendingCount = leaves?.filter(l => l.status === 'pending').length ?? 0

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Approval', value: pendingCount, color: 'text-orange-600 bg-orange-50' },
          { label: 'Approved (this month)', value: leaves?.filter(l => l.status === 'approved').length ?? 0, color: 'text-green-600 bg-green-50' },
          { label: 'Rejected', value: leaves?.filter(l => l.status === 'rejected').length ?? 0, color: 'text-red-600 bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color.split(' ')[0]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Employee', 'Leave Type', 'Period', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
              ))}</tr>
            )) : leaves?.map(leave => (
              <tr key={leave.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">
                    {leave.employeeId.slice(0, 2).toUpperCase()}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{leaveTypeLabel[leave.leaveType] ?? leave.leaveType}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {format(parseISO(leave.fromDate), 'dd MMM')} – {format(parseISO(leave.toDate), 'dd MMM yyyy')}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{leave.days}d</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{leave.reason}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadge[leave.status] ?? 'default'}>{leave.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  {leave.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => approveMutation.mutate({ id: leave.id, status: 'approved' })}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => setRejectId(leave.id)}
                        className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 rounded">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !leaves?.length && (
          <div className="text-center py-10 text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No leave requests found</p>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-3">Reject Leave Request</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Reason for rejection (optional)"
              className="input mb-4" />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setRejectId(null); setRejectReason('') }}>Cancel</Button>
              <Button variant="danger" className="flex-1"
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: rejectId, status: 'rejected', rejectionReason: rejectReason })}>
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
