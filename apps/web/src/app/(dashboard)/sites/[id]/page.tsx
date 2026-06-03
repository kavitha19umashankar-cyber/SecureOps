'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { ArrowLeft, MapPin, Phone, Edit2, Save, X, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface Site {
  id: string; tenantId: string; clientId: string; name: string; address: string
  lat: number; lng: number; radiusMeters: number; siteType: string
  photoCheckinIntervalMinutes: number; postOrders?: string; isActive: boolean
  emergencyContacts: Array<{ name: string; phone: string; role: string }>
  createdAt: string
}

interface Contract {
  id: string; startDate: string; endDate?: string; billingRatePerDay: string
  overtimeBillingRate?: string; currency: string; requiredHeadcount: number
  agencyState?: string; isActive: boolean; createdAt: string
}

const SITE_TYPES = ['office','factory','hospital','mall','residential','educational','warehouse','bank','hotel','other']

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'details' | 'contracts' | 'post-orders'>('details')
  const [editing, setEditing] = useState(false)
  const [showContractForm, setShowContractForm] = useState(false)
  const [contacts, setContacts] = useState<Array<{ name: string; phone: string; role: string }>>([])

  const { data: site, isLoading } = useQuery<Site>({
    queryKey: ['site', id],
    queryFn: (): Promise<Site> => api.get<{ success: boolean; data: Site }>(`/sites/${id}`).then(r => r.data.data),
  })

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ['site-contracts', id],
    queryFn: (): Promise<Contract[]> => api.get<{ success: boolean; data: Contract[] }>(`/sites/${id}/contracts`).then(r => r.data.data),
    enabled: tab === 'contracts',
  })

  const { register, handleSubmit, reset } = useForm<Omit<Site, 'id' | 'tenantId' | 'createdAt' | 'emergencyContacts'>>()

  const { register: regC, handleSubmit: handleC, reset: resetC } = useForm<{
    startDate: string; endDate?: string; billingRatePerDay: number; overtimeBillingRate?: number
    currency: string; requiredHeadcount: number; agencyState?: string
  }>()

  const updateSite = useMutation({
    mutationFn: (data: Partial<Site>) => api.patch(`/sites/${id}`, { ...data, emergencyContacts: contacts }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['site', id] }); setEditing(false) },
  })

  const addContract = useMutation({
    mutationFn: (data: object) => api.post(`/sites/${id}/contracts`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['site-contracts', id] }); setShowContractForm(false); resetC() },
  })

  const startEdit = () => {
    if (site) {
      reset(site)
      setContacts(site.emergencyContacts ?? [])
    }
    setEditing(true)
  }

  const inr = (v: string | number) => '₹' + Number(v).toLocaleString('en-IN')

  if (isLoading) return <div className="bg-white rounded-xl border h-64 animate-pulse" />
  if (!site) return <p className="text-gray-500">Site not found</p>

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/sites" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{site.name}</h2>
          <p className="text-sm text-gray-500">{site.address}</p>
        </div>
        <Badge variant={site.isActive ? 'success' : 'default'}>{site.isActive ? 'Active' : 'Inactive'}</Badge>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Edit2 className="w-3.5 h-3.5 mr-1.5" />Edit
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['details', 'contracts', 'post-orders'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setEditing(false) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {tab === 'details' && !editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle><MapPin className="w-4 h-4 inline mr-2" />Location</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ['Address', site.address],
                ['Coordinates', `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`],
                ['Geofence Radius', `${site.radiusMeters}m`],
                ['Site Type', site.siteType.replace('_', ' ')],
                ['Photo Check-in', `Every ${site.photoCheckinIntervalMinutes} min`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{k}</span>
                  <span className="text-gray-900 text-right capitalize">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {site.emergencyContacts?.length > 0 && (
            <Card>
              <CardHeader><CardTitle><Phone className="w-4 h-4 inline mr-2" />Emergency Contacts</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {site.emergencyContacts.map((c, i) => (
                  <div key={i} className="text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-gray-500">{c.phone} · {c.role}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit form */}
      {tab === 'details' && editing && (
        <form onSubmit={handleSubmit(data => updateSite.mutate(data))} className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Edit Site Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Site Name</label>
                <input {...register('name')} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input {...register('address')} className="input" />
              </div>
              <div>
                <label className="label">Latitude</label>
                <input type="number" step="any" {...register('lat', { valueAsNumber: true })} className="input" />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input type="number" step="any" {...register('lng', { valueAsNumber: true })} className="input" />
              </div>
              <div>
                <label className="label">Geofence Radius (m)</label>
                <input type="number" {...register('radiusMeters', { valueAsNumber: true })} className="input" />
              </div>
              <div>
                <label className="label">Photo Check-in Interval (min)</label>
                <input type="number" {...register('photoCheckinIntervalMinutes', { valueAsNumber: true })} className="input" />
              </div>
              <div>
                <label className="label">Site Type</label>
                <select {...register('siteType')} className="input">
                  {SITE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contacts editor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Emergency Contacts</CardTitle>
              <button type="button" onClick={() => setContacts(c => [...c, { name: '', phone: '', role: '' }])}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" />Add
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {contacts.map((c, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="label">Name</label>
                    <input value={c.name} onChange={e => setContacts(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="label">Phone</label>
                    <input value={c.phone} onChange={e => setContacts(cs => cs.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="label">Role</label>
                    <input value={c.role} onChange={e => setContacts(cs => cs.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} className="input" />
                  </div>
                  <button type="button" onClick={() => setContacts(cs => cs.filter((_, j) => j !== i))}
                    className="p-2 text-red-400 hover:text-red-600 mb-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {contacts.length === 0 && <p className="text-sm text-gray-400">No emergency contacts</p>}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" loading={updateSite.isPending}><Save className="w-4 h-4 mr-1.5" />Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}><X className="w-4 h-4 mr-1.5" />Cancel</Button>
          </div>
        </form>
      )}

      {/* Contracts tab */}
      {tab === 'contracts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowContractForm(v => !v)}>
              <Plus className="w-4 h-4 mr-1.5" />Add Contract
            </Button>
          </div>

          {showContractForm && (
            <Card>
              <CardHeader><CardTitle>New Contract</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleC(data => addContract.mutate(data))} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Start Date</label>
                    <input type="date" {...regC('startDate')} className="input" required />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input type="date" {...regC('endDate')} className="input" />
                  </div>
                  <div>
                    <label className="label">Billing Rate / Day (₹)</label>
                    <input type="number" step="0.01" {...regC('billingRatePerDay', { valueAsNumber: true })} className="input" required />
                  </div>
                  <div>
                    <label className="label">Overtime Rate / Hour (₹)</label>
                    <input type="number" step="0.01" {...regC('overtimeBillingRate', { valueAsNumber: true })} className="input" />
                  </div>
                  <div>
                    <label className="label">Required Headcount</label>
                    <input type="number" {...regC('requiredHeadcount', { valueAsNumber: true })} defaultValue={1} className="input" />
                  </div>
                  <div>
                    <label className="label">Agency State</label>
                    <input {...regC('agencyState')} placeholder="e.g. Maharashtra" className="input" />
                  </div>
                  <div className="col-span-2 flex gap-3">
                    <Button type="submit" size="sm" loading={addContract.isPending}>Save Contract</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowContractForm(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {contracts?.map(c => (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm flex-1">
                      <div><span className="text-gray-500">Period </span><span className="font-medium">{c.startDate} → {c.endDate ?? 'Ongoing'}</span></div>
                      <div><span className="text-gray-500">Billing </span><span className="font-medium">{inr(c.billingRatePerDay)}/day</span></div>
                      {c.overtimeBillingRate && <div><span className="text-gray-500">Overtime </span><span className="font-medium">{inr(c.overtimeBillingRate)}/hr</span></div>}
                      <div><span className="text-gray-500">Guards required </span><span className="font-medium">{c.requiredHeadcount}</span></div>
                      {c.agencyState && <div><span className="text-gray-500">State </span><span className="font-medium">{c.agencyState}</span></div>}
                    </div>
                    <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Closed'}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Created {format(new Date(c.createdAt), 'dd MMM yyyy')}</p>
                </CardContent>
              </Card>
            ))}
            {!contracts?.length && (
              <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-200">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No contracts yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post orders tab */}
      {tab === 'post-orders' && (
        <Card>
          <CardHeader>
            <CardTitle>Post Orders / Standing Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleSubmit(data => updateSite.mutate({ postOrders: data.postOrders }))}>
                <textarea {...register('postOrders')} rows={12}
                  className="input w-full font-mono text-sm" placeholder="Enter standing instructions for guards at this site..." />
                <div className="flex gap-3 mt-4">
                  <Button type="submit" size="sm" loading={updateSite.isPending}><Save className="w-4 h-4 mr-1.5" />Save</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div>
                {site.postOrders ? (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{site.postOrders}</pre>
                ) : (
                  <p className="text-sm text-gray-400">No post orders have been set for this site.</p>
                )}
                <Button size="sm" variant="outline" className="mt-4" onClick={startEdit}>
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />{site.postOrders ? 'Edit' : 'Add'} Post Orders
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
