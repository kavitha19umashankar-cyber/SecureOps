'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Search } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import type { Incident } from '@secureops/types'

const severityVariant = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
} as const

const statusVariant = {
  raised: 'danger',
  acknowledged: 'warning',
  under_investigation: 'info',
  resolved: 'success',
  escalated: 'danger',
  closed: 'default',
} as const

export default function IncidentsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', status],
    queryFn: () =>
      api.get<{ success: boolean; data: Incident[] }>('/incidents', { params: { status } })
        .then((r) => r.data.data),
  })

  const filtered = data?.filter((i) =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incidents..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="raised">Raised</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="under_investigation">Under Investigation</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Incident</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : filtered?.map((inc) => (
                  <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-900">{inc.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{inc.category.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <Badge variant={severityVariant[inc.severity] ?? 'default'}>{inc.severity}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[inc.status] ?? 'default'}>
                        {inc.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(inc.occurredAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/incidents/${inc.id}`} className="text-xs text-brand-600 hover:underline font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && !filtered?.length && (
          <div className="text-center py-10 text-gray-400 text-sm">No incidents found</div>
        )}
      </div>
    </div>
  )
}
