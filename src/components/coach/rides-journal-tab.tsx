"use client"

// "Sorties" — le journal des dernières activités, extrait de Cyclisme >
// Vue d'ensemble lors de la refonte IA (voir CLAUDE.md section Navigation) :
// planifier une sortie (Proposition du jour, Météo & Tenue) et la relire
// après coup sont le même geste mental "je m'occupe de ma prochaine/dernière
// sortie", donc les deux vivent maintenant sous Coach plutôt que sur la page
// données (Cyclisme).

import { useMemo } from 'react'
import { format, subDays, formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Bike, ChevronRight, Timer, Flame } from 'lucide-react'
import { useActivities, useFitnessChart } from '@/hooks/use-intervals'
import { NotConfiguredBanner } from '@/components/cycling/not-configured-banner'
import { QuickFeedbackButton } from '@/components/cycling/quick-feedback-widget'

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

  // Map date → charge d'entraînement du jour, pour les activités qui
  // n'ont pas leur propre icu_training_load renseigné.
  const dailyLoad = useMemo(() => {
    const map = new Map<string, number>()
    for (const day of fitness.data) {
      if (day.trainingLoad > 0) map.set(day.date, day.trainingLoad)
    }
    return map
  }, [fitness.data])

  if (!isConfigured && !athleteLoading) return <NotConfiguredBanner />

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Journal d&apos;activités</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {activities.data.length} activité{activities.data.length > 1 ? 's' : ''}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {activities.isLoading ? (
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
        ) : activities.data.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune activité sur les 30 derniers jours
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.data.slice(0, 20).map((ride) => {
              const dateStr = ride.start_date_local?.slice(0, 10)
              const load = dateStr ? dailyLoad.get(dateStr) : undefined
              return (
                <a
                  key={ride.id}
                  href={`https://intervals.icu/activities/${ride.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold">
                        {ride.name || (dateStr ? format(parseISO(dateStr), 'EEEE d MMMM', { locale: fr }) : 'Activité')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ride.start_date_local
                          ? formatDistanceToNow(parseISO(ride.start_date_local), { addSuffix: true, locale: fr })
                          : 'Date inconnue'}
                        {ride.source === 'STRAVA' && (
                          <span className="ml-2 text-orange-400">Strava</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
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
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
