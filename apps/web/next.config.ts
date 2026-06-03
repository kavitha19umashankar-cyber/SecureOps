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
  webpack: (config) => {
    // Force single React 19 instance — prevents hook conflicts in monorepo
    config.resolve.alias['react'] = path.resolve(__dirname, 'node_modules/react')
    config.resolve.alias['react-dom'] = path.resolve(__dirname, 'node_modules/react-dom')
    return config
  },
}

export default nextConfig
