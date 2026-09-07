import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Was 'export' (full static site, no server at all) -- that's what made
  // /api/gemini-audit unreachable in production: static export produces no
  // server runtime on Vercel, so the route 404'd regardless of env vars.
  // Removing this switches Vercel to its standard hybrid Next.js deploy
  // (static pages + working serverless API routes); every other page still
  // talks to Supabase directly from the client and is unaffected.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
