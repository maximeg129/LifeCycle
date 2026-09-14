"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, Loader2, Send, CheckCircle2, Clock, MapPin, CloudRain, ShieldCheck, Home, TreePine, Apple, Dumbbell, PlayCircle, Target, ChevronDown, FileText, Bike, Shuffle } from 'lucide-react'
import { useDailyWorkout } from './use-daily-workout'
import { buildRideDateTime } from './daily-workout-types'
import type { DailyWorkoutRecommendationOutput } from '@/ai/flows/daily-workout-recommendation-flow'
import { EmptyState } from '@/components/ui/empty-state'
import { SourceCitation } from '@/components/coach/source-citation'
import { RideAnalysisDialog } from '@/components/coach/ride-analysis-dialog'
import { useRideAnalysis } from '@/components/coach/use-ride-analysis'
import { LiveStrengthSessionView } from './live-strength-session-view'
import { LogStrengthSessionDialog } from './log-strength-session-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { findWeekStrengthSession, type PlanWeekSessionWithValidation } from './training-plan-types'
import { IntervalsOnboardingNotice } from './intervals-onboarding-notice'
import { WorkoutProfileChart } from './workout-profile-chart'
import { PlanAttentionBadge } from './plan-attention-badge'
import { buildPlanAttentionItems } from './plan-attention-types'
import { cn } from '@/lib/utils'

const DEFAULT_MINUTES = 60
const DEFAULT_RIDE_TIME = '09:00'

/**
 * Carte séance musculation "à faire aujourd'hui" — extraite pour être
 * réutilisée par les deux chemins qui peuvent aboutir à une séance muscu
 * dans "Aujourd'hui" : (1) le plan a déjà daté une séance strength ce
 * jour-là (court-circuit automatique), (2) l'athlète a basculé le toggle
 * "Salle" pour remplacer le vélo prévu par la séance muscu de la semaine
 * (retour utilisateur : "un petit toggle... si l'athlète ne veut pas ou ne
 * peut pas faire de vélo, mais pour aller à la gym"). Mêmes actions que
 * l'onglet Plan (suivi en direct / saisie rétroactive) — gère son propre
 * état d'ouverture du suivi en direct, self-contained.
 */
function StrengthSessionCard({ session, weekNumber, sessionIndex, badge, description }: {
  session: PlanWeekSessionWithValidation
  weekNumber: number
  sessionIndex: number
  badge: React.ReactNode
  description?: string
}) {
  const [liveOpen, setLiveOpen] = useState(false)
  const exercises = session.strengthExercises ?? []
  return (
    <>
      {/* .lc-card + ring-2 ring-primary/50 — même vocabulaire "à faire
          maintenant" que l'exercice courant du suivi en direct muscu
          (COACH_UX_AUDIT.md §5) : c'est la seule carte de cet onglet à
          justifier l'emphase visuelle maximale. */}
      <Card className="lc-card ring-2 ring-primary/50">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {badge}
            <Badge variant="secondary">{session.intensityLabel}</Badge>
          </div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-primary" /> {session.title}
          </CardTitle>
          <CardDescription>{description ?? session.rationale}</CardDescription>
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
            <Button onClick={() => setLiveOpen(true)} className="gap-2">
              <PlayCircle className="w-4 h-4" /> Démarrer la séance
            </Button>
            <LogStrengthSessionDialog session={session} weekNumber={weekNumber} sessionIndex={sessionIndex} />
          </div>
        </CardContent>
      </Card>
      {liveOpen && (
        <LiveStrengthSessionView
          session={session}
          weekNumber={weekNumber}
          sessionIndex={sessionIndex}
          sessionKey={`${weekNumber}-${sessionIndex}`}
          onClose={() => setLiveOpen(false)}
        />
      )}
    </>
  )
}

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
    isSendingPlanSession,
    canSendToIntervals,
    generate,
    sendToIntervals,
    sendPlanSessionDirectly,
    generateStrengthSession,
    isGeneratingStrength,
    todaysPlanSession,
    todaysPlanSessionIsStrength,
    generateWeekSessions,
    generatingSessionsForWeek,
    todaysCompletion,
  } = useDailyWorkout()

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
  const [showRationale, setShowRationale] = useState(false)
  // Retour utilisateur : "un petit toggle pour faire la proposition du jour
  // si l'athlète ne veut pas ou ne peut pas faire de vélo, mais pour aller
  // à la gym" — choix d'affichage local, jamais persisté (contrairement à
  // indoorRequested) : ce n'est pas un paramètre de génération IA, juste
  // "qu'est-ce qu'on affiche aujourd'hui", à re-décider à chaque ouverture.
  const [wantsGym, setWantsGym] = useState(false)
  // Retour utilisateur : "reintegrer la possibilité de... proposer une
  // seance de muscu (bien sur qui viendrais s'imbriquer dans le plan)" —
  // séance générée par dailyStrengthRecommendation (use-daily-workout.ts),
  // déjà embarquée dans le plan au moment où l'appel réussit (voir
  // generateStrengthSession) ; cet état local ne pilote que ce qui
  // s'affiche ICI, pas la persistance (déjà faite côté hook, comme
  // planWeekSessions pour une séance de semaine). `index` permet de
  // régénérer en remplaçant la même entrée plutôt qu'en empilant des
  // doublons — voir handleProposeStrength.
  const [strengthDraft, setStrengthDraft] = useState<{ session: PlanWeekSessionWithValidation; weekNumber: number; index: number } | null>(null)
  // Retour utilisateur : "je me demande s'il ne serait pas intéressant
  // d'avoir... la séance du jour proposée sur le plan, et un bouton...
  // de proposition alternative où l'utilisateur clique et ça l'emmène sur
  // la capacité de dire combien de temps tu as disponible, où tu es, etc."
  // — quand le plan a déjà daté une séance vélo aujourd'hui, le formulaire
  // temps/lieu/heure n'est plus la vue par défaut : la séance du plan
  // s'affiche directement (aucun appel IA nécessaire juste pour la voir),
  // et ce formulaire devient l'action secondaire "proposer autre chose"
  // (moins de temps disponible, envie d'ailleurs...). Jamais persisté —
  // même statut que wantsGym, un choix d'affichage du moment.
  const [showAlternativeForm, setShowAlternativeForm] = useState(false)
  // Feedback visuel local (jamais persisté — même statut que wasSent avant
  // un rechargement) : "Envoyé" une fois sendPlanSessionDirectly réussi,
  // pour distinguer un premier envoi d'un ré-envoi — cliquer à nouveau reste
  // sans danger (même externalId, upsert côté Intervals.icu, jamais un
  // doublon).
  const [planSessionSent, setPlanSessionSent] = useState(false)
  // Retour utilisateur : "avec le webhook on devrait pouvoir pousser les
  // activités réalisée sur la carte du jour et donc le déclenchement de
  // l'IA lorsque l'on rentre sur le jour pour avoir l'analyse IA de la
  // séance réalisée versus plan." Le webhook Intervals.icu (chantier B2)
  // génère déjà une analyse "légère" à l'automatique (sans comparaison au
  // script prévu, voir CLAUDE.md) — cet effet déclenche silencieusement la
  // version RICHE (chemin client complet, avec plannedWorkout/
  // intervalAdherence) dès que l'athlète ouvre "Aujourd'hui" et qu'une
  // vraie activité a été rapprochée à la séance du jour, sans exiger un
  // clic "Analyser". `useRideAnalysis` est appelé ici indépendamment de
  // RideAnalysisDialog (qui l'appelle aussi, gated par son propre `open`)
  // — les deux liront/écriront le même document Firestore réactif, jamais
  // un doublon de logique.
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const todaysActivityId = todaysCompletion?.status === 'done' ? todaysCompletion.activityId : undefined
  const autoAnalysis = useRideAnalysis(todaysActivityId ?? null)
  const autoAnalysisTriggeredRef = useRef(false)
  useEffect(() => {
    if (!todaysActivityId || !autoAnalysis.canAnalyze) return
    if (autoAnalysis.isLoadingStored || autoAnalysis.isGenerating) return
    // Déjà une analyse riche (comparaison prévu/réalisé déjà calculée) —
    // rien à refaire, jamais un deuxième appel IA pour le même résultat.
    if (autoAnalysis.analysis && (autoAnalysis.plannedWorkout || autoAnalysis.intervalAdherence)) return
    if (autoAnalysisTriggeredRef.current) return
    autoAnalysisTriggeredRef.current = true
    void autoAnalysis.generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysActivityId, autoAnalysis.canAnalyze, autoAnalysis.isLoadingStored, autoAnalysis.isGenerating, autoAnalysis.analysis, autoAnalysis.plannedWorkout, autoAnalysis.intervalAdherence])

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

  // Retour utilisateur : "reintegrer la possibilité de... proposer une
  // seance de muscu (bien sur qui viendrais s'imbriquer dans le plan)" —
  // dailyStrengthRecommendation (use-daily-workout.ts) compose UNE séance
  // muscu pour aujourd'hui et l'embarque directement dans la semaine du
  // plan en cours (persistée côté hook, pas seulement affichée ici).
  // strengthDraft.index (déjà défini) fait que ré-appeler cette fonction
  // RÉGÉNÈRE la même entrée plutôt que d'en empiler une deuxième.
  const handleProposeStrength = async () => {
    const result = await generateStrengthSession(strengthDraft?.index)
    if (result) setStrengthDraft(result)
  }

  // Retour utilisateur : "une fois la séance alternative proposée on
  // devrait pouvoir revenir sur la séance initiale" — avant ce correctif,
  // le lien "← Revenir à la séance prévue par le plan" disparaissait dès
  // qu'un draft existait (voir le commentaire historique juste au-dessus
  // de son premier usage plus bas), sur l'idée qu'"il n'y aurait plus rien
  // de plus à montrer" — faux : la séance du plan reste consultable/
  // envoyable même après avoir généré une alternative. N'efface rien côté
  // Firestore (workoutProposals/{date} reste tel quel) — juste une remise
  // à zéro de l'affichage local, régénérable à tout moment. Efface aussi
  // strengthDraft par cohérence (même si les deux cartes sont mutuellement
  // exclusives dans le rendu, pour ne jamais laisser un état local périmé) —
  // ne supprime RIEN côté Firestore : une séance muscu déjà proposée reste
  // dans le plan (Plan tab, PlanNextSessionsList), juste plus affichée ici.
  const handleBackToPlan = () => {
    setDraft(null)
    setShowAlternativeForm(false)
    setStrengthDraft(null)
  }

  const handleSend = async () => {
    if (!draft) return
    const ok = await sendToIntervals(draft)
    if (ok) setWasSent(true)
  }

  // "Envoyer sur Intervals.icu" sur l'aperçu de la séance du plan — retour
  // utilisateur, capture d'écran à l'appui : "que le bouton soit simplement
  // envoi vers intervals ou proposer une alternative". La séance du plan
  // est déjà entièrement définie (title/durée/structuredWorkout) : plus
  // d'aller-retour IA pour la "recopier" avant de pouvoir l'envoyer (voir
  // sendPlanSessionDirectly, use-daily-workout.ts) — un seul geste.
  const handleSendPlanSession = async () => {
    const ok = await sendPlanSessionDirectly()
    if (ok) setPlanSessionSent(true)
  }

  const updateDraft = (patch: Partial<DailyWorkoutRecommendationOutput>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setWasSent(false)
  }

  // Retour utilisateur, après usage réel de la fusion "séance prévue" +
  // "suggestion du coach" côte à côte (chantier ci-dessus) : "avoir côte à
  // côte la séance du plan et la proposition du coach du jour est
  // redondant... la proposition du jour est un peu redondante de proposer
  // une séance alternative qui pourrait en fait nous emmener à rentrer les
  // détails de proposition du jour." Retour à un flux séquentiel — la
  // suggestion du coach ne se génère donc plus automatiquement : elle
  // n'existe (draft) qu'une fois que l'athlète a explicitement demandé
  // "Changer de séance" ou "Proposer une séance alternative" (voir le
  // rendu plus bas, un seul état affiché à la fois). L'auto-génération au
  // chargement de l'onglet a disparu avec elle.

  // Retour utilisateur : "un petit toggle... si l'athlète ne veut pas ou ne
  // peut pas faire de vélo, mais pour aller à la gym" — la séance muscu de
  // la semaine, quel que soit le jour où le plan l'a datée à l'origine
  // (findWeekStrengthSession, training-plan-types.ts). Jamais une
  // génération IA à la demande : ce flow reste cycling-only (voir
  // use-daily-workout.ts) — on réutilise le contenu déjà produit par
  // planWeekSessions, exactement comme le court-circuit automatique
  // ci-dessous. Calculé AVANT le early-return qui suit — les Hooks ne
  // peuvent pas être conditionnels (react-hooks/rules-of-hooks).
  const weekStrengthSession = useMemo(() => findWeekStrengthSession(planWeek), [planWeek])

  // Retour utilisateur : "les warnings pas détaillés, mais mis sur le côté
  // avec une pastille" — même consolidation que le badge de vigilance du
  // Plan (voir plan-attention-types.ts/PlanAttentionBadge, training-plan-
  // tab.tsx) : draft.verdict/recommendation/warnings ont exactement la
  // forme AttentionSource attendue (contrat de sortie coach partagé, voir
  // outputContract.ts) — un seul aplatissement réutilisé tel quel plutôt
  // qu'une deuxième logique de consolidation pour cette carte. `null` pour
  // loadProgression (concept propre au Plan, sans équivalent ici).
  const attentionItems = useMemo(
    () => (draft ? buildPlanAttentionItems({ verdict: draft.verdict, recommendation: draft.recommendation, warnings: draft.warnings }, null) : []),
    [draft]
  )

  // Retour utilisateur, indirect — découvert en construisant l'aperçu de
  // séance prévue de la page Cyclisme : depuis la séparation Aujourd'hui/
  // Plan en deux onglets (voir CLAUDE.md "Aujourd'hui et Plan
  // redéfusionnés"), l'auto-génération de la semaine courante (voir "Plan
  // d'entraînement — vue calendrier", section "Génération automatique de
  // la semaine courante") ne se déclenchait plus que depuis l'onglet Plan
  // — un athlète qui n'ouvre que "Aujourd'hui" (l'onglet par défaut) ne
  // voyait donc jamais sa semaine composée, ni ici ni sur Cyclisme. Même
  // effet, même garde (autoGeneratedRef) que training-plan-tab.tsx —
  // dupliqué plutôt que partagé au niveau composant (chaque onglet garde
  // sa propre garde contre le double-appel), mais le mutateur lui-même
  // (generateWeekSessions) est bien partagé, voir use-generate-week-
  // sessions.ts.
  const autoGeneratedRef = useRef<number | null>(null)
  useEffect(() => {
    if (!planWeek || planWeek.sampleSessions || generatingSessionsForWeek != null) return
    if (autoGeneratedRef.current === planWeek.weekNumber) return
    autoGeneratedRef.current = planWeek.weekNumber
    generateWeekSessions(planWeek)
  }, [planWeek, generatingSessionsForWeek, generateWeekSessions])

  // Retour utilisateur : "le plan d'entrainement ne devrais t il pas etre
  // figé avec les seances par jour ?" — quand le plan a déjà daté une
  // séance de MUSCULATION pour aujourd'hui, "Proposition du jour" n'a rien
  // à générer/ajuster (ce flow est cycling-only, voir use-daily-workout.ts) :
  // on affiche directement la séance prévue avec les mêmes actions que
  // l'onglet Plan (suivi en direct / saisie rétroactive), plutôt que de
  // laisser l'athlète générer une séance vélo qui n'aurait pas de sens ce
  // jour-là.
  if (todaysPlanSessionIsStrength && todaysPlanSession) {
    return (
      <div className="space-y-6">
        {!canSendToIntervals && (
          <IntervalsOnboardingNotice message="Intervals.icu non connecté — le suivi de cette séance reste local, rien n'est envoyé sur votre calendrier." />
        )}
        <StrengthSessionCard
          session={todaysPlanSession.session}
          weekNumber={todaysPlanSession.weekNumber}
          sessionIndex={todaysPlanSession.index}
          badge={
            <Badge variant="outline" className="gap-1.5 font-normal text-xs">
              <Target className="w-3 h-3" /> Semaine {todaysPlanSession.weekNumber} du plan
            </Badge>
          }
        />
      </div>
    )
  }

  // Retour utilisateur, après usage réel du chantier "séance prévue +
  // suggestion côte à côte" ci-dessus : "avoir côte à côte la séance du
  // plan et la proposition du coach du jour est redondant... la
  // proposition du jour est un peu redondante de proposer une séance
  // alternative." Un seul état affiché à la fois plutôt que plusieurs blocs
  // simultanés (carte "Proposition du jour" toujours visible + carte
  // "séance prévue" + carte "suggestion") — voir le rendu plus bas.
  // showPlanCard : une séance du plan existe pour aujourd'hui, c'est la vue
  // par défaut tant qu'aucune alternative n'a été demandée.
  const showPlanCard = !!todaysPlanSession

  return (
    <div className="space-y-6">
      {/* Retour utilisateur : "avec le webhook on devrait pouvoir pousser
          les activités réalisée sur la carte du jour." Séance vélo
          rapprochée à une vraie activité Intervals.icu du même jour
          (todaysCompletion, use-daily-workout.ts) — l'analyse riche se
          génère déjà en tâche de fond (voir l'effet ci-dessus), ce bouton
          sert surtout à la CONSULTER (comme StrengthAnalysisTrigger côté
          muscu). */}
      {todaysActivityId && (
        <Card className="lc-card ring-2 ring-primary/50">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Séance réalisée</p>
                <p className="text-xs text-muted-foreground">
                  {todaysCompletion?.actualDurationMinutes != null
                    ? `${Math.round(todaysCompletion.actualDurationMinutes)} min sur Intervals.icu`
                    : 'Activité synchronisée depuis Intervals.icu'}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setAnalysisOpen(true)} className="gap-2">
              {autoAnalysis.isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analyse IA — prévu vs réalisé
            </Button>
          </CardContent>
        </Card>
      )}
      {todaysActivityId && (
        <RideAnalysisDialog
          activityId={todaysActivityId}
          rideLabel={todaysPlanSession?.session.title ?? draft?.title ?? 'Séance du jour'}
          open={analysisOpen}
          onOpenChange={setAnalysisOpen}
        />
      )}
      {!canSendToIntervals && (
        <IntervalsOnboardingNotice message="Intervals.icu non connecté — vous pouvez générer une proposition, mais pas l'envoyer sur votre calendrier." />
      )}

      {/* Contexte toujours visible (semaine du plan/récupération) + toggle
          Vélo/Salle — sorti de la carte "Proposition du jour" (qui
          n'existe plus comme bloc permanent, voir plus bas) pour rester
          accessible quel que soit l'état affiché en dessous. */}
      <div className="flex flex-wrap items-center gap-2">
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
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Aujourd&apos;hui</Label>
        <div className="flex gap-0.5 rounded-full bg-muted p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setWantsGym(false)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              !wantsGym ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Bike className="w-3.5 h-3.5" /> Vélo
          </button>
          <button
            type="button"
            onClick={() => setWantsGym(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              wantsGym ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Dumbbell className="w-3.5 h-3.5" /> Salle
          </button>
        </div>
      </div>

      {wantsGym ? (
        weekStrengthSession ? (
          <StrengthSessionCard
            session={weekStrengthSession.session}
            weekNumber={weekStrengthSession.weekNumber}
            sessionIndex={weekStrengthSession.index}
            badge={
              <Badge variant="outline" className="gap-1.5 font-normal text-xs">
                <Target className="w-3 h-3" /> Séance muscu de la semaine {weekStrengthSession.weekNumber}
              </Badge>
            }
            description="Basculée depuis le vélo — la séance muscu déjà prévue cette semaine par le plan, peu importe le jour où elle était datée à l'origine."
          />
        ) : (
          <EmptyState
            icon={Dumbbell}
            title="Aucune séance de musculation dans le plan"
            description={
              planWeek
                ? "La musculation n'est pas activée pour cette semaine — active-la dans l'onglet Plan pour que le coach t'en propose une."
                : "Aucun plan actif — génère un plan avec la musculation activée dans l'onglet Plan pour en profiter ici."
            }
          />
        )
      ) : isLoadingStored && !draft ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : strengthDraft ? (
        // Retour utilisateur : "proposer une seance de muscu (bien sur qui
        // viendrais s'imbriquer dans le plan)" — la séance est déjà
        // persistée dans le plan au moment où ce state se pose (voir
        // handleProposeStrength) ; StrengthSessionCard (même composant que
        // pour la séance muscu de la semaine/le court-circuit automatique)
        // gère elle-même le suivi en direct/la saisie rétroactive.
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleBackToPlan}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left w-fit"
          >
            ← Revenir à la séance prévue par le plan
          </button>
          <StrengthSessionCard
            session={strengthDraft.session}
            weekNumber={strengthDraft.weekNumber}
            sessionIndex={strengthDraft.index}
            badge={
              <Badge variant="outline" className="gap-1.5 font-normal text-xs">
                <Sparkles className="w-3 h-3" /> Séance muscu proposée par le coach
              </Badge>
            }
          />
          <Button variant="outline" size="sm" onClick={handleProposeStrength} disabled={isGeneratingStrength} className="gap-1.5">
            {isGeneratingStrength ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
            Régénérer
          </Button>
        </div>
      ) : draft ? (
        // Retour utilisateur : le résultat (suggestion générée, "Changer de
        // séance" ou "Proposer une séance alternative") remplace désormais
        // la vue plutôt que de s'ajouter à côté de la séance du plan — un
        // seul lien de retour ("← Revenir à la séance prévue par le plan")
        // couvre les deux chemins qui y mènent (shuffle ou formulaire).
        <Card className="lc-card ring-2 ring-primary/50">
          <CardHeader className="space-y-3">
            {showPlanCard && (
              <button
                type="button"
                onClick={handleBackToPlan}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left w-fit"
              >
                ← Revenir à la séance prévue par le plan
              </button>
            )}
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
              {/* Retour utilisateur : "les warnings pas détaillés, mais mis
                  sur le côté avec une pastille" — même traitement compact
                  que le badge de vigilance du Plan, posé ici dans la ligne
                  de badges plutôt qu'empilé sous forme de blocs dépliés. */}
              <PlanAttentionBadge items={attentionItems} />
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
            {/* Retour utilisateur : même repère visuel que la carte "séance
                du jour" (aperçu du plan, voir plus bas) plutôt que du texte
                seul — le graphique est désormais affiché directement, pas
                caché derrière l'accordéon "script" (qui reste plus bas pour
                l'édition texte elle-même). */}
            <WorkoutProfileChart structuredWorkout={draft.structuredWorkout} height={48} />

            {/* Retour utilisateur, capture d'écran à l'appui : "ayons un
                accordéon aussi ici pour l'explication" — rationale (2-4
                phrases) était le dernier bloc de texte toujours visible en
                haut de la carte, souvent long (surtout sur une proposition
                ajustée depuis le plan, qui cite en plus le motif de
                l'ajustement). Même patron que "Pourquoi ce plan ?" dans
                training-plan-tab.tsx. */}
            <Collapsible open={showRationale} onOpenChange={setShowRationale}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Pourquoi cette séance ?
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showRationale && 'rotate-180')} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="text-sm text-muted-foreground leading-relaxed">{draft.rationale}</p>
              </CollapsibleContent>
            </Collapsible>

            {/* Retour utilisateur : "j'enlèverais le côté météo que
                j'aimerais simplement garder ad hoc" — le bulletin météo
                (température/vent/conditions) et le conseil de direction
                (windAdvice) ne s'affichent plus comme un bloc structuré ;
                lieu/heure de départ (formulaire "Proposer une séance
                alternative" plus bas) restent des champs ad hoc simples,
                sans mise en avant dédiée. weatherAlert reste affiché : ce
                n'est pas une donnée météo à consulter mais un avertissement
                de sécurité (séance déjà adaptée en home trainer par le
                flow si le temps est trop dégradé). */}
            {draft.weatherAlert && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-sm">
                <CloudRain className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>{draft.weatherAlert}</span>
              </div>
            )}

            {/* draft.warnings est désormais consolidé dans le badge de
                vigilance du header (attentionItems/PlanAttentionBadge) au
                lieu d'un bloc par warning ici — voir le commentaire sur
                attentionItems plus haut. */}

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

            {/* Verdict/recommendation — champs du contrat de sortie coach
                (withCoachOutputContract, ai/coach/outputContract.ts) — sont
                désormais aussi consolidés dans le badge de vigilance du
                header via attentionItems (même traitement que warnings[]
                ci-dessus), plutôt qu'un bandeau séparé ici. "reasons"/
                "uncertainty" (le détail du raisonnement, pas un verdict à
                signaler) restent dans leur propre accordéon juste en
                dessous — verdict est ce qui pilote le blocage d'envoi
                (draft.verdict === 'block', voir le bouton plus bas), le
                reste ("reasons") n'est que contextuel. */}

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
                  <FileText className="w-3.5 h-3.5" /> {showScript ? 'Masquer' : 'Modifier'} le script de la séance
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
              <p className="text-xs text-destructive text-right">Envoi bloqué — voir le point de vigilance en haut de la carte avant de continuer.</p>
            )}
          </CardContent>
        </Card>
      ) : showPlanCard && todaysPlanSession && !showAlternativeForm ? (
        // Retour utilisateur : "on aurait... la séance du jour proposée
        // sur le plan" — la séance déjà datée par le plan s'affiche
        // directement (title/durée/intensité/motif, aucun appel IA
        // nécessaire juste pour la voir), profil graphique
        // (WorkoutProfileChart, même composant que le calendrier du plan).
        // "Envoyer sur Intervals.icu" envoie la séance telle quelle
        // directement (sendPlanSessionDirectly, sans aller-retour IA).
        // "Changer de séance"/"Proposer une séance alternative" vivent ici
        // (plus sur une carte "suggestion" séparée, supprimée — retour
        // utilisateur : "avoir côte à côte la séance du plan et la
        // proposition du coach du jour est redondant"). "Proposer une
        // séance de muscu" réintégré ici (retour utilisateur :
        // "reintegrer la possibilité de... proposer une seance de
        // muscu"). "Ajuster la séance"/"Changer de séance" — deux
        // boutons distincts brièvement réintroduits puis retirés (retour
        // utilisateur : "un peu redondants... laisse seulement proposer
        // une séance alternative, avec le petit logo de changer de
        // séance") : le formulaire "Proposer une séance alternative"
        // couvrait déjà les deux usages (generate() attache plannedSession
        // par défaut — soumettre le formulaire sans rien changer EST
        // "ajuster la séance") — un seul bouton, portant l'icône Shuffle.
        <Card className="lc-card ring-2 ring-primary/50">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1.5 font-normal text-xs">
                <Target className="w-3 h-3" /> Semaine {todaysPlanSession.weekNumber} du plan
              </Badge>
              <Badge variant="secondary">{todaysPlanSession.session.intensityLabel}</Badge>
            </div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bike className="w-4 h-4 text-primary" /> {todaysPlanSession.session.title}
            </CardTitle>
            <CardDescription>{todaysPlanSession.session.rationale}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WorkoutProfileChart structuredWorkout={todaysPlanSession.session.structuredWorkout} height={48} />
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {todaysPlanSession.session.durationMinutes} min
            </p>
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
              <Button
                onClick={handleSendPlanSession}
                disabled={isSendingPlanSession || !canSendToIntervals}
                className="gap-2"
                title={canSendToIntervals ? undefined : 'Renseignez vos identifiants Intervals.icu dans Réglages'}
              >
                {isSendingPlanSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {planSessionSent ? 'Ré-envoyer sur Intervals.icu' : 'Envoyer sur Intervals.icu'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAlternativeForm(true)} className="gap-1.5">
                <Shuffle className="w-3.5 h-3.5" />
                Proposer une séance alternative
              </Button>
              <Button variant="outline" size="sm" onClick={handleProposeStrength} disabled={isGeneratingStrength} className="gap-1.5">
                {isGeneratingStrength ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Dumbbell className="w-3.5 h-3.5" />}
                Proposer une séance de muscu
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Retour utilisateur : "la proposition du jour est un peu
        // redondante de proposer une séance alternative qui pourrait en
        // fait nous emmener à rentrer les détails de proposition du jour"
        // — ce formulaire (anciennement une carte "Proposition du jour"
        // toujours visible à côté du résultat) n'apparaît plus QUE dans
        // deux cas : aucune séance de plan aujourd'hui (vue par défaut,
        // comme avant), ou après un tap explicite sur "Proposer une séance
        // alternative" — jamais les deux vues en même temps.
        <Card className="lc-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> {showPlanCard ? 'Proposer une séance alternative' : 'Proposition du jour'}
            </CardTitle>
            <CardDescription>
              Indiquez le temps dont vous disposez — l&apos;IA propose une séance adaptée à votre forme actuelle
              (charge interne, TSB, blessures, objectifs), que vous pouvez ajuster avant de l&apos;envoyer sur Intervals.icu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            {showPlanCard && (
              <button
                type="button"
                onClick={handleBackToPlan}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-left -mb-2"
              >
                ← Revenir à la séance prévue par le plan
              </button>
            )}
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
            {/* Retour utilisateur : "j'enlèverais le côté météo... que
                j'aimerais simplement garder ad hoc" — lieu/heure restent de
                simples champs optionnels (l'IA continue de récupérer la
                météo réelle en interne quand ils sont renseignés, pour le
                conseil de direction et l'adaptation home trainer si besoin),
                mais sans plus expliquer/mettre en avant ce mécanisme ici. */}
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
              Proposer une séance
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
