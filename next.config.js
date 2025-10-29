/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Do NOT use `output: 'export'` for Vercel — we need server/API routes to run
};

module.exports = nextConfig;
