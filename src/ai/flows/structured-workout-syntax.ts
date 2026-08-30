// ── Shared constant, deliberately NOT in a 'use server' file ────────────
//
// This used to live inside daily-workout-recommendation-flow.ts (a 'use
// server' file) and get re-exported from there. That is invalid: Next.js
// requires every export of a 'use server' file to be an async function —
// "A 'use server' file can only export async functions, found string."
// (node_modules/next/dist/build/webpack/loaders/next-flight-loader/
// action-validate.js). This check runs at RUNTIME when the module is
// registered as a Server Action module, not at build time — `next build`
// succeeds either way, so the failure only ever showed up as every Server
// Action in that file (and any file importing STRUCTURED_WORKOUT_SYNTAX
// from it — plan-week-sessions-flow.ts) rejecting instantly in production
// with Next.js's generic redacted RSC error, with nothing in the
// application's own logs to point at why. Moving the constant here (a
// plain module, safe to export anything from) is the fix.

/**
 * The Intervals.icu workout-builder text syntax, shared verbatim by every
 * flow that generates a `structuredWorkout` field (daily-workout-
 * recommendation-flow.ts and plan-week-sessions-flow.ts) — a single source
 * of truth for the precision-critical format the site's own parser expects
 * (see the "Nx (étape / étape)" warning below: that inline shorthand looks
 * plausible but silently produces a workout with no steps).
 */
export const STRUCTURED_WORKOUT_SYNTAX = `Format du script structuré (structuredWorkout), en syntaxe Intervals.icu — c'est le format texte du
"workout builder" que le site parse lui-même pour générer les étapes, respecte-le EXACTEMENT :
- Le script est organisé en sections. Chaque section commence par une ligne d'en-tête en texte libre
  (ex. "Échauffement", "Corps de séance", "Retour au calme"), suivie d'une ligne vide avant la section
  suivante.
- Sous chaque en-tête, une ou plusieurs lignes d'étape commençant par "- ", format :
  "- <durée><unité> [ramp] <cible>[%|w] [<cadence>rpm]"
  - Durée : nombre suivi de "s" (secondes), "m" (minutes — PAS des mètres) ou "h" (heures), ex. "15m", "30s".
  - Cible : % de la FTP (ex. "55-65%", "95-105%") — jamais en watts absolus sauf cas particulier.
  - "ramp" (optionnel, avant la cible) : montée/descente progressive sur la durée de l'étape, ex. "ramp 55-65%".
  - Cadence (optionnel, en fin de ligne) : ex. "90rpm".
- Pour un bloc répété (ex. 4 fois 5min effort / 3min récup), mets le nombre de répétitions en suffixe de
  l'en-tête de section ("Corps de séance 4x"), puis liste les étapes du bloc à répéter en dessous.
- N'utilise JAMAIS la syntaxe "Nx (étape / étape)" sur une seule ligne — elle n'est pas reconnue par le parseur.

Exemple complet pour un échauffement en rampe + 4x(5min seuil / 3min récup) + retour au calme :
Échauffement
- 15m ramp 55-65%

Corps de séance 4x
- 5m 95-105%
- 3m 50%

Retour au calme
- 10m 55%`;
