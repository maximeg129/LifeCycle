"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { Target } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'

interface Goals {
  calorieTarget: number
  proteinTarget: number
  carbsTarget: number
  hydrationTargetLiters: number
}

export function NutritionGoalsDialog({ current }: { current: Goals }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const { isSaving, submit } = useCrudSubmit()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const goalsData = {
      calorieTarget: Number(fd.get('calorieTarget')) || 0,
      proteinTarget: Number(fd.get('proteinTarget')) || 0,
      carbsTarget: Number(fd.get('carbsTarget')) || 0,
      hydrationTargetLiters: Number(fd.get('hydrationTargetLiters')) || 0,
      updatedAt: serverTimestamp(),
    }

    const ref = doc(db, `users/${user.uid}/settings/nutrition`)
    const ok = await submit(
      () => setDoc(ref, goalsData, { merge: true }),
      { path: ref.path, operation: 'update', requestResourceData: goalsData }
    )
    if (ok) {
      setOpen(false)
      toast({ title: 'Objectifs mis à jour' })
    }
  }

  return (
    <CrudDialogShell
      title="Objectifs nutritionnels"
      description="Vos cibles quotidiennes."
      trigger={
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Target className="w-4 h-4" /> Objectifs
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      onSubmit={handleSubmit}
      contentClassName="max-w-sm"
    >
      <div className="space-y-2">
        <Label htmlFor="calorieTarget">Calories (kcal)</Label>
        <Input id="calorieTarget" name="calorieTarget" type="number" min={0} defaultValue={current.calorieTarget} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="proteinTarget">Protéines (g)</Label>
          <Input id="proteinTarget" name="proteinTarget" type="number" min={0} defaultValue={current.proteinTarget} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="carbsTarget">Glucides (g)</Label>
          <Input id="carbsTarget" name="carbsTarget" type="number" min={0} defaultValue={current.carbsTarget} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hydrationTargetLiters">Hydratation (L)</Label>
        <Input id="hydrationTargetLiters" name="hydrationTargetLiters" type="number" min={0} step={0.1} defaultValue={current.hydrationTargetLiters} />
      </div>
    </CrudDialogShell>
  )
}
