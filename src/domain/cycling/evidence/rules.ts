// ── Règles opérationnelles du coach — chaque règle porte sa justification ──
//
// Transcription des sections 1, 3, 4, 5, 6, 7 et 8 de
// docs/02_Specification_Coach_LifeHub.md. Une règle sans référence
// scientifique valide est une convention produit, jamais une donnée
// scientifique déguisée — voir rules.test.ts pour le garde-fou qui
// vérifie ça mécaniquement (aucune CoachRule ne doit avoir `refs: []`
// sans `convention: true`).
//
// `scope` distingue où la règle s'applique dans le pipeline coach :
// - interpretation      : comment lire/afficher un indicateur (section 3)
// - plan-validation      : les 9 contrôles avant de valider un plan (section 4)
// - session-arbitration  : la décision readiness → séance du jour (section 5)
// - ride-analysis        : le pipeline de lecture d'une sortie (section 6)
// - red-flag             : signaux qui font abandonner l'optimisation (section 7)
// - forbidden-claim      : affirmations interdites (section 8)

import { REFERENCES } from './references'

export interface CoachRule {
  id: string
  scope: 'interpretation' | 'plan-validation' | 'session-arbitration' | 'ride-analysis' | 'red-flag' | 'forbidden-claim'
  statement: string
  refs: Array<keyof typeof REFERENCES> // non vide, sauf si convention: true
  convention?: true
}

export const RULES: CoachRule[] = [
  // ── Section 1 — dix principes non négociables ────────────────────────
  {
    id: 'principle-1-external-vs-internal-load',
    scope: 'interpretation',
    statement:
      "Charge externe ≠ charge interne. Toute décision d'ajustement se prend sur la charge interne (réponse), pas sur la charge externe (travail prescrit).",
    refs: ['R05'],
  },
  {
    id: 'principle-2-no-isolated-value',
    scope: 'interpretation',
    statement:
      "Jamais de décision sur une valeur isolée. HRV, sommeil et bien-être s'interprètent en moyenne glissante 7 jours rapportée à une ligne de base individuelle établie sur ≥ 4 semaines.",
    refs: ['R25'],
  },
  {
    id: 'principle-3-hrv-sign-ambiguous',
    scope: 'interpretation',
    statement:
      "Le signe d'une variation de HRV est ambigu. Chez un athlète entraîné, une hausse comme une baisse peuvent signaler une adaptation négative. Le HRV ne décide jamais seul.",
    refs: ['R25'],
  },
  {
    id: 'principle-4-subjective-not-secondary',
    scope: 'interpretation',
    statement:
      "Le subjectif n'est pas le parent pauvre. Le bien-être auto-rapporté suit la charge avec une sensibilité supérieure aux marqueurs objectifs, et les deux ne corrèlent généralement pas.",
    refs: ['R31'],
  },
  {
    id: 'principle-5-kj-weighted-by-intensity',
    scope: 'interpretation',
    statement: 'Le kJ se pondère par l\'intensité. Un budget en kJ bruts est structurellement trop permissif.',
    refs: ['R09', 'R10'],
  },
  {
    id: 'principle-6-no-sleep-stages',
    scope: 'interpretation',
    statement:
      "Les stades de sommeil des wearables ne sont pas exploitables. Durée, régularité et heure de coucher : oui. REM/deep : non.",
    refs: ['R30'],
  },
  {
    id: 'principle-7-no-automatic-acwr',
    scope: 'interpretation',
    statement: "Pas d'ACWR comme règle de décision automatique. Le ratio est mathématiquement vicié.",
    refs: ['R22'],
  },
  {
    id: 'principle-8-tss-not-performance-prediction',
    scope: 'interpretation',
    statement: "Le TSS n'est pas une prédiction de performance. Chez des professionnels, les relations dose–performance sont faibles.",
    refs: ['R17'],
  },
  {
    id: 'principle-9-traceable-constants',
    scope: 'interpretation',
    statement: "Toute constante affichée doit être traçable à une source primaire ou étiquetée [convention].",
    refs: ['R03'],
  },
  {
    id: 'principle-10-alert-overrides-performance',
    scope: 'interpretation',
    statement:
      "Le seuil d'alerte prime sur l'objectif de performance. Si un signal REDs, OTS ou sommeil chronique se déclenche, on abandonne l'optimisation et on oriente.",
    refs: ['R23', 'R35'],
  },

  // ── Section 3.1 — Fitness/Fatigue/Forme ──────────────────────────────
  {
    id: 'fitness-fatigue-windows-are-convention',
    scope: 'interpretation',
    statement:
      "Les constantes 42j/7j du modèle impulsion-réponse sont une convention de secteur, pas une calibration individuelle — à afficher comme telle.",
    refs: ['R03'],
  },
  {
    id: 'fitness-fatigue-show-trajectory-not-absolute',
    scope: 'interpretation',
    statement: "Afficher la trajectoire du CTL/ATL/TSB, pas le nombre absolu — un CTL de X n'a pas de signification comparable entre modèles.",
    refs: ['R03'],
  },
  {
    id: 'fitness-fatigue-cross-with-wellbeing',
    scope: 'interpretation',
    statement: "La courbe de forme se lit avec le bien-être subjectif superposé — une divergence entre les deux est un signal, pas du bruit.",
    refs: ['R31'],
  },

  // ── Section 3.2 — Budget kJ hebdomadaire ─────────────────────────────
  {
    id: 'kj-budget-unit-is-kj-per-kg-weighted',
    scope: 'interpretation',
    statement: "Unité du budget : kJ/kg, jamais kJ bruts, pondérée par l'intensité.",
    refs: ['R09', 'R10'],
  },
  {
    id: 'kj-budget-thresholds-are-ceilings-not-targets',
    scope: 'interpretation',
    statement:
      "Les repères de durabilité (10/20/30/40 kJ/kg) sont des plafonds de référence — un athlète non professionnel se dégrade plus tôt, ne pas les traiter comme des cibles.",
    refs: ['R08', 'R10', 'R11'],
  },
  {
    id: 'kj-budget-increasing-coefficient-above-cp',
    scope: 'interpretation',
    statement:
      "Le travail réalisé au-dessus de la puissance critique produit une dégradation supérieure pour un kJ accumulé inférieur — appliquer un coefficient croissant par zone.",
    refs: ['R10'],
  },
  {
    id: 'kj-budget-durability-not-from-lab-tests',
    scope: 'interpretation',
    statement:
      "La durabilité ne se déduit pas des tests labo (VT, PMA, VO₂max) — elle doit être mesurée séparément sur le terrain.",
    refs: ['R08'],
  },

  // ── Section 3.3 — Indice d'endurance (Riegel) ────────────────────────
  {
    id: 'riegel-never-running-exponent',
    scope: 'interpretation',
    statement:
      "Ne jamais appliquer l'exposant de fatigue de la course à pied à des données cyclisme — Riegel a ajusté des facteurs distincts par sport.",
    refs: ['R12'],
  },
  {
    id: 'riegel-calibrate-individual-exponent',
    scope: 'interpretation',
    statement:
      "Calibrer un exposant individuel sur les performances réelles de l'athlète — un modèle basé sur 1-2 performances antérieures divise l'erreur par deux par rapport à une constante universelle.",
    refs: ['R13'],
  },
  {
    id: 'riegel-validity-domain',
    scope: 'interpretation',
    statement: "Domaine de validité du fit Riegel : environ 3,5 à 230 minutes ; avertir hors de cette plage.",
    refs: ['R12'],
  },
  {
    id: 'riegel-prefer-critical-power-side-cycling',
    scope: 'interpretation',
    statement: 'Alternative à privilégier côté vélo : le modèle CP/W′, physiologiquement fondé plutôt que par ajustement statistique.',
    refs: ['R14'],
  },

  // ── Section 3.4 — Puissance normalisée et zones ──────────────────────
  {
    id: 'power-np-if-tss-label-proprietary',
    scope: 'interpretation',
    statement: "Étiqueter NP/IF/TSS comme métriques propriétaires non validées par les pairs, jamais comme un standard scientifique.",
    refs: ['R16'],
  },
  {
    id: 'power-zones-3-zone-distribution-required',
    scope: 'interpretation',
    statement: "Modèle 3 zones obligatoire pour la distribution d'intensité, en plus du modèle 5-7 zones de prescription.",
    refs: ['R18'],
  },
  {
    id: 'power-zones-5-7-zone-prescription-convention',
    scope: 'interpretation',
    statement: "Le modèle 5-7 zones (Coggan) sert à la prescription de séance — convention practicien issue du même algorithme que NP/TSS, pas elle-même validée séparément.",
    refs: [],
    convention: true,
  },
  {
    id: 'power-distribution-target-descriptive-not-prescriptive',
    scope: 'interpretation',
    statement:
      "La cible ~80% basse intensité est une observation descriptive d'athlètes s'entraînant 10-13 fois/semaine, pas une prescription universelle.",
    refs: ['R18'],
  },
  {
    id: 'power-interval-session-calibration',
    scope: 'interpretation',
    statement:
      "Calibrer les séances d'intervalles sur des protocoles plus volumineux, plus contrôlés et moins épuisants que ceux des études d'intervention.",
    refs: ['R19'],
  },

  // ── Section 3.5 — Gouverneur de charge interne ───────────────────────
  {
    id: 'governor-inputs-session-rpe-monotony-strain',
    scope: 'interpretation',
    statement: "Entrées du gouverneur : session-RPE, monotonie (moyenne/écart-type sur 7j), strain (charge×monotonie).",
    refs: ['R21'],
  },
  {
    id: 'governor-forbid-acwr-trigger',
    scope: 'interpretation',
    statement: 'ACWR interdit comme déclencheur automatique du gouverneur.',
    refs: ['R22'],
  },
  {
    id: 'governor-output-never-opaque',
    scope: 'interpretation',
    statement: "Sortie du gouverneur : feu vert/ambre/rouge accompagné du motif et de la métrique déclenchante — jamais un score opaque.",
    refs: [],
    convention: true,
  },

  // ── Section 3.6 — Readiness et sommeil ───────────────────────────────
  {
    id: 'readiness-composition-explicit-weighting',
    scope: 'interpretation',
    statement:
      "Composition du score readiness : HRV (Ln rMSSD, 7j vs SWC), durée/régularité de sommeil, bien-être subjectif — pondération explicite et visible/modifiable par l'utilisateur.",
    refs: ['R25', 'R28', 'R31'],
  },
  {
    id: 'readiness-exclude-sleep-stages',
    scope: 'interpretation',
    statement: 'Exclure les stades de sommeil du score readiness.',
    refs: ['R30'],
  },
  {
    id: 'readiness-no-universal-sleep-target',
    scope: 'interpretation',
    statement: "Pas de cible universelle 7-9h de sommeil — calibrer sur le besoin perçu de l'athlète.",
    refs: ['R28'],
  },
  {
    id: 'readiness-sleep-restriction-correction',
    scope: 'interpretation',
    statement:
      "Après restriction de sommeil, la performance se dégrade sans que le RPE ne change — le gouverneur doit corriger la charge même si l'athlète se déclare frais.",
    refs: ['R29'],
  },
  {
    id: 'readiness-hrv-coaching-honesty',
    scope: 'interpretation',
    statement:
      "Le pilotage par HRV améliore surtout les indices vagaux ; l'effet sur la performance est modeste et non significatif entre groupes — ne jamais promettre un gain de performance.",
    refs: ['R26', 'R27'],
  },

  // ── Section 3.7 — Métabolisme de base et nutrition ───────────────────
  {
    id: 'nutrition-bmr-ten-haaf-default',
    scope: 'interpretation',
    statement: "Équation de métabolisme de base par défaut : Ten-Haaf (80,2% des athlètes prédits à ±10%, hétérogénéité nulle).",
    refs: ['R32', 'R33'],
  },
  {
    id: 'nutrition-harris-benedict-underestimates',
    scope: 'interpretation',
    statement:
      "Avertir : Harris-Benedict sous-estime fortement chez l'athlète à haut volume (jusqu'à ~500 kcal/j de MB, >1000 kcal/j sur les besoins totaux à PAL 2+).",
    refs: ['R32'],
  },
  {
    id: 'nutrition-carb-intake-guidance',
    scope: 'interpretation',
    statement: "Glucides à l'effort : jusqu'à 120 g·h⁻¹, ratios glucose:fructose ~1:0,8, introduction progressive (tolérance digestive).",
    refs: ['R34'],
  },
  {
    id: 'nutrition-reds-framework-when-crossing-budget-intake',
    scope: 'interpretation',
    statement:
      "Dès que budget kJ et apports sont tous deux suivis, appliquer le cadre REDs — LEA sur un continuum adaptable → problématique.",
    refs: ['R35'],
  },

  // ── Section 4 — checklist de validation d'un plan (9 contrôles) ──────
  {
    id: 'plan-check-1-intensity-distribution',
    scope: 'plan-validation',
    statement: "Distribution d'intensité : ~80% des séances en basse intensité ; écart > 15 points → WARN.",
    refs: ['R18'],
  },
  {
    id: 'plan-check-2-kj-budget-weighted',
    scope: 'plan-validation',
    statement: 'Budget kJ/kg pondéré : dépasse le plafond hebdomadaire calibré → WARN ; dépasse de >20% → BLOCK.',
    refs: ['R09', 'R10'],
  },
  {
    id: 'plan-check-3-accumulated-load-before-key-session',
    scope: 'plan-validation',
    statement: 'Charge accumulée avant séance clé : séance de qualité après >20 kJ/kg le jour-même ou la veille → WARN.',
    refs: ['R08', 'R11'],
  },
  {
    id: 'plan-check-4-monotony',
    scope: 'plan-validation',
    statement: 'Monotonie élevée sur 7 jours glissants → WARN (risque de strain).',
    refs: ['R21'],
  },
  {
    id: 'plan-check-5-interval-volume',
    scope: 'plan-validation',
    statement: "Volume d'intervalles par séance plus épuisant que les modèles d'entraîneurs de haut niveau → WARN.",
    refs: ['R19'],
  },
  {
    id: 'plan-check-6-planned-sleep',
    scope: 'plan-validation',
    statement: 'Nuits < besoin perçu prévues avant une séance clé → WARN.',
    refs: ['R28', 'R29'],
  },
  {
    id: 'plan-check-7-energy-availability',
    scope: 'plan-validation',
    statement: 'Apports planifiés incompatibles avec la dépense estimée → WARN, puis BLOCK si persistant > 2 semaines.',
    refs: ['R35'],
  },
  {
    id: 'plan-check-8-load-progression',
    scope: 'plan-validation',
    statement: 'Hausse de charge chronique sans semaine de décharge sur 4 semaines → WARN.',
    refs: ['R23'],
  },
  {
    id: 'plan-check-9-traceability',
    scope: 'plan-validation',
    statement: "Traçabilité : toute constante utilisée dans le plan doit être sourcée ou étiquetée convention.",
    refs: [],
    convention: true,
  },

  // ── Section 5 — arbitrage readiness → séance du jour (5 cas) ─────────
  {
    id: 'arbitration-nominal-case',
    scope: 'session-arbitration',
    statement: 'HRV dans/au-dessus de la ligne de base, bien-être normal, sommeil conforme → séance prévue, y compris haute intensité.',
    refs: [],
    convention: true,
  },
  {
    id: 'arbitration-wellbeing-overrides',
    scope: 'session-arbitration',
    statement: 'HRV dans/au-dessus de la ligne de base mais bien-être dégradé, sommeil conforme → basse intensité, le subjectif l\'emporte.',
    refs: ['R31'],
  },
  {
    id: 'arbitration-low-hrv-reassess-48h',
    scope: 'session-arbitration',
    statement: 'HRV sous la limite basse, bien-être normal, sommeil conforme → basse intensité, réévaluation à 48h.',
    refs: ['R25'],
  },
  {
    id: 'arbitration-sleep-restriction-overrides-feeling-fresh',
    scope: 'session-arbitration',
    statement:
      'Restriction de sommeil ≥ 2 nuits → basse intensité même si l\'athlète se déclare frais, quel que soit le reste des signaux.',
    refs: ['R29'],
  },
  {
    id: 'arbitration-persistent-degradation-orients',
    scope: 'session-arbitration',
    statement: 'HRV sous la limite basse ET bien-être dégradé ET sommeil dégradé → repos ; si persistance > 7 jours → orientation.',
    refs: ['R23'],
  },

  // ── Section 6 — pipeline de lecture d'une sortie (7 étapes) ──────────
  {
    id: 'ride-analysis-1-execution-vs-prescription',
    scope: 'ride-analysis',
    statement: "Comparer l'exécution à la prescription par écart de temps en zones, pas seulement par TSS.",
    refs: [],
    convention: true,
  },
  {
    id: 'ride-analysis-2-power-profile-by-accumulated-tier',
    scope: 'ride-analysis',
    statement:
      "Extraire le profil de puissance (MMP 10s/1/5/12/20/40min) aux paliers 0/10/20/30/40 kJ/kg et le comparer à l'historique de l'athlète au MÊME palier — seule lecture valide de la durabilité.",
    refs: ['R07', 'R08', 'R10'],
  },
  {
    id: 'ride-analysis-3-decoupling-context',
    scope: 'ride-analysis',
    statement:
      "Ratio ΔFC/Δpuissance sur segments comparables — contextualiser : la dérive cardiaque n'est pas toujours un signe de fatigue (hypovolémie, chaleur).",
    refs: ['R06'],
  },
  {
    id: 'ride-analysis-4-w-prime-balance',
    scope: 'ride-analysis',
    statement:
      "Reconstruire le W′ balance sur la sortie avec la constante de temps de reconstitution issue de Skiba 2012, surtout utile sur les sorties à efforts répétés.",
    refs: ['R15'],
  },
  {
    id: 'ride-analysis-5-session-rpe-vs-external-load',
    scope: 'ride-analysis',
    statement: "Comparer la session-RPE à la charge externe — un écart persistant RPE↑/puissance↓ est un signal de charge interne.",
    refs: ['R05', 'R21'],
  },
  {
    id: 'ride-analysis-6-weight-by-above-cp-intensity',
    scope: 'ride-analysis',
    statement: "Pondérer l'analyse par la part du travail réalisé au-dessus de la puissance critique, pas seulement le total kJ.",
    refs: ['R09'],
  },
  {
    id: 'ride-analysis-7-one-sentence-synthesis',
    scope: 'ride-analysis',
    statement: 'Synthèse en une phrase + une seule recommandation actionnable — jamais un tableau de bord de 30 métriques.',
    refs: [],
    convention: true,
  },

  // ── Section 7 — signaux rouges (abandon de l'optimisation) ───────────
  {
    id: 'red-flag-nfor-ots-suspicion',
    scope: 'red-flag',
    statement:
      "Baisse de performance persistante malgré la récupération, avec troubles de l'humeur → suspicion NFOR/OTS, cesser d'optimiser et orienter.",
    refs: ['R23'],
  },
  {
    id: 'red-flag-reds',
    scope: 'red-flag',
    statement:
      "Faible disponibilité énergétique répétée, perte de poids non planifiée, fractures de fatigue, troubles du sommeil/hormonaux → cadre REDs, outil de dépistage en 3 étapes.",
    refs: ['R35'],
  },
  {
    id: 'red-flag-chronic-sleep-issue',
    scope: 'red-flag',
    statement: "Problème de sommeil chronique → dépistage type ASSQ puis spécialiste, plutôt qu'un ajustement de plan.",
    refs: ['R28'],
  },

  // ── Section 8 — affirmations interdites ──────────────────────────────
  {
    id: 'forbidden-tss-ctl-predicts-performance',
    scope: 'forbidden-claim',
    statement: 'Que le TSS ou le CTL prédisent la performance.',
    refs: ['R17'],
  },
  {
    id: 'forbidden-tsb-universal-optimal',
    scope: 'forbidden-claim',
    statement: "Qu'un TSB donné correspond à un état de forme optimal universel.",
    refs: ['R03'],
  },
  {
    id: 'forbidden-hrv-sign-fatigue-freshness',
    scope: 'forbidden-claim',
    statement: "Qu'une baisse de HRV signifie fatigue et une hausse fraîcheur.",
    refs: ['R25'],
  },
  {
    id: 'forbidden-wearable-sleep-stages-exploitable',
    scope: 'forbidden-claim',
    statement: 'Que les stades de sommeil rapportés par le wearable sont exploitables.',
    refs: ['R30'],
  },
  {
    id: 'forbidden-universal-sleep-target',
    scope: 'forbidden-claim',
    statement: 'Que 7 à 9h de sommeil est la bonne cible pour tout le monde.',
    refs: ['R28'],
  },
  {
    id: 'forbidden-hrv-guided-training-proven-performance-gain',
    scope: 'forbidden-claim',
    statement: 'Que le pilotage par HRV améliore la performance de façon démontrée.',
    refs: ['R26', 'R27'],
  },
  {
    id: 'forbidden-1-06-running-exponent-in-cycling',
    scope: 'forbidden-claim',
    statement: "Que l'exposant de fatigue de la course à pied est l'exposant d'endurance en cyclisme.",
    refs: ['R12'],
  },
  {
    id: 'forbidden-unweighted-kj-reflects-fatigue',
    scope: 'forbidden-claim',
    statement: "Qu'un budget kJ non pondéré reflète la fatigue accumulée.",
    refs: ['R09'],
  },
]
