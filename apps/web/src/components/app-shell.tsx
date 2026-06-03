'use client'

import loadDynamic from 'next/dynamic'

// Load QueryClient and providers client-side only to avoid React dual-instance
// SSR hook conflict (Next.js App Router monorepo issue with React 19)
const ClientApp = loadDynamic(() => import('./client-app'), { ssr: false })

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ClientApp>{children}</ClientApp>
}
