"use client"

// ── Carte "Analyse automatique de sortie" (Réglages) ─────────────────────
//
// Chantier "repenser planification/séances/feedback" (pièce B2, voir
// CLAUDE.md) — connexion OAuth ADDITIONNELLE à la clé API personnelle déjà
// renseignée dans la carte Intervals.icu juste au-dessus (IntervalsCard,
// settings/intervals) : celle-ci reste nécessaire pour tout le reste de
// l'app (données, envoi de séances...), cette carte-ci ne sert QU'À
// autoriser la réception des webhooks Intervals.icu (analyse IA automatique
// + notification push après chaque sortie, même app fermée). Même patron
// visuel/mécanique que StravaCard (Card lc-card, badge, fragment d'URL).

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, setDoc } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Unlink } from 'lucide-react'
import { useUser, useFirestore } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useIntervalsOAuth, type IntervalsOAuthSettingsDoc } from '@/components/cycling/use-intervals-oauth'

export function IntervalsOAuthCard() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings, isConnected, disconnect } = useIntervalsOAuth()
  const [disconnecting, setDisconnecting] = useState(false)
  const consumedHashRef = useRef(false)
  const consumedErrorRef = useRef(false)

  // Erreur renvoyée par /api/intervals-oauth/callback — même patron que
  // StravaCard (strava_error), affichée une fois puis nettoyée de l'URL.
  useEffect(() => {
    if (consumedErrorRef.current) return
    const error = searchParams.get('intervals_oauth_error')
    if (!error) return
    consumedErrorRef.current = true
    const description = error === 'access_denied' ? "Vous avez refusé l'autorisation côté Intervals.icu."
      : error === 'not_configured' ? "Cette connexion n'est pas encore configurée côté serveur (application Intervals.icu en attente d'approbation ?)."
        : error
    toast({ variant: 'destructive', title: 'Connexion Intervals.icu (analyse auto) impossible', description })
    router.replace('/settings')
  }, [searchParams, router, toast])

  // Rapatrie les jetons livrés par /api/intervals-oauth/callback dans le
  // fragment d'URL (#intervals_oauth_tokens=...) — même mécanique que
  // StravaCard, voir ce fichier pour le raisonnement complet.
  useEffect(() => {
    if (consumedHashRef.current || !user || !db) return
    const hash = window.location.hash
    const match = hash.match(/intervals_oauth_tokens=([^&]+)/)
    if (!match) return
    consumedHashRef.current = true

    try {
      const decoded = JSON.parse(atob(match[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
        accessToken: string; athleteId: string; athleteName: string | null; scope: string; uid: string
      }
      history.replaceState(null, '', window.location.pathname + window.location.search)
      if (decoded.uid !== user.uid) {
        toast({ variant: 'destructive', title: 'Connexion annulée', description: "Le compte connecté ne correspond pas à l'utilisateur courant." })
        return
      }
      const data: IntervalsOAuthSettingsDoc = {
        accessToken: decoded.accessToken,
        athleteId: decoded.athleteId,
        athleteName: decoded.athleteName,
        scope: decoded.scope,
        connectedAt: new Date().toISOString(),
      }
      const ref = doc(db, `users/${user.uid}/settings/intervalsOAuth`)
      setDoc(ref, data)
        .then(() => toast({ title: 'Analyse automatique activée', description: 'Chaque sortie recevra désormais une analyse IA dès sa fin, avec notification.' }))
        .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: data })))
    } catch {
      history.replaceState(null, '', window.location.pathname + window.location.search)
      toast({ variant: 'destructive', title: 'Connexion échouée', description: 'Réponse inattendue.' })
    }
  }, [user, db, toast])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    await disconnect()
    setDisconnecting(false)
    toast({ title: 'Analyse automatique désactivée' })
  }

  return (
    <Card className="lc-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Analyse automatique de sortie</CardTitle>
              <CardDescription className="text-sm">Notification IA dès la fin d&apos;une sortie, même app fermée.</CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge className="rounded-full bg-green-500/10 text-green-600 border-none text-xs px-3">Activée</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connexion additionnelle, distincte de la clé API ci-dessus (toujours nécessaire) — celle-ci
          autorise uniquement Intervals.icu à prévenir cette app dès qu&apos;une sortie est prête, pour
          déclencher son analyse IA automatiquement et vous notifier (voir la carte Notifications push).
        </p>
        {isConnected ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-medium">Analyse automatique active</p>
              {settings?.athleteName && (
                <p className="text-xs text-muted-foreground">{settings.athleteName}</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              Désactiver
            </Button>
          </div>
        ) : (
          <Button asChild className="gap-1.5 rounded-xl">
            <a href={`/api/intervals-oauth/authorize?uid=${user?.uid ?? ''}`}>
              <Sparkles className="w-4 h-4" /> Activer l&apos;analyse automatique
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
