"use client"

// "Journal" — le journal des dernières activités (vélo ET musculation),
// extrait de Cyclisme > Vue d'ensemble lors de la refonte IA (voir
// CLAUDE.md section Navigation) : planifier une sortie (Proposition du
// jour, Météo & Tenue) et la relire après coup sont le même geste mental
// "je m'occupe de ma prochaine/dernière sortie", donc les deux vivent
// maintenant sous Coach plutôt que sur la page données (Cyclisme).
//
// Retour utilisateur, à propos du lien plan ↔ activités : "lien entre plan
// et sorties (d'ailleurs peut etre pas le bon nom)". "Sorties" ne couvrait
// que les activités Intervals.icu (donc uniquement le vélo) — renommé en
// "Journal" et fusionné avec strengthSessionLogs (musculation), pour que
// CE SOIT réellement l'endroit où l'athlète relit tout ce qu'il a fait,
// pas seulement ses sorties vélo. Chaque entrée muscu affiche directement
// son lien vers le plan (planWeekNumber/planSessionIndex, déjà porté par
// le log lui-même — voir strength-log-types.ts) ; le rapprochement réalisé/
// prévu pour le vélo reste affiché sur l'onglet Plan (matchSessionCompletion,
// training-plan-types.ts), pas dupliqué ici.

import { useMemo, useState } from 'react'
import { format, subDays, formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bike, ChevronRight, Timer, Flame, Dumbbell } from 'lucide-react'
import { useActivities, useFitnessChart } from '@/hooks/use-intervals'
import { NotConfiguredBanner } from '@/components/cycling/not-configured-banner'
import { QuickFeedbackButton } from '@/components/cycling/quick-feedback-widget'
import { RideAnalysisDialog, RideAnalysisTrigger } from './ride-analysis-dialog'
import { useStrengthLogs } from '@/components/cycling/use-strength-logs'
import type { StrengthSessionLogWithId } from '@/components/cycling/strength-log-types'

type RideActivity = ReturnType<typeof useActivities>['data'][number]
/** Une entrée du journal fusionné vélo+musculation — voir journalEntries ci-dessous. */
type JournalEntry =
  | { kind: 'ride'; ride: RideActivity; date: string }
  | { kind: 'strength'; log: StrengthSessionLogWithId; date: string }

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

function formatDistance(meters: number | null | undefined): string {
  if (meters == null || isNaN(meters)) return '—'
  const km = meters / 1000
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`
}

const today = new Date()
const newest = format(today, 'yyyy-MM-dd')
const activitiesOldest = format(subDays(today, 30), 'yyyy-MM-dd')
const fitnessOldest = format(subDays(today, 84), 'yyyy-MM-dd') // 12 semaines — même fenêtre que PMC

export function RidesJournalTab({ isConfigured, athleteLoading }: { isConfigured: boolean; athleteLoading: boolean }) {
  const activities = useActivities(activitiesOldest, newest)
  const fitness = useFitnessChart(fitnessOldest, newest)
  const strengthLogs = useStrengthLogs()
  const [analyzingRide, setAnalyzingRide] = useState<{ id: string; label: string } | null>(null)

  // Map date → charge d'entraînement du jour, pour les activités qui
  // n'ont pas leur propre icu_training_load renseigné.
  const dailyLoad = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of fitness.data) {
      if (day.trainingLoad > 0) map.set(day.date, day.trainingLoad)
    }
    return map
  }, [fitness.data])

  // Fenêtre des 30 derniers jours pour les logs muscu aussi (même fenêtre
  // que les activités Intervals.icu ci-dessus) — fusionnées en UN SEUL
  // flux chronologique (journalEntries), pas deux listes séparées : c'est
  // exactement le point du rapprochement "Journal" (retour utilisateur).
  const journalEntries = useMemo(() => {
    const rideEntries: JournalEntry[] = activities.data.map((ride) => ({ kind: 'ride', ride, date: ride.start_date_local?.slice(0, 10) ?? '' }))
    const strengthEntries: JournalEntry[] = strengthLogs.logs
      .filter((l) => l.date >= activitiesOldest)
      .map((log) => ({ kind: 'strength', log, date: log.date }))
    return [...rideEntries, ...strengthEntries].sort((a, b) => b.date.localeCompare(a.date))
  }, [activities.data, strengthLogs.logs])

  if (!isConfigured && !athleteLoading) return <NotConfiguredBanner />

  const totalCount = journalEntries.length
  const isLoading = activities.isLoading || strengthLogs.isLoading

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Journal d&apos;activités</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {totalCount} activité{totalCount > 1 ? 's' : ''}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune activité sur les 30 derniers jours
          </div>
        ) : (
          <div className="divide-y divide-border">
            {journalEntries.slice(0, 20).map((entry) =>
              entry.kind === 'strength' ? (
                <div key={`s-${entry.log.id}`} className="flex items-center justify-between gap-3 p-4">
                  {/* min-w-0 sur chaque niveau flex + truncate sur le titre
                      — retour utilisateur : "vérifie sur mobile que les
                      autres onglets sont cohérents". Sans ce min-w-0 en
                      cascade (même piège que le header du dialogue recette,
                      voir CLAUDE.md), un titre de séance long pousse toute
                      la ligne plus large que l'écran au lieu de tronquer. */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold truncate">{entry.log.title}</span>
                        {entry.log.planWeekNumber != null && (
                          <Badge variant="outline" className="text-[10px] shrink-0">Plan S{entry.log.planWeekNumber}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(parseISO(entry.log.date), { addSuffix: true, locale: fr })}
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-end shrink-0">
                    <span className="text-sm font-medium">{entry.log.exercises.length} exercice{entry.log.exercises.length > 1 ? 's' : ''}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {entry.log.exercises.reduce((sum, e) => sum + e.sets, 0)} série{entry.log.exercises.reduce((sum, e) => sum + e.sets, 0) > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ) : (() => {
              const ride = entry.ride
              const dateStr = ride.start_date_local?.slice(0, 10)
              const load = dateStr ? dailyLoad.get(dateStr) : undefined
              return (
                <a
                  key={`r-${ride.id}`}
                  href={`https://intervals.icu/activities/${ride.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  {/* min-w-0 en cascade + truncate — un nom de sortie Strava
                      peut être long (texte libre), sans ça la ligne entière
                      poussait plus large que l'écran sur mobile au lieu de
                      tronquer (même piège que le header du dialogue
                      recette, voir CLAUDE.md). */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {ride.name || (dateStr ? format(parseISO(dateStr), 'EEEE d MMMM', { locale: fr }) : 'Activité')}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {ride.start_date_local
                          ? formatDistanceToNow(parseISO(ride.start_date_local), { addSuffix: true, locale: fr })
                          : 'Date inconnue'}
                        {ride.source === 'STRAVA' && (
                          <span className="ml-2 text-orange-400">Strava</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    {ride.distance ? (
                      <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-medium">{formatDistance(ride.distance)}</span>
                        <span className="text-[10px] text-muted-foreground">Distance</span>
                      </div>
                    ) : null}
                    {ride.moving_time ? (
                      <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-medium flex items-center gap-1">
                          <Timer className="w-3 h-3" /> {formatDuration(ride.moving_time)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Durée</span>
                      </div>
                    ) : null}
                    {(ride.icu_training_load || load) && (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-400" />
                          {Math.round(ride.icu_training_load ?? load ?? 0)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Charge</span>
                      </div>
                    )}
                    <QuickFeedbackButton activityId={ride.id} date={dateStr ?? format(new Date(), 'yyyy-MM-dd')} />
                    <RideAnalysisTrigger
                      onClick={() => setAnalyzingRide({
                        id: ride.id,
                        label: ride.name || (dateStr ? format(parseISO(dateStr), 'EEEE d MMMM', { locale: fr }) : 'Activité'),
                      })}
                    />
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </a>
              )
            })()
            )}
          </div>
        )}
      </CardContent>
      {analyzingRide && (
        <RideAnalysisDialog
          activityId={analyzingRide.id}
          rideLabel={analyzingRide.label}
          open={!!analyzingRide}
          onOpenChange={(open) => { if (!open) setAnalyzingRide(null) }}
        />
      )}
    </Card>
  )
}
