"use client"

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
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
  const { isSaving, submit } = useCrudSubmit()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db || !category) return

    const fd = new FormData(e.currentTarget)
    const limitAmount = Number(fd.get('limitAmount'))
    if (!limitAmount || limitAmount <= 0) {
      toast({ variant: 'destructive', title: 'Indiquez un montant valide' })
      return
    }

    const budgetRef = doc(db, `users/${user.uid}/monthlyBudgets/${monthId}`)
    const allocRef = doc(db, `users/${user.uid}/monthlyBudgets/${monthId}/budgetAllocations/${category.id}`)

    const ok = await submit(
      async () => {
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
      },
      { path: allocRef.path, operation: existingAllocation ? 'update' : 'create', requestResourceData: { limitAmount } }
    )
    if (ok) {
      onOpenChange(false)
      toast({ title: 'Budget mis à jour', description: `${category.name} — ${limitAmount}€ / mois` })
    }
  }

  return (
    <CrudDialogShell
      title={`Budget — ${category?.name}`}
      description="Définissez la limite mensuelle pour cette catégorie."
      open={open}
      onOpenChange={onOpenChange}
      isSaving={isSaving}
      onSubmit={handleSubmit}
      contentClassName="max-w-sm"
    >
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
    </CrudDialogShell>
  )
}
