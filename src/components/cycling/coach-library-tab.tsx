"use client"

// ── "Bibliothèque" — réorientée en lecture seule (Q4, docs/OPEN_QUESTIONS.md,
// réponse (c), 31 août 2026). Cette fonctionnalité affichait à l'origine un
// CRUD Firestore libre (l'athlète ajoutait ses propres études/articles) —
// retiré : coachLibrary est une collection Firestore différente des 35
// références évidence-based (evidence/references.ts, versionnées dans le
// code, seule source de vérité pour les règles opérationnelles) et laisser
// coexister "source ajoutée librement, non revue" à côté de "source qui
// fait autorité" entretenait une confusion sur ce qui grounde réellement le
// coach IA. Cet onglet affiche maintenant les 35 références elles-mêmes,
// en lecture seule, directement depuis le code — jamais depuis Firestore.
//
// add-library-entry-dialog.tsx / use-coach-library.ts / library-types.ts /
// l'API /api/library/extract-pdf sont supprimés (obsolètes, plus aucun
// appelant). Les 6 flows coach qui injectaient ces entrées Firestore dans
// leur contexte (coach-context.ts, buildLibraryContextBlock) ne le font
// plus — ils sont déjà grounded dans RULES/REFERENCES via buildSystemPrompt
// (src/ai/coach/, PR 8), plus rigoureusement que ce mécanisme ne l'était.

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Library, Search, ExternalLink } from 'lucide-react'
import { REFERENCES, type EvidenceLevel } from '@/domain/cycling/evidence/references'

const LEVEL_LABELS: Record<EvidenceLevel, string> = {
  A: 'Niveau A — revue systématique/méta-analyse ou consensus',
  B: 'Niveau B — étude primaire',
  C: 'Niveau C — source praticien (non revue par les pairs)',
}

const LEVEL_BADGE_CLASS: Record<EvidenceLevel, string> = {
  A: 'bg-primary/10 text-primary border-primary/20',
  B: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  C: 'bg-muted text-muted-foreground border-border',
}

function referenceUrl(doi?: string, pmid?: string): string | null {
  if (doi) return `https://doi.org/${doi}`
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
  return null
}

export function CoachLibraryTab() {
  const [search, setSearch] = useState('')

  const entries = useMemo(() => {
    const all = Object.values(REFERENCES).sort((a, b) => a.id.localeCompare(b.id))
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.authors.toLowerCase().includes(q) ||
        r.claim.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" /> Bibliothèque
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Les {Object.keys(REFERENCES).length} références scientifiques qui font autorité pour le coach IA — la
            même base que celle citée dans le prompt système de chaque réponse (source-au-clic sur les métriques
            concernées). Lecture seule : ces références sont versionnées dans le code, pas modifiables ici.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, auteur, id (Rxx)..."
            className="pl-9"
          />
        </div>

        {entries.length === 0 ? (
          <EmptyState size="compact" icon={Search} title="Aucune référence trouvée" description="Essayez un autre terme de recherche." className="py-4" />
        ) : (
          <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
            {entries.map((ref) => {
              const url = referenceUrl(ref.doi, ref.pmid)
              return (
                <div key={ref.id} className="p-3 rounded-lg border border-border bg-background/40 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-data text-xs text-muted-foreground">{ref.id}</span>
                        <span className="font-medium text-sm">{ref.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ref.authors}, {ref.year}. {ref.source}.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={LEVEL_BADGE_CLASS[ref.level]} title={LEVEL_LABELS[ref.level]}>
                        {ref.level}
                      </Badge>
                      {ref.openAccess && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          accès libre
                        </Badge>
                      )}
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Ouvrir la source">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-sm">{ref.claim}</p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
