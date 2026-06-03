import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/app-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SecureOps — Security & Housekeeping Management',
  description: 'End-to-end management platform for security and housekeeping agencies',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
