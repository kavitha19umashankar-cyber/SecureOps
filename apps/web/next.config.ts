import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@secureops/types', '@secureops/utils'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  webpack: (config) => {
    const base = path.resolve(__dirname, 'node_modules')
    config.resolve.alias['react'] = path.join(base, 'react')
    config.resolve.alias['react-dom'] = path.join(base, 'react-dom')
    config.resolve.alias['react/jsx-runtime'] = path.join(base, 'react/jsx-runtime')
    config.resolve.alias['react/jsx-dev-runtime'] = path.join(base, 'react/jsx-dev-runtime')
    config.resolve.alias['scheduler'] = path.join(base, 'scheduler')
    return config
  },
}

export default nextConfig
