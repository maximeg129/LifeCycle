import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { sendPushNotification } from '@/lib/push-notifications'

// ── Envoi de notification push, déclenché côté CLIENT ──────────────────────
//
// Chantier "repenser planification/séances/feedback" (voir CLAUDE.md, pièce
// B3) : sendPushNotification() a besoin de l'Admin SDK (Firebase Cloud
// Messaging côté serveur, voir firebase-admin.ts) — inutilisable directement
// depuis le navigateur. Cette route est le seul pont entre un déclenchement
// client (fin d'une séance de musculation, analyse IA terminée) et l'envoi
// réel.
//
// ⚠️ Contrairement aux routes proxy /api/intervals/* et /api/strava/*
// (identifiants fournis par l'appelant, jamais vérifiés — voir l'audit
// sécurité dans CLAUDE.md), CETTE route DOIT vérifier l'identité de
// l'appelant : sans ça, n'importe qui pourrait pousser une notification
// arbitraire (titre/corps/URL de clic) dans l'appareil de N'IMPORTE QUEL
// utilisateur connaissant son uid — un vecteur de spam/phishing bien plus
// direct que le risque déjà documenté et accepté pour les routes Intervals.icu.
// Le jeton Firebase Auth du client (`Authorization: Bearer <idToken>`) est
// vérifié via `adminAuth().verifyIdToken()` — l'uid destinataire est TOUJOURS
// celui du jeton vérifié, jamais un uid pris dans le corps de la requête :
// cette route ne peut donc jamais envoyer à quelqu'un d'autre que
// l'appelant lui-même (elle n'a pas besoin de l'être — chaque cas d'usage
// prévu notifie l'athlète de sa propre analyse).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!idToken) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 })
  }

  let uid: string
  try {
    const decoded = await adminAuth().verifyIdToken(idToken)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  let body: { title?: string; body?: string; url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.title || !body.body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  try {
    await sendPushNotification(uid, { title: body.title, body: body.body, url: body.url })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Best-effort par construction (voir push-notifications.ts) — une
    // erreur ici ne doit jamais empêcher l'appelant de continuer (l'analyse
    // elle-même est déjà persistée avant cet appel), donc pas de 5xx
    // bruyant : le client traite déjà cet appel comme fire-and-forget.
    console.error('[api/notifications/send] failed:', e)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 200 })
  }
}
