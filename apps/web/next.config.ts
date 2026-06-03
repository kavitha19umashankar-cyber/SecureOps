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
      // Alias react to Next.js's own compiled copy so server components and
      // the Next.js App Router runtime share exactly one React instance.
      const nextDir = path.dirname(require.resolve('next/package.json'))
      config.resolve.alias['react'] = path.join(nextDir, 'dist/compiled/react')
      config.resolve.alias['react-dom'] = path.join(nextDir, 'dist/compiled/react-dom')
      config.resolve.alias['react/jsx-runtime'] = path.join(nextDir, 'dist/compiled/react/jsx-runtime')
      config.resolve.alias['react/jsx-dev-runtime'] = path.join(nextDir, 'dist/compiled/react/jsx-dev-runtime')
    }
    return config
  },
}

export default nextConfig
