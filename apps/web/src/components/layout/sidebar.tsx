'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield, Users, MapPin, Calendar, Clock, Camera, AlertTriangle,
  FileText, DollarSign, BarChart3, Settings, LogOut, Building2, Map,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/auth'
import { UserRole } from '@secureops/types'

const ALL = 'all'

const navSections = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: BarChart3, roles: ALL },
      { label: 'Live Map', href: '/live-map', icon: Map, roles: [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SITE_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.CLIENT] },
      { label: 'Attendance', href: '/attendance', icon: Clock, roles: ALL },
      { label: 'Photo Logs', href: '/photo-logs', icon: Camera, roles: [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SITE_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.CLIENT] },
      { label: 'Incidents', href: '/incidents', icon: AlertTriangle, roles: ALL },
    ],
  },
  {
    label: 'Workforce',
    items: [
      { label: 'Employees', href: '/employees', icon: Users, roles: [UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN] },
      { label: 'Shifts', href: '/shifts', icon: Calendar, roles: [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SITE_SUPERVISOR, UserRole.SUPER_ADMIN] },
      { label: 'Leaves', href: '/leaves', icon: FileText, roles: [UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.SITE_SUPERVISOR, UserRole.SUPER_ADMIN] },
    ],
  },
  {
    label: 'Clients & Sites',
    items: [
      { label: 'Clients', href: '/clients', icon: Building2, roles: [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN] },
      { label: 'Sites', href: '/sites', icon: MapPin, roles: [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Payroll', href: '/payroll', icon: DollarSign, roles: [UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN] },
      { label: 'Invoices', href: '/invoices', icon: FileText, roles: [UserRole.AGENCY_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3, roles: [UserRole.AGENCY_ADMIN, UserRole.HR_MANAGER, UserRole.OPERATIONS_MANAGER, UserRole.SUPER_ADMIN] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Tenants', href: '/tenants', icon: Shield, roles: [UserRole.SUPER_ADMIN] },
      { label: 'Settings', href: '/settings', icon: Settings, roles: ALL },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-full shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100 shrink-0">
        <div className="bg-brand-600 text-white p-1.5 rounded-lg">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-gray-900 text-sm">SecureOps</span>
          {user?.role && (
            <p className="text-xs text-gray-400 capitalize">{user.role.replace(/_/g, ' ')}</p>
          )}
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-3 px-2 space-y-5">
        {navSections.map(section => {
          const visible = section.items.filter(item => {
            if (item.roles === ALL) return true
            return user?.role && (item.roles as string[]).includes(user.role)
          })
          if (!visible.length) return null

          return (
            <div key={section.label}>
              <p className="px-2 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link key={item.href} href={item.href}
                      className={clsx(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )}>
                      <item.icon className={clsx('w-4 h-4 shrink-0', active ? 'text-brand-600' : 'text-gray-400')} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User info */}
      <div className="px-3 py-3 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email ?? '—'}</p>
          </div>
        </div>
        <button onClick={logout}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors w-full px-1 py-1 rounded">
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
