"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Loader2, Send, AlertTriangle, CheckCircle2, Clock, Wind, MapPin } from 'lucide-react'
import { useDailyWorkout } from './use-daily-workout'
import { buildRideDateTime } from './daily-workout-types'
import type { DailyWorkoutRecommendationOutput } from '@/ai/flows/daily-workout-recommendation-flow'
import { EmptyState } from '@/components/ui/empty-state'

const DEFAULT_MINUTES = 60
const DEFAULT_RIDE_TIME = '09:00'

export function DailyWorkoutTab() {
  const {
    stored,
    storedAvailableMinutes,
    storedRide,
    sentToIntervals,
    planWeek,
    recovery,
    isLoadingStored,
    isGenerating,
    isSending,
    canSendToIntervals,
    generate,
    sendToIntervals,
  } = useDailyWorkout()

  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)
  const [rideLocation, setRideLocation] = useState('')
  const [rideTime, setRideTime] = useState(DEFAULT_RIDE_TIME)
  const [draft, setDraft] = useState<DailyWorkoutRecommendationOutput | null>(null)
  const [wasSent, setWasSent] = useState(false)

  // Prefill from today's already-generated proposal (Firestore singleton),
  // so reopening the tab doesn't lose it or force a regeneration.
  useEffect(() => {
    if (stored) {
      setDraft(stored)
      setWasSent(sentToIntervals)
    }
    if (storedAvailableMinutes != null) setMinutes(storedAvailableMinutes)
    if (storedRide) {
      setRideLocation(storedRide.location)
      setRideTime(storedRide.departureDateTime.slice(11, 16) || DEFAULT_RIDE_TIME)
    }
    // Only meant to run once the stored doc first resolves — not on every
    // render, or a user's in-progress edits would get clobbered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingStored])

  const handleGenerate = async () => {
    const ride = rideLocation.trim()
      ? { location: rideLocation.trim(), departureDateTime: buildRideDateTime(new Date(), rideTime) }
      : undefined
    const proposal = await generate(minutes, ride)
    if (proposal) {
      setDraft(proposal)
      setWasSent(false)
    }
  }

  const handleSend = async () => {
    if (!draft) return
    const ok = await sendToIntervals(draft)
    if (ok) setWasSent(true)
  }

  const updateDraft = (patch: Partial<DailyWorkoutRecommendationOutput>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setWasSent(false)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card/40 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Proposition du jour
          </CardTitle>
          <CardDescription>
            Indiquez le temps dont vous disposez aujourd&apos;hui — l&apos;IA propose une séance adaptée à votre forme actuelle
            (charge interne, TSB, blessures, objectifs), que vous pouvez ajuster avant de l&apos;envoyer sur Intervals.icu.
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            {planWeek && (
              <Badge variant="outline" className="w-fit gap-1.5 font-normal text-xs">
                Semaine {planWeek.weekNumber} du plan · {planWeek.focus}
              </Badge>
            )}
            {recovery && (recovery.sleepHours != null || recovery.hrv != null || recovery.readiness != null) && (
              <Badge variant="outline" className="w-fit gap-1.5 font-normal text-xs">
                Récup {recovery.sleepHours != null ? `${recovery.sleepHours}h` : ''}
                {recovery.hrv != null ? ` · HRV ${recovery.hrv}ms` : ''}
                {recovery.readiness != null ? ` · Readiness ${recovery.readiness}/100` : ''}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="available-minutes">Temps disponible (min)</Label>
            <Input
              id="available-minutes"
              type="number"
              min={15}
              max={360}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ride-location" className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Lieu de départ (optionnel)
            </Label>
            <Input
              id="ride-location"
              placeholder="ex: Mont Ventoux"
              value={rideLocation}
              onChange={(e) => setRideLocation(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ride-time">Heure de départ</Label>
            <Input
              id="ride-time"
              type="time"
              value={rideTime}
              onChange={(e) => setRideTime(e.target.value)}
              disabled={!rideLocation.trim()}
              className="w-28"
            />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {draft ? 'Régénérer' : 'Proposer une séance'}
          </Button>
        </CardContent>
        {rideLocation.trim() && (
          <CardContent className="pt-0">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Wind className="w-3 h-3" /> Avec un lieu et une heure de départ, l&apos;IA récupère la météo réelle et conseille une direction pour avoir le vent dans le dos au retour.
            </p>
          </CardContent>
        )}
      </Card>

      {isLoadingStored && !draft ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : !draft ? (
        <EmptyState
          icon={Clock}
          title="Aucune proposition pour aujourd'hui"
          description="Indiquez votre temps disponible et générez une séance adaptée à votre forme du jour."
        />
      ) : (
        <Card className="bg-card/60 border-primary/20 border-2">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                className="text-lg font-bold border-none bg-transparent px-0 h-auto focus-visible:ring-0 flex-1 min-w-[200px]"
              />
              <Badge variant="secondary">{draft.intensityLabel}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="draft-duration" className="text-xs text-muted-foreground shrink-0">Durée (min)</Label>
              <Input
                id="draft-duration"
                type="number"
                min={1}
                value={draft.durationMinutes}
                onChange={(e) => updateDraft({ durationMinutes: Number(e.target.value) })}
                className="w-24 h-8"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">{draft.rationale}</p>

            {draft.warnings.length > 0 && (
              <div className="space-y-2">
                {draft.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {draft.windAdvice && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                <Wind className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{draft.windAdvice}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="draft-structured">Script de la séance</Label>
              <Textarea
                id="draft-structured"
                value={draft.structuredWorkout}
                onChange={(e) => updateDraft({ structuredWorkout: e.target.value })}
                rows={6}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              {wasSent ? (
                <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                  <CheckCircle2 className="w-4 h-4" /> Envoyé sur Intervals.icu
                </span>
              ) : <span />}
              <Button onClick={handleSend} disabled={isSending || !canSendToIntervals} className="gap-2">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {wasSent ? 'Ré-envoyer sur Intervals.icu' : 'Envoyer sur Intervals.icu'}
              </Button>
            </div>
            {!canSendToIntervals && (
              <p className="text-xs text-muted-foreground text-right">Connectez Intervals.icu dans Réglages pour envoyer la séance.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
