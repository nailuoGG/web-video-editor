/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  webpack: (config, { isServer }) => {
    config.externals = [...config.externals, { canvas: 'canvas' }]
    
    // Handle WebAssembly files
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }
    
    return config
  },
  // Enable serving static files with proper headers for WebAssembly
  async headers() {
    return [
      {
        source: '/ffmpeg/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig