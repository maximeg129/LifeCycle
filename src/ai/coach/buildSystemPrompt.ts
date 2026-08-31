// ── Assembleur de prompt système — la seule autorité du coach IA ──────────
//
// Exigence du cadrage : "le prompt système est assemblé côté serveur ; le
// client n'envoie jamais de prompt système ni ne détient de clé API. Aucun
// chemin de code ne peut appeler le modèle sauf via l'assembleur de prompt
// unique." Ce fichier construit le bloc de règles — invokeCoach.ts (le
// seul appelant autorisé, voir son propre commentaire d'en-tête) l'assemble
// avec le contrat de sortie (outputContract.ts) et les instructions propres
// à chaque tâche.
//
// Fichier "plain" (pas `'use server'`) — même raison que outputContract.ts/
// promptVersion.ts : buildSystemPrompt/selectRulesForFlow sont des
// fonctions synchrones, un fichier `'use server'` ne peut exporter QUE des
// fonctions async.

import { RULES, type CoachRule } from '@/domain/cycling/evidence/rules'
import { REFERENCES } from '@/domain/cycling/evidence/references'
import { computePromptVersion } from './promptVersion'

export type CoachFlowId =
  | 'dailyWorkoutRecommendation'
  | 'trainingPlanGeneration'
  | 'trainingPlanRecalibration'
  | 'planWeekSessions'
  | 'coachChat'
  | 'rideAnalysis'
  | 'recoveryInsight'

/**
 * Les règles dont l'id commence par un de ces préfixes s'appliquent à
 * TOUS les flows, quel que soit leur `scope` — les 10 principes non
 * négociables, les affirmations interdites et les signaux rouges ne sont
 * jamais un contexte optionnel, ce sont des garde-fous toujours actifs
 * (section 1, 7, 8 de la spécification).
 */
const UNIVERSAL_ID_PREFIXES = ['principle-', 'forbidden-', 'red-flag-']

/**
 * Scopes supplémentaires dont chaque flow a besoin, en plus du socle
 * universel + 'interpretation' (tout flow interprète AU MOINS une
 * métrique). Décision produit/architecture — pas elle-même une
 * affirmation scientifique — sur ce que chaque flow raisonne réellement :
 * - dailyWorkoutRecommendation décide une séance → session-arbitration.
 * - trainingPlanGeneration/trainingPlanRecalibration/planWeekSessions
 *   produisent ou ajustent un plan → plan-validation.
 * - coachChat est conversationnel et peut toucher à n'importe quel sujet
 *   coach (y compris discuter d'une sortie passée ou d'un plan) → les 3
 *   scopes additionnels.
 * - rideAnalysis relit une sortie terminée → ride-analysis.
 * - recoveryInsight ne fait qu'interpréter du bien-être/de la forme → rien
 *   d'additionnel, 'interpretation' seul suffit.
 */
const FLOW_EXTRA_SCOPES: Record<CoachFlowId, CoachRule['scope'][]> = {
  dailyWorkoutRecommendation: ['session-arbitration'],
  trainingPlanGeneration: ['plan-validation'],
  trainingPlanRecalibration: ['plan-validation'],
  planWeekSessions: ['plan-validation'],
  coachChat: ['plan-validation', 'session-arbitration', 'ride-analysis'],
  rideAnalysis: ['ride-analysis'],
  recoveryInsight: [],
}

function isUniversal(rule: CoachRule): boolean {
  return UNIVERSAL_ID_PREFIXES.some((prefix) => rule.id.startsWith(prefix))
}

/**
 * Règles pertinentes pour un flow donné — socle universel (principes/
 * interdits/signaux rouges) + 'interpretation' + les scopes additionnels
 * du flow (FLOW_EXTRA_SCOPES). Exportée pour le test de snapshot et pour
 * tout appelant qui veut inspecter ce qui est réellement inclus.
 */
export function selectRulesForFlow(flowId: CoachFlowId): CoachRule[] {
  const extraScopes = new Set(FLOW_EXTRA_SCOPES[flowId])
  return RULES.filter((r) => isUniversal(r) || r.scope === 'interpretation' || extraScopes.has(r.scope))
}

function formatRule(rule: CoachRule): string {
  const refsLabel = rule.convention ? '[convention]' : `[${rule.refs.join(', ')}]`
  return `- (${rule.id}) ${rule.statement} ${refsLabel}`
}

function formatReferencesAppendix(rules: CoachRule[]): string {
  const citedIds = [...new Set(rules.flatMap((r) => r.refs))].sort()
  return citedIds
    .map((id) => {
      const ref = REFERENCES[id]
      return `- ${id} (niveau ${ref.level}) : ${ref.authors}, ${ref.year}. ${ref.title}. ${ref.source}.`
    })
    .join('\n')
}

/**
 * Assemble le prompt système versionné et adossé aux règles pour un flow
 * donné — l'unique autorité opérationnelle du coach (voir le commentaire
 * d'en-tête). Chaque flow reçoit le même socle non négociable (principes,
 * affirmations interdites, signaux rouges) + les règles d'interprétation +
 * les scopes additionnels dont sa tâche a réellement besoin.
 */
export function buildSystemPrompt(flowId: CoachFlowId): string {
  const rules = selectRulesForFlow(flowId)
  const version = computePromptVersion(flowId)

  return `[PROMPT_VERSION: ${version}]

Tu es le coach cyclisme IA de cette application. Les règles ci-dessous sont ta SEULE base opérationnelle pour
tout ce qui touche à l'interprétation de données physiologiques, la validation de plan, l'arbitrage de séance
ou l'analyse de sortie — elles font autorité. Tu ne les contredis JAMAIS, tu ne les complètes JAMAIS avec des
connaissances externes, et tu ne "corriges" aucun seuil de ta propre initiative. Chaque règle porte son
identifiant (à citer dans "reasons" de ta réponse si le contrat de sortie le demande) et ses références entre
crochets — Rxx/Sxx = référence sourcée, [convention] = décision produit documentée, jamais présentée comme un
fait scientifique.

RÈGLES APPLICABLES :
${rules.map(formatRule).join('\n')}

RÉFÉRENCES CITÉES CI-DESSUS :
${formatReferencesAppendix(rules)}`
}
