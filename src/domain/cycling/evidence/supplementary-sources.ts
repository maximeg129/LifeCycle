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
// - S05 : grille de validation musculation FOURNIE PAR L'UTILISATEUR
//   directement dans la conversation (1er septembre 2026, pas un fichier
//   joint) — même statut que S01/S02 (source praticien/produit, jamais une
//   preuve scientifique en tant que telle), niveau [C]. Contrairement à
//   S03/S04 (guidage qualitatif jusqu'à confirmation), l'utilisateur a
//   explicitement demandé une application STRICTE ("Tu dois respecter
//   strictement les règles ci-dessous") avec des chiffres précis (%1RM,
//   séries/reps/repos, seuils horaires) — ces chiffres sont donc utilisés
//   tels quels dans strengthSessionValidator.ts, la même autorité que
//   n'importe quelle autre instruction utilisateur explicite, pas une
//   affirmation scientifique à faire vérifier davantage.

// ⚠️ Une des règles S05 (§3, "si les données de récupération sont
// disponibles... réduire la charge d'un cran") N'EST PAS vérifiable
// mécaniquement après coup sans recalculer toute la décision — traitée en
// guidage de prompt uniquement (strength-training-guidance.ts), jamais un
// contrôle déterministe (même honnêteté que plan-check-5 dans
// planValidator.ts pour R19, qui n'a pas de seuil chiffré exploitable).

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
  S05: {
    id: 'S05',
    title: 'Grille de validation "séance de musculation pour cycliste" — patterns de mouvement, matrice charge/reps/repos, contraintes de volume/interférence',
    attribution:
      "Fournie directement par l'utilisateur dans la conversation (1er septembre 2026), pas un fichier joint — un cahier des " +
      "charges d'application explicite (\"Tu dois respecter strictement les règles ci-dessous\"), pas une publication " +
      "académique. Même statut que S01/S02 : source praticien/produit, niveau [C].",
    level: 'C',
    addedFor:
      "Aucune des 35 références (R01-R35) ne couvre le contenu interne d'une séance de musculation (patterns de mouvement à " +
      "couvrir, matrice charge/reps/repos par phase, contraintes de fréquence/timing avec le vélo) — S05 comble ce trou pour " +
      "que le coach IA puisse générer ET valider mécaniquement une séance de musculation, plutôt que de laisser sa " +
      "complétude à l'appréciation seule du modèle.",
    claim:
      "(1) Couverture des patterns : une séance \"principale\" doit couvrir ≥4 des 6 patterns (bilatéral lourd, hip-hinge, " +
      "unilatéral, anti-extension, anti-rotation/latéral, cheville/mollet), dont obligatoirement le bilatéral lourd — sauf " +
      "séance taguée \"entretien\"/\"top-up\" (1-2 exercices autorisés, jamais un remplacement silencieux de la séance " +
      "principale de la semaine). " +
      "(2) Matrice charge/reps/repos par phase : base/prépa 3x8-12 @60-70% 1RM, repos 90-120s ; force max 3-5x3-6 @85-92% " +
      "(RPE 8-9), repos 180-300s ; transfert-puissance 3-4x4-6 + composante explosive @75-85%, repos 120-180s ; entretien " +
      "2x5-8 @70-80%, repos 90s. " +
      "(3) Volume/interférence : ≤45-50min hors échauffement pour une séance principale ; si volume vélo hebdo >10h, ≤2 " +
      "séances force/semaine en phase build, ≤1/semaine en pleine saison ; jamais de séance force lourde (force max ou " +
      "transfert-puissance) dans les 24-48h avant une sortie vélo clé ; si des données de récupération sont disponibles et " +
      "sous la baseline de l'athlète, réduire la charge d'un cran (~5-10% de %1RM ou repli en phase entretien) — non " +
      "vérifiable mécaniquement, voir la note ⚠️ en tête de ce fichier.",
  },
}
