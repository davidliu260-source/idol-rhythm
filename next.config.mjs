/** @type {import('next').NextConfig} */
const nextConfig = {
  // Twitter image routes share their renderer with OG routes. Include the
  // local font explicitly so each deployed image function can read it.
  outputFileTracingIncludes: {
    '/**/{opengraph,twitter}-image': ['./assets/fonts/NotoSansTC-Bold-subset.otf'],
  },
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
