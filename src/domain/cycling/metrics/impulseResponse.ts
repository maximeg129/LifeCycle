// ── Modèle impulsion-réponse — Fitness/Fatigue/Forme (R01-R03) ────────────
//
// Banister et al. (1975, R01) : modèle systémique complet à 2 exponentielles,
// P(t) = P₀ + k₁·e^(−t/τ₁) − k₂·e^(−t/τ₂), avec k₁/k₂/τ₁/τ₂ ajustés
// individuellement par athlète via régression sur des données de
// performance réelles — jamais fait ici, ni dans la quasi-totalité de
// l'industrie du cyclisme grand public (Clarke & Skiba 2013, R02, présente
// le modèle IR à côté du modèle de puissance critique comme complémentaires,
// sans trancher entre les variantes).
//
// Ce module implémente la forme **simplifiée** réellement utilisée par
// TrainingPeaks/Coggan/Intervals.icu (déjà la source des CTL/ATL/TSB
// affichés aujourd'hui, voir plus bas) : k₁=k₂=1, moyenne mobile
// exponentielle (EWMA) à fenêtres fixes plutôt qu'une convolution à
// paramètres individuellement ajustés. R03 établit explicitement que les
// différentes formes à 1/2/3 paramètres k ne sont PAS comparables entre
// elles — c'est pour ça que IMPULSE_RESPONSE_WINDOWS (evidence/constants.ts,
// PR 1) est déjà étiquetée `convention`, jamais une calibration sourcée.
// Ce fichier implémente cette même convention (fitness-fatigue-windows-are-
// convention, fitness-fatigue-show-trajectory-not-absolute dans
// evidence/rules.ts), explicitement, une seule fois, plutôt que de la
// laisser implicite dans un composant d'affichage.
//
// Le modèle est volontairement agnostique à l'unité de la charge
// journalière (kJ/kg, session-RPE, TSS...) — ce n'est pas son rôle de
// décider quelle métrique de charge l'alimente.
//
// Aujourd'hui, l'UI affiche encore le CTL/ATL/TSB renvoyés directement par
// Intervals.icu (icu_ctl/icu_atl, src/lib/intervals-api.ts) — ce module ne
// remplace pas cette source (même posture que durability.ts/kj.ts : module
// domaine pur, pas encore branché). Son intérêt immédiat : projeter une
// trajectoire future sous une charge hypothétique (utile à
// trainingPlanGeneration pour simuler l'effet d'un plan avant qu'il ne
// soit exécuté), une capacité qu'une API qui ne renvoie que de l'historique
// réel ne peut pas offrir.

import { IMPULSE_RESPONSE_WINDOWS, requireConstant } from '../evidence/constants'

export interface FitnessFatigueState {
  ctl: number
  atl: number
}

export interface FitnessFatiguePoint extends FitnessFatigueState {
  tsb: number
}

/**
 * Un pas du modèle EWMA : nouveau_CTL = CTL_veille + (charge_du_jour −
 * CTL_veille) / fenêtre_ctl (même formule pour ATL, avec sa propre
 * fenêtre, plus courte). Un jour sans charge doit être passé comme `0`,
 * jamais omis — c'est la décroissance des jours de repos qui fait
 * fonctionner le modèle.
 */
export function stepFitnessFatigue(previous: FitnessFatigueState, dailyLoad: number): FitnessFatigueState {
  const w = requireConstant(IMPULSE_RESPONSE_WINDOWS, 'IMPULSE_RESPONSE_WINDOWS')
  return {
    ctl: previous.ctl + (dailyLoad - previous.ctl) / w.ctlDays,
    atl: previous.atl + (dailyLoad - previous.atl) / w.atlDays,
  }
}

/**
 * Déroule la série complète jour par jour à partir d'un état initial
 * (`{ctl:0, atl:0}` par défaut, pour un historique qui démarre de zéro).
 * `dailyLoads` : un élément par jour, en ordre chronologique.
 */
export function computeFitnessFatigueSeries(
  dailyLoads: number[],
  initial: FitnessFatigueState = { ctl: 0, atl: 0 }
): FitnessFatiguePoint[] {
  const points: FitnessFatiguePoint[] = []
  let state = initial
  for (const load of dailyLoads) {
    state = stepFitnessFatigue(state, load)
    points.push({ ...state, tsb: state.ctl - state.atl })
  }
  return points
}

/**
 * Projette la trajectoire future à partir d'un état réel connu (par
 * exemple le dernier point CTL/ATL renvoyé par Intervals.icu) sous une
 * charge journalière hypothétique — pour simuler l'effet d'un plan avant
 * qu'il ne soit exécuté, jamais pour se substituer à une lecture réelle
 * passée.
 */
export function projectFitnessFatigue(current: FitnessFatigueState, futureDailyLoads: number[]): FitnessFatiguePoint[] {
  return computeFitnessFatigueSeries(futureDailyLoads, current)
}
