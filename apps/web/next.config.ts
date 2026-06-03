import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Only the packages the web app actually imports need transpiling.
  // @secureops/auth and @secureops/db are server-only; never bundle them here.
  transpilePackages: ['@secureops/types', '@secureops/utils'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
}

export default nextConfig
