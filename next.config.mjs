/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: '/favorites', destination: '/atlas', permanent: false }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
}

export default nextConfig
