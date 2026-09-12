"use client"

// ── Bouton d'export d'une séance muscu (Intervals.icu ou Strava), avec note ─
//
// Retour utilisateur, en réponse à la proposition "note par exercice
// pendant la séance" : "pas nécessaire, nous pouvons faire une note après
// la séance avant d'envoyer sur intervalles". Une seule note globale,
// capturée juste avant l'envoi plutôt qu'une note par exercice pendant le
// suivi en direct — skippable : "Envoyer sans note" reste un simple clic,
// la Popover n'ajoute une étape que si l'athlète a effectivement quelque
// chose à dire. Générique depuis "let's integrate Strava publishing of
// activities" : un seul composant, `platformLabel` change juste le texte
// affiché (voir rides-journal-tab.tsx, qui en rend deux côte à côte).

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
  /**
   * Libellé de la plateforme cible — retour utilisateur : "let's integrate
   * Strava publishing of activities". Ce composant sert désormais aux deux
   * exports manuels (Intervals.icu et Strava, voir rides-journal-tab.tsx) :
   * un seul bouton générique plutôt que deux composants quasi identiques.
   * Défaut "Intervals.icu" pour rester rétrocompatible avec l'appel
   * existant.
   */
  platformLabel?: string
  /**
   * Désactive le bouton avec une raison précise indépendante de `canExport`
   * (ex. Strava exige une durée réelle — `elapsed_time` — que cette séance
   * n'a pas, contrairement à Intervals.icu où c'est optionnel) — affichée
   * en `title` plutôt qu'un bouton simplement grisé sans explication.
   */
  disabledReason?: string
}

export function StrengthLogExportButton({ log, canExport, sending, onExport, platformLabel = 'Intervals.icu', disabledReason }: Props) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  const handleSend = () => {
    onExport(log, note.trim() || undefined)
    setOpen(false)
    setNote('')
  }

  const disabled = !canExport || sending || !!disabledReason

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          title={disabledReason || `Envoyer sur ${platformLabel}`}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <p className="text-sm font-medium">Envoyer sur {platformLabel}</p>
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
