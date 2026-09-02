"use client"

// ── Aperçu de la séance prévue par le plan, sur Cyclisme ─────────────────
//
// Retour utilisateur : "mettre sous les indicateurs clef du jour la
// séance « prévue » au plan du jour (si pas de plan un bouton pour
// préparer le plan), un autre bouton pourrait être prévoir une autre
// activité." Place le geste "que dois-je faire aujourd'hui ?" directement
// à côté des indicateurs de forme (Forme/Récupération/Sommeil) plutôt que
// d'exiger un aller-retour de nav vers Coach pour le découvrir — même
// motif "readiness + séance du jour sur un seul écran" que documenté dans
// COACH_UX_AUDIT.md (Join/TrainerRoad), appliqué ici sans dupliquer tout
// DailyWorkoutTab : juste un aperçu + deux boutons vers Coach, qui reste
// seul propriétaire de la génération/l'ajustement de la séance elle-même
// (Cyclisme reste la page données — voir CLAUDE.md "Coach").
//
// Les deux boutons mènent tous les deux à Coach > Aujourd'hui quand un
// plan existe — "Voir la séance" (suivre le plan) et "Prévoir une autre
// activité" (s'en écarter, ex. toggle Salle ou séance libre) sont deux
// intentions différentes qui atterrissent délibérément au même endroit :
// DailyWorkoutTab gère déjà les deux (séance ajustée depuis le plan par
// défaut, toggle Vélo/Salle pour en dévier) — dupliquer ce choix ici
// introduirait une deuxième façon de le faire.

import Link from 'next/link'
import { Bike, Dumbbell, Wand2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTodaysPlanSession } from './use-todays-plan-session'
import { PHASE_LABELS } from './training-plan-types'

export function TodaysSessionCard() {
  const { isLoading, hasActivePlan, week, weekGenerated, session } = useTodaysPlanSession()

  if (isLoading) {
    return <div className="h-8 rounded-lg bg-primary/10 animate-pulse" />
  }

  if (!hasActivePlan) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">Aucun plan d&apos;entraînement actif.</p>
        <div className="flex gap-2 shrink-0">
          <Button asChild size="sm" className="gap-1.5 h-8">
            <Link href="/coach?tab=plan"><Wand2 className="w-3.5 h-3.5" /> Préparer mon plan</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5 h-8">
            <Link href="/coach?tab=today"><Sparkles className="w-3.5 h-3.5" /> Prévoir une activité</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        {session ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {session.sessionKind === 'strength'
              ? <Dumbbell className="w-3.5 h-3.5 text-primary shrink-0" />
              : <Bike className="w-3.5 h-3.5 text-primary shrink-0" />}
            <span className="text-sm font-medium truncate">{session.title}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{session.durationMinutes} min</span>
          </div>
        ) : weekGenerated ? (
          <p className="text-sm text-muted-foreground">Repos aujourd&apos;hui.</p>
        ) : week ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm text-muted-foreground">Plan actif —</span>
            <Badge variant="outline" className="text-[10px]">{PHASE_LABELS[week.phase]}</Badge>
            <span className="text-sm text-muted-foreground truncate">{week.focus}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Plan actif, hors de la période couverte aujourd&apos;hui.</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button asChild size="sm" className="gap-1.5 h-8">
          <Link href="/coach?tab=today">Voir la séance</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5 h-8">
          <Link href="/coach?tab=today">Prévoir une autre activité</Link>
        </Button>
      </div>
    </div>
  )
}
