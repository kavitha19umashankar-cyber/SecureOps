import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'SecureOps — Security & Housekeeping Management',
  description: 'End-to-end management platform for security and housekeeping agencies',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
