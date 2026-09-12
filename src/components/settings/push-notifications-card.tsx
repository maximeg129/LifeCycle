"use client"

// ── Carte "Notifications push" (Réglages) ────────────────────────────────
//
// Chantier "repenser planification/séances/feedback" (voir CLAUDE.md) —
// pour l'instant utilisée UNIQUEMENT par l'analyse IA automatique d'une
// séance de musculation (déclenchement client à la fin de la séance) : le
// résultat peut arriver après que l'athlète a fermé l'app, la notification
// est la seule façon de le savoir sans revenir vérifier. Même patron
// visuel que la carte Strava juste au-dessus (Card lc-card, badge d'état,
// bouton d'action) — un simple bouton d'activation plutôt qu'un flow
// externe.

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Bell, BellOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePushNotifications } from '@/hooks/use-push-notifications'

export function PushNotificationsCard() {
  const { permission, isRegistering, isConfigured, requestPermissionAndRegister, unregister } = usePushNotifications()
  const { toast } = useToast()
  const [disabling, setDisabling] = useState(false)

  const handleEnable = async () => {
    const ok = await requestPermissionAndRegister()
    if (ok) toast({ title: 'Notifications activées', description: 'Vous recevrez une notification quand une analyse de séance est prête.' })
    else if (permission === 'denied') toast({ variant: 'destructive', title: 'Permission refusée', description: 'Autorisez les notifications pour ce site dans les réglages de votre navigateur.' })
  }

  const handleDisable = async () => {
    setDisabling(true)
    await unregister()
    setDisabling(false)
    toast({ title: 'Notifications désactivées sur cet appareil' })
  }

  const isEnabled = permission === 'granted'

  return (
    <Card className="lc-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Notifications push</CardTitle>
              <CardDescription className="text-sm">Analyse de séance prête, séances importantes.</CardDescription>
            </div>
          </div>
          {isEnabled && (
            <Badge className="rounded-full bg-green-500/10 text-green-600 border-none text-xs px-3">Activées</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Une séance de musculation loguée dans l&apos;app déclenche une analyse IA approfondie — le résultat
          peut prendre quelques secondes, une notification vous prévient dès qu&apos;il est prêt même si vous
          avez fermé l&apos;app entre-temps.
        </p>
        {permission === 'unsupported' && (
          <p className="text-xs text-muted-foreground italic">Votre navigateur ne prend pas en charge les notifications push.</p>
        )}
        {!isConfigured && permission !== 'unsupported' && (
          <p className="text-xs text-muted-foreground italic">Notifications non configurées côté serveur pour l&apos;instant.</p>
        )}
        {permission === 'denied' && (
          <p className="text-xs text-destructive">
            Notifications bloquées pour ce site — autorisez-les dans les réglages de votre navigateur pour les activer.
          </p>
        )}
        {isConfigured && permission !== 'unsupported' && (
          isEnabled ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <p className="text-sm font-medium">Activées sur cet appareil</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDisable} disabled={disabling}>
                {disabling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
                Désactiver
              </Button>
            </div>
          ) : (
            <Button className="gap-1.5 rounded-xl" onClick={handleEnable} disabled={isRegistering || permission === 'denied'}>
              {isRegistering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Activer les notifications
            </Button>
          )
        )}
      </CardContent>
    </Card>
  )
}
