/** @type {import('next').NextConfig} */
const nextConfig =
  process.env.NODE_ENV === 'development'
    ? {
        env: {
          MONGO_URI: process.env.MONGO_URI,
        },
      }
    : {
        output: 'export',
        images: { unoptimized: true },
        basePath: '',
        assetPrefix: '',
        env: {
          MONGO_URI: process.env.MONGO_URI,
        },
      };

module.exports = nextConfig;
