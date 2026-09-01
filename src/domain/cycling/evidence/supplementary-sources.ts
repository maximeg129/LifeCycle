// ── Sources supplémentaires — hors des 35 références originelles ──────────
//
// `references.ts` transcrit exactement les 35 sources (R01–R35) de
// docs/01_Base_Scientifique_Cyclisme.md — ce fichier-là reste un canon figé,
// jamais renuméroté ni étendu. Ce fichier-ci accueille les sources ajoutées
// après coup, en cours de projet, pour combler un trou précis que les 35
// références ne couvraient pas. Séparé de REFERENCES pour ne jamais laisser
// croire qu'une source ajoutée après coup faisait partie des 35 d'origine.
//
// Deux provenances distinctes cohabitent ici, chacune tracée honnêtement
// dans `attribution` :
// - S01/S02 : documents fournis PAR L'UTILISATEUR (POWER_ZONES.pdf,
//   POLARIZED_TRAINING.pdf) — diapositives de présentation sans référence
//   académique propre (pas de DOI/PMID, pas de nom de revue), niveau [C],
//   au même titre que R16 (Coggan/TrainingPeaks) dans les 35 références
//   d'origine : une source praticien, jamais une preuve scientifique en
//   tant que telle. Ajoutées pour Q5 (docs/OPEN_QUESTIONS.md) : R18 établit
//   la cible ~80% basse intensité mais ne donne aucune borne %FTP pour le
//   modèle 3 zones lui-même.
// - S03/S04 : trouvées par RECHERCHE AUTONOME (WebSearch, pas fournies par
//   l'utilisateur) — deux publications à comité de lecture (revue narrative
//   + position stand de société savante), niveau [B], formalisées dans le
//   canon après confirmation explicite de l'utilisateur ("C'est okay, nous
//   pouvons les inclure", 1er septembre 2026) — même précédent que S01/S02
//   quant au mécanisme (Sxx, jamais Rxx, jamais mêlées aux 35 d'origine),
//   mais provenance différente à ne jamais laisser croire identique à celle
//   d'un document que l'utilisateur a lui-même fourni.

import type { EvidenceLevel } from './references'

export interface SupplementarySource {
  id: `S${string}`
  title: string
  attribution: string
  level: EvidenceLevel
  addedFor: string // pourquoi cette source a été ajoutée — quelle question ouverte elle comble
  claim: string
  /** Écart connu entre deux endroits du même document, et comment il a été tranché — jamais silencieusement résolu. */
  knownDiscrepancy?: string
}

export const SUPPLEMENTARY_SOURCES: Record<string, SupplementarySource> = {
  S01: {
    id: 'S01',
    title: 'Power Zones (diapositive) — "By Andrew Coggan"',
    attribution: 'Document fourni par l\'utilisateur (POWER_ZONES.pdf), attribué à Andrew Coggan, sans référence académique propre.',
    level: 'C',
    addedFor:
      'Corroboration du modèle 7 zones (R16) déjà utilisé dans zones.ts — pas utilisé pour changer une valeur, seulement pour confirmer les bornes déjà sourcées.',
    claim:
      "Zones 1-7 par %FTP : <55 / 56-75 / 76-90 (+ Sweetspot 88-94) / 91-105 / 106-120 / 121-150 / N/A (maximal). Recoupe " +
      "les bornes déjà en place dans POWER_ZONES_7 (R16) aux arrondis de notation près — aucun changement de valeur nécessaire.",
  },
  S02: {
    id: 'S02',
    title: 'Polarized Training — Power Zones (diapositive), attribué à Dr. Stephen Seiler',
    attribution:
      "Document fourni par l'utilisateur (POLARIZED_TRAINING.pdf) — reformulation tierce du modèle 3 zones de Seiler (R18 dans " +
      "les 35 références), pas une publication de Seiler lui-même.",
    level: 'C',
    addedFor:
      "Comble Q5 (docs/OPEN_QUESTIONS.md) : R18 établit la cible ~80% basse intensité mais ne donne aucune borne %FTP pour le " +
      "modèle 3 zones lui-même (R18 le définit par seuil de lactate sanguin, non mesurable depuis les données de puissance seules).",
    claim: 'Zone 1 (Endurance) 50-79% FTP, Zone 2 (Tempo) 80-99% FTP, Zone 3 (Threshold) 100%+ FTP.',
    knownDiscrepancy:
      "Le document se contredit lui-même : le tableau donne 60-80/80-100/>100, le paragraphe qui l'accompagne (\"Dr. Stephen " +
      "Seiler a défini...\") donne 50-79/80-99/100+. Décision utilisateur du 31 août 2026 (docs/OPEN_QUESTIONS.md, Q5) : retenir " +
      "les valeurs du paragraphe (50/80/100), pas celles du tableau.",
  },
  S03: {
    id: 'S03',
    title:
      'Jeukendrup AE (2014), "A Step Towards Personalized Sports Nutrition: Carbohydrate Intake During Exercise", ' +
      'Sports Medicine 44(Suppl 1):S25-33, DOI 10.1007/s40279-014-0148-z (PMC4008807, accès libre).',
    attribution:
      "Recherche autonome (WebSearch), pas fournie par l'utilisateur — revue narrative à comité de lecture (contrairement à " +
      'S01/S02, diapositives sans référence académique propre). Auteur affilié au Gatorade Sports Science Institute ' +
      '(GSSI/PepsiCo) — même type de transparence à signaler que R34 (Podlogar & Wallis 2022, également financé GSSI).',
    level: 'B',
    addedFor:
      "Comble le trou documenté dans CARB_INTAKE_GUIDANCE (R34, constants.ts) : R34 donne un plafond (120g/h) et un ratio " +
      "glucose:fructose, mais \"ne donne pas de formule reliant durée/intensité à un débit précis en g/h\". S03 fournit ce " +
      "cadre par tranche de durée, utilisé par on-bike-fueling-guidance.ts (Proposition du jour) — décision utilisateur du " +
      "1er septembre 2026 : \"C'est okay, nous pouvons les inclure.\"",
    claim:
      "En dessous d'environ 75 minutes, un apport glucidique pendant l'effort n'apporte pas de bénéfice physiologique clair " +
      "démontré (rinçage buccal éventuel). Entre 1h et 2h30 : jusqu'à ~60g/h d'une source glucidique unique (le transporteur " +
      "intestinal SGLT1 plafonne l'oxydation du glucose seul autour de cette valeur). Au-delà de 2h30 à intensité soutenue : " +
      "jusqu'à ~90g/h en combinant glucose+fructose (ratio ~2:1 — utilise en parallèle SGLT1 et le transporteur GLUT5).",
  },
  S04: {
    id: 'S04',
    title:
      'Kerksick CM, Arent S, Schoenfeld BJ, Stout JR, Campbell B, Wilborn CD, Taylor L, Kalman D, Smith-Ryan AE, Kreider RB, ' +
      'Willoughby D, Arciero PJ, VanDusseldorp TA, Ormsbee MJ, Wildman R, Greenwood M, Ziegenfuss TN, Aragon AA, Antonio J ' +
      '(2017), "International Society of Sports Nutrition position stand: nutrient timing", Journal of the International ' +
      'Society of Sports Nutrition 14:33, DOI 10.1186/s12970-017-0189-4 (PMC5596471, accès libre).',
    attribution:
      "Recherche autonome (WebSearch), pas fournie par l'utilisateur — position stand collectif d'une société savante " +
      '(même nature de document que R35, le consensus IOC REDs), pas la publication d\'un seul laboratoire.',
    level: 'B',
    addedFor:
      "Corrobore S03 pour la fourchette 1h-2h30 (30-60g/h) avec un second document indépendant, et ajoute un repère " +
      "hydratation absent de R34/S03.",
    claim:
      "Confirme une fourchette ~30-60g/h de glucides au-delà de 70 minutes d'effort à >70% VO2max, sous forme de solution " +
      "glucido-électrolytique à 6-8%, ~180-360ml toutes les 10-15 minutes.",
  },
}
