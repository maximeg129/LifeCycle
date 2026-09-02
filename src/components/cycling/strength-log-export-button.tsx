"use client"

// ── Bouton d'export d'une séance muscu vers Intervals.icu, avec note ────
//
// Retour utilisateur, en réponse à la proposition "note par exercice
// pendant la séance" : "pas nécessaire, nous pouvons faire une note après
// la séance avant d'envoyer sur intervalles". Une seule note globale,
// capturée juste avant l'envoi plutôt qu'une note par exercice pendant le
// suivi en direct — skippable : "Envoyer sans note" reste un simple clic,
// la Popover n'ajoute une étape que si l'athlète a effectivement quelque
// chose à dire.

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { StrengthSessionLogWithId } from './strength-log-types'

interface Props {
  log: StrengthSessionLogWithId
  canExport: boolean
  sending: boolean
  onExport: (log: StrengthSessionLogWithId, note?: string) => void
}

export function StrengthLogExportButton({ log, canExport, sending, onExport }: Props) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  const handleSend = () => {
    onExport(log, note.trim() || undefined)
    setOpen(false)
    setNote('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled={!canExport || sending}
          onClick={(e) => e.stopPropagation()}
          title="Envoyer sur Intervals.icu"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <p className="text-sm font-medium">Envoyer sur Intervals.icu</p>
          <p className="text-xs text-muted-foreground">Une note optionnelle, ajoutée à la description de l&apos;activité.</p>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. Bonne séance, genou un peu sensible sur les squats..."
          className="min-h-20 text-sm"
        />
        <Button size="sm" className="w-full gap-1.5" onClick={handleSend}>
          <Send className="w-3.5 h-3.5" /> {note.trim() ? 'Envoyer avec la note' : 'Envoyer sans note'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
