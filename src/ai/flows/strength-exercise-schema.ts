// ── Schéma d'un exercice de musculation — partagé entre plan-week-sessions-flow.ts
// et daily-strength-recommendation-flow.ts ─────────────────────────────────
//
// Fichier plain, délibérément PAS 'use server' — même raison documentée dans
// structured-workout-syntax.ts et les autres fichiers de guidage de ce
// dossier (un fichier 'use server' ne peut exporter QUE des fonctions
// async ; MovementPatternEnum/StrengthExerciseSchema sont des valeurs Zod).
//
// Extrait de plan-week-sessions-flow.ts (où il vivait seul, non exporté)
// au moment d'introduire un second flow qui génère aussi des exercices de
// musculation (dailyStrengthRecommendation, "Proposer une séance de
// muscu" — retour utilisateur, voir CLAUDE.md) : un seul schéma, jamais un
// deuxième dupliqué qui pourrait diverger du premier.

import { z } from 'zod';

export const MovementPatternEnum = z.enum([
  'bilateral-heavy',
  'hip-hinge',
  'unilateral',
  'anti-extension',
  'anti-rotation-lateral',
  'ankle-calf',
]);

export const StrengthExerciseSchema = z.object({
  name: z.string().describe('e.g. "Squat", "Presse à cuisses", "Fentes bulgares".'),
  pattern: MovementPatternEnum.describe('The ONE movement pattern this exercise primarily trains — see STRENGTH_SESSION_VALIDATION_GUIDANCE (S05) for the 6 patterns and which is mandatory.'),
  sets: z.number(),
  reps: z.string().describe('Human-readable display, e.g. "5" or "8-10" — MUST match repsMin/repsMax below exactly (e.g. "3-6" for repsMin=3/repsMax=6, or "5" if repsMin=repsMax=5).'),
  repsMin: z.number().describe('Lower bound of the rep count (equal to repsMax for a fixed number) — used for mechanical validation against the S05 phase matrix.'),
  repsMax: z.number().describe('Upper bound of the rep count.'),
  pct1RMMin: z.number().nullable().describe('Lower bound of estimated %1RM for THIS exercise, per the S05 matrix for the session\'s strengthPhase — null when not applicable (bodyweight/core work).'),
  pct1RMMax: z.number().nullable().describe('Upper bound of estimated %1RM — null when not applicable.'),
  loadGuidance: z.string().describe('Short qualitative complement, e.g. "charge lourde (RPE 8-9)" — alongside the numeric pct1RM range above, not a replacement for it.'),
  restSeconds: z.number().nullable().describe('Rest between sets, in seconds — per the S05 phase matrix (STRENGTH_SESSION_VALIDATION_GUIDANCE). Null only when a clean rest duration does not apply to this exercise (e.g. paired/circuit exercise sharing rest with the next one) — otherwise always a real value from the matrix, never guessed at random.'),
});

export type StrengthExercise = z.infer<typeof StrengthExerciseSchema>;
