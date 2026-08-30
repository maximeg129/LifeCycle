import { NextRequest, NextResponse } from 'next/server'

/**
 * Temporary diagnostic route — same posture as /api/debug/anthropic (plain
 * Route Handler, unauthenticated, delete once done). Echoes back exactly
 * the headers Next.js's own Server Actions CSRF check reads (see
 * next.config.ts's `experimental.serverActions.allowedOrigins` comment) —
 * `origin`, `host`, `x-forwarded-host` — so we can see the *actual* values
 * Firebase App Hosting's proxy sends instead of guessing at the domain
 * shape from a truncated URL bar screenshot.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    _debug: 'headers',
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    url: request.url,
  })
}
