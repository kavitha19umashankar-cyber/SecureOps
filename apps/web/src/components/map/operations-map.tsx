'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon paths broken by webpack
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const siteIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#2563eb;color:#fff;border-radius:50%;
    width:36px;height:36px;display:flex;align-items:center;justify-content:center;
    font-size:14px;font-weight:700;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.25)">S</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const guardIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#059669;color:#fff;border-radius:50%;
    width:30px;height:30px;display:flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:700;border:2px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.2)">G</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

interface Site {
  id: string; name: string; address: string
  lat: number; lng: number; radiusMeters: number; guardsOnDuty: number
}

interface Guard {
  attendance: { id: string; clockInTime?: string; clockInLat?: number; clockInLng?: number }
  employee: { id: string; name: string; employeeType: string } | null
}

function AutoCenter({ sites }: { sites: Site[] }) {
  const map = useMap()
  useEffect(() => {
    if (sites.length === 0) return
    if (sites.length === 1) {
      map.setView([sites[0]!.lat, sites[0]!.lng], 15)
    } else {
      const bounds = L.latLngBounds(sites.map(s => [s.lat, s.lng]))
      map.fitBounds(bounds, { padding: [60, 60] })
    }
  }, [sites, map])
  return null
}

export default function OperationsMap({ sites, guards }: { sites: Site[]; guards: Guard[] }) {
  const defaultCenter: [number, number] = sites[0]
    ? [sites[0].lat, sites[0].lng]
    : [20.5937, 78.9629] // India center

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <AutoCenter sites={sites} />

      {/* Site markers with geofence circle */}
      {sites.map(site => (
        <div key={site.id}>
          <Circle
            center={[site.lat, site.lng]}
            radius={site.radiusMeters}
            pathOptions={{
              color: site.guardsOnDuty > 0 ? '#059669' : '#6b7280',
              fillColor: site.guardsOnDuty > 0 ? '#059669' : '#6b7280',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '5 5',
            }}
          />
          <Marker position={[site.lat, site.lng]} icon={siteIcon}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-semibold text-gray-900 text-sm">{site.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{site.address}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${site.guardsOnDuty > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-xs font-medium">
                    {site.guardsOnDuty} guard{site.guardsOnDuty !== 1 ? 's' : ''} on duty
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Radius: {site.radiusMeters}m</p>
              </div>
            </Popup>
          </Marker>
        </div>
      ))}

      {/* Guard markers — plotted at their clock-in location */}
      {guards.map((g, i) => {
        const lat = g.attendance.clockInLat
        const lng = g.attendance.clockInLng
        if (!lat || !lng) return null
        return (
          <Marker key={i} position={[lat, lng]} icon={guardIcon}>
            <Popup>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{g.employee?.name ?? 'Guard'}</p>
                <p className="text-xs text-gray-500 capitalize">{g.employee?.employeeType?.replace('_', ' ')}</p>
                {g.attendance.clockInTime && (
                  <p className="text-xs text-green-600 mt-1">
                    Clocked in: {new Date(g.attendance.clockInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
