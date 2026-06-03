import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@secureops/types', '@secureops/utils'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize React from the server bundle so Node.js loads one shared instance,
      // preventing duplicate React when Next.js externalizes its own runtime modules.
      const existing = Array.isArray(config.externals) ? config.externals : (config.externals ? [config.externals] : [])
      config.externals = [...existing, 'react', 'react-dom', 'react-dom/server']
    }
    return config
  },
}

export default nextConfig
