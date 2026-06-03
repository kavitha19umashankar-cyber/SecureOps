'use client'

import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Shield, Bell } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuthStore()

  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <CardHeader><CardTitle><User className="w-4 h-4 inline mr-2" />Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            ['Name', user?.name],
            ['Email', user?.email],
            ['Role', user?.role?.replace(/_/g, ' ')],
            ['Tenant ID', user?.tenantId],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900 capitalize">{value ?? '—'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><Bell className="w-4 h-4 inline mr-2" />Notifications</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-500">
          Notification preferences coming soon.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><Shield className="w-4 h-4 inline mr-2" />Security</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-500">
          Password change and 2FA settings coming soon.
        </CardContent>
      </Card>
    </div>
  )
}
