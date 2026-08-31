import { NextRequest, NextResponse } from 'next/server'
// ⚠️ Import the inner implementation, NOT `pdf-parse` itself — the
// package's index.js runs a `!module.parent` self-test (reads a bundled
// sample PDF) whenever module.parent is falsy, which is exactly the case
// inside a Next.js server route bundle (each route is its own webpack
// entry, no traditional CJS parent chain) — confirmed by a real
// `next build` failure: "ENOENT ... ./test/data/05-versions-space.pdf".
// lib/pdf-parse.js is the actual parser with no such side effect.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

/**
 * Extracts plain text from an uploaded PDF, for the "Bibliothèque" tab's
 * "Importer un PDF" button (add-library-entry-dialog.tsx) — populates the
 * same fullText textarea a pasted-text entry would, so the rest of the app
 * never has to care which way the text got there.
 *
 * No Firebase Auth check — same accepted-risk posture already documented in
 * CLAUDE.md for the /api/intervals/* proxy routes: this app has no
 * server-side Firebase Admin SDK anywhere (see "Authentification"), so a
 * real check isn't available without a larger architecture change. This
 * route touches no user data at all (it doesn't read or write Firestore),
 * so the worst case is CPU/bandwidth abuse, not a data leak — bounded by
 * the 15MB client-side cap (add-library-entry-dialog.tsx) and re-checked
 * here server-side since a client check alone is never a real guarantee.
 */
const MAX_PDF_BYTES = 15 * 1024 * 1024

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Requête invalide (formData attendu).' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 })
  }
  if (file.type && file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Le fichier doit être un PDF.' }, { status: 400 })
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'PDF trop volumineux (15 Mo maximum).' }, { status: 413 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await pdfParse(buffer)
    const text = parsed.text.trim()
    if (!text) {
      return NextResponse.json({ error: "Aucun texte extractible dans ce PDF (scan sans OCR ?)." }, { status: 422 })
    }
    return NextResponse.json({ text, pages: parsed.numpages })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json({ error: `Échec de l'extraction : ${message}` }, { status: 500 })
  }
}
