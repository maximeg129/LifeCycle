// ── Constantes — trois catégories distinguées par le type ──────────────────
//
// sourced    : valeur réelle + Rxx qui la justifie.
// convention : valeur produit + justification (jamais une découverte
//              scientifique déguisée en constante — voir principle-9 dans
//              rules.ts, "toute constante affichée doit être traçable").
// pending    : PAS de valeur. `requireConstant()` lève une erreur explicite
//              nommant la source à consulter dès qu'un calcul en amont
//              essaie de la lire — jamais une valeur par défaut silencieuse.
//              "Je les remplirai moi-même depuis les papiers. Ne les invente
//              sous aucun prétexte, même approximativement, même en
//              commentaire « à vérifier »." — donc aucune des trois
//              constantes pending ci-dessous ne porte de valeur numérique,
//              pas même un exemple ou un ordre de grandeur.

import type { REFERENCES } from './references'

export type ConstantStatus = 'sourced' | 'convention' | 'pending'

export interface SourcedConstant<T> {
  status: 'sourced'
  value: T
  refs: Array<keyof typeof REFERENCES>
  note?: string
}

export interface ConventionConstant<T> {
  status: 'convention'
  value: T
  justification: string
}

export interface PendingConstant {
  status: 'pending'
  /** Où aller chercher la vraie valeur — jamais un TODO vague. */
  sourceToConsult: string
}

export type Constant<T> = SourcedConstant<T> | ConventionConstant<T> | PendingConstant

/**
 * Seul point d'accès à la valeur d'une constante. Lève une erreur explicite
 * — nommant la source à consulter — si la constante est encore `pending`,
 * plutôt que de laisser un appelant lire silencieusement `undefined` ou
 * inventer un repli. `name` sert uniquement au message d'erreur (le nom
 * lisible de la constante, pas sa clé dans CONSTANTS).
 */
export function requireConstant<T>(constant: Constant<T>, name: string): T {
  if (constant.status === 'pending') {
    throw new Error(
      `Constante "${name}" non disponible (pending) : à extraire de ${constant.sourceToConsult} avant tout calcul. ` +
        `Aucune valeur par défaut ne doit être utilisée à sa place — voir constants.ts.`
    )
  }
  return constant.value
}

// ── Fitness/Fatigue/Forme — fenêtres du modèle impulsion-réponse ──────────

export const IMPULSE_RESPONSE_WINDOWS: ConventionConstant<{ ctlDays: number; atlDays: number }> = {
  status: 'convention',
  value: { ctlDays: 42, atlDays: 7 },
  justification:
    "Fenêtres CTL/ATL du secteur (TrainingPeaks/Coggan, reprises par Intervals.icu) — pas une calibration individuelle validée. " +
    "R03 établit que la valeur d'un paramètre k de ce modèle n'a pas de signification univoque ni comparable d'un modèle à l'autre ; " +
    "à afficher comme une convention, jamais comme une mesure.",
}

// ── Gouverneur — fenêtre de baseline HRV/sommeil/bien-être ────────────────

export const GOVERNOR_BASELINE_WINDOW: ConventionConstant<{ recentDays: number; baselineDays: number }> = {
  status: 'convention',
  value: { recentDays: 7, baselineDays: 28 },
  justification:
    "Le principe 2 de la spécification demande une baseline « établie sur ≥ 4 semaines » ; aucun Rxx ne fixe un chiffre exact " +
    "au-delà de ce plancher, donc 28 jours (le plancher lui-même) est retenu plutôt qu'un nombre plus grand non justifié. " +
    "Décision utilisateur du 31 août 2026 (docs/OPEN_QUESTIONS.md, Q3) — remplace les 21 jours utilisés par l'ancien gouverneur.",
}

// ── Budget kJ — seuils de durabilité par palier de travail accumulé ───────

export interface KjDurabilityThresholds {
  /** R11 — première baisse mesurable du profil de puissance, mesurée aux deux sexes. */
  firstMeasurableDeclineKJPerKg: number
  /** R08 — dégradation nette chez le professionnel (CLM 20min, à froid vs après ~4h submaximales). */
  proDegradationKJPerKg: number
  /** R11 — au-delà de ce palier, la décroissance relative s'écarte entre sexes (4/4/2 % sur 1/5/20min chez les femmes). */
  womenDivergenceStartKJPerKg: number
  /** R11 — l'écart s'amplifie au-delà de ce palier (8/6/7 % sur 1/5/20min chez les femmes). */
  womenDivergenceAmplifiesKJPerKg: number
  /** R10 — U23, efforts ≤ 12min : baisses significatives de MMP dès ce total. */
  u23ShortEffortsThresholdKJ: number
  /** R10 — U23, autres durées : plage où les baisses deviennent significatives. */
  u23OtherDurationsRangeKJ: [number, number]
  /** R10 — professionnels, efforts 5 et 12min : baisses significatives dès ce total. */
  proShortEffortsThresholdKJ: number
  /** R10 — professionnels, autres durées : plage où les baisses deviennent significatives. */
  proOtherDurationsRangeKJ: [number, number]
}

export const KJ_DURABILITY_THRESHOLDS: SourcedConstant<KjDurabilityThresholds> = {
  status: 'sourced',
  refs: ['R08', 'R10', 'R11'],
  value: {
    firstMeasurableDeclineKJPerKg: 10,
    proDegradationKJPerKg: 40,
    womenDivergenceStartKJPerKg: 20,
    womenDivergenceAmplifiesKJPerKg: 30,
    u23ShortEffortsThresholdKJ: 1000,
    u23OtherDurationsRangeKJ: [1500, 2500],
    proShortEffortsThresholdKJ: 1000,
    proOtherDurationsRangeKJ: [2000, 3000],
  },
  note:
    "Ce sont des plafonds de référence, pas des cibles (principle 'kj-budget-thresholds-are-ceilings-not-targets' — un athlète " +
    'non professionnel se dégrade plus tôt que ces seuils).',
}

// ── Constantes PENDING — à extraire des sources primaires avant codage ────
// Annexe B de docs/01_Base_Scientifique_Cyclisme.md. Trois constantes,
// obligatoires au démarrage de la Phase 2 (endurance.ts / criticalPower.ts /
// metabolism.ts en dépendent directement — chacune lèvera via
// requireConstant() tant que la valeur réelle n'est pas fournie ici).

/**
 * Coefficients de l'équation Ten-Haaf (métabolisme de base), versions masse
 * corporelle ET masse maigre. R33 : "Les coefficients exacts... doivent être
 * repris dans le tableau du papier avant codage — ne pas les reconstituer
 * de mémoire."
 */
export const TEN_HAAF_COEFFICIENTS: PendingConstant = {
  status: 'pending',
  sourceToConsult:
    'R33 — ten Haaf T, Weijs PJM (2014), "Resting energy expenditure prediction in recreational athletes of 18–35 years", ' +
    'PLoS ONE 9(10):e108460 — tableau des coefficients, version masse corporelle ET version masse maigre.',
}

/**
 * Constante de temps de reconstitution du W′ au-dessus de la puissance
 * critique. R15 : équation à reprendre dans Skiba et al. (2012) — le
 * document ne donne qu'un ordre de grandeur illustratif (τ≈377s pour une
 * récupération à 20W dans une condition précise), pas la formule générale
 * à coder.
 */
export const W_PRIME_RECONSTITUTION_CONSTANT: PendingConstant = {
  status: 'pending',
  sourceToConsult:
    'R15 — Skiba PF, Chidnok W, Vanhatalo A, Jones AM (2012), "Modeling the expenditure and reconstitution of work capacity ' +
    'above critical power", MSSE 44(8):1526–1532, doi:10.1249/MSS.0b013e3182517a80 — équation de reconstitution (constante de ' +
    "temps τ en fonction de l'écart CP − puissance de récupération).",
}

/**
 * Exposant de fatigue Riegel spécifiquement calibré pour le cyclisme par
 * Riegel lui-même — distinct de l'exposant historique de la course à pied
 * (voir la règle forbidden-1-06-running-exponent-in-cycling dans rules.ts,
 * et le garde-fou CI qui bannit ce littéral du domaine cyclisme — ce
 * commentaire l'évite donc lui aussi, délibérément). L'app calibre déjà un
 * exposant individuel par athlète (endurance.ts, héritier de
 * riegel-types.ts) — cette constante ne sert que de repli théorique
 * documenté quand aucune calibration individuelle n'est possible (moins de
 * 2 records personnels), jamais de valeur utilisée par défaut tant qu'elle
 * n'est pas remplie.
 */
export const RIEGEL_CYCLING_FATIGUE_EXPONENT: PendingConstant = {
  status: 'pending',
  sourceToConsult:
    'R12 — Riegel PS (1981), "Athletic records and human endurance", American Scientist 69(3):285–290 — Riegel y donne des ' +
    "facteurs de fatigue distincts pour le cyclisme (et par groupe d'âge/sexe) ; à extraire du texte original, jamais l'exposant historique de la course à pied.",
}
