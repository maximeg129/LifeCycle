// ── Points de vigilance du plan — logique pure ──────────────────────────
//
// Retour utilisateur (chantier "vue calendrier v2") : "tu as fait à chaque
// fois sur un plan d'entraînement des box de warning... ça prend quand même
// pas mal de place sur la page et ça rallonge [la page]... je me demande
// s'il ne serait pas plus user friendly de simplement avoir des pastilles
// ou des petits points d'exclamation, un, deux, trois selon le nombre de
// warnings et qu'après l'utilisateur clique sur ce warning pour le voir."
//
// Avant ce chantier, training-plan-tab.tsx empilait jusqu'à trois blocs
// toujours dépliés : la bannière de verdict (currentVerdict), chaque
// chaîne de activePlan.warnings[], et le contrôle plan-check-8
// (loadProgressionCheck). Ce fichier consolide les trois sources en une
// seule liste plate — l'UI (Popover compact + badge/compteur) ne fait plus
// que la parcourir, plutôt que de connaître chacune des trois sources.
//
// Sévérité honnête préservée (retour utilisateur : "si on a des box
// rouges, s'il y a vraiment un point de vigilance et que l'athlète ne
// devrait pas s'entraîner") — 'block' reste distinct de 'warn', jamais
// aplati en un simple point d'exclamation générique.

export type AttentionSeverity = 'warn' | 'block'

export interface AttentionItem {
  severity: AttentionSeverity
  text: string
  /** Présent seulement pour un item qui cite une règle evidence/rules.ts (voir SourceCitation) — ex. plan-check-8. */
  ruleIds?: string[]
}

/** Sous-ensemble de TrainingPlanDoc (use-training-plan.ts) pertinent ici — verdict+recommendation viennent soit de la génération initiale, soit de la dernière recalibration (l'appelant choisit lequel passer, voir training-plan-tab.tsx). */
export interface AttentionSource {
  verdict?: 'ok' | 'warn' | 'block'
  recommendation?: string
  warnings: string[]
}

/** Sortie de checkLoadProgressionWithoutDeload (planValidator.ts) — ne produit en pratique jamais 'block' aujourd'hui, mais le type le permet (autres CheckVerdict de ce fichier l'utilisent) donc géré ici pour ne pas dépendre d'une garantie fragile. */
export interface LoadProgressionSource {
  verdict: 'ok' | 'warn' | 'block' | 'insufficient_data'
  detail: string
}

/**
 * Aplati les trois sources de vigilance d'un plan en une liste unique,
 * dans l'ordre où elles apparaissaient précédemment (verdict d'abord, puis
 * warnings de génération, puis le contrôle de progression de charge) — pas
 * pour un ordre d'affichage particulier, juste stable/prévisible pour les
 * tests et le rendu.
 */
export function buildPlanAttentionItems(source: AttentionSource, loadProgression: LoadProgressionSource | null): AttentionItem[] {
  const items: AttentionItem[] = []

  if (source.verdict && source.verdict !== 'ok' && source.recommendation) {
    items.push({ severity: source.verdict, text: source.recommendation })
  }

  for (const w of source.warnings) {
    if (w) items.push({ severity: 'warn', text: w })
  }

  if (loadProgression && (loadProgression.verdict === 'warn' || loadProgression.verdict === 'block')) {
    items.push({ severity: loadProgression.verdict, text: loadProgression.detail, ruleIds: ['plan-check-8-load-progression'] })
  }

  return items
}

/** Sévérité globale d'une liste d'items — pilote la couleur du badge/compteur compact (rouge si au moins un 'block', jaune/ambre sinon, null si rien à signaler → badge non affiché). */
export function attentionOverallSeverity(items: AttentionItem[]): AttentionSeverity | null {
  if (items.some((i) => i.severity === 'block')) return 'block'
  if (items.length > 0) return 'warn'
  return null
}
