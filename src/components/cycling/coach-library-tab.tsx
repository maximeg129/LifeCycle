"use client"

// ── "Bibliothèque" — retour utilisateur : "j'aimerais pouvoir completer le
// coaching avec des documents solide, des etudes, des articles realisé par
// des coachs, des entraineurs et des scientifique." Chaque source ajoutée
// ici est résumée dans le contexte de tous les flows IA coach (voir
// coach-context.ts/library-types.ts) — jamais son texte intégral, qui reste
// consultable ici mais n'est jamais envoyé à Claude automatiquement.

import { useState } from 'react'
import { doc, deleteDoc } from 'firebase/firestore'
import { useUser, useFirestore } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Trash2, ExternalLink, ChevronDown, ChevronUp, Library } from 'lucide-react'
import { useCoachLibrary } from './use-coach-library'
import { AddLibraryEntryDialog } from './add-library-entry-dialog'
import { SOURCE_TYPE_LABELS } from './library-types'

export function CoachLibraryTab() {
  const { user } = useUser()
  const db = useFirestore()
  const { entries, isLoading } = useCoachLibrary()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const remove = async (id: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/coachLibrary/${id}`)
    try {
      await deleteDoc(ref)
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    }
  }

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" /> Bibliothèque
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Études, articles, livres ou notes de coach — chaque résumé est injecté dans le contexte de
            Proposition du jour, Plan, Stella, Récupération et Analyse de sortie.
          </p>
        </div>
        <AddLibraryEntryDialog />
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : entries.length === 0 ? (
          <EmptyState
            size="compact"
            icon={Library}
            title="Aucune source ajoutée"
            description="Ajoutez une étude, un article ou une note de coach pour que le coach IA s'en serve."
            className="py-4"
          />
        ) : (
          entries.map((entry) => {
            const isExpanded = expandedId === entry.id
            return (
              <div key={entry.id} className="p-4 rounded-lg border border-border bg-background/40 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{entry.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{SOURCE_TYPE_LABELS[entry.sourceType]}</Badge>
                    </div>
                    {entry.authors && <p className="text-xs text-muted-foreground">{entry.authors}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {entry.url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Ouvrir la source">
                        <a href={entry.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                    <AddLibraryEntryDialog entry={entry} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(entry.id)} title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-sm">{entry.summary}</p>

                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] font-normal">{tag}</Badge>
                    ))}
                  </div>
                )}

                {entry.fullText && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? 'Masquer le texte intégral' : 'Voir le texte intégral'}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {entry.fullText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
