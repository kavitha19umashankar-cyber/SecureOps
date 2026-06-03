'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Users, MapPin, RefreshCw, Circle } from 'lucide-react'
import { api } from '@/lib/api'

interface SiteHeadcount {
  id: string; name: string; address: string
  lat: number; lng: number; radiusMeters: number; guardsOnDuty: number
}

interface LiveGuard {
  attendance: {
    id: string; clockInTime?: string; clockOutTime?: string
    clockInLat?: number; clockInLng?: number
  }
  employee: { id: string; name: string; photoUrl?: string; employeeType: string } | null
}

// Leaflet must be loaded client-side only (no SSR)
const MapView = dynamic(() => import('@/components/map/operations-map'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-gray-100 rounded-xl flex items-center justify-center">
      <div className="text-center text-gray-400">
        <MapPin className="w-8 h-8 mx-auto mb-2 animate-pulse" />
        <p className="text-sm">Loading map…</p>
      </div>
    </div>
  ),
})

export default function LiveMapPage() {
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const { data: sites, isLoading: sitesLoading, dataUpdatedAt } = useQuery<SiteHeadcount[]>({
    queryKey: ['sites-headcount'],
    queryFn: (): Promise<SiteHeadcount[]> => api.get<{ success: boolean; data: SiteHeadcount[] }>('/reports/sites/headcount').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (dataUpdatedAt) setLastRefresh(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const { data: liveGuards } = useQuery<LiveGuard[]>({
    queryKey: ['live-attendance'],
    queryFn: () => api.get<{ success: boolean; data: LiveGuard[] }>('/dashboard/live-attendance').then(r => r.data.data),
    refetchInterval: 15_000,
  })

  const totalOnDuty = sites?.reduce((sum, s) => sum + s.guardsOnDuty, 0) ?? 0
  const activeSites = sites?.filter(s => s.guardsOnDuty > 0).length ?? 0

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* Stats bar */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-700">Live</span>
          <span className="text-xs text-gray-400">· Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Users className="w-4 h-4 text-green-600" />
          <span className="font-semibold text-gray-900">{totalOnDuty}</span>
          <span className="text-gray-500">guards on duty</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-gray-900">{activeSites}</span>
          <span className="text-gray-500">active sites</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm ml-auto">
          <span className="text-xs text-gray-400">Auto-refresh every 30s</span>
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          {!sitesLoading && sites && (
            <MapView sites={sites} guards={liveGuards ?? []} />
          )}
        </div>

        {/* Side panel — guards list */}
        <div className="w-64 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Guards On Duty</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            {liveGuards?.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No guards on duty</p>
              </div>
            )}
            {liveGuards?.map((g, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {g.employee?.name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{g.employee?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-500 capitalize">{g.employee?.employeeType?.replace('_', ' ') ?? '—'}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              </div>
            ))}
          </div>

          {/* Site headcount */}
          <div className="border-t border-gray-100">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sites</h3>
            </div>
            {sites?.map(site => (
              <div key={site.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
                <div className={`w-2 h-2 rounded-full shrink-0 ${site.guardsOnDuty > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <p className="text-xs text-gray-700 flex-1 truncate">{site.name}</p>
                <span className={`text-xs font-semibold ${site.guardsOnDuty > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {site.guardsOnDuty}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
