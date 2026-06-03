'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Camera, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'

interface PhotoCheckin {
  id: string
  employeeId: string
  siteId: string
  photoUrl: string
  capturedAt: string
  lat?: number
  lng?: number
  isLate: boolean
  isLiveCaptured: boolean
  intervalNumber: number
}

interface Site { id: string; name: string }

export default function PhotoLogsPage() {
  const [siteId, setSiteId] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [preview, setPreview] = useState<PhotoCheckin | null>(null)

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ success: boolean; data: Site[] }>('/sites').then(r => r.data.data),
  })

  const { data: photos, isLoading } = useQuery({
    queryKey: ['photo-checkins', siteId, date],
    queryFn: () => api.get<{ success: boolean; data: PhotoCheckin[] }>(
      `/photo-checkins/site/${siteId}?date=${date}`
    ).then(r => r.data.data),
    enabled: !!siteId,
  })

  // Group by employee
  const grouped = photos?.reduce<Record<string, PhotoCheckin[]>>((acc, p) => {
    acc[p.employeeId] = [...(acc[p.employeeId] ?? []), p]
    return acc
  }, {}) ?? {}

  const totalLate = photos?.filter(p => p.isLate).length ?? 0
  const totalOnTime = photos?.filter(p => !p.isLate).length ?? 0

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={siteId} onChange={e => setSiteId(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">Select Site</option>
          {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" />

        {!!photos?.length && (
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">{totalOnTime} on time</span>
            </div>
            {totalLate > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-orange-600">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{totalLate} late</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!siteId ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-400">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Select a site to view photo check-ins</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-52 animate-pulse" />
          ))}
        </div>
      ) : !photos?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-400">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No photo check-ins found for this date</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-6 text-sm">
            <span className="text-gray-500">Total check-ins: <span className="font-semibold text-gray-900">{photos.length}</span></span>
            <span className="text-gray-500">Employees: <span className="font-semibold text-gray-900">{Object.keys(grouped).length}</span></span>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map(photo => (
              <button key={photo.id} onClick={() => setPreview(photo)}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-brand-200 transition-all text-left group">
                <div className="relative aspect-square bg-gray-100">
                  {/* Using img with the S3/MinIO URL directly */}
                  <img
                    src={photo.photoUrl}
                    alt="Photo check-in"
                    className="w-full h-full object-cover"
                    onError={e => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50" y="55" text-anchor="middle" font-size="12" fill="%239ca3af">No image</text></svg>'
                    }}
                  />
                  {photo.isLate && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded font-medium">Late</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>{format(new Date(photo.capturedAt), 'hh:mm a')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                    <span>Check #{photo.intervalNumber}</span>
                    <span className="ml-auto">
                      {photo.isLiveCaptured
                        ? <span className="text-green-600">Live</span>
                        : <span className="text-orange-500">Upload</span>}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-md w-full" onClick={e => e.stopPropagation()}>
            <img src={preview.photoUrl} alt="Photo check-in" className="w-full aspect-square object-cover" />
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium">{format(new Date(preview.capturedAt), 'hh:mm a, MMM d')}</span>
                </div>
                <Badge variant={preview.isLate ? 'warning' : 'success'}>
                  {preview.isLate ? 'Late' : 'On Time'}
                </Badge>
              </div>
              {preview.lat && preview.lng && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{preview.lat.toFixed(5)}, {preview.lng.toFixed(5)}</span>
                </div>
              )}
              <p className="text-xs text-gray-400">Check-in #{preview.intervalNumber} · {preview.isLiveCaptured ? 'Live capture' : 'Uploaded'}</p>
              <button onClick={() => setPreview(null)}
                className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
