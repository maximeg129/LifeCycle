"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { type ExpenseCategory } from './finance-types'
import { AddCategoryDialog } from './add-category-dialog'

type WithIdCategory = ExpenseCategory & { id: string }

export function AddExpenseDialog({ categories }: { categories: WithIdCategory[] }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? '')

  // Keep the selected category valid as the list loads/changes.
  React.useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id)
  }, [categories, categoryId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const label = fd.get('label')?.toString().trim()
    const amount = Number(fd.get('amount'))
    const dateStr = fd.get('date')?.toString()
    const category = categories.find((c) => c.id === categoryId)

    if (!label || !amount || amount <= 0) {
      toast({ variant: 'destructive', title: 'Libellé et montant requis' })
      return
    }
    if (!category) {
      toast({ variant: 'destructive', title: 'Choisissez une catégorie' })
      return
    }

    setIsSaving(true)
    const expenseData = {
      userId: user.uid,
      label,
      amount,
      categoryId: category.id,
      categoryName: category.name,
      date: Timestamp.fromDate(dateStr ? new Date(dateStr) : new Date()),
      createdAt: serverTimestamp(),
    }
    const ref = doc(collection(db, `users/${user.uid}/expenses`))

    try {
      await setDoc(ref, expenseData)
      setOpen(false)
      toast({ title: 'Dépense enregistrée', description: `${label} — ${amount.toFixed(2)}€` })
    } catch {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: expenseData })
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full h-11 px-6 font-bold gap-2">
          <Plus className="w-4 h-4" /> Nouvelle dépense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle dépense</DialogTitle>
          <DialogDescription>Enregistrez une dépense dans une catégorie.</DialogDescription>
        </DialogHeader>

        {categories.length === 0 ? (
          <div className="py-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Créez d&apos;abord une catégorie pour classer vos dépenses.</p>
            <AddCategoryDialog />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exp-label">Libellé *</Label>
              <Input id="exp-label" name="label" placeholder="ex: Chambre à air Continental" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Montant (€) *</Label>
                <Input id="exp-amount" name="amount" type="number" min={0.01} step={0.01} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Date</Label>
                <Input id="exp-date" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
