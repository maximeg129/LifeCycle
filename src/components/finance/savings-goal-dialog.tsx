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
import { type FinanceSettings } from './finance-types'

export function SavingsGoalDialog({ current }: { current: (FinanceSettings & { id: string }) | null }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const savingsGoalLabel = fd.get('label')?.toString().trim() || 'Objectif'
    const savingsGoalAmount = Number(fd.get('amount'))
    if (!savingsGoalAmount || savingsGoalAmount <= 0) {
      toast({ variant: 'destructive', title: 'Indiquez un montant valide' })
      return
    }

    setIsSaving(true)
    const ref = doc(db, `users/${user.uid}/settings/finance`)
    const data = { savingsGoalLabel, savingsGoalAmount, updatedAt: serverTimestamp() }

    try {
      await setDoc(ref, data, { merge: true })
      setOpen(false)
      toast({ title: 'Objectif enregistré', description: `${savingsGoalLabel} — ${savingsGoalAmount}€` })
    } catch {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: data })
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Target className="w-4 h-4" /> {current?.savingsGoalAmount ? "Modifier l'objectif" : 'Définir un objectif'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Objectif d&apos;épargne</DialogTitle>
          <DialogDescription>À quoi épargnez-vous, et combien ?</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-label">Objectif</Label>
            <Input id="goal-label" name="label" placeholder="ex: Nouveau vélo" defaultValue={current?.savingsGoalLabel ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-amount">Montant (€)</Label>
            <Input id="goal-amount" name="amount" type="number" min={1} step={1} defaultValue={current?.savingsGoalAmount ?? ''} required />
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
