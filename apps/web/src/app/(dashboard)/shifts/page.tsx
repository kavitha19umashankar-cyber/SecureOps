'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Calendar, Clock, Users, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface Site { id: string; name: string }
interface Employee { id: string; name: string; employeeType: string }
interface Shift {
  id: string; siteId: string; template: string
  startTime: string; endTime: string; date: string; requiredCount: number
}
interface Allocation {
  allocation: { id: string; role: string; status: string }
  employee: { id: string; name: string; employeeType: string } | null
}

const shiftSchema = z.object({
  siteId: z.string().min(1, 'Select a site'),
  template: z.enum(['morning', 'afternoon', 'night', 'custom']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  date: z.string(),
  requiredCount: z.coerce.number().min(1),
})
type ShiftForm = z.infer<typeof shiftSchema>

const TEMPLATES: Record<string, { start: string; end: string }> = {
  morning: { start: '06:00', end: '14:00' },
  afternoon: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
  custom: { start: '09:00', end: '17:00' },
}

export default function ShiftsPage() {
  const qc = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showForm, setShowForm] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [allocatingTo, setAllocatingTo] = useState<string | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const fromDate = format(weekStart, 'yyyy-MM-dd')
  const toDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<{ success: boolean; data: Site[] }>('/sites').then(r => r.data.data),
  })

  const { data: employees } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => api.get<{ success: boolean; data: { items: Employee[] } }>('/employees?status=active&pageSize=100').then(r => r.data.data.items),
  })

  const { data: shifts } = useQuery({
    queryKey: ['shifts', fromDate, toDate],
    queryFn: () => api.get<{ success: boolean; data: Shift[] }>(`/shifts?from=${fromDate}&to=${toDate}`).then(r => r.data.data),
  })

  const { data: allocations } = useQuery({
    queryKey: ['allocations', selectedShift?.id],
    queryFn: () => api.get<{ success: boolean; data: Allocation[] }>(`/shifts/${selectedShift!.id}/allocations`).then(r => r.data.data),
    enabled: !!selectedShift,
  })

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { template: 'morning', startTime: '06:00', endTime: '14:00', requiredCount: 1 },
  })

  const template = watch('template')

  const createShift = useMutation({
    mutationFn: (data: ShiftForm) => api.post('/shifts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setShowForm(false); reset() },
  })

  const allocateMutation = useMutation({
    mutationFn: (employeeId: string) =>
      api.post(`/shifts/${selectedShift!.id}/allocate`, { employeeId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['allocations'] }); setAllocatingTo(null) },
  })

  const removeAllocation = useMutation({
    mutationFn: (allocationId: string) =>
      api.delete(`/shifts/${selectedShift!.id}/allocations/${allocationId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations'] }),
  })

  const shiftsForDay = (date: Date) =>
    shifts?.filter(s => isSameDay(parseISO(s.date), date)) ?? []

  const siteMap = Object.fromEntries(sites?.map(s => [s.id, s.name]) ?? [])

  const templateColors: Record<string, string> = {
    morning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    afternoon: 'bg-blue-50 border-blue-200 text-blue-800',
    night: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    custom: 'bg-gray-50 border-gray-200 text-gray-800',
  }

  return (
    <div className="space-y-5">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekStart(d => addDays(d, -7))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
            Today
          </button>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Create Shift
        </Button>
      </div>

      {/* Create shift form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Create New Shift</h3>
          <form onSubmit={handleSubmit(d => createShift.mutate(d))} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Site *</label>
              <select {...register('siteId')} className="input">
                <option value="">Select site</option>
                {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {errors.siteId && <p className="text-red-500 text-xs mt-1">{errors.siteId.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Shift Type</label>
              <select {...register('template')} className="input" onChange={e => {
                const t = e.target.value as keyof typeof TEMPLATES
                setValue('template', t)
                if (TEMPLATES[t]) {
                  setValue('startTime', TEMPLATES[t]!.start)
                  setValue('endTime', TEMPLATES[t]!.end)
                }
              }}>
                <option value="morning">Morning (6AM–2PM)</option>
                <option value="afternoon">Afternoon (2PM–10PM)</option>
                <option value="night">Night (10PM–6AM)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input {...register('date')} type="date" className="input"
                defaultValue={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
              <input {...register('startTime')} className="input" placeholder="06:00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
              <input {...register('endTime')} className="input" placeholder="14:00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Guards Required</label>
              <input {...register('requiredCount')} type="number" min={1} className="input" />
            </div>
            <div className="col-span-2 sm:col-span-3 flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" loading={createShift.isPending}>Create Shift</Button>
            </div>
          </form>
        </div>
      )}

      {/* Weekly calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map(day => (
            <div key={day.toISOString()} className={`px-3 py-2 text-center border-r border-gray-100 last:border-0 ${isSameDay(day, new Date()) ? 'bg-brand-50' : ''}`}>
              <p className="text-xs font-medium text-gray-500">{format(day, 'EEE')}</p>
              <p className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-brand-600' : 'text-gray-900'}`}>
                {format(day, 'd')}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-48">
          {weekDays.map(day => (
            <div key={day.toISOString()} className={`p-2 border-r border-gray-100 last:border-0 space-y-1.5 ${isSameDay(day, new Date()) ? 'bg-brand-50/30' : ''}`}>
              {shiftsForDay(day).map(shift => (
                <button key={shift.id} onClick={() => setSelectedShift(s => s?.id === shift.id ? null : shift)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs font-medium transition-all hover:shadow-sm ${templateColors[shift.template] ?? ''} ${selectedShift?.id === shift.id ? 'ring-2 ring-brand-400' : ''}`}>
                  <div className="font-semibold truncate">{siteMap[shift.siteId] ?? 'Site'}</div>
                  <div className="text-xs opacity-75">{shift.startTime}–{shift.endTime}</div>
                  <div className="flex items-center gap-1 mt-0.5 opacity-70">
                    <Users className="w-2.5 h-2.5" />
                    <span>{shift.requiredCount} req</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Shift detail + allocations panel */}
      {selectedShift && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                {siteMap[selectedShift.siteId]} — {selectedShift.startTime}–{selectedShift.endTime}
              </h3>
              <p className="text-sm text-gray-500 capitalize">
                {selectedShift.template} shift · {format(parseISO(selectedShift.date), 'EEEE, MMM d')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={allocations?.length === selectedShift.requiredCount ? 'success' : 'warning'}>
                {allocations?.length ?? 0}/{selectedShift.requiredCount} assigned
              </Badge>
              <button onClick={() => setSelectedShift(null)} className="text-gray-400 hover:text-gray-600 text-xs">Close</button>
            </div>
          </div>

          {/* Assigned guards */}
          <div className="space-y-2 mb-4">
            {allocations?.map(({ allocation, employee }) => (
              <div key={allocation.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {employee?.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{employee?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-500 capitalize">{employee?.employeeType?.replace('_', ' ')}</p>
                </div>
                <Badge variant={allocation.status === 'assigned' ? 'info' : allocation.status === 'confirmed' ? 'success' : 'default'}>
                  {allocation.status}
                </Badge>
                <button onClick={() => removeAllocation.mutate(allocation.id)}
                  className="text-gray-400 hover:text-red-500 p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {!allocations?.length && (
              <p className="text-sm text-gray-400 text-center py-2">No employees assigned yet</p>
            )}
          </div>

          {/* Add employee */}
          <div className="flex items-center gap-2">
            <select value={allocatingTo ?? ''}
              onChange={e => setAllocatingTo(e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select employee to assign...</option>
              {employees
                ?.filter(e => !allocations?.some(a => a.employee?.id === e.id))
                .map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.employeeType.replace('_', ' ')})</option>
                ))}
            </select>
            <Button size="sm" disabled={!allocatingTo} loading={allocateMutation.isPending}
              onClick={() => allocatingTo && allocateMutation.mutate(allocatingTo)}>
              Assign
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
