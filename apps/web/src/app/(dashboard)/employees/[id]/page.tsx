'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload, CheckCircle, XCircle, FileText, User, CreditCard, AlertTriangle, Edit2, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface Employee {
  id: string; name: string; employeeCode: string; phone: string; email?: string
  dob?: string; gender?: string; address?: string; employeeType: string; status: string
  joiningDate: string; skills: string[]; performanceScore: number
  backgroundVerificationStatus: string
  bankAccountNumber?: string; bankIfsc?: string; bankName?: string
  uanNumber?: string; esiNumber?: string
  emergencyContactName?: string; emergencyContactPhone?: string
}

interface Document {
  id: string; docType: string; fileName: string; fileUrl: string
  expiryDate?: string; status: string; verifiedAt?: string; rejectionReason?: string
}

const DOC_TYPES = [
  'aadhaar','pan','passport','driving_license','voter_id','police_verification',
  'security_license','educational_certificate','training_certificate','medical_certificate',
  'employment_contract','bank_passbook',
]

const statusColor: Record<string, string> = {
  active: 'text-green-700 bg-green-50',
  on_leave: 'text-yellow-700 bg-yellow-50',
  suspended: 'text-orange-700 bg-orange-50',
  terminated: 'text-red-700 bg-red-50',
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'profile' | 'edit' | 'documents' | 'attendance'>('profile')
  const [uploadDocType, setUploadDocType] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadExpiry, setUploadExpiry] = useState('')

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get<{ success: boolean; data: Employee }>(`/employees/${id}`).then(r => r.data.data),
  })

  const { data: documents } = useQuery({
    queryKey: ['employee-docs', id],
    queryFn: () => api.get<{ success: boolean; data: Document[] }>(`/employees/${id}/documents`).then(r => r.data.data),
    enabled: activeTab === 'documents',
  })

  const { data: attendance } = useQuery({
    queryKey: ['employee-attendance', id],
    queryFn: () => {
      const now = new Date()
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const to = format(now, 'yyyy-MM-dd')
      return api.get<{ success: boolean; data: unknown[] }>(`/attendance/my`, { params: { from, to } }).then(r => r.data.data)
    },
    enabled: activeTab === 'attendance',
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !uploadDocType) return
      const form = new FormData()
      form.append('photo', uploadFile)
      return api.post(
        `/employees/${id}/documents?docType=${uploadDocType}${uploadExpiry ? `&expiryDate=${uploadExpiry}` : ''}`,
        form, { headers: { 'Content-Type': 'multipart/form-data' } },
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-docs', id] })
      setUploadDocType(''); setUploadFile(null); setUploadExpiry('')
    },
  })

  const verifyDoc = useMutation({
    mutationFn: ({ docId, status, reason }: { docId: string; status: 'verified' | 'rejected'; reason?: string }) =>
      api.patch(`/employees/documents/${docId}/status`, { status, rejectionReason: reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-docs', id] }),
  })

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { isDirty } } = useForm({
    defaultValues: employee ? {
      name: employee.name, phone: employee.phone, email: employee.email ?? '',
      dob: employee.dob ?? '', gender: employee.gender ?? '',
      address: employee.address ?? '', employeeType: employee.employeeType,
      status: employee.status, joiningDate: employee.joiningDate,
      emergencyContactName: employee.emergencyContactName ?? '',
      emergencyContactPhone: employee.emergencyContactPhone ?? '',
      bankAccountNumber: employee.bankAccountNumber ?? '',
      bankIfsc: employee.bankIfsc ?? '', bankName: employee.bankName ?? '',
      uanNumber: employee.uanNumber ?? '', esiNumber: employee.esiNumber ?? '',
    } : {},
  })

  const updateEmployee = useMutation({
    mutationFn: (data: object) => api.patch(`/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', id] })
      setActiveTab('profile')
    },
  })

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-32 animate-pulse" />)}</div>
  }

  if (!employee) return <p className="text-gray-500">Employee not found</p>

  const docStatusBadge: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
    pending: 'warning', verified: 'success', rejected: 'danger', expired: 'default',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/employees" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">
            {employee.name[0]}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{employee.name}</h2>
            <p className="text-sm text-gray-500 font-mono">{employee.employeeCode}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusColor[employee.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {employee.status.replace('_', ' ')}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['profile', 'edit', 'documents', 'attendance'] as const).map(tab => (
          <button key={tab} onClick={() => {
            setActiveTab(tab)
            if (tab === 'edit' && employee) resetEdit({
              name: employee.name, phone: employee.phone, email: employee.email ?? '',
              dob: employee.dob ?? '', gender: employee.gender ?? '',
              address: employee.address ?? '', employeeType: employee.employeeType,
              status: employee.status, joiningDate: employee.joiningDate,
              emergencyContactName: employee.emergencyContactName ?? '',
              emergencyContactPhone: employee.emergencyContactPhone ?? '',
              bankAccountNumber: employee.bankAccountNumber ?? '',
              bankIfsc: employee.bankIfsc ?? '', bankName: employee.bankName ?? '',
              uanNumber: employee.uanNumber ?? '', esiNumber: employee.esiNumber ?? '',
            })
          }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'edit' ? <span className="flex items-center gap-1"><Edit2 className="w-3 h-3" />Edit</span> : tab}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle><User className="w-4 h-4 inline mr-2" />Personal Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ['Phone', employee.phone],
                ['Email', employee.email],
                ['Date of Birth', employee.dob ? format(parseISO(employee.dob), 'dd MMM yyyy') : '—'],
                ['Gender', employee.gender ?? '—'],
                ['Employee Type', employee.employeeType.replace('_', ' ')],
                ['Joining Date', format(parseISO(employee.joiningDate), 'dd MMM yyyy')],
                ['Address', employee.address],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="text-gray-900 text-right capitalize">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle><CreditCard className="w-4 h-4 inline mr-2" />Bank & Statutory</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ['Bank', employee.bankName],
                ['Account', employee.bankAccountNumber ? `****${employee.bankAccountNumber.slice(-4)}` : '—'],
                ['IFSC', employee.bankIfsc],
                ['UAN', employee.uanNumber],
                ['ESI', employee.esiNumber],
                ['BGV Status', employee.backgroundVerificationStatus],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="text-gray-900 capitalize">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {(employee.emergencyContactName || employee.emergencyContactPhone) && (
            <Card>
              <CardHeader><CardTitle><AlertTriangle className="w-4 h-4 inline mr-2" />Emergency Contact</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Name</span><span>{employee.emergencyContactName ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{employee.emergencyContactPhone ?? '—'}</span></div>
              </CardContent>
            </Card>
          )}

          {employee.skills?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Skills & Certifications</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {employee.skills.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs rounded-full font-medium">{s.replace('_', ' ')}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit tab */}
      {activeTab === 'edit' && (
        <form onSubmit={handleEdit(data => updateEmployee.mutate(data))} className="space-y-5 max-w-3xl">
          <Card>
            <CardHeader><CardTitle><User className="w-4 h-4 inline mr-2" />Personal Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Full Name</label><input {...regEdit('name')} className="input" /></div>
              <div><label className="label">Phone</label><input {...regEdit('phone')} className="input" /></div>
              <div><label className="label">Email</label><input type="email" {...regEdit('email')} className="input" /></div>
              <div><label className="label">Date of Birth</label><input type="date" {...regEdit('dob')} className="input" /></div>
              <div>
                <label className="label">Gender</label>
                <select {...regEdit('gender')} className="input">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Employee Type</label>
                <select {...regEdit('employeeType')} className="input">
                  {['security_guard','armed_guard','supervisor','housekeeper','housekeeping_supervisor'].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select {...regEdit('status')} className="input">
                  {['active','on_leave','suspended','terminated'].map(s => (
                    <option key={s} value={s}>{s.replace('_',' ')}</option>
                  ))}
                </select>
              </div>
              <div><label className="label">Joining Date</label><input type="date" {...regEdit('joiningDate')} className="input" /></div>
              <div className="sm:col-span-2"><label className="label">Address</label><input {...regEdit('address')} className="input" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle><AlertTriangle className="w-4 h-4 inline mr-2" />Emergency Contact</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Contact Name</label><input {...regEdit('emergencyContactName')} className="input" /></div>
              <div><label className="label">Contact Phone</label><input {...regEdit('emergencyContactPhone')} className="input" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle><CreditCard className="w-4 h-4 inline mr-2" />Bank & Statutory</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Bank Name</label><input {...regEdit('bankName')} className="input" /></div>
              <div><label className="label">Account Number</label><input {...regEdit('bankAccountNumber')} className="input" /></div>
              <div><label className="label">IFSC Code</label><input {...regEdit('bankIfsc')} className="input" /></div>
              <div><label className="label">UAN Number</label><input {...regEdit('uanNumber')} className="input" /></div>
              <div><label className="label">ESI Number</label><input {...regEdit('esiNumber')} className="input" /></div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" loading={updateEmployee.isPending}>
              <Save className="w-4 h-4 mr-1.5" />Save Changes
            </Button>
            <Button type="button" variant="secondary" onClick={() => setActiveTab('profile')}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Upload form */}
          <Card>
            <CardHeader><CardTitle><Upload className="w-4 h-4 inline mr-2" />Upload Document</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
                  <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)} className="input">
                    <option value="">Select type</option>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date (if any)</label>
                  <input type="date" value={uploadExpiry} onChange={e => setUploadExpiry(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">File (PDF / Image)</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                    className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-medium cursor-pointer" />
                </div>
                <Button size="sm" disabled={!uploadDocType || !uploadFile} loading={uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}>Upload</Button>
              </div>
            </CardContent>
          </Card>

          {/* Document list */}
          <div className="space-y-3">
            {documents?.map(doc => (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <FileText className="w-8 h-8 text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 capitalize">{doc.docType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500 truncate">{doc.fileName}</p>
                  {doc.expiryDate && (
                    <p className="text-xs text-orange-600 mt-0.5">Expires: {format(parseISO(doc.expiryDate), 'dd MMM yyyy')}</p>
                  )}
                </div>
                <Badge variant={docStatusBadge[doc.status] ?? 'default'}>{doc.status}</Badge>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline px-2 py-1 rounded border border-brand-200">View</a>
                  {doc.status === 'pending' && (
                    <>
                      <button onClick={() => verifyDoc.mutate({ docId: doc.id, status: 'verified' })}
                        className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => verifyDoc.mutate({ docId: doc.id, status: 'rejected' })}
                        className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!documents?.length && (
              <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-200">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No documents uploaded yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance tab */}
      {activeTab === 'attendance' && (
        <Card>
          <CardHeader><CardTitle>This Month's Attendance</CardTitle></CardHeader>
          <CardContent>
            {Array.isArray(attendance) && attendance.length > 0 ? (
              <div className="grid grid-cols-7 gap-1.5">
                {(attendance as Array<{ date: string; status: string; clockInTime?: string; clockOutTime?: string }>).map((a) => {
                  const colors: Record<string, string> = {
                    present: 'bg-green-100 text-green-700',
                    absent: 'bg-red-100 text-red-600',
                    half_day: 'bg-yellow-100 text-yellow-700',
                    on_leave: 'bg-blue-100 text-blue-700',
                  }
                  return (
                    <div key={a.date} title={`${a.date}: ${a.status}`}
                      className={`rounded-lg p-1.5 text-center ${colors[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      <p className="text-xs font-medium">{format(parseISO(a.date), 'd')}</p>
                      <p className="text-xs capitalize mt-0.5 truncate">{a.status.replace('_', ' ').slice(0, 4)}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No attendance records for this month</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
