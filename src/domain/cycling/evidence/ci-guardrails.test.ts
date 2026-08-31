// ── Garde-fous CI, posés en Phase 1 comme demandé (pas repoussés à la fin) ──
//
// Deux des six garde-fous demandés ne sont pas encore possibles à ce stade :
// - "Snapshot du prompt système" — buildSystemPrompt.ts n'existe pas encore
//   (Phase 3 / PR 8). Rien à snapshotter avant.
// - "Réponse coach sans uncertainty rejetée" — le contrat de sortie Zod
//   unifié n'existe pas encore (même PR). Rien à valider avant.
// Les deux seront ajoutés dans la PR qui introduit buildSystemPrompt.ts.
//
// Les quatre autres sont actionnables dès maintenant et vivent ici :
// rules.test.ts et constants.test.ts couvrent les garde-fous propres à
// l'évidence base elle-même ; ce fichier couvre les deux garde-fous qui
// scannent le dépôt (littéral interdit, point d'entrée unique).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SRC_ROOT = join(__dirname, '..', '..', '..') // src/domain/cycling/evidence -> src

/** Every non-test .ts/.tsx file under `root`, recursively — production code only. */
function listProductionFiles(root: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...listProductionFiles(full))
      continue
    }
    if (!['.ts', '.tsx'].includes(extname(entry))) continue
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx') || entry.endsWith('.spec.ts')) continue
    out.push(full)
  }
  return out
}

describe('CI guardrail — the Riegel running exponent literal never appears in the cycling domain', () => {
  // Le constat en tête de l'audit (docs/AUDIT_CYCLING.md §0) : absent
  // aujourd'hui, vérifié par grep manuel. Ce test rend cette vérification
  // permanente plutôt qu'un audit ponctuel — toute PR future qui
  // réintroduirait la valeur (même « juste pour un test rapide ») casse la CI.
  //
  // Scope volontairement limité au domaine cyclisme/coach plutôt qu'à tout
  // `src/` — un scan de l'app entière remonte des faux positifs sans
  // rapport (ex. les coordonnées de tracé SVG du logo Google dans les pages
  // de login/inscription contiennent la sous-chaîne "1.06" par coïncidence).
  const CYCLING_DOMAIN_ROOTS = [
    join(SRC_ROOT, 'domain', 'cycling'),
    join(SRC_ROOT, 'components', 'cycling'),
    join(SRC_ROOT, 'components', 'coach'),
    join(SRC_ROOT, 'ai'),
    join(SRC_ROOT, 'lib', 'intervals-api.ts'),
    join(SRC_ROOT, 'app', 'cycling'),
    join(SRC_ROOT, 'app', 'coach'),
  ]

  function listExisting(paths: string[]): string[] {
    const out: string[] = []
    for (const p of paths) {
      let stat
      try {
        stat = statSync(p)
      } catch {
        continue // n'existe pas encore (ex. src/app/coach avant sa création) — rien à scanner
      }
      out.push(...(stat.isDirectory() ? listProductionFiles(p) : [p]))
    }
    return out
  }

  it('no production file under the cycling/coach domain contains the literal "1.06" or "1,06"', () => {
    const offenders: string[] = []
    for (const file of listExisting(CYCLING_DOMAIN_ROOTS)) {
      const content = readFileSync(file, 'utf8')
      if (/1[.,]06/.test(content)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})

describe('CI guardrail — single entry point to the Anthropic API', () => {
  // Aujourd'hui (avant la PR 8 / buildSystemPrompt.ts), deux fichiers
  // appellent réellement l'API : anthropic.ts (generateJson, partagé par
  // 6 flows) et coach-chat-flow.ts (son propre appel direct, documenté
  // dans CLAUDE.md). C'est la liste blanche de référence tant que la
  // migration n'a pas eu lieu — elle ne doit jamais grandir sans une
  // décision explicite, et elle se réduira à un seul fichier
  // (src/ai/coach/invokeCoach.ts) une fois la PR 8 livrée.
  const ALLOWED_CALL_SITES = [join(SRC_ROOT, 'ai', 'anthropic.ts'), join(SRC_ROOT, 'ai', 'flows', 'coach-chat-flow.ts')]

  it('no file outside the allowlist calls anthropic.messages.create', () => {
    const offenders: string[] = []
    for (const file of listProductionFiles(SRC_ROOT)) {
      if (ALLOWED_CALL_SITES.includes(file)) continue
      const content = readFileSync(file, 'utf8')
      if (/\.messages\.create\s*\(/.test(content)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('the allowlist itself still matches real files on disk (catches a rename silently widening the guard)', () => {
    for (const file of ALLOWED_CALL_SITES) {
      expect(() => statSync(file), `expected ${file} to exist`).not.toThrow()
    }
  })
})
