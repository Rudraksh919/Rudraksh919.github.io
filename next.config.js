/** @type {import('next').NextConfig} */
const nextConfig = process.env.NODE_ENV === 'development' 
  ? {
      // Development config - with API routes
    }
  : {
      // Production config - static export
      output: 'export',
      images: {
        unoptimized: true,
      },
      basePath: '/Rudraksh919.github.io'
    }

module.exports = nextConfig