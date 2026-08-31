// ── Sources supplémentaires — hors des 35 références originelles ──────────
//
// `references.ts` transcrit exactement les 35 sources (R01–R35) de
// docs/01_Base_Scientifique_Cyclisme.md — ce fichier-là reste un canon figé,
// jamais renuméroté ni étendu. Ce fichier-ci accueille les sources que
// l'utilisateur fournit ensuite, en cours de projet, pour combler un trou
// précis que les 35 références ne couvraient pas (ici : Q5, les bornes %FTP
// du modèle 3 zones de Seiler — R18 établit la cible ~80% basse intensité
// mais ne donne aucune borne %FTP exploitable). Séparé de REFERENCES pour
// ne jamais laisser croire qu'une source ajoutée après coup faisait partie
// des 35 d'origine.
//
// Même exigence de traçabilité, même niveau de preuve honnête : ces deux
// documents (POWER_ZONES.pdf, POLARIZED_TRAINING.pdf) sont des diapositives
// de présentation sans référence académique propre (pas de DOI/PMID, pas de
// nom de revue) — niveau [C], au même titre que R16 (Coggan/TrainingPeaks)
// dans les 35 références d'origine : une source praticien, jamais une
// preuve scientifique en tant que telle.

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
}
