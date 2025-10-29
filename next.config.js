/** @type {import('next').NextConfig} */
const nextConfig = process.env.NODE_ENV === 'development' 
  ? {
      // Development config with API routes enabled
      env: {
        MONGO_URI: process.env.MONGO_URI,
      }
    }
  : {
      // Production config - static export
      output: 'export',
      images: {
        unoptimized: true,
      },
      // For GitHub Pages deployment
      basePath: '/Rudraksh919.github.io',
      env: {
        MONGO_URI: process.env.MONGO_URI,
      }
    }

module.exports = nextConfig