'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface Component {
  name: string
  type: 'earning' | 'deduction'
  calculationType: 'fixed' | 'percentage_of_basic' | 'percentage_of_gross'
  value: number
  isStatutory: boolean
}

interface SalaryStructure {
  id: string
  name: string
  components: Component[]
  createdAt: string
}

type FormValues = { name: string; components: Component[] }

const CALC_LABELS: Record<string, string> = {
  fixed: 'Fixed ₹',
  percentage_of_basic: '% of Basic',
  percentage_of_gross: '% of Gross',
}

const defaultComponent = (): Component => ({
  name: '', type: 'earning', calculationType: 'fixed', value: 0, isStatutory: false,
})

export default function SalaryStructuresPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: structures, isLoading } = useQuery<SalaryStructure[]>({
    queryKey: ['salary-structures'],
    queryFn: (): Promise<SalaryStructure[]> =>
      api.get<{ success: boolean; data: SalaryStructure[] }>('/payroll/salary-structures').then(r => r.data.data),
  })

  const { register, control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: { name: '', components: [defaultComponent()] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'components' })

  const create = useMutation({
    mutationFn: (data: FormValues) => api.post('/payroll/salary-structures', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-structures'] }); resetForm() },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormValues }) =>
      api.patch(`/payroll/salary-structures/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-structures'] }); resetForm() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/salary-structures/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-structures'] }),
  })

  const resetForm = () => {
    reset({ name: '', components: [defaultComponent()] })
    setShowForm(false)
    setEditId(null)
  }

  const startEdit = (s: SalaryStructure) => {
    reset({ name: s.name, components: s.components })
    setEditId(s.id)
    setShowForm(true)
  }

  const onSubmit = (data: FormValues) => {
    if (editId) update.mutate({ id: editId, data })
    else create.mutate(data)
  }

  const computeCtc = (components: Component[]) => {
    const basic = components.find(c => c.name.toLowerCase() === 'basic')?.value ?? 0
    const gross = components
      .filter(c => c.type === 'earning')
      .reduce((sum, c) => {
        if (c.calculationType === 'fixed') return sum + c.value
        if (c.calculationType === 'percentage_of_basic') return sum + (basic * c.value)
        return sum
      }, 0)
    return gross
  }

  const inr = (v: number) => '₹' + v.toLocaleString('en-IN')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Salary Structures</h2>
          <p className="text-sm text-gray-500">Define earnings and deduction components for payroll calculation</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1.5" />New Structure
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="border-brand-200 shadow-sm">
          <CardHeader>
            <CardTitle>{editId ? 'Edit' : 'New'} Salary Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Structure Name</label>
                <input {...register('name', { required: true })} placeholder="e.g. Standard Guard CTC" className="input max-w-sm" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Components</label>
                  <button type="button" onClick={() => append(defaultComponent())}
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" />Add Component
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                    <span className="col-span-3">Component Name</span>
                    <span className="col-span-2">Type</span>
                    <span className="col-span-3">Calculation</span>
                    <span className="col-span-2">Value</span>
                    <span className="col-span-1">Statutory</span>
                    <span className="col-span-1" />
                  </div>

                  {fields.map((field, i) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                      <input {...register(`components.${i}.name`)} placeholder="e.g. Basic" className="input col-span-3 text-sm" />
                      <select {...register(`components.${i}.type`)} className="input col-span-2 text-sm">
                        <option value="earning">Earning</option>
                        <option value="deduction">Deduction</option>
                      </select>
                      <select {...register(`components.${i}.calculationType`)} className="input col-span-3 text-sm">
                        <option value="fixed">Fixed ₹</option>
                        <option value="percentage_of_basic">% of Basic</option>
                        <option value="percentage_of_gross">% of Gross</option>
                      </select>
                      <input type="number" step="0.01" {...register(`components.${i}.value`, { valueAsNumber: true })}
                        className="input col-span-2 text-sm" />
                      <div className="col-span-1 flex justify-center">
                        <input type="checkbox" {...register(`components.${i}.isStatutory`)} className="w-4 h-4 rounded text-brand-600" />
                      </div>
                      <button type="button" onClick={() => remove(i)}
                        className="col-span-1 text-red-400 hover:text-red-600 flex justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" loading={create.isPending || update.isPending}>
                  <Save className="w-4 h-4 mr-1.5" />{editId ? 'Update' : 'Create'} Structure
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  <X className="w-4 h-4 mr-1.5" />Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="bg-white rounded-xl border h-24 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {structures?.map(s => {
            const earnings = s.components.filter(c => c.type === 'earning')
            const deductions = s.components.filter(c => c.type === 'deduction')
            const isExpanded = expandedId === s.id

            return (
              <Card key={s.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{s.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {earnings.length} earnings · {deductions.length} deductions
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        className="text-gray-400 hover:text-gray-600 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <Button size="sm" variant="secondary" onClick={() => startEdit(s)}>
                        <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                      </Button>
                      <button onClick={() => deleteMutation.mutate(s.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Earnings</p>
                        <div className="space-y-1.5">
                          {earnings.map((c, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {c.name}
                                {c.isStatutory && <span className="ml-1 text-xs text-blue-500">(statutory)</span>}
                              </span>
                              <span className="text-gray-900 font-medium">
                                {c.calculationType === 'fixed' ? inr(c.value) : `${(c.value * (c.calculationType === 'percentage_of_basic' ? 100 : 100)).toFixed(0)}%`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Deductions</p>
                        <div className="space-y-1.5">
                          {deductions.map((c, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {c.name}
                                {c.isStatutory && <span className="ml-1 text-xs text-blue-500">(statutory)</span>}
                              </span>
                              <span className="text-gray-900 font-medium">
                                {c.calculationType === 'fixed' ? inr(c.value) : `${(c.value * 100).toFixed(1)}%`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {!structures?.length && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
              <p className="text-sm">No salary structures yet. Create one to enable payroll computation.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
