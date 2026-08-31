"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { Plus, Pencil, Loader2, FileUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { SOURCE_TYPE_LABELS, SOURCE_TYPES, validateLibraryEntry, parseTagsText, tagsToText, type LibrarySourceType } from './library-types'
import type { LibraryEntry } from './use-coach-library'

interface Props {
  /** Omit for "add" mode (own Plus-button trigger). Pass an existing entry for "edit" mode (own pencil-icon trigger, opened inline from the entry's own row). */
  entry?: LibraryEntry
}

// Généreux pour un article scientifique typique tout en bornant ce qu'on
// envoie à /api/library/extract-pdf — cette route n'a pas d'autre garde-fou
// de taille (voir CLAUDE.md, section sécurité : ces routes utilitaires
// restent volontairement non-authentifiées, comme les proxies Intervals.icu).
const MAX_PDF_BYTES = 15 * 1024 * 1024

export function AddLibraryEntryDialog({ entry }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const { isSaving, submit } = useCrudSubmit()
  const [sourceType, setSourceType] = useState<LibrarySourceType>(entry?.sourceType ?? 'etude')
  const [fullText, setFullText] = useState(entry?.fullText ?? '')
  const [isExtracting, setIsExtracting] = useState(false)

  const isEdit = !!entry

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier plus tard
    if (!file) return
    if (file.size > MAX_PDF_BYTES) {
      toast({ variant: 'destructive', title: 'PDF trop volumineux', description: '15 Mo maximum.' })
      return
    }
    setIsExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/library/extract-pdf', { method: 'POST', body: fd })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`)
      setFullText((prev) => (prev.trim() ? `${prev}\n\n${body.text}` : body.text))
      toast({ title: 'Texte extrait', description: file.name })
    } catch (err) {
      toast({ variant: 'destructive', title: "Impossible d'extraire le PDF", description: err instanceof Error ? err.message : 'Erreur inconnue.' })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    const fd = new FormData(e.currentTarget)
    const title = fd.get('title')?.toString().trim() || ''
    const summary = fd.get('summary')?.toString().trim() || ''
    const validation = validateLibraryEntry({ title, summary, sourceType })
    if (!validation.ok) {
      toast({ variant: 'destructive', title: validation.error })
      return
    }

    const data = {
      userId: user.uid,
      title,
      authors: fd.get('authors')?.toString().trim() || '',
      sourceType,
      url: fd.get('url')?.toString().trim() || '',
      tags: parseTagsText(fd.get('tags')?.toString() || ''),
      summary,
      fullText: fullText.trim(),
      ...(isEdit ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
    }

    const ref = isEdit
      ? doc(db, `users/${user.uid}/coachLibrary/${entry.id}`)
      : doc(collection(db, `users/${user.uid}/coachLibrary`))

    const ok = await submit(
      () => (isEdit ? updateDoc(ref, data) : setDoc(ref, data)),
      { path: ref.path, operation: isEdit ? 'update' : 'create', requestResourceData: data }
    )
    if (ok) {
      setOpen(false)
      toast({ title: isEdit ? 'Source mise à jour' : 'Source ajoutée', description: title })
      if (!isEdit) {
        setFullText('')
        setSourceType('etude')
      }
    }
  }

  return (
    <CrudDialogShell
      title={isEdit ? 'Modifier la source' : 'Ajouter une source'}
      description="Étude, article, livre ou note de coach — le résumé est ce que le coach IA lit ; le texte intégral reste consultable ici, jamais envoyé automatiquement à l'IA."
      trigger={
        isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Ajouter une source
          </Button>
        )
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      submitLabel={isEdit ? 'Enregistrer' : 'Ajouter'}
      onSubmit={handleSubmit}
      contentClassName="max-w-lg max-h-[85vh] overflow-y-auto"
    >
      <div className="space-y-2">
        <Label htmlFor="lib-title">Titre *</Label>
        <Input id="lib-title" name="title" defaultValue={entry?.title} placeholder="ex: A systems model of training for athletic performance" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lib-authors">Auteur(s)</Label>
          <Input id="lib-authors" name="authors" defaultValue={entry?.authors} placeholder="ex: Banister et al." />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as LibrarySourceType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="lib-url">Lien (optionnel)</Label>
        <Input id="lib-url" name="url" type="url" defaultValue={entry?.url} placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lib-tags">Tags (séparés par des virgules)</Label>
        <Input id="lib-tags" name="tags" defaultValue={entry ? tagsToText(entry.tags) : ''} placeholder="ex: récupération, HRV, endurance" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lib-summary">Résumé *</Label>
        <Textarea id="lib-summary" name="summary" defaultValue={entry?.summary} placeholder="Ce que le coach IA doit retenir de cette source — quelques phrases, pas un copier-coller." rows={3} required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label htmlFor="lib-fulltext">Texte intégral (optionnel)</Label>
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer hover:underline">
            {isExtracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
            Importer un PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} disabled={isExtracting} />
          </label>
        </div>
        <Textarea
          id="lib-fulltext"
          value={fullText}
          onChange={(e) => setFullText(e.target.value)}
          placeholder="Collez le texte complet, ou importez un PDF ci-dessus…"
          rows={6}
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">Jamais envoyé automatiquement à l&apos;IA — seul le résumé ci-dessus l&apos;est.</p>
      </div>
    </CrudDialogShell>
  )
}
