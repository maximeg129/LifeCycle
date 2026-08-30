"use client"

// Temporary diagnostic page — delete once done, same posture as the
// /api/debug/* routes it calls. A plain navigation to /api/debug/headers
// doesn't set an `Origin` header (only same-page fetch() does — same as a
// Server Action's own request), so this page fires that fetch() from
// inside the already-loaded app and shows the result, to see the exact
// Origin/Host headers a real Server Action call sends in this deployed
// environment instead of guessing.
//
// Also calls pingAction() (actions.ts) directly — a trivial Server Action
// with no Anthropic/Firestore code at all. If THIS fails the same way the
// AI flows do, the problem is the Server Actions dispatch mechanism
// itself on this deployment, not anything in the AI flow code.

import { useEffect, useState } from 'react'
import { pingAction } from './actions'

export default function DebugHeadersPage() {
  const [headersResult, setHeadersResult] = useState<unknown>(null)
  const [headersError, setHeadersError] = useState<string | null>(null)
  const [pingResult, setPingResult] = useState<unknown>(null)
  const [pingError, setPingError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/debug/headers', { method: 'POST' })
      .then((r) => r.json())
      .then(setHeadersResult)
      .catch((e) => setHeadersError(e instanceof Error ? e.message : String(e)))

    pingAction()
      .then((r) => setPingResult(r))
      .catch((e) => setPingError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div style={{ padding: 24, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      <h1>Diagnostic Server Actions</h1>

      <h2>1. pingAction() — Server Action minimale, sans Anthropic/Firestore</h2>
      {pingError && <p style={{ color: 'red' }}>ÉCHEC : {pingError}</p>}
      {!pingResult && !pingError && <p>Chargement...</p>}
      {pingResult != null && <pre style={{ color: 'green' }}>RÉUSSI : {JSON.stringify(pingResult, null, 2)}</pre>}

      <h2>2. En-têtes vus par un fetch() POST (comparaison)</h2>
      {headersError && <p style={{ color: 'red' }}>Erreur : {headersError}</p>}
      {!headersResult && !headersError && <p>Chargement...</p>}
      {headersResult != null && <pre>{JSON.stringify(headersResult, null, 2)}</pre>}
    </div>
  )
}
