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
  experimental: {
    serverActions: {
      // Firebase App Hosting fronts the Cloud Run backend with its own edge
      // proxy — the browser's `Origin` header is the public *.hosted.app
      // domain, but the `Host`/`x-forwarded-host` header the backend sees
      // can differ, which trips Next.js's built-in Server Actions CSRF
      // check (origin !== host → "Invalid Server Actions request.",
      // node_modules/next/dist/server/app-render/action-handler.js). Every
      // Server Action (every AI flow generation call in this app) was
      // failing instantly with that error, redacted client-side to the
      // generic "An error occurred in the Server Components render..."
      // text — confirmed by ruling out a bad ANTHROPIC_API_KEY first (see
      // /api/debug/anthropic, which calls the same Anthropic client
      // successfully from a plain Route Handler, unaffected by this check
      // since it isn't a Server Action). `**` matches any number of
      // subdomain labels, which Firebase's generated hosted.app hostnames
      // have several of (e.g. <backend>--<hash>.<region>.hosted.app).
      allowedOrigins: ['**.hosted.app'],
    },
  },
  // Botanica (plants) merged into Maison as its "Plantes" tab — see
  // AUDIT.md/PLAN.md section 3.2. Météo AI merged into the Coach hub as its
  // "Météo & Tenue" sub-tab — see CLAUDE.md section Navigation (refonte IA).
  // Redirect old bookmarks/PWA shortcuts instead of leaving them 404.
  async redirects() {
    return [
      { source: '/botanica', destination: '/home-management', permanent: true },
      { source: '/weather', destination: '/coach', permanent: true },
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
