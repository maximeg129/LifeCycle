// ── Guidance qualitative par phase de plan — partagée entre plan-week-
// sessions-flow.ts et daily-strength-recommendation-flow.ts ───────────────
//
// Fichier plain, délibérément PAS 'use server' — même raison documentée
// dans strength-exercise-schema.ts / structured-workout-syntax.ts (un
// fichier 'use server' ne peut exporter QUE des fonctions async).
//
// Extrait de plan-week-sessions-flow.ts (où il vivait seul, non exporté)
// au moment d'introduire un second flow qui doit aussi raisonner sur la
// phase du plan (dailyStrengthRecommendation, "Proposer une séance de
// muscu" — retour utilisateur, voir CLAUDE.md) : un seul texte de
// guidance par phase, jamais un deuxième qui pourrait diverger du premier.

export type PlanPhaseForGuidance = 'base' | 'build' | 'peak' | 'taper' | 'recovery';

export const PHASE_GUIDANCE: Record<PlanPhaseForGuidance, string> = {
  base: 'Phase base : volume et endurance, intensité majoritairement basse (55-75% FTP). Peu ou pas de haute intensité.',
  build: 'Phase développement : intensité croissante et spécificité — introduit du seuil/sweet spot, garde une part d\'endurance.',
  peak: 'Phase pic : les séances les plus spécifiques et intenses du plan (seuil, VO2max, ou spécificité de l\'objectif) — le volume peut être plus bas qu\'en base/build mais l\'intensité est élevée.',
  taper: 'Phase affûtage : volume nettement réduit, mais garde un peu d\'intensité courte pour rester affûté — pas juste des sorties molles.',
  recovery: 'Phase récupération : volume et intensité réduits (~50-60% de la normale), quasi exclusivement en endurance légère.',
};
