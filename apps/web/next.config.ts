import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@secureops/types', '@secureops/utils'],
  serverExternalPackages: ['styled-jsx'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  webpack: (config, { isServer }) => {
    // Force a single React instance across the monorepo to avoid hook conflicts
    const reactPath = path.resolve(__dirname, 'node_modules/react')
    const reactDomPath = path.resolve(__dirname, 'node_modules/react-dom')
    config.resolve.alias['react'] = reactPath
    config.resolve.alias['react-dom'] = reactDomPath
    if (isServer) {
      config.resolve.alias['react/jsx-runtime'] = path.resolve(__dirname, 'node_modules/react/jsx-runtime')
      config.resolve.alias['react/jsx-dev-runtime'] = path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime')
    }
    return config
  },
}

export default nextConfig
