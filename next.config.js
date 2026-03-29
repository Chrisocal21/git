/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
}

module.exports = nextConfig
