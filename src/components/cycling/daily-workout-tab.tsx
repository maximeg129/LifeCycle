"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Loader2, Send, AlertTriangle, CheckCircle2, Clock, Wind, MapPin, Thermometer, CloudSun, CloudRain, ShieldAlert, ShieldCheck, Home, TreePine, Apple, Dumbbell, PlayCircle, Target, ChevronDown, FileText } from 'lucide-react'
import { useDailyWorkout } from './use-daily-workout'
import { buildRideDateTime } from './daily-workout-types'
import type { DailyWorkoutRecommendationOutput } from '@/ai/flows/daily-workout-recommendation-flow'
import { EmptyState } from '@/components/ui/empty-state'
import { SourceCitation } from '@/components/coach/source-citation'
import { LiveStrengthSessionView } from './live-strength-session-view'
import { LogStrengthSessionDialog } from './log-strength-session-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

const DEFAULT_MINUTES = 60
const DEFAULT_RIDE_TIME = '09:00'

export function DailyWorkoutTab() {
  const {
    stored,
    storedAvailableMinutes,
    storedRide,
    storedIndoorRequested,
    sentToIntervals,
    planWeek,
    recovery,
    isLoadingStored,
    isGenerating,
    isSending,
    canSendToIntervals,
    generate,
    sendToIntervals,
    todaysPlanSession,
    todaysPlanSessionIsStrength,
  } = useDailyWorkout()

  const [liveStrengthOpen, setLiveStrengthOpen] = useState(false)
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)
  const [rideLocation, setRideLocation] = useState('')
  const [rideTime, setRideTime] = useState(DEFAULT_RIDE_TIME)
  // Retour utilisateur : "choisir si on veut faire la séance en intérieur
  // ou en extérieur, si en intérieur du coup on n'a pas besoin de mettre la
  // météo". Indépendant de la météo (voir daily-workout-recommendation-
  // flow.ts, forceIndoor) — un choix délibéré, pas une réaction au temps.
  const [indoorRequested, setIndoorRequested] = useState(false)
  const [draft, setDraft] = useState<DailyWorkoutRecommendationOutput | null>(null)
  const [wasSent, setWasSent] = useState(false)
  // Retour utilisateur, capture d'écran à l'appui : "c'est pas très user
  // friendly" — le script structuré (syntaxe technique) et le détail du
  // raisonnement (motif/incertitude) gonflaient la carte "Aujourd'hui" bien
  // au-delà de ce dont l'athlète a besoin d'un coup d'œil (titre/durée/
  // pourquoi/envoyer). Repliés par défaut, jamais perdus — juste un tap
  // pour les rouvrir.
  const [showScript, setShowScript] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)

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
    setIndoorRequested(storedIndoorRequested)
    // Only meant to run once the stored doc first resolves — not on every
    // render, or a user's in-progress edits would get clobbered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingStored])

  const handleGenerate = async () => {
    const ride = !indoorRequested && rideLocation.trim()
      ? { location: rideLocation.trim(), departureDateTime: buildRideDateTime(new Date(), rideTime) }
      : undefined
    const proposal = await generate(minutes, ride, indoorRequested)
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

  // Retour utilisateur : "le plan d'entrainement ne devrais t il pas etre
  // figé avec les seances par jour ?" — quand le plan a déjà daté une
  // séance de MUSCULATION pour aujourd'hui, "Proposition du jour" n'a rien
  // à générer/ajuster (ce flow est cycling-only, voir use-daily-workout.ts) :
  // on affiche directement la séance prévue avec les mêmes actions que
  // l'onglet Plan (suivi en direct / saisie rétroactive), plutôt que de
  // laisser l'athlète générer une séance vélo qui n'aurait pas de sens ce
  // jour-là.
  if (todaysPlanSessionIsStrength && todaysPlanSession) {
    const session = todaysPlanSession.session
    const exercises = session.strengthExercises ?? []
    return (
      <div className="space-y-6">
        <Card className="bg-card/60 border-primary/20 border-2">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1.5 font-normal text-xs">
                <Target className="w-3 h-3" /> Semaine {todaysPlanSession.weekNumber} du plan
              </Badge>
              <Badge variant="secondary">{session.intensityLabel}</Badge>
            </div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-primary" /> {session.title}
            </CardTitle>
            <CardDescription>{session.rationale}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exercises.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {exercises.map((ex, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-muted-foreground">— {ex.sets}x{ex.reps} — {ex.loadGuidance}{ex.restSeconds ? ` (repos ${ex.restSeconds}s)` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
              <Button onClick={() => setLiveStrengthOpen(true)} className="gap-2">
                <PlayCircle className="w-4 h-4" /> Démarrer la séance
              </Button>
              <LogStrengthSessionDialog session={session} weekNumber={todaysPlanSession.weekNumber} sessionIndex={todaysPlanSession.index} />
            </div>
          </CardContent>
        </Card>
        {liveStrengthOpen && (
          <LiveStrengthSessionView
            session={session}
            weekNumber={todaysPlanSession.weekNumber}
            sessionIndex={todaysPlanSession.index}
            sessionKey={`${todaysPlanSession.weekNumber}-${todaysPlanSession.index}`}
            onClose={() => setLiveStrengthOpen(false)}
          />
        )}
      </div>
    )
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
            {recovery && (recovery.sleepHours != null || recovery.hrv != null || recovery.restingHR != null || recovery.readiness != null) && (
              <Badge variant="outline" className="w-fit gap-1.5 font-normal text-xs">
                Récup {recovery.sleepHours != null ? `${recovery.sleepHours}h` : ''}
                {recovery.hrv != null ? ` · HRV ${recovery.hrv}ms` : ''}
                {recovery.restingHR != null ? ` · FC repos ${recovery.restingHR}bpm` : ''}
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
            <Label>Intérieur ou extérieur</Label>
            <div className="flex gap-0.5 rounded-full bg-muted p-0.5 w-fit">
              <button
                type="button"
                onClick={() => setIndoorRequested(false)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  !indoorRequested ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TreePine className="w-3.5 h-3.5" /> Extérieur
              </button>
              <button
                type="button"
                onClick={() => setIndoorRequested(true)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  indoorRequested ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Home className="w-3.5 h-3.5" /> Intérieur
              </button>
            </div>
          </div>
          {/* Lieu/heure de départ n'ont de sens que pour une sortie extérieure
              (météo réelle, conseil de vent) — masqués en intérieur plutôt que
              désactivés, pour ne pas laisser croire qu'ils comptent encore. */}
          {!indoorRequested && (
            <>
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
            </>
          )}
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {draft ? 'Régénérer' : 'Proposer une séance'}
          </Button>
        </CardContent>
        {!indoorRequested && rideLocation.trim() && (
          <CardContent className="pt-0">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Wind className="w-3 h-3" /> Avec un lieu et une heure de départ, l&apos;IA récupère la météo réelle et conseille une direction pour avoir le vent dans le dos au retour.
            </p>
          </CardContent>
        )}
        {indoorRequested && (
          <CardContent className="pt-0">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Home className="w-3 h-3" /> Séance adaptée pour home trainer (pas une copie de la séance extérieure — voir rationale une fois générée).
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
              {draft.sportType === 'VirtualRide' && (
                <Badge variant="outline" className="gap-1">
                  <Home className="w-3 h-3" /> Home trainer
                </Badge>
              )}
              <Badge variant="secondary">{draft.intensityLabel}</Badge>
            </div>
            {/* Retour utilisateur : "le plan d'entrainement ne devrais t
                il pas etre figé avec les seances par jour ?" — distingue
                une proposition qui AJUSTE la séance déjà prévue par le
                plan d'aujourd'hui d'une proposition générée librement (pas
                de plan actif, ou jour de repos du plan). draft.adjustedFromPlan
                absent (proposition stockée avant l'introduction de ce
                champ) traité comme false — même précaution défensive que
                draft.verdict/reasons plus bas. */}
            {draft.adjustedFromPlan ? (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Target className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  Ajustée depuis la séance prévue par le plan{todaysPlanSession ? ` (semaine ${todaysPlanSession.weekNumber})` : ''}.
                  {draft.planAdjustmentNote ? ` ${draft.planAdjustmentNote}` : ''}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Générée librement — aucune séance planifiée aujourd&apos;hui.</p>
            )}
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

            {/* Bulletin météo réel — même chiffres/même principe (pré-fetch
                déterministe, jamais inventé) que Météo & Tenue, affichés ici
                sous forme compacte plutôt que les 4 grandes cartes de cet
                onglet-là (retour utilisateur : "s'assurer que la météo
                fonctionne de la même façon que dans météo et tenue"). */}
            {draft.predictedWeather && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3 rounded-xl bg-muted/50 border border-border text-sm">
                <span className="flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5 text-muted-foreground" /> {draft.predictedWeather.temperatureCelsius}°C</span>
                <span className="flex items-center gap-1.5"><Wind className="w-3.5 h-3.5 text-muted-foreground" /> {draft.predictedWeather.windSpeedKmh} km/h · {draft.predictedWeather.windDirectionCompass}</span>
                <span className="flex items-center gap-1.5"><CloudSun className="w-3.5 h-3.5 text-muted-foreground" /> {draft.predictedWeather.conditions}</span>
              </div>
            )}

            {/* Météo trop dégradée (vent fort, pluie/neige forte, orage) — la
                séance ci-dessus a déjà été adaptée en home trainer par le flow
                (retour utilisateur : "si le temps est vraiment dégradée...
                l'IA pourrait proposer une alternative adaptée pour home
                trainer"), ce bandeau explique pourquoi. Couleur destructive
                pour le distinguer des warnings jaunes génériques ci-dessous. */}
            {draft.weatherAlert && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-sm">
                <CloudRain className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>{draft.weatherAlert}</span>
              </div>
            )}

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

            {/* Alimentation à avoir sur le vélo — retour utilisateur :
                "il est important de baser cette alimentation sur des
                recherches spécifiquement et pas de sortir un chiffre au
                pif" (voir on-bike-fueling-guidance.ts). draft.fueling
                gardé optionnel (draft.fueling &&) : une proposition stockée
                avant l'introduction de ce champ (workoutProposals/
                {yyyy-MM-dd}) n'en a pas, même précaution que verdict/
                reasons ci-dessous. */}
            {draft.fueling && draft.fueling.neededOnBike && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                <Apple className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">
                    {draft.fueling.carbGramsPerHourMin}
                    {draft.fueling.carbGramsPerHourMax != null && draft.fueling.carbGramsPerHourMax !== draft.fueling.carbGramsPerHourMin ? `–${draft.fueling.carbGramsPerHourMax}` : ''}
                    {' '}g de glucides/h sur le vélo
                  </p>
                  <p className="text-muted-foreground">{draft.fueling.rationale}</p>
                  {draft.fueling.hydrationNote && <p className="text-muted-foreground">{draft.fueling.hydrationNote}</p>}
                </div>
              </div>
            )}

            {/* Verdict/motif/incertitude — champs du contrat de sortie coach
                (withCoachOutputContract, ai/coach/outputContract.ts), déjà
                calculés par invokeCoachJson sur chaque proposition mais
                jusqu'ici jamais affichés. "reasons" EST le motif de chaque
                ajustement de séance ; "verdict" distingue une proposition
                qui suit les règles sans réserve (ok, pas de bandeau) d'une
                qui porte une réserve à afficher (warn, jaune) ou qui
                enfreindrait un red-flag si suivie telle quelle (block,
                destructive — la séance ci-dessus reste affichée pour
                transparence, mais l'envoi vers Intervals.icu est bloqué). */}
            {/* Champs du contrat de sortie coach (verdict/reasons/uncertainty)
                gardés défensivement (draft.verdict && ..., (draft.reasons ?? [])
                plutôt qu'un accès direct : une proposition déjà stockée dans
                Firestore AVANT l'introduction de ce contrat (workoutProposals/
                {yyyy-MM-dd}, un doc par jour, potentiellement ancien) n'a pas
                ces champs — undefined.length/.map ferait planter toute la
                page Coach au chargement, pas seulement afficher un vide. Bug
                réel rencontré en production : premier accès à un draft ancien
                après le déploiement de cet affichage. */}
            {draft.verdict && draft.verdict !== 'ok' && (
              <div
                className={cn(
                  'flex items-start gap-2 p-3 rounded-xl border text-sm',
                  draft.verdict === 'block'
                    ? 'bg-destructive/5 border-destructive/20'
                    : 'bg-yellow-500/5 border-yellow-500/20'
                )}
              >
                <ShieldAlert
                  className={cn('w-4 h-4 shrink-0 mt-0.5', draft.verdict === 'block' ? 'text-destructive' : 'text-yellow-500')}
                />
                <span>{draft.recommendation}</span>
              </div>
            )}

            {/* Retour utilisateur : "c'est pas très user friendly" — motif/
                incertitude/script repliés par défaut (Collapsible), pour
                que la carte s'arrête à l'essentiel (titre/durée/pourquoi
                en une phrase/bouton d'envoi) au premier coup d'œil. Un
                seul disclosure pour les deux (motif + incertitude) : ce
                sont la même catégorie d'info ("le détail du raisonnement
                du coach"), pas la peine de deux toggles séparés. */}
            {((draft.reasons ?? []).length > 0 || draft.uncertainty) && (
              <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <ShieldCheck className="w-3.5 h-3.5" /> Motif de cette proposition
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showReasoning && 'rotate-180')} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-2">
                  {(draft.reasons ?? []).length > 0 && (
                    <ul className="space-y-1.5">
                      {(draft.reasons ?? []).map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                          <span className="flex-1">{r.detail}</span>
                          <SourceCitation ruleIds={[r.rule]} label="Voir la règle citée" className="shrink-0 mt-0.5" />
                        </li>
                      ))}
                    </ul>
                  )}
                  {draft.uncertainty && (
                    <p className="text-xs text-muted-foreground italic">Incertitude : {draft.uncertainty}</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            <Collapsible open={showScript} onOpenChange={setShowScript}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <FileText className="w-3.5 h-3.5" /> {showScript ? 'Masquer' : 'Voir/modifier'} le script de la séance
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showScript && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <Label htmlFor="draft-structured" className="sr-only">Script de la séance</Label>
                <Textarea
                  id="draft-structured"
                  value={draft.structuredWorkout}
                  onChange={(e) => updateDraft({ structuredWorkout: e.target.value })}
                  rows={6}
                  className="font-mono text-xs"
                />
              </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              {wasSent ? (
                <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                  <CheckCircle2 className="w-4 h-4" /> Envoyé sur Intervals.icu
                </span>
              ) : <span />}
              <Button onClick={handleSend} disabled={isSending || !canSendToIntervals || draft.verdict === 'block'} className="gap-2">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {wasSent ? 'Ré-envoyer sur Intervals.icu' : 'Envoyer sur Intervals.icu'}
              </Button>
            </div>
            {!canSendToIntervals && (
              <p className="text-xs text-muted-foreground text-right">Connectez Intervals.icu dans Réglages pour envoyer la séance.</p>
            )}
            {canSendToIntervals && draft.verdict === 'block' && (
              <p className="text-xs text-destructive text-right">Envoi bloqué — voir le motif ci-dessus avant de continuer.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
