import type { Metadata } from 'next'
import './globals.css'
import loadDynamic from 'next/dynamic'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SecureOps — Security & Housekeeping Management',
  description: 'End-to-end management platform for security and housekeeping agencies',
}

// Load app body client-side only to avoid React instance conflicts during SSR
const ClientApp = loadDynamic(() => import('@/components/client-app'), { ssr: false })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientApp>{children}</ClientApp>
      </body>
    </html>
  )
}
