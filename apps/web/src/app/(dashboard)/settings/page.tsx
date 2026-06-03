'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { User, Shield, Bell, Check, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function SettingsPage() {
  const { user, login } = useAuthStore()
  const [tab, setTab] = useState<'profile' | 'security' | 'notifications'>('profile')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' },
  })

  const { register: regP, handleSubmit: handleP, reset: resetP, setError, formState: { errors: errP } } = useForm<{
    currentPassword: string; newPassword: string; confirmPassword: string
  }>()

  const updateProfile = useMutation({
    mutationFn: (data: { name: string; email: string; phone?: string }) => api.patch('/auth/profile', data),
    onSuccess: (res) => {
      const updated = res.data?.data
      if (updated && user) {
        login({ user: { ...user, ...updated }, tokens: { accessToken: '', refreshToken: '', expiresIn: 900 } })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const changePassword = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post('/auth/change-password', data),
    onSuccess: () => { resetP(); setSaved(true); setTimeout(() => setSaved(false), 2000) },
    onError: () => setError('currentPassword', { message: 'Current password is incorrect' }),
  })

  const onPasswordSubmit = (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (data.newPassword !== data.confirmPassword) {
      setError('confirmPassword', { message: 'Passwords do not match' })
      return
    }
    changePassword.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword })
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['profile', 'security', 'notifications'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <Card>
          <CardHeader><CardTitle><User className="w-4 h-4 inline mr-2" />Profile</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(d => updateProfile.mutate(d))} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input {...register('name', { required: 'Name is required' })} className="input" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" {...register('email')} className="input" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input {...register('phone')} className="input" placeholder="+91 98765 43210" />
              </div>
              <div className="pt-2 flex items-center gap-3">
                <Button type="submit" loading={updateProfile.isPending}>Save Changes</Button>
                {saved && <span className="text-green-600 text-sm flex items-center gap-1"><Check className="w-4 h-4" />Saved</span>}
              </div>
              {/* Read-only info */}
              <div className="pt-4 border-t border-gray-100 space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Role</span>
                  <span className="text-gray-900 capitalize font-medium">{user?.role?.replace(/_/g, ' ')}</span>
                </div>
                {user?.tenantId && (
                  <div className="flex justify-between text-gray-500">
                    <span>Tenant ID</span>
                    <span className="text-gray-900 font-mono text-xs">{user.tenantId.slice(0, 8)}…</span>
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <Card>
          <CardHeader><CardTitle><Shield className="w-4 h-4 inline mr-2" />Change Password</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleP(onPasswordSubmit)} className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <input type={showCurrent ? 'text' : 'password'}
                    {...regP('currentPassword', { required: 'Required' })} className="input pr-10" />
                  <button type="button" onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errP.currentPassword && <p className="text-red-500 text-xs mt-1">{errP.currentPassword.message}</p>}
              </div>
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'}
                    {...regP('newPassword', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })}
                    className="input pr-10" />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errP.newPassword && <p className="text-red-500 text-xs mt-1">{errP.newPassword.message}</p>}
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" {...regP('confirmPassword', { required: 'Required' })} className="input" />
                {errP.confirmPassword && <p className="text-red-500 text-xs mt-1">{errP.confirmPassword.message}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" loading={changePassword.isPending}>Update Password</Button>
                {saved && <span className="text-green-600 text-sm flex items-center gap-1"><Check className="w-4 h-4" />Updated</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <Card>
          <CardHeader><CardTitle><Bell className="w-4 h-4 inline mr-2" />Notification Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'incidents', label: 'Incident Alerts', desc: 'Get notified when a new incident is reported' },
              { key: 'attendance', label: 'Attendance Anomalies', desc: 'Alerts for late check-ins or missed attendance' },
              { key: 'leaves', label: 'Leave Requests', desc: 'Notify when employees submit leave requests' },
              { key: 'payroll', label: 'Payroll Ready', desc: 'Notify when payroll is computed and ready to review' },
              { key: 'invoices', label: 'Invoice Due', desc: 'Remind when invoices are approaching due date' },
            ].map(pref => (
              <div key={pref.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                  <p className="text-xs text-gray-500">{pref.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
