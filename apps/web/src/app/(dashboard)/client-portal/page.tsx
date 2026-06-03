'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import {
  MapPin, FileText, Users, AlertTriangle, TrendingUp,
  CheckCircle, Clock, AlertCircle, Building2
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { api } from '@/lib/api'

interface Site {
  id: string; name: string; address: string; siteType: string
  isActive: boolean; radiusMeters: number; photoCheckinIntervalMinutes: number
}

interface Invoice {
  id: string; invoiceNumber: string; periodStart: string; periodEnd: string
  totalAmount: string; paidAmount: string; status: string; dueDate: string; createdAt: string
}

interface Incident {
  id: string; title: string; category: string; severity: string
  status: string; occurredAt: string
}

interface AttendanceSummary {
  date: string; present: number; absent: number; total: number
}

const severityColor: Record<string, string> = {
  low: 'text-blue-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600'
}

const statusBadge: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  paid: 'success', overdue: 'danger', partially_paid: 'warning',
  pending_approval: 'warning', approved: 'default', sent: 'default',
}

const inr = (v: string | number) => '₹' + Number(v).toLocaleString('en-IN')

export default function ClientPortalPage() {
  const { user } = useAuthStore()

  const { data: sites, isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ['client-sites'],
    queryFn: (): Promise<Site[]> => api.get<{ success: boolean; data: Site[] }>('/sites').then(r => r.data.data),
  })

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['client-invoices'],
    queryFn: (): Promise<Invoice[]> => api.get<{ success: boolean; data: Invoice[] }>('/invoices').then(r => r.data.data),
  })

  const { data: incidents, isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ['client-incidents'],
    queryFn: (): Promise<Incident[]> => api.get<{ success: boolean; data: Incident[] }>('/incidents').then(r => r.data.data),
  })

  const activeSites = sites?.filter(s => s.isActive).length ?? 0
  const totalSites = sites?.length ?? 0
  const outstandingInvoices = invoices?.filter(i => !['paid', 'cancelled'].includes(i.status)) ?? []
  const totalOutstanding = outstandingInvoices.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0)
  const openIncidents = incidents?.filter(i => !['resolved', 'closed'].includes(i.status)).length ?? 0
  const recentInvoices = [...(invoices ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
  const recentIncidents = [...(incidents ?? [])].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 text-white rounded-2xl px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
            <p className="text-brand-200 text-sm mt-0.5">Client Portal — Security Services Overview</p>
          </div>
          <div className="bg-white/10 p-3 rounded-xl">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5">
          {[
            { label: 'Active Sites', value: `${activeSites}/${totalSites}`, icon: MapPin },
            { label: 'Outstanding', value: inr(totalOutstanding), icon: FileText },
            { label: 'Open Incidents', value: openIncidents, icon: AlertTriangle },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2.5">
              <s.icon className="w-4 h-4 text-brand-200 mb-1" />
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs text-brand-200">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sites */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle><MapPin className="w-4 h-4 inline mr-2" />Your Sites</CardTitle>
            <Link href="/sites" className="text-xs text-brand-600 hover:underline">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {sitesLoading ? (
              <div className="space-y-2 p-4">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : sites?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No sites assigned</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {sites?.map(site => (
                  <Link key={site.id} href={`/sites/${site.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${site.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{site.name}</p>
                      <p className="text-xs text-gray-500 truncate">{site.address}</p>
                    </div>
                    <span className="text-xs text-gray-400 capitalize shrink-0">{site.siteType.replace('_', ' ')}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle><FileText className="w-4 h-4 inline mr-2" />Recent Invoices</CardTitle>
            <Link href="/invoices" className="text-xs text-brand-600 hover:underline">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {invoicesLoading ? (
              <div className="space-y-2 p-4">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : recentInvoices.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No invoices yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentInvoices.map(inv => {
                  const balance = Number(inv.totalAmount) - Number(inv.paidAmount)
                  const overdue = inv.status !== 'paid' && new Date(inv.dueDate) < new Date()
                  return (
                    <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 font-mono">{inv.invoiceNumber}</p>
                          {overdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                        <p className="text-xs text-gray-500">
                          {format(parseISO(inv.periodStart), 'dd MMM')} – {format(parseISO(inv.periodEnd), 'dd MMM yyyy')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900">{inr(inv.totalAmount)}</p>
                        {balance > 0 && <p className="text-xs text-red-600">Due: {inr(balance)}</p>}
                      </div>
                      <Badge variant={statusBadge[inv.status] ?? 'default'}>{inv.status.replace('_', ' ')}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle><AlertTriangle className="w-4 h-4 inline mr-2" />Recent Incidents at Your Sites</CardTitle>
            <Link href="/incidents" className="text-xs text-brand-600 hover:underline">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {incidentsLoading ? (
              <div className="space-y-2 p-4">{[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
            ) : recentIncidents.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">No incidents reported</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentIncidents.map(inc => (
                  <div key={inc.id} className="flex items-start gap-3 px-4 py-3">
                    <div className={`mt-0.5 shrink-0 ${severityColor[inc.severity] ?? 'text-gray-500'}`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{inc.title}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">
                        {inc.category.replace('_', ' ')} · {format(new Date(inc.occurredAt), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={inc.severity === 'critical' ? 'danger' : inc.severity === 'high' ? 'warning' : 'default'}>
                        {inc.severity}
                      </Badge>
                      <Badge variant={['resolved', 'closed'].includes(inc.status) ? 'success' : 'default'}>
                        {inc.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
