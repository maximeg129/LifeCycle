import { NextRequest, NextResponse } from 'next/server'

/**
 * Temporary diagnostic route — same posture as /api/debug/anthropic (plain
 * Route Handler, unauthenticated, delete once done). Echoes back exactly
 * the headers Next.js's own Server Actions CSRF check reads (see
 * next.config.ts's `experimental.serverActions.allowedOrigins` comment) —
 * `origin`, `host`, `x-forwarded-host` — so we can see the *actual* values
 * Firebase App Hosting's proxy sends instead of guessing at the domain
 * shape from a truncated URL bar screenshot.
 *
 * A plain browser navigation (typing the URL, tapping a link) does NOT set
 * an `Origin` header — only a same-page `fetch()` does, same as a Server
 * Action's own request. GET here is for a quick manual look; POST is what
 * /debug-headers (a tiny client page, see src/app/debug-headers/page.tsx)
 * calls via fetch() to see the Origin header a real Server Action call
 * would actually send from this exact deployed environment.
 */
function respond(request: NextRequest) {
  return NextResponse.json({
    _debug: 'headers',
    method: request.method,
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    url: request.url,
  })
}

export async function GET(request: NextRequest) {
  return respond(request)
}

export async function POST(request: NextRequest) {
  return respond(request)
}
