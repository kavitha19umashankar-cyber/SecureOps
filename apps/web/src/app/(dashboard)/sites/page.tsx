'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Search } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { Site } from '@secureops/types'

export default function SitesPage() {
  const [search, setSearch] = useState('')

  const { data: sites, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ success: boolean; data: Site[] }>('/sites').then((r) => r.data.data),
  })

  const filtered = sites?.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sites..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Link href="/sites/new">
          <Button><Plus className="w-4 h-4" /> Add Site</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-brand-50 p-2 rounded-lg">
                      <MapPin className="w-4 h-4 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{site.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{site.siteType?.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <Badge variant={site.isActive ? 'success' : 'default'}>
                    {site.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{site.address}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Radius: {site.radiusMeters}m</span>
                  <span>Photo: every {site.photoCheckinIntervalMinutes}min</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && !filtered?.length && (
        <div className="text-center py-12 text-gray-400">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No sites found</p>
        </div>
      )}
    </div>
  )
}
