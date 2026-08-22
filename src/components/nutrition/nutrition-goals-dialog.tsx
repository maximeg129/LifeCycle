"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Target, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

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
  const [isSaving, setIsSaving] = useState(false)

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

    setIsSaving(true)
    const ref = doc(db, `users/${user.uid}/settings/nutrition`)
    try {
      await setDoc(ref, goalsData, { merge: true })
      setOpen(false)
      toast({ title: 'Objectifs mis à jour' })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: goalsData }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Target className="w-4 h-4" /> Objectifs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Objectifs nutritionnels</DialogTitle>
          <DialogDescription>Vos cibles quotidiennes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
