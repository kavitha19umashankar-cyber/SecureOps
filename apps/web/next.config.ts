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
      // Externalize React so Node.js module cache gives one shared instance,
      // matching what react-dom (also externalized) uses at runtime.
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : []
      config.externals = [
        ...existingExternals,
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          // Externalize any react import so Node.js resolves the same instance
          if (request && /^react(\/|$)/.test(request) && !request.includes('react-dom')) {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }
    return config
  },
}

export default nextConfig
