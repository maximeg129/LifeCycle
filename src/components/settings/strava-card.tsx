"use client"

// ── Carte "Intégration Strava" (Réglages) ────────────────────────────────
//
// Retour utilisateur : "let's integrate Strava publishing of activities" —
// suite du "Strava en attente" documenté dans CLAUDE.md. Même patron
// visuel que la carte Intervals.icu juste au-dessus (Card lc-card, badge
// "Connecté", bouton d'action) — mais ici un vrai flow OAuth (Connecter →
// redirige vers Strava → callback → jetons rapatriés via un fragment
// d'URL, voir src/app/api/strava/callback/route.ts) plutôt qu'un couple de
// champs à copier-coller manuellement.

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, setDoc } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2, Unlink } from 'lucide-react'
import { useUser, useFirestore } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useStrava, type StravaSettingsDoc } from '@/components/cycling/use-strava'

/** lucide-react n'a pas de logo Strava — un simple losange à la couleur de marque Strava (#FC4C02) fait office de repère visuel minimal plutôt qu'une icône générique trompeuse. */
function StravaMark() {
  return <div className="w-5 h-5 rounded-[6px] bg-[#FC4C02]" aria-hidden />
}

export function StravaCard() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings, isConnected, disconnect } = useStrava()
  const [disconnecting, setDisconnecting] = useState(false)
  const consumedHashRef = useRef(false)
  const consumedErrorRef = useRef(false)

  // Erreur renvoyée par /api/strava/callback (refus de l'athlète, panne
  // réseau, credentials serveur absents...) — voir ce fichier pour la
  // liste des codes possibles. Affichée une fois puis nettoyée de l'URL,
  // même discipline que le fragment de jetons ci-dessous.
  useEffect(() => {
    if (consumedErrorRef.current) return
    const error = searchParams.get('strava_error')
    if (!error) return
    consumedErrorRef.current = true
    const description = error === 'access_denied' ? "Vous avez refusé l'autorisation côté Strava."
      : error === 'not_configured' ? "L'intégration Strava n'est pas encore configurée côté serveur."
        : error
    toast({ variant: 'destructive', title: 'Connexion Strava impossible', description })
    router.replace('/settings')
  }, [searchParams, router, toast])

  // Rapatrie les jetons livrés par /api/strava/callback dans le fragment
  // d'URL (#strava_tokens=...) — une seule fois, puis efface immédiatement
  // le fragment (history.replaceState) pour ne jamais le laisser traîner
  // dans l'historique du navigateur plus longtemps que nécessaire.
  useEffect(() => {
    if (consumedHashRef.current || !user || !db) return
    const hash = window.location.hash
    const match = hash.match(/strava_tokens=([^&]+)/)
    if (!match) return
    consumedHashRef.current = true

    try {
      const decoded = JSON.parse(atob(match[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
        accessToken: string; refreshToken: string; expiresAt: number; athleteId: number | null; uid: string
      }
      history.replaceState(null, '', window.location.pathname + window.location.search)
      if (decoded.uid !== user.uid) {
        toast({ variant: 'destructive', title: 'Connexion Strava annulée', description: "Le compte connecté ne correspond pas à l'utilisateur courant." })
        return
      }
      const data: StravaSettingsDoc = {
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken,
        expiresAt: decoded.expiresAt,
        athleteId: decoded.athleteId,
        connectedAt: new Date().toISOString(),
      }
      const ref = doc(db, `users/${user.uid}/settings/strava`)
      setDoc(ref, data)
        .then(() => toast({ title: 'Strava connecté', description: 'Vous pouvez maintenant exporter vos séances muscu.' }))
        .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: data })))
    } catch {
      history.replaceState(null, '', window.location.pathname + window.location.search)
      toast({ variant: 'destructive', title: 'Connexion Strava échouée', description: 'Réponse inattendue.' })
    }
  }, [user, db, toast])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    await disconnect()
    setDisconnecting(false)
    toast({ title: 'Strava déconnecté' })
  }

  return (
    <Card className="lc-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FC4C02]/10 rounded-[10px] flex items-center justify-center">
              <StravaMark />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Intégration Strava</CardTitle>
              <CardDescription className="text-sm">Publication des séances de musculation.</CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge className="rounded-full bg-green-500/10 text-green-600 border-none text-xs px-3">Connecté</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Une fois connecté, chaque séance de musculation loguée dans le Journal (Coach) peut être exportée
          directement vers Strava, en plus d&apos;Intervals.icu — les sorties vélo continuent d&apos;arriver
          via Intervals.icu, jamais republiées ici.
        </p>
        {isConnected ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-medium">Compte Strava lié</p>
              {settings?.athleteId != null && (
                <p className="text-xs text-muted-foreground">Athlète #{settings.athleteId}</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              Déconnecter
            </Button>
          </div>
        ) : (
          <Button asChild className="gap-1.5 rounded-xl bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white">
            <a href={`/api/strava/authorize?uid=${user?.uid ?? ''}`}>
              <Link2 className="w-4 h-4" /> Connecter Strava
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
