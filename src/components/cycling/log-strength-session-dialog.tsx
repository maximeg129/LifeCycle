"use client"

// "Logger cette séance" — suivi détaillé par exercice (retour utilisateur),
// suit le patron CrudDialogShell/useCrudSubmit standard (voir CLAUDE.md,
// section Dialogues CRUD). Toujours ouvert depuis une séance de musculation
// PLANIFIÉE (session.strengthExercises) — la liste d'exercices est donc déjà
// connue, l'athlète ajuste juste séries/répétitions/charge réellement faites
// plutôt que de composer une liste depuis rien (pas de dialogue "ajouter un
// exercice" pour l'instant — hors scope de cette itération).

import { useState } from 'react'
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { useStrengthLogs } from './use-strength-logs'
import { exerciseHistory, type LoggedExercise, type StrengthSessionLog } from './strength-log-types'
import type { PlanWeekSession } from '@/ai/flows/plan-week-sessions-flow'

interface Props {
  session: PlanWeekSession
  weekNumber: number
  /** Index de la séance au sein de la semaine — voir strength-log-types.ts (planSessionIndex), pour rapprocher précisément le log de la séance type prévue. */
  sessionIndex: number
}

export function LogStrengthSessionDialog({ session, weekNumber, sessionIndex }: Props) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const { isSaving, submit } = useCrudSubmit()
  const { logs } = useStrengthLogs()
  const [open, setOpen] = useState(false)

  const exercises = session.strengthExercises ?? []
  if (exercises.length === 0) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    const fd = new FormData(e.currentTarget)
    const date = String(fd.get('date') || format(new Date(), 'yyyy-MM-dd'))
    const title = String(fd.get('title') || session.title).trim() || session.title

    const loggedExercises: LoggedExercise[] = exercises.map((ex, i) => {
      const setsRaw = Number(fd.get(`ex-${i}-sets`))
      const reps = String(fd.get(`ex-${i}-reps`) || ex.reps).trim() || ex.reps
      const loadRaw = fd.get(`ex-${i}-loadKg`)
      const loadKg = loadRaw != null && String(loadRaw).trim() !== '' ? Number(loadRaw) : undefined
      const notes = String(fd.get(`ex-${i}-notes`) || '').trim()
      const entry: LoggedExercise = { name: ex.name, sets: Number.isFinite(setsRaw) && setsRaw > 0 ? setsRaw : ex.sets, reps }
      if (loadKg != null && Number.isFinite(loadKg)) entry.loadKg = loadKg
      if (notes) entry.notes = notes
      return entry
    })

    const ref = doc(collection(db, `users/${user.uid}/strengthSessionLogs`))
    const data = {
      userId: user.uid,
      date,
      title,
      exercises: loggedExercises,
      planWeekNumber: weekNumber,
      planSessionIndex: sessionIndex,
      createdAt: serverTimestamp(),
    } satisfies StrengthSessionLog
    const ok = await submit(() => setDoc(ref, data), { path: ref.path, operation: 'create', requestResourceData: data })
    if (ok) {
      setOpen(false)
      toast({ title: 'Séance loguée', description: title })
    }
  }

  return (
    <CrudDialogShell
      title="Logger cette séance"
      description="Séries, répétitions et charge réellement faites — ajustez si besoin, la dernière charge connue est préremplie."
      trigger={
        <Button size="sm" variant="outline" className="gap-1.5 h-8">
          <Dumbbell className="w-3.5 h-3.5" /> Logger
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="log-date">Date</Label>
          <Input id="log-date" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="log-title">Titre</Label>
          <Input id="log-title" name="title" defaultValue={session.title} required />
        </div>
      </div>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {exercises.map((ex, i) => {
          const history = exerciseHistory(logs, ex.name)
          const last = history.at(-1)
          return (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-medium">{ex.name}</p>
              {last && (
                <p className="text-xs text-muted-foreground">
                  Dernière fois ({last.date}) : {last.sets}x{last.reps}{last.loadKg != null ? ` @ ${last.loadKg}kg` : ''}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`ex-${i}-sets`} className="text-xs">Séries</Label>
                  <Input id={`ex-${i}-sets`} name={`ex-${i}-sets`} type="number" min={1} defaultValue={ex.sets} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`ex-${i}-reps`} className="text-xs">Répétitions</Label>
                  <Input id={`ex-${i}-reps`} name={`ex-${i}-reps`} defaultValue={ex.reps} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`ex-${i}-loadKg`} className="text-xs">Charge (kg)</Label>
                  <Input id={`ex-${i}-loadKg`} name={`ex-${i}-loadKg`} type="number" step="0.5" min={0} defaultValue={last?.loadKg} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`ex-${i}-notes`} className="text-xs">Notes (optionnel)</Label>
                <Input id={`ex-${i}-notes`} name={`ex-${i}-notes`} className="h-8 text-xs" />
              </div>
            </div>
          )
        })}
      </div>
    </CrudDialogShell>
  )
}
