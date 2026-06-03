'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin, Clock, Route, Shield, CheckCircle2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface Checkpoint {
  id: string; name: string; description?: string; lat: number; lng: number
  radiusMeters: number; orderIndex: number
}

interface PatrolRoute {
  id: string; siteId: string; name: string; description?: string
  estimatedDurationMinutes: number; isActive: boolean; checkpoints?: Checkpoint[]
}

interface PatrolLog {
  id: string; status: string; startedAt?: string; completedAt?: string
  totalCheckpoints: number; scannedCheckpoints: number; notes?: string; createdAt: string
}

interface Site { id: string; name: string }

const statusBadge: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  completed: 'success', in_progress: 'warning', missed: 'danger', pending: 'default',
}

export default function PatrolPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logsRouteId, setLogsRouteId] = useState<string | null>(null)
  const [addingCpTo, setAddingCpTo] = useState<string | null>(null)

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: (): Promise<Site[]> => api.get<{ success: boolean; data: Site[] }>('/sites').then(r => r.data.data),
  })

  const { data: routes, isLoading } = useQuery<PatrolRoute[]>({
    queryKey: ['patrol-routes'],
    queryFn: (): Promise<PatrolRoute[]> =>
      api.get<{ success: boolean; data: PatrolRoute[] }>('/patrol-routes').then(r => r.data.data),
  })

  const { data: routeDetail } = useQuery<PatrolRoute>({
    queryKey: ['patrol-route', expandedId],
    queryFn: (): Promise<PatrolRoute> =>
      api.get<{ success: boolean; data: PatrolRoute }>(`/patrol-routes/${expandedId}`).then(r => r.data.data),
    enabled: !!expandedId,
  })

  const { data: logs } = useQuery<PatrolLog[]>({
    queryKey: ['patrol-logs', logsRouteId],
    queryFn: (): Promise<PatrolLog[]> =>
      api.get<{ success: boolean; data: PatrolLog[] }>(`/patrol-routes/${logsRouteId}/logs`).then(r => r.data.data),
    enabled: !!logsRouteId,
  })

  const { register, handleSubmit, reset } = useForm<{
    siteId: string; name: string; description?: string; estimatedDurationMinutes: number
  }>()

  const { register: regCp, handleSubmit: handleCp, reset: resetCp } = useForm<{
    name: string; lat: number; lng: number; radiusMeters: number; orderIndex: number
  }>()

  const create = useMutation({
    mutationFn: (data: object) => api.post('/patrol-routes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patrol-routes'] }); reset(); setShowForm(false) },
  })

  const deleteRoute = useMutation({
    mutationFn: (id: string) => api.delete(`/patrol-routes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol-routes'] }),
  })

  const addCheckpoint = useMutation({
    mutationFn: ({ routeId, data }: { routeId: string; data: object }) =>
      api.post(`/patrol-routes/${routeId}/checkpoints`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patrol-route', addingCpTo] })
      resetCp(); setAddingCpTo(null)
    },
  })

  const deleteCheckpoint = useMutation({
    mutationFn: ({ routeId, cpId }: { routeId: string; cpId: string }) =>
      api.delete(`/patrol-routes/${routeId}/checkpoints/${cpId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol-route', expandedId] }),
  })

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
    setLogsRouteId(null)
  }

  const toggleLogs = (id: string) => {
    setLogsRouteId(prev => prev === id ? null : id)
    setExpandedId(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Patrol Routes</h2>
          <p className="text-sm text-gray-500">Define guard patrol routes and monitor checkpoint scans</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4 mr-1.5" />New Route
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-brand-200">
          <CardHeader><CardTitle>Create Patrol Route</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(d => create.mutate(d))} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Route Name</label>
                <input {...register('name', { required: true })} placeholder="e.g. Main Perimeter" className="input" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Site</label>
                <select {...register('siteId', { required: true })} className="input">
                  <option value="">Select site</option>
                  {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Description (optional)</label>
                <input {...register('description')} placeholder="Brief description of the patrol route" className="input" />
              </div>
              <div>
                <label className="label">Estimated Duration (min)</label>
                <input type="number" {...register('estimatedDurationMinutes', { valueAsNumber: true })} defaultValue={60} className="input" />
              </div>
              <div className="flex items-end gap-3">
                <Button type="submit" loading={create.isPending}>Create Route</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Routes list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="bg-white rounded-xl border h-24 animate-pulse" />)}</div>
      ) : routes?.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
          <Route className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No patrol routes created yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes?.map(route => {
            const detail = expandedId === route.id ? routeDetail : null
            const routeLogs = logsRouteId === route.id ? logs : null

            return (
              <Card key={route.id}>
                <CardContent className="pt-4">
                  {/* Route header */}
                  <div className="flex items-start gap-3">
                    <div className="bg-brand-50 p-2 rounded-lg mt-0.5">
                      <Route className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{route.name}</h3>
                        <Badge variant={route.isActive ? 'success' : 'default'}>
                          {route.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {route.description && <p className="text-xs text-gray-500 mt-0.5">{route.description}</p>}
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{route.estimatedDurationMinutes} min</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Site assigned</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => toggleExpand(route.id)}
                        className="px-2.5 py-1 text-xs text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">
                        Checkpoints {expandedId === route.id ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
                      </button>
                      <button onClick={() => toggleLogs(route.id)}
                        className="px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                        Logs {logsRouteId === route.id ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
                      </button>
                      <button onClick={() => deleteRoute.mutate(route.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Checkpoints panel */}
                  {expandedId === route.id && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">Checkpoints</h4>
                        <button onClick={() => setAddingCpTo(addingCpTo === route.id ? null : route.id)}
                          className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                          <Plus className="w-3 h-3" />Add Checkpoint
                        </button>
                      </div>

                      {addingCpTo === route.id && (
                        <form onSubmit={handleCp(d => addCheckpoint.mutate({ routeId: route.id, data: d }))}
                          className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                          <div className="col-span-2">
                            <label className="label">Checkpoint Name</label>
                            <input {...regCp('name', { required: true })} placeholder="e.g. Gate 1" className="input" />
                          </div>
                          <div>
                            <label className="label">Latitude</label>
                            <input type="number" step="any" {...regCp('lat', { required: true, valueAsNumber: true })} className="input" />
                          </div>
                          <div>
                            <label className="label">Longitude</label>
                            <input type="number" step="any" {...regCp('lng', { required: true, valueAsNumber: true })} className="input" />
                          </div>
                          <div>
                            <label className="label">Radius (m)</label>
                            <input type="number" {...regCp('radiusMeters', { valueAsNumber: true })} defaultValue={30} className="input" />
                          </div>
                          <div>
                            <label className="label">Order</label>
                            <input type="number" {...regCp('orderIndex', { valueAsNumber: true })} defaultValue={0} className="input" />
                          </div>
                          <div className="col-span-2 flex gap-2">
                            <Button type="submit" size="sm" loading={addCheckpoint.isPending}>Add</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setAddingCpTo(null)}>Cancel</Button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {detail?.checkpoints?.sort((a, b) => a.orderIndex - b.orderIndex).map((cp, i) => (
                          <div key={cp.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{cp.name}</p>
                              <p className="text-xs text-gray-400">{cp.lat.toFixed(5)}, {cp.lng.toFixed(5)} · {cp.radiusMeters}m radius</p>
                            </div>
                            <button onClick={() => deleteCheckpoint.mutate({ routeId: route.id, cpId: cp.id })}
                              className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {(!detail?.checkpoints?.length) && (
                          <p className="text-xs text-gray-400 py-2">No checkpoints added yet</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Logs panel */}
                  {logsRouteId === route.id && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Patrol Logs</h4>
                      <div className="space-y-2">
                        {routeLogs?.map(log => (
                          <div key={log.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <div className="shrink-0">
                              {log.status === 'completed'
                                ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                                : <AlertCircle className="w-5 h-5 text-yellow-500" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={statusBadge[log.status] ?? 'default'} className="text-xs">
                                  {log.status.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {log.scannedCheckpoints}/{log.totalCheckpoints} checkpoints
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {log.startedAt && format(new Date(log.startedAt), 'dd MMM yyyy, HH:mm')}
                                {log.completedAt && ` → ${format(new Date(log.completedAt), 'HH:mm')}`}
                              </p>
                            </div>
                            {log.status === 'completed' && (
                              <div className="text-xs text-green-600 font-medium">
                                {Math.round((log.scannedCheckpoints / Math.max(log.totalCheckpoints, 1)) * 100)}%
                              </div>
                            )}
                          </div>
                        ))}
                        {!routeLogs?.length && (
                          <p className="text-xs text-gray-400 py-2">No patrol logs yet. Guards can start patrols from the mobile app.</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
