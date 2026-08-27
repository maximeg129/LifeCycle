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
import { type FinanceSettings } from './finance-types'

export function SavingsGoalDialog({ current }: { current: (FinanceSettings & { id: string }) | null }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const { isSaving, submit } = useCrudSubmit()

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

    const ref = doc(db, `users/${user.uid}/settings/finance`)
    const data = { savingsGoalLabel, savingsGoalAmount, updatedAt: serverTimestamp() }

    const ok = await submit(
      () => setDoc(ref, data, { merge: true }),
      { path: ref.path, operation: 'update', requestResourceData: data }
    )
    if (ok) {
      setOpen(false)
      toast({ title: 'Objectif enregistré', description: `${savingsGoalLabel} — ${savingsGoalAmount}€` })
    }
  }

  return (
    <CrudDialogShell
      title="Objectif d'épargne"
      description="À quoi épargnez-vous, et combien ?"
      trigger={
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Target className="w-4 h-4" /> {current?.savingsGoalAmount ? "Modifier l'objectif" : 'Définir un objectif'}
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      onSubmit={handleSubmit}
      contentClassName="max-w-sm"
    >
      <div className="space-y-2">
        <Label htmlFor="goal-label">Objectif</Label>
        <Input id="goal-label" name="label" placeholder="ex: Nouveau vélo" defaultValue={current?.savingsGoalLabel ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal-amount">Montant (€)</Label>
        <Input id="goal-amount" name="amount" type="number" min={1} step={1} defaultValue={current?.savingsGoalAmount ?? ''} required />
      </div>
    </CrudDialogShell>
  )
}
