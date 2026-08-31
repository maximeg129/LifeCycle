// ── Contrat de sortie coach — obligatoire pour toute réponse structurée ────
//
// Exigence du cadrage : chaque réponse coach doit porter un verdict
// explicite de conformité aux règles (evidence/rules.ts), les règles
// effectivement appliquées (citées par id, jamais inventées), et une
// incertitude explicite — jamais silencieusement omise. `withCoachOutputContract()`
// COMPOSE ce socle avec le schéma propre à chaque flow (title/structuredWorkout
// pour la proposition du jour, headline/strengths pour l'analyse de sortie,
// etc.) — aucun flow ne peut donc renvoyer une réponse qui ne porte pas ces
// 5 champs, structurellement (échec de validation Zod sinon), pas seulement
// par convention de code.
//
// Ce fichier est délibérément un fichier "plain" (pas `'use server'`) —
// même raison que evidence/constants.ts et ai/language.ts : un fichier
// `'use server'` ne peut exporter QUE des fonctions async (voir l'avertissement
// dans CLAUDE.md) ; CoachOutputContractSchema/CoachReasonSchema sont des
// valeurs, pas des fonctions.

import { z } from 'zod'

export const CoachReasonSchema = z.object({
  rule: z
    .string()
    .min(1)
    .describe(
      'Id exact de la CoachRule (evidence/rules.ts) qui a influencé cette réponse, ex. "kj-budget-thresholds-are-ceilings-not-targets" — jamais un id inventé, jamais une règle non listée dans le prompt système.'
    ),
  refs: z
    .array(z.string())
    .describe('Références (Rxx/Sxx) associées à cette règle — vide seulement si la règle est [convention].'),
  detail: z.string().min(1).describe('Une phrase : comment cette règle a concrètement influencé cette réponse précise.'),
})

export type CoachReason = z.infer<typeof CoachReasonSchema>

export const CoachOutputContractSchema = z.object({
  verdict: z
    .enum(['ok', 'warn', 'block'])
    .describe(
      '"ok" : la réponse suit les règles sans réserve. "warn" : suit les règles mais avec une réserve à afficher. ' +
        '"block" : suivre la demande violerait un red-flag ou une affirmation interdite — refuser/orienter plutôt que produire le contenu à risque.'
    ),
  summary: z.string().min(1).describe('Aperçu en une ou deux phrases, indépendant des champs propres au flow.'),
  recommendation: z.string().min(1).describe('Une action concrète et immédiate.'),
  reasons: z
    .array(CoachReasonSchema)
    .describe('Chaque règle du prompt système qui a matériellement influencé cette réponse — vide seulement si aucune règle ne s\'appliquait vraiment.'),
  uncertainty: z
    .string()
    .min(1)
    .describe(
      'Ce qui est incertain dans cette réponse (donnée manquante, hypothèse faite, règle appliquée hors de son contexte habituel). ' +
        'OBLIGATOIRE, jamais vide — si vraiment rien n\'est incertain, le dire explicitement plutôt qu\'omettre le champ.'
    ),
})

export type CoachOutputContract = z.infer<typeof CoachOutputContractSchema>

/**
 * Compose le socle obligatoire ci-dessus avec le schéma propre à un flow —
 * SEUL point de construction d'un schéma de sortie coach dans ce projet.
 * `flowShape` peut redéfinir `summary`/`recommendation` avec sa propre
 * description si le flow a déjà un sens plus précis pour ces deux champs
 * (ex. rideAnalysis, recoveryInsight) — Zod `.extend()` fait gagner les
 * clés de `flowShape` sur celles du socle en cas de collision ; s'assurer
 * alors que la redéfinition garde `.min(1)` (voir outputContract.test.ts,
 * qui vérifie ce point précis sur chaque flow migré).
 */
export function withCoachOutputContract<Shape extends z.ZodRawShape>(flowShape: Shape) {
  return CoachOutputContractSchema.extend(flowShape)
}

/**
 * Texte à insérer dans le prompt système de tout flow utilisant
 * `withCoachOutputContract` — décrit les 5 champs obligatoires en plus de
 * ceux propres à la tâche (déjà décrits par le flow lui-même). N'est
 * PAS utilisé par coachChat (invokeCoachConversational) : forcer ce
 * contrat sur un tour de conversation libre entrerait en conflit avec le
 * format tool_use — voir invokeCoach.ts.
 */
export function describeCoachOutputContract(): string {
  return `Contrat de sortie obligatoire — en plus des champs propres à ta tâche (précisés ci-dessus), ta réponse
JSON DOIT toujours inclure ces 5 champs :
{
  "verdict": "ok" | "warn" | "block",
  "summary": "aperçu en une ou deux phrases",
  "recommendation": "une action concrète et immédiate",
  "reasons": [{"rule": "id exact d'une règle listée ci-dessus", "refs": ["Rxx"], "detail": "une phrase"}],
  "uncertainty": "ce qui est incertain dans cette réponse — jamais vide, dis-le explicitement si rien n'est incertain"
}
"verdict" doit être "block" si suivre la demande violerait une règle red-flag ou une affirmation interdite listée
ci-dessus — dans ce cas, n'invente pas de contenu à risque : explique pourquoi dans summary/recommendation à la
place. "reasons" ne doit citer QUE des id de règles listées dans le prompt système ci-dessus, jamais un id inventé.`
}
