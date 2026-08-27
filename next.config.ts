import type {NextConfig} from 'next';
import { execSync } from 'child_process';

// Git commit + build time, exposed to the client so a small badge in the
// sidebar can show which commit is actually deployed — Firebase App Hosting
// auto-deploys silently on every push, and several bugs this app has hit
// turned out to be "the fix never actually deployed" rather than a code
// issue, so this is worth a glance in production.
function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_GIT_SHA: gitShortSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Botanica (plants) merged into Maison as its "Plantes" tab — see
  // AUDIT.md/PLAN.md section 3.2. Redirect old bookmarks/PWA shortcuts
  // instead of leaving them 404.
  async redirects() {
    return [
      { source: '/botanica', destination: '/home-management', permanent: true },
    ];
  },
  images: {
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
