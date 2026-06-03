'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Building2, Mail, Phone, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'

interface Client {
  id: string
  name: string
  gstNumber?: string
  billingAddress: string
  billingState?: string
  contactEmail?: string
  contactPhone?: string
  contactPersonName?: string
  isActive: boolean
  portalAccessEnabled: boolean
  createdAt: string
}

const clientSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  gstNumber: z.string().optional(),
  billingAddress: z.string().min(5, 'Address is required'),
  billingState: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  contactPersonName: z.string().optional(),
})
type ClientForm = z.infer<typeof clientSchema>

export default function ClientsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get<{ success: boolean; data: Client[] }>('/clients').then(r => r.data.data),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
  })

  const saveMutation = useMutation({
    mutationFn: (data: ClientForm) =>
      editing
        ? api.patch(`/clients/${editing.id}`, data)
        : api.post('/clients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setShowForm(false)
      setEditing(null)
      reset()
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: (client: Client) =>
      api.patch(`/clients/${client.id}`, { isActive: !client.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  const openEdit = (client: Client) => {
    setEditing(client)
    setValue('name', client.name)
    setValue('gstNumber', client.gstNumber ?? '')
    setValue('billingAddress', client.billingAddress)
    setValue('billingState', client.billingState ?? '')
    setValue('contactEmail', client.contactEmail ?? '')
    setValue('contactPhone', client.contactPhone ?? '')
    setValue('contactPersonName', client.contactPersonName ?? '')
    setShowForm(true)
  }

  const filtered = clients?.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <Button onClick={() => { setEditing(null); reset(); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Add Client
        </Button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{editing ? 'Edit Client' : 'New Client'}</h3>
          <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name *</label>
              <input {...register('name')} className="input" placeholder="Infosys Ltd" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">GST Number</label>
              <input {...register('gstNumber')} className="input" placeholder="27AABCU9603R1ZX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Person</label>
              <input {...register('contactPersonName')} className="input" placeholder="Arjun Nair" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input {...register('contactEmail')} type="email" className="input" placeholder="contact@company.com" />
              {errors.contactEmail && <p className="text-red-500 text-xs mt-1">{errors.contactEmail.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input {...register('contactPhone')} className="input" placeholder="9876543210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
              <input {...register('billingState')} className="input" placeholder="Karnataka" />
            </div>
            <div>
              {/* spacer */}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Billing Address *</label>
              <textarea {...register('billingAddress')} rows={2} className="input" placeholder="Full billing address" />
              {errors.billingAddress && <p className="text-red-500 text-xs mt-1">{errors.billingAddress.message}</p>}
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" type="button" onClick={() => { setShowForm(false); setEditing(null); reset() }}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>Save Client</Button>
            </div>
          </form>
        </div>
      )}

      {/* Client cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map(client => (
            <Card key={client.id}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-blue-50 p-2 rounded-lg shrink-0">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{client.name}</p>
                      {client.gstNumber && <p className="text-xs text-gray-500 font-mono">{client.gstNumber}</p>}
                    </div>
                  </div>
                  <Badge variant={client.isActive ? 'success' : 'default'}>
                    {client.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                  {client.contactPersonName && <p className="font-medium text-gray-700">{client.contactPersonName}</p>}
                  {client.contactEmail && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <span>{client.contactEmail}</span>
                    </div>
                  )}
                  {client.contactPhone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-gray-400" />
                      <span>{client.contactPhone}</span>
                    </div>
                  )}
                  <p className="text-gray-400 line-clamp-1">{client.billingAddress}</p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(client)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => toggleActiveMutation.mutate(client)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 ml-auto">
                    {client.isActive
                      ? <><ToggleRight className="w-3.5 h-3.5 text-green-500" /> Deactivate</>
                      : <><ToggleLeft className="w-3.5 h-3.5" /> Activate</>}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !filtered?.length && (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search ? 'No clients match your search' : 'No clients added yet'}</p>
        </div>
      )}
    </div>
  )
}
