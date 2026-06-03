import type { Metadata } from 'next'
import './globals.css'
import dynamic from 'next/dynamic'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SecureOps — Security & Housekeeping Management',
  description: 'End-to-end management platform for security and housekeeping agencies',
}

// Load the entire app client-side to avoid React instance conflicts during SSR
const ClientApp = dynamic(() => import('@/components/client-app'), { ssr: false })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientApp>{children}</ClientApp>
      </body>
    </html>
  )
}
