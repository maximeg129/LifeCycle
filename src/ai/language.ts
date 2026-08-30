// ── Langue des réponses IA — chantier multilangue ────────────────────
//
// Fichier plain (PAS 'use server') — importé par des flows 'use server'
// (recovery-insight-flow.ts et, au fur et à mesure de leur migration, les
// 6 autres). Un fichier 'use server' ne peut exporter QUE des fonctions
// async (voir CLAUDE.md, section "Un fichier 'use server' ne peut exporter
// QUE des fonctions async") — LANGUAGE_NAMES/languageInstruction() vivent
// donc ici, jamais à côté d'un flow, pour ne pas reproduire ce piège déjà
// vécu en prod avec STRUCTURED_WORKOUT_SYNTAX.
//
// Portée actuelle : uniquement recoveryInsight (preuve du mécanisme de bout
// en bout — UI, Firestore, cookie, jusqu'au prompt IA). Les 6 autres flows
// (dailyWorkoutRecommendation, trainingPlanGeneration, planWeekSessions,
// rideAnalysis, cyclingOutfitRecommendation, coachChat) reçoivent encore un
// prompt figé en français — voir le "reste à faire" dans CLAUDE.md, section
// i18n, pour la marche à suivre (identique sur chacun : ajouter `language`
// au schéma Zod d'input, interpoler languageInstruction(language) dans le
// system prompt, passer `useLocale()` côté appelant).

import type { Locale } from '@/i18n/config'

export const LANGUAGE_NAMES: Record<Locale, string> = {
  fr: 'French',
  en: 'English',
}

/** Ligne à interpoler dans le system prompt de tout flow generateJson-based — remplace un "Write your entire response in French." figé. */
export function languageInstruction(language: Locale): string {
  return `Write your entire response in ${LANGUAGE_NAMES[language]}.`
}
