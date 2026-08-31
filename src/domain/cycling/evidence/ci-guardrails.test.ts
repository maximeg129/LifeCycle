// ── Garde-fous CI, posés en Phase 1 comme demandé (pas repoussés à la fin) ──
//
// Les 6 garde-fous demandés sont maintenant tous en place :
// 1-2. rules.test.ts / constants.test.ts (aucune CoachRule sans refs ni
//    convention:true ; aucune constante pending utilisée sans throw).
// 3. Le littéral Riegel interdit — scanné ci-dessous.
// 4. Point d'entrée unique — scanné ci-dessous, resserré à
//    [anthropic.ts, coach/invokeCoach.ts] par la PR 8 (buildSystemPrompt.ts/
//    invokeCoach.ts) : les 6 flows coach en périmètre appellent maintenant
//    exclusivement invokeCoachJson/invokeCoachConversational, plus jamais
//    generateJson/anthropic.messages.create directement.
// 5. Snapshot du prompt système — src/ai/coach/buildSystemPrompt.test.ts
//    (`toMatchSnapshot()` par flow, un snapshot committé par PR 8).
// 6. Réponse coach sans uncertainty rejetée —
//    src/ai/coach/outputContract.test.ts.
//
// Ce fichier couvre les deux garde-fous qui scannent le dépôt (littéral
// interdit, point d'entrée unique) ; les autres vivent dans leurs modules
// respectifs, plus naturels à maintenir à côté du code qu'ils couvrent.

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
  // Depuis la PR 8 (buildSystemPrompt.ts/invokeCoach.ts) : exactement deux
  // fichiers appellent réellement l'API — anthropic.ts (generateJson, le
  // client bas niveau partagé) et src/ai/coach/invokeCoach.ts (le seul
  // appelant autorisé de generateJson/anthropic.messages.create pour les 6
  // flows coach en périmètre, Q2 dans docs/OPEN_QUESTIONS.md). Les 6 flows
  // eux-mêmes (dailyWorkoutRecommendation, trainingPlanGeneration,
  // planWeekSessions, coachChat, rideAnalysis, recoveryInsight) n'appellent
  // plus jamais le modèle directement — coach-chat-flow.ts, seul cas qui
  // appelait l'API en direct avant cette PR (texte libre/tool_use, pas de
  // schéma Zod), est passé par invokeCoachConversational comme les 5 autres
  // par invokeCoachJson. `cyclingOutfitRecommendation`/`identifyPlant`
  // restent hors périmètre (Q2) et continuent d'appeler generateJson
  // directement depuis leur propre fichier — mais generateJson lui-même vit
  // dans anthropic.ts, déjà dans la liste blanche, donc leur appel effectif
  // à `.messages.create` n'apparaît toujours nulle part ailleurs. Cette
  // liste ne doit jamais grandir sans une décision explicite.
  const ALLOWED_CALL_SITES = [join(SRC_ROOT, 'ai', 'anthropic.ts'), join(SRC_ROOT, 'ai', 'coach', 'invokeCoach.ts')]

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
