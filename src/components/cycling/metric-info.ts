// ── Contenu statique des pages détail de métrique ───────────────────────
//
// Chaque tuile de Cyclisme > Vue d'ensemble renvoie vers
// /cycling/metric/<id> pour une explication de l'indicateur + sa courbe
// dans le temps (quand l'historique existe — voir metric-detail-page.tsx
// pour les métriques qui n'ont pas encore de suivi dans le temps).

export type MetricId = 'tsb' | 'ctl' | 'atl' | 'ftp' | 'riegel' | 'sleep' | 'hrv' | 'restingHr' | 'readiness'

export interface MetricInfo {
  id: MetricId
  label: string
  unit?: string
  /** Une phrase, affichée en sous-titre. */
  tagline: string
  /** 1-3 paragraphes expliquant le principe et le calcul, en langage simple. */
  explanation: string[]
  goodDirection: 'higher' | 'lower' | 'context'
}

export const METRIC_INFO: Record<MetricId, MetricInfo> = {
  tsb: {
    id: 'tsb',
    label: 'Forme (TSB)',
    tagline: "L'équilibre entre fitness et fatigue — la question \"puis-je pousser aujourd'hui ?\"",
    explanation: [
      "Le TSB (Training Stress Balance) se calcule simplement : CTL − ATL, la fitness chronique moins la fatigue aiguë. Un TSB positif veut dire que la fatigue récente est passée sous le niveau de fitness accumulé — le corps est \"frais\". Un TSB très négatif veut dire que la charge récente dépasse largement ce que le corps a l'habitude d'absorber.",
      "Ce n'est pas un chiffre à optimiser en permanence : rester positif tout le temps signifie ne jamais assez charger pour progresser, et rester très négatif trop longtemps mène au surentraînement. L'utile, c'est de savoir où on se situe avant une séance clé ou une compétition.",
    ],
    goodDirection: 'context',
  },
  ctl: {
    id: 'ctl',
    label: 'Fitness (CTL)',
    unit: 'TSS/j',
    tagline: 'La charge d\'entraînement moyenne sur les ~42 derniers jours — le niveau de forme construit dans la durée.',
    explanation: [
      "Le CTL (Chronic Training Load) est une moyenne mobile pondérée exponentiellement de la charge d'entraînement quotidienne (TSS), sur une fenêtre d'environ 42 jours. Il monte lentement quand on enchaîne les semaines chargées, et descend lentement en cas de coupure — c'est voulu : la fitness ne se construit ni ne se perd du jour au lendemain.",
      "C'est le meilleur indicateur du volume/intensité que le corps peut absorber sans forcer, mais il ne dit rien de la fraîcheur du moment — c'est le rôle du TSB.",
      "Ce chiffre n'a pas de signification universelle : les adaptations successives du modèle impulsion-réponse ont produit des formes à 1, 2 ou 3 paramètres — la valeur d'un CTL n'est donc comparable ni d'un athlète à l'autre, ni d'un outil à l'autre (R03). C'est la trajectoire qui compte — la courbe ci-dessous — pas le nombre isolé du jour.",
    ],
    goodDirection: 'higher',
  },
  atl: {
    id: 'atl',
    label: 'Fatigue (ATL)',
    unit: 'TSS/j',
    tagline: 'La charge d\'entraînement moyenne sur les ~7 derniers jours — l\'effet des séances récentes.',
    explanation: [
      "L'ATL (Acute Training Load) est la même moyenne mobile que le CTL, mais sur une fenêtre courte (~7 jours) — elle réagit vite à une grosse semaine ou à une semaine de repos. C'est le pendant \"court terme\" du CTL.",
      "Un ATL qui grimpe beaucoup plus vite que le CTL est le signal classique d'une charge trop agressive par rapport à ce que le corps a l'habitude d'encaisser — c'est exactement ce que le TSB (CTL − ATL) traduit en un seul chiffre.",
    ],
    goodDirection: 'context',
  },
  ftp: {
    id: 'ftp',
    label: 'FTP',
    unit: 'W',
    tagline: 'La puissance maximale soutenable pendant environ une heure — la référence de toutes les zones d\'intensité.',
    explanation: [
      "La FTP (Functional Threshold Power) est la puissance qu'un cycliste peut, en théorie, maintenir pendant environ 60 minutes à l'effort maximal soutenable. C'est le nombre de référence : les zones d'entraînement (endurance, seuil, VO2max...) sont presque toujours exprimées en % de la FTP plutôt qu'en watts absolus, pour rester comparables dans le temps.",
      "Contrairement au CTL/ATL/TSB, la FTP n'est pas recalculée en continu — elle vient d'un test spécifique ou d'une estimation par Intervals.icu, et n'est mise à jour que ponctuellement.",
    ],
    goodDirection: 'higher',
  },
  riegel: {
    id: 'riegel',
    label: 'Indice d\'endurance (Riegel)',
    tagline: 'À quel point la puissance tient dans la durée, indépendamment du niveau de puissance brut.',
    explanation: [
      "Cet indice vient d'un ajustement de type Riegel : P(t) = a · t^(−e) sur 3 records personnels (court, moyen, long), plutôt que d'une puissance critique ou de seuils supposés fixes. L'indice affiché est 1 − e, typiquement entre 0,85 et 0,95 : plus c'est proche de 1, mieux la puissance se maintient quand la durée augmente.",
      "C'est une mesure d'endurance pure, séparée du niveau de puissance absolu — deux cyclistes avec des FTP très différentes peuvent avoir le même indice d'endurance.",
    ],
    goodDirection: 'higher',
  },
  sleep: {
    id: 'sleep',
    label: 'Sommeil',
    unit: 'h',
    tagline: 'Durée (et qualité) de la nuit précédente — l\'entrée de récupération la plus directe.',
    explanation: [
      "Les heures de sommeil et leur qualité viennent en priorité de la synchronisation automatique Intervals.icu (WHOOP ou tout autre capteur connecté), complétées par la saisie manuelle quand rien n'est synchronisé.",
      "Une nuit courte ou de mauvaise qualité fait baisser la readiness et pousse le coach IA à revoir l'intensité proposée à la baisse, même si la charge d'entraînement suggérerait autre chose.",
    ],
    goodDirection: 'higher',
  },
  hrv: {
    id: 'hrv',
    label: 'HRV',
    unit: 'ms',
    tagline: 'La variabilité de la fréquence cardiaque — un signal de récupération du système nerveux autonome.',
    explanation: [
      "Le HRV (variabilité de fréquence cardiaque) mesure les micro-variations de temps entre deux battements cardiaques. Un HRV plus élevé que sa propre moyenne habituelle signale en général un système nerveux bien reposé ; un HRV en baisse peut indiquer fatigue, stress ou début de maladie.",
      "Ce qui compte, c'est la tendance par rapport à sa propre baseline sur plusieurs jours — pas la valeur absolue, qui varie énormément d'une personne à l'autre, et surtout pas une seule mesure isolée d'un jour sur l'autre : le sens d'une variation de HRV est ambigu, même chez un athlète entraîné une hausse comme une baisse peuvent signaler une adaptation négative (R25) — le HRV ne décide jamais seul.",
    ],
    goodDirection: 'higher',
  },
  restingHr: {
    id: 'restingHr',
    label: 'FC repos',
    unit: 'bpm',
    tagline: 'La fréquence cardiaque au réveil — un signal simple de fatigue accumulée, plus stable que le HRV au jour le jour.',
    explanation: [
      "La FC (fréquence cardiaque) de repos, mesurée au réveil, tend à baisser avec l'amélioration de la fitness cardiovasculaire sur le long terme. À court terme, une hausse inhabituelle de quelques battements par minute est souvent un des tout premiers signaux de fatigue accumulée, de déshydratation ou d'un début de maladie — avant même que ça se ressente à l'effort.",
      "Comme le HRV, ce qui compte c'est l'écart à sa propre baseline habituelle plutôt que la valeur absolue, qui dépend énormément de la génétique et du niveau d'entraînement de chacun.",
    ],
    goodDirection: 'lower',
  },
  readiness: {
    id: 'readiness',
    label: 'Readiness',
    unit: '/100',
    tagline: 'Un score composite 0-100 — sommeil, stress et humeur combinés (ou le score du capteur connecté).',
    explanation: [
      "Quand un capteur connecté (WHOOP via Intervals.icu) fournit son propre score de récupération, c'est celui-ci qui est utilisé — plus fiable qu'une heuristique locale. Sinon, un score léger est calculé à partir de la qualité de sommeil, du stress et de l'humeur saisis manuellement.",
      "Ce n'est pas une mesure médicale — juste un signal parmi d'autres pour décider si c'est le jour de pousser ou de lever le pied.",
    ],
    goodDirection: 'higher',
  },
}
