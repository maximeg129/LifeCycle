"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { GOAL_METRIC_LABELS, type GoalMetric, type GoalDirection } from './lifestyle-types'

const DEFAULT_DIRECTION: Record<GoalMetric, GoalDirection> = {
  sleepHours: 'min',
  sleepQuality: 'min',
  hrv: 'min',
  stressScore: 'max',
  mood: 'min',
}

export function AddGoalDialog() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const { isSaving, submit } = useCrudSubmit()
  const [metric, setMetric] = useState<GoalMetric>('sleepHours')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const label = fd.get('label')?.toString().trim()
    const target = Number(fd.get('target'))
    if (!label || !target) {
      toast({ variant: 'destructive', title: 'Nom et cible requis' })
      return
    }

    const goalData = {
      userId: user.uid,
      label,
      metric,
      target,
      direction: DEFAULT_DIRECTION[metric],
      createdAt: serverTimestamp(),
    }
    const ref = doc(collection(db, `users/${user.uid}/healthGoals`))

    const ok = await submit(
      () => setDoc(ref, goalData),
      { path: ref.path, operation: 'create', requestResourceData: goalData }
    )
    if (ok) {
      setOpen(false)
      toast({ title: 'Objectif créé', description: label })
    }
  }

  return (
    <CrudDialogShell
      title="Nouvel objectif"
      description="Suivi automatique sur la moyenne des 7 derniers jours."
      trigger={
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Plus className="w-4 h-4" /> Nouvel objectif
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      submitLabel="Créer"
      onSubmit={handleSubmit}
      contentClassName="max-w-sm"
    >
      <div className="space-y-2">
        <Label htmlFor="goal-label">Nom *</Label>
        <Input id="goal-label" name="label" placeholder="ex: Dormir suffisamment" required />
      </div>
      <div className="space-y-2">
        <Label>Mesure suivie</Label>
        <Select value={metric} onValueChange={(v) => setMetric(v as GoalMetric)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(GOAL_METRIC_LABELS) as GoalMetric[]).map((key) => (
              <SelectItem key={key} value={key}>{GOAL_METRIC_LABELS[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal-target">
          Cible {DEFAULT_DIRECTION[metric] === 'min' ? '(minimum visé)' : '(maximum toléré)'}
        </Label>
        <Input id="goal-target" name="target" type="number" min={0} step={0.1} required />
      </div>
    </CrudDialogShell>
  )
}
