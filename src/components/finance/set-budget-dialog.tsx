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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { type ExpenseCategory, type BudgetAllocation } from './finance-types'

type WithIdCategory = ExpenseCategory & { id: string }
type WithIdAllocation = BudgetAllocation & { id: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: WithIdCategory | null
  monthId: string
  existingAllocation?: WithIdAllocation
}

export function SetBudgetDialog({ open, onOpenChange, category, monthId, existingAllocation }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db || !category) return

    const fd = new FormData(e.currentTarget)
    const limitAmount = Number(fd.get('limitAmount'))
    if (!limitAmount || limitAmount <= 0) {
      toast({ variant: 'destructive', title: 'Indiquez un montant valide' })
      return
    }

    setIsSaving(true)
    const budgetRef = doc(db, `users/${user.uid}/monthlyBudgets/${monthId}`)
    const allocRef = doc(db, `users/${user.uid}/monthlyBudgets/${monthId}/budgetAllocations/${category.id}`)

    try {
      // Ensure the parent monthlyBudgets doc exists before writing the allocation.
      await setDoc(budgetRef, { userId: user.uid, month: monthId, createdAt: serverTimestamp() }, { merge: true })

      await setDoc(allocRef, {
        userId: user.uid,
        monthlyBudgetId: monthId,
        categoryId: category.id,
        categoryName: category.name,
        icon: category.icon,
        color: category.color,
        limitAmount,
        ...(existingAllocation ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      }, { merge: true })

      // Recompute the month's total from all allocations, so overview cards stay in sync.
      const allocsSnap = await getDocs(collection(db, `users/${user.uid}/monthlyBudgets/${monthId}/budgetAllocations`))
      const total = allocsSnap.docs.reduce((sum, d) => sum + (d.data().limitAmount || 0), 0)
      await setDoc(budgetRef, { totalLimit: total, updatedAt: serverTimestamp() }, { merge: true })

      onOpenChange(false)
      toast({ title: 'Budget mis à jour', description: `${category.name} — ${limitAmount}€ / mois` })
    } catch {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({ path: allocRef.path, operation: existingAllocation ? 'update' : 'create', requestResourceData: { limitAmount } })
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Budget — {category?.name}</DialogTitle>
          <DialogDescription>Définissez la limite mensuelle pour cette catégorie.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="limitAmount">Limite mensuelle (€)</Label>
            <Input
              id="limitAmount"
              name="limitAmount"
              type="number"
              min={1}
              step={1}
              defaultValue={existingAllocation?.limitAmount ?? ''}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
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
