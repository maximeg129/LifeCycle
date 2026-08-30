"use client"

// Temporary diagnostic page — delete once done, same posture as the
// /api/debug/* routes it calls. A plain navigation to /api/debug/headers
// doesn't set an `Origin` header (only same-page fetch() does — same as a
// Server Action's own request), so this page fires that fetch() from
// inside the already-loaded app and shows the result, to see the exact
// Origin/Host headers a real Server Action call sends in this deployed
// environment instead of guessing.

import { useEffect, useState } from 'react'

export default function DebugHeadersPage() {
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/debug/headers', { method: 'POST' })
      .then((r) => r.json())
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      <h1>Diagnostic en-têtes (fetch POST depuis le navigateur)</h1>
      {error && <p style={{ color: 'red' }}>Erreur : {error}</p>}
      {!result && !error && <p>Chargement...</p>}
      {result != null && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}
