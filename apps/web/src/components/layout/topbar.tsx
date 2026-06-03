'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string; type: string; title: string; body: string; readAt?: string; createdAt: string
}

const titleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/employees': 'Employees',
  '/clients': 'Clients',
  '/sites': 'Sites',
  '/shifts': 'Shift Scheduling',
  '/attendance': 'Attendance',
  '/photo-logs': 'Photo Logs',
  '/incidents': 'Incidents',
  '/leaves': 'Leave Management',
  '/payroll': 'Payroll',
  '/invoices': 'Invoices',
  '/tenants': 'Tenant Management',
  '/settings': 'Settings',
  '/live-map': 'Live Operations Map',
  '/reports': 'Reports',
}

export function TopBar() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const title = Object.entries(titleMap).find(([key]) => pathname.startsWith(key))?.[1] ?? 'SecureOps'

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ success: boolean; data: Notification[] }>('/notifications').then(r => r.data.data).catch(() => [] as Notification[]),
    refetchInterval: 60_000,
    enabled: !!user,
  })

  const unreadCount = notifications?.filter(n => !n.readAt).length ?? 0

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const typeIcon: Record<string, string> = {
    INCIDENT: '🚨', ATTENDANCE: '✅', PHOTO_CHECKIN: '📷', PAYSLIP: '💰', LEAVE: '📅', SOS: '🆘',
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notifications bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="relative p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs text-brand-600 font-medium">{unreadCount} unread</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!notifications?.length ? (
                  <div className="text-center py-8 text-gray-400">
                    <Bell className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <p className="text-xs">No notifications</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${!n.readAt ? 'bg-blue-50/40' : ''}`}>
                      <span className="text-base shrink-0 mt-0.5">{typeIcon[n.type] ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.readAt && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold">
          {user?.name?.[0]?.toUpperCase()}
        </div>
      </div>
    </header>
  )
}
