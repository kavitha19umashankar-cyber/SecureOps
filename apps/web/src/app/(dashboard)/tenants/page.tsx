'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, ToggleRight, ToggleLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { UserRole } from '@secureops/types'

interface Tenant {
  id: string; name: string; subdomain: string; plan: string; status: string
  maxEmployees: number; contactEmail?: string; contactPhone?: string
  trialEndsAt?: string; createdAt: string
}

const schema = z.object({
  name: z.string().min(2),
  subdomain: z.string().min(3).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminPhone: z.string().optional(),
  plan: z.enum(['trial', 'starter', 'growth', 'business', 'enterprise']).default('trial'),
  contactEmail: z.string().email().optional().or(z.literal('')),
})
type TenantForm = z.infer<typeof schema>

const planColors: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  growth: 'bg-green-100 text-green-700',
  business: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-orange-100 text-orange-700',
}

export default function TenantsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [showForm, setShowForm] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TenantForm>({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'trial' },
  })

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.get<{ success: boolean; data: Tenant[] }>('/tenants').then(r => r.data.data),
    enabled: user?.role === UserRole.SUPER_ADMIN,
  })

  const createTenant = useMutation({
    mutationFn: (data: TenantForm) => api.post('/tenants', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); setShowForm(false); reset() },
  })

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tenants/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  })

  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Access restricted to Super Admin only</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500">{tenants?.length ?? 0} agencies on platform</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Onboard Agency
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Onboard New Agency</h3>
          <form onSubmit={handleSubmit(d => createTenant.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Agency Name *</label>
              <input {...register('name')} className="input" placeholder="QuickGuard Security" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subdomain * (login code)</label>
              <input {...register('subdomain')} className="input" placeholder="quickguard" />
              {errors.subdomain && <p className="text-red-500 text-xs mt-1">{errors.subdomain.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Admin Name *</label>
              <input {...register('adminName')} className="input" placeholder="Rajesh Kumar" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Admin Email *</label>
              <input {...register('adminEmail')} type="email" className="input" placeholder="admin@agency.com" />
              {errors.adminEmail && <p className="text-red-500 text-xs mt-1">{errors.adminEmail.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Admin Phone</label>
              <input {...register('adminPhone')} className="input" placeholder="9876543210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Temporary Password *</label>
              <input {...register('adminPassword')} type="password" className="input" placeholder="Min 8 chars" />
              {errors.adminPassword && <p className="text-red-500 text-xs mt-1">{errors.adminPassword.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
              <select {...register('plan')} className="input">
                <option value="trial">Trial (14 days)</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            {createTenant.isError && (
              <div className="sm:col-span-2 text-red-500 text-sm">
                {(createTenant.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create'}
              </div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" type="button" onClick={() => { setShowForm(false); reset() }}>Cancel</Button>
              <Button type="submit" loading={createTenant.isPending}>Create Agency</Button>
            </div>
          </form>
        </div>
      )}

      {/* Tenant table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Agency', 'Subdomain', 'Plan', 'Status', 'Max Guards', 'Trial Ends', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
              ))}</tr>
            )) : tenants?.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  {t.contactEmail && <p className="text-xs text-gray-500">{t.contactEmail}</p>}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{t.subdomain}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${planColors[t.plan] ?? 'bg-gray-100 text-gray-600'}`}>{t.plan}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={t.status === 'active' ? 'success' : t.status === 'suspended' ? 'danger' : 'warning'}>
                    {t.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{t.maxEmployees}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {t.trialEndsAt ? format(parseISO(t.trialEndsAt), 'dd MMM yy') : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {format(parseISO(t.createdAt), 'dd MMM yy')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleStatus.mutate({ id: t.id, status: t.status === 'active' ? 'suspended' : 'active' })}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    {t.status === 'active'
                      ? <><ToggleRight className="w-4 h-4 text-green-500" /> Suspend</>
                      : <><ToggleLeft className="w-4 h-4" /> Activate</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !tenants?.length && (
          <div className="text-center py-10 text-gray-400">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No agencies onboarded yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
