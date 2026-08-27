"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { GOAL_PRIORITY_LABELS } from './coach-memory-types'

export function AddCoachGoalDialog() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const { isSaving, submit } = useCrudSubmit()
  const [priority, setPriority] = useState('1')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const eventName = fd.get('eventName')?.toString().trim()
    const eventDate = fd.get('eventDate')?.toString()
    if (!eventName || !eventDate) {
      toast({ variant: 'destructive', title: "Nom et date de l'objectif requis" })
      return
    }

    const goalData = {
      userId: user.uid,
      eventName,
      eventDate,
      targetOutcome: fd.get('targetOutcome')?.toString().trim() || '',
      priority: Number(priority),
      createdAt: serverTimestamp(),
    }
    const ref = doc(collection(db, `users/${user.uid}/coachGoals`))

    const ok = await submit(
      () => setDoc(ref, goalData),
      { path: ref.path, operation: 'create', requestResourceData: goalData }
    )
    if (ok) {
      setOpen(false)
      toast({ title: 'Objectif créé', description: eventName })
    }
  }

  return (
    <CrudDialogShell
      title="Nouvel objectif"
      description="Course, sortie ou événement que le coach IA doit garder en tête."
      trigger={
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nouvel objectif
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      submitLabel="Créer"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="goal-event-name">Nom de l&apos;événement *</Label>
        <Input id="goal-event-name" name="eventName" placeholder="ex: La Marmotte" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="goal-event-date">Date *</Label>
          <Input id="goal-event-date" name="eventDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label>Priorité</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(GOAL_PRIORITY_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal-target-outcome">Résultat visé</Label>
        <Textarea id="goal-target-outcome" name="targetOutcome" placeholder="ex: Finir sous les 8h, top 10 catégorie…" rows={2} />
      </div>
    </CrudDialogShell>
  )
}
