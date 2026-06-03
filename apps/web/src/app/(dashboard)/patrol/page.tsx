'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, ChevronDown, ChevronUp, Clock, Route, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface Checkpoint {
  id: string; name: string; lat?: number; lng?: number
  qrCode?: string; expectedMinuteFromStart: number; order: number
}

interface PatrolRoute {
  id: string; siteId: string; name: string; isActive: boolean
  checkpoints: Checkpoint[]; createdAt: string
}

interface PatrolLog {
  id: string; startedAt?: string; completedAt?: string
  completionRate: number; checkpointsVisited: unknown[]; createdAt: string
}

interface Site { id: string; name: string }

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

  const { data: logs } = useQuery<PatrolLog[]>({
    queryKey: ['patrol-logs', logsRouteId],
    queryFn: (): Promise<PatrolLog[]> =>
      api.get<{ success: boolean; data: PatrolLog[] }>(`/patrol-routes/${logsRouteId}/logs`).then(r => r.data.data),
    enabled: !!logsRouteId,
  })

  const { register, handleSubmit, reset } = useForm<{ siteId: string; name: string }>()
  const { register: regCp, handleSubmit: handleCp, reset: resetCp } = useForm<{
    name: string; lat?: number; lng?: number; qrCode?: string; expectedMinuteFromStart: number
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patrol-routes'] }); resetCp(); setAddingCpTo(null) },
  })

  const deleteCheckpoint = useMutation({
    mutationFn: ({ routeId, cpId }: { routeId: string; cpId: string }) =>
      api.delete(`/patrol-routes/${routeId}/checkpoints/${cpId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patrol-routes'] }),
  })

  const siteMap = Object.fromEntries(sites?.map(s => [s.id, s.name]) ?? [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Patrol Routes</h2>
          <p className="text-sm text-gray-500">Define guard patrol routes and monitor checkpoint progress</p>
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
              <div>
                <label className="label">Route Name</label>
                <input {...register('name', { required: true })} placeholder="e.g. Main Perimeter" className="input" />
              </div>
              <div>
                <label className="label">Site</label>
                <select {...register('siteId', { required: true })} className="input">
                  <option value="">Select site</option>
                  {sites?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-3">
                <Button type="submit" loading={create.isPending}>Create Route</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Routes list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="bg-white rounded-xl border h-20 animate-pulse" />)}</div>
      ) : routes?.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
          <Route className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No patrol routes yet. Create one to start tracking guard patrols.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes?.map(route => {
            const isExpanded = expandedId === route.id
            const showLogs = logsRouteId === route.id
            const routeLogs = showLogs ? logs : null

            return (
              <Card key={route.id}>
                <CardContent className="pt-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="bg-brand-50 p-2 rounded-lg mt-0.5 shrink-0">
                      <Route className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{route.name}</h3>
                        <Badge variant={route.isActive ? 'success' : 'default'}>
                          {route.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {siteMap[route.siteId] ?? 'Unknown site'} · {route.checkpoints?.length ?? 0} checkpoints
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => { setExpandedId(isExpanded ? null : route.id); setLogsRouteId(null) }}
                        className="px-2.5 py-1 text-xs text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 flex items-center gap-1">
                        <Edit2 className="w-3 h-3" />
                        Checkpoints {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <button onClick={() => { setLogsRouteId(showLogs ? null : route.id); setExpandedId(null) }}
                        className="px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Logs {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <button onClick={() => deleteRoute.mutate(route.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Checkpoints panel */}
                  {isExpanded && (
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
                          className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-xl text-sm">
                          <div className="col-span-2">
                            <label className="label">Name</label>
                            <input {...regCp('name', { required: true })} placeholder="e.g. Gate 1" className="input" />
                          </div>
                          <div>
                            <label className="label">Latitude (optional)</label>
                            <input type="number" step="any" {...regCp('lat', { valueAsNumber: true })} className="input" />
                          </div>
                          <div>
                            <label className="label">Longitude (optional)</label>
                            <input type="number" step="any" {...regCp('lng', { valueAsNumber: true })} className="input" />
                          </div>
                          <div>
                            <label className="label">QR/NFC Code (optional)</label>
                            <input {...regCp('qrCode')} placeholder="CP-001" className="input" />
                          </div>
                          <div>
                            <label className="label">Expected at (min from start)</label>
                            <input type="number" {...regCp('expectedMinuteFromStart', { valueAsNumber: true })} defaultValue={0} className="input" />
                          </div>
                          <div className="col-span-2 flex gap-2">
                            <Button type="submit" size="sm" loading={addCheckpoint.isPending}>Add</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setAddingCpTo(null)}>Cancel</Button>
                          </div>
                        </form>
                      )}

                      <div className="space-y-2">
                        {[...(route.checkpoints ?? [])].sort((a, b) => a.order - b.order).map((cp, i) => (
                          <div key={cp.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{cp.name}</p>
                              <p className="text-xs text-gray-400">
                                {cp.lat && cp.lng ? `${cp.lat.toFixed(4)}, ${cp.lng.toFixed(4)}` : 'No coordinates'}
                                {cp.qrCode ? ` · QR: ${cp.qrCode}` : ''}
                                {cp.expectedMinuteFromStart > 0 ? ` · @${cp.expectedMinuteFromStart}min` : ''}
                              </p>
                            </div>
                            <button onClick={() => deleteCheckpoint.mutate({ routeId: route.id, cpId: cp.id })}
                              className="text-red-400 hover:text-red-600 p-1 shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {!route.checkpoints?.length && (
                          <p className="text-xs text-gray-400 py-2">No checkpoints yet. Add checkpoints to track guard movement.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Logs panel */}
                  {showLogs && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Patrol Logs</h4>
                      <div className="space-y-2">
                        {routeLogs?.map(log => {
                          const pct = Math.round((log.completionRate ?? 0) * 100)
                          const done = pct >= 100
                          return (
                            <div key={log.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                              {done ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> : <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={done ? 'success' : 'warning'}>{done ? 'Completed' : 'In Progress'}</Badge>
                                  <span className="text-xs text-gray-500">{pct}% complete</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {log.startedAt && format(new Date(log.startedAt), 'dd MMM, HH:mm')}
                                  {log.completedAt && ` → ${format(new Date(log.completedAt), 'HH:mm')}`}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                        {!routeLogs?.length && (
                          <p className="text-xs text-gray-400 py-2">No patrol logs yet. Guards start patrols from the mobile app.</p>
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
