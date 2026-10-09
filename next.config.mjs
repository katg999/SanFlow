/** @type {import('next').NextConfig} */
const nextConfig = {
  // Frontend-only development: `npm run dev:web` forwards /api/* to a deployed backend (API_PROXY), so no local
  // database or CORS setup is needed. Unset in normal use (the API is then served by the same server / Netlify).
  async rewrites() {
    const target = process.env.API_PROXY;
    return target ? [{ source: '/api/:path*', destination: `${target.replace(/\/$/, '')}/api/:path*` }] : [];
  },
};

export default nextConfig;
