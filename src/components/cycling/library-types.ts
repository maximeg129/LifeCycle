// ── Bibliothèque du coach — pure functions, no Firebase deps ──────────────
//
// Retour utilisateur : "j'aimerais pouvoir completer le coaching avec des
// documents solide, des etudes, des articles realisé par des coachs, des
// entraineurs et des scientifique." Chaque source ajoutée ici est
// injectée, sous forme de résumé compact, dans le contexte de TOUS les
// flows IA coach (buildCoachContext — voir coach-context.ts) : Proposition
// du jour, Plan, Stella, analyse de sortie, recoveryInsight. Jamais le
// texte intégral d'une source dans un prompt — seulement son résumé — pour
// que le budget de prompt reste borné même à plusieurs dizaines de sources
// (voir buildLibraryContextBlock ci-dessous). Le texte intégral, quand
// présent, reste consultable dans l'onglet Bibliothèque lui-même mais
// n'est jamais envoyé à Claude automatiquement.

export type LibrarySourceType = 'etude' | 'article' | 'livre' | 'note-coach'

export const SOURCE_TYPE_LABELS: Record<LibrarySourceType, string> = {
  etude: 'Étude scientifique',
  article: 'Article',
  livre: 'Livre',
  'note-coach': 'Note de coach/entraîneur',
}

export const SOURCE_TYPES: LibrarySourceType[] = ['etude', 'article', 'livre', 'note-coach']

export function isLibrarySourceType(value: string): value is LibrarySourceType {
  return (SOURCE_TYPES as string[]).includes(value)
}

/** Minimal shape buildLibraryContextBlock() needs — a full Firestore LibraryEntry (with id/fullText/url/timestamps) satisfies it, so the same formatter serves both the real hook data and unit tests. */
export interface LibraryEntryLike {
  title: string
  authors?: string
  sourceType: LibrarySourceType
  summary: string
  tags?: string[]
}

export interface LibraryValidationInput {
  title: string
  summary: string
  sourceType: string
}

export interface LibraryValidationResult {
  ok: boolean
  error?: string
}

/** Résumé max injecté dans un prompt — au-delà, tronqué avec une ellipse plutôt que de laisser une source verbeuse gonfler chaque appel IA. Le champ lui-même n'est pas limité en base, seulement ce qui part dans le contexte. */
const MAX_SUMMARY_CHARS_IN_PROMPT = 600

/** Validates the required fields of a library entry before writing it — title and a real summary (the summary is what the coach actually reads, an empty one would silently contribute nothing). */
export function validateLibraryEntry(input: LibraryValidationInput): LibraryValidationResult {
  if (!input.title.trim()) return { ok: false, error: 'Le titre est requis.' }
  if (!input.summary.trim()) return { ok: false, error: "Le résumé est requis — c'est lui que le coach IA lit." }
  if (!isLibrarySourceType(input.sourceType)) return { ok: false, error: 'Type de source invalide.' }
  return { ok: true }
}

/** Comma-separated free text → deduped, trimmed, lowercased tags. Same convention as ingredient parsing (recipe-types.ts parseIngredientsText). */
export function parseTagsText(text: string): string[] {
  const tags = text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  return [...new Set(tags)]
}

export function tagsToText(tags: string[]): string {
  return tags.join(', ')
}

function formatReferenceLine(entry: LibraryEntryLike): string {
  const authors = entry.authors?.trim() ? ` (${entry.authors.trim()})` : ''
  const summary = entry.summary.length > MAX_SUMMARY_CHARS_IN_PROMPT
    ? `${entry.summary.slice(0, MAX_SUMMARY_CHARS_IN_PROMPT)}…`
    : entry.summary
  const tagsSuffix = entry.tags && entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : ''
  return `- "${entry.title}"${authors} — ${SOURCE_TYPE_LABELS[entry.sourceType]} : ${summary}${tagsSuffix}`
}

/**
 * Builds the "BASE DE CONNAISSANCES" section appended to buildCoachContext.
 * Empty string when there's nothing to add, so every call site can just
 * always append the result without an extra `if` — matches the pattern
 * every other buildCoachContext section already follows.
 */
export function buildLibraryContextBlock(entries: LibraryEntryLike[]): string {
  if (entries.length === 0) return ''
  const lines: string[] = [
    '',
    `BASE DE CONNAISSANCES (${entries.length} source${entries.length > 1 ? 's' : ''} ajoutée${entries.length > 1 ? 's' : ''} par l'athlète) :`,
  ]
  for (const entry of entries) lines.push(formatReferenceLine(entry))
  lines.push("- Appuie-toi sur ces sources quand elles sont pertinentes au sujet, cite leur titre si tu t'en sers, et ne les invente jamais si aucune ne s'applique.")
  return lines.join('\n')
}
