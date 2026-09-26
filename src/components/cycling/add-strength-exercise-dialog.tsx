"use client"

// ── Ajouter un exercice manuellement à une séance de musculation ────────
//
// Retour utilisateur : "il faudrait pouvoir rajouter des exercices, et des
// tour pour chaque exercice dans la musculation" — AskUserQuestion :
// possible à la fois AVANT de démarrer (édite la séance déjà persistée du
// plan, voir withExerciseAdded dans training-plan-types.ts) ET PENDANT le
// suivi en direct (state local, live-strength-session-view.tsx). Un seul
// composant de saisie partagé par les deux usages — l'appelant décide de
// ce qu'il fait du résultat (écriture Firestore immédiate ou simple
// setState local), ce composant ne fait que collecter les champs.
//
// Chrome CrudDialogShell réutilisé tel quel même si aucune écriture
// Firestore n'a lieu ICI (onSubmit synchrone, isSaving={false}) — même
// Dialog/Header/Footer que tout autre dialogue "ajouter X" de l'app, pas
// de raison de diverger juste parce que la persistance est déléguée au
// parent plutôt que faite sur place.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { Plus } from 'lucide-react'
import { MOVEMENT_PATTERNS, type MovementPattern } from '@/domain/cycling/validation/strengthSessionValidator'
import { EXERCISE_TECHNIQUE } from './exercise-technique'
import type { StrengthExercise } from '@/ai/flows/strength-exercise-schema'

const DEFAULT_SETS = 3
const DEFAULT_REPS = '10'
const DEFAULT_REST_SECONDS = 90
const DEFAULT_PATTERN: MovementPattern = 'bilateral-heavy'

interface Props {
  onAdd: (exercise: StrengthExercise) => void
  /** "Ajouter un exercice" par défaut — personnalisable pour un contexte plus compact. */
  triggerLabel?: string
}

export function AddStrengthExerciseDialog({ onAdd, triggerLabel = 'Ajouter un exercice' }: Props) {
  const [open, setOpen] = useState(false)
  const [pattern, setPattern] = useState<MovementPattern>(DEFAULT_PATTERN)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = fd.get('name')?.toString().trim()
    if (!name) return
    const sets = Math.max(1, Math.round(Number(fd.get('sets'))) || DEFAULT_SETS)
    const reps = fd.get('reps')?.toString().trim() || DEFAULT_REPS
    const loadGuidance = fd.get('loadGuidance')?.toString().trim() || 'À définir'
    const restSeconds = Math.max(0, Math.round(Number(fd.get('restSeconds'))) || DEFAULT_REST_SECONDS)
    const exercise: StrengthExercise = {
      name,
      pattern,
      sets,
      reps,
      // Jamais une plage %1RM/reps inventée pour un exercice ajouté
      // manuellement — le contrôle matrice S05 traite déjà repsMin/repsMax/
      // pct1RM null comme "non vérifiable" plutôt que comme une violation
      // (voir strengthSessionValidator.ts, StrengthExerciseForValidation).
      repsMin: null,
      repsMax: null,
      pct1RMMin: null,
      pct1RMMax: null,
      loadGuidance,
      restSeconds,
    }
    e.currentTarget.reset()
    setPattern(DEFAULT_PATTERN)
    setOpen(false)
    onAdd(exercise)
  }

  return (
    <CrudDialogShell
      title="Ajouter un exercice"
      description="Vient s'ajouter à la séance — les répétitions/charge restent éditables ensuite."
      trigger={
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {triggerLabel}
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={false}
      submitLabel="Ajouter"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="exercise-name">Nom de l&apos;exercice *</Label>
        <Input id="exercise-name" name="name" placeholder="ex. Curl biceps" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label>Type de mouvement</Label>
        <Select value={pattern} onValueChange={(v) => setPattern(v as MovementPattern)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOVEMENT_PATTERNS.map((p) => (
              <SelectItem key={p} value={p}>{EXERCISE_TECHNIQUE[p].title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exercise-sets">Séries</Label>
          <Input id="exercise-sets" name="sets" type="number" min={1} defaultValue={DEFAULT_SETS} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-reps">Répétitions</Label>
          <Input id="exercise-reps" name="reps" placeholder="ex. 8-10" defaultValue={DEFAULT_REPS} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="exercise-load">Charge</Label>
          <Input id="exercise-load" name="loadGuidance" placeholder="ex. modérée" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-rest">Repos (s)</Label>
          <Input id="exercise-rest" name="restSeconds" type="number" min={0} defaultValue={DEFAULT_REST_SECONDS} />
        </div>
      </div>
    </CrudDialogShell>
  )
}
