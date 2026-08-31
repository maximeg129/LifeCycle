// ── Version du prompt système coach — loggée avec chaque réponse ──────────
//
// Exigence du cadrage : "le prompt assemblé est versionné, et l'id de
// version est loggé avec chaque réponse coach pour l'audit." Deux sources
// de changement distinctes, capturées séparément :
// - PROMPT_ASSEMBLER_VERSION : bump manuel quand la LOGIQUE d'assemblage
//   change (buildSystemPrompt.ts — nouvelle section, nouveau format...).
// - le hash de contenu ci-dessous : automatique, change dès qu'une règle
//   ou une référence change dans evidence/rules.ts ou evidence/references.ts,
//   même si buildSystemPrompt.ts lui-même n'a pas bougé — pour qu'un prompt
//   assemblé avec une base de connaissances périmée soit toujours détectable
//   dans les logs.
//
// Fichier "plain" (pas `'use server'`) — même raison que outputContract.ts.

import { createHash } from 'crypto'
import { RULES } from '@/domain/cycling/evidence/rules'
import { REFERENCES } from '@/domain/cycling/evidence/references'

/** Bump manuellement quand buildSystemPrompt.ts change sa LOGIQUE d'assemblage (pas son contenu, déjà capturé par le hash ci-dessous). */
export const PROMPT_ASSEMBLER_VERSION = '1.0.0'

let cachedContentHash: string | null = null

/**
 * Hash déterministe sur le contenu complet de RULES + REFERENCES — change
 * automatiquement si une règle ou une référence est éditée, sans dépendre
 * d'un bump manuel. Mis en cache : la base de connaissances est statique
 * le temps d'un process (pas de rechargement à chaud en production).
 */
export function computeEvidenceContentHash(): string {
  if (cachedContentHash) return cachedContentHash

  const canonicalRules = RULES.map((r) => ({
    id: r.id,
    scope: r.scope,
    statement: r.statement,
    refs: r.refs,
    convention: r.convention ?? false,
  }))
  const canonicalReferences = Object.keys(REFERENCES)
    .sort()
    .map((id) => {
      const r = REFERENCES[id]
      return { id: r.id, level: r.level, claim: r.claim }
    })

  const canonical = JSON.stringify({ rules: canonicalRules, references: canonicalReferences })
  cachedContentHash = createHash('sha256').update(canonical).digest('hex').slice(0, 16)
  return cachedContentHash
}

/**
 * Version complète loggée avec chaque appel coach —
 * `{assemblerVersion}-{flowId}-{contentHash}`. Change dès que la logique
 * d'assemblage OU le contenu de la base de connaissances change, donc un
 * prompt périmé dans les logs est toujours reconnaissable.
 */
export function computePromptVersion(flowId: string): string {
  return `${PROMPT_ASSEMBLER_VERSION}-${flowId}-${computeEvidenceContentHash()}`
}
