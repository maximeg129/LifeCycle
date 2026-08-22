"use client"

import React, { useState } from 'react'
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
import { MEAL_TYPE_LABELS, type MealType } from './nutrition-types'

interface RecipeOption {
  id: string
  title: string
  calories?: number
  protein?: number
  carbs?: number
}

export function LogMealDialog({ recipes }: { recipes: RecipeOption[] }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [recipeId, setRecipeId] = useState<string>('custom')

  const selectedRecipe = recipes.find((r) => r.id === recipeId)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const label = fd.get('label')?.toString().trim()
    const calories = Number(fd.get('calories')) || 0
    const protein = Number(fd.get('protein')) || 0
    const carbs = Number(fd.get('carbs')) || 0

    if (!label) {
      toast({ variant: 'destructive', title: 'Le nom du repas est requis' })
      return
    }

    setIsSaving(true)
    const mealData = {
      userId: user.uid,
      label,
      mealType,
      recipeId: recipeId !== 'custom' ? recipeId : null,
      calories,
      protein,
      carbs,
      date: Timestamp.fromDate(new Date()),
      createdAt: serverTimestamp(),
    }
    const ref = doc(collection(db, `users/${user.uid}/mealLogs`))

    try {
      await setDoc(ref, mealData)
      setOpen(false)
      setRecipeId('custom')
      toast({ title: 'Repas ajouté', description: `${label} — ${calories} kcal` })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: mealData }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 rounded-full">
          <Plus className="w-4 h-4" /> Ajouter un repas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau repas</DialogTitle>
          <DialogDescription>Depuis une recette de votre livre, ou une saisie libre.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} key={recipeId} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Repas</Label>
              <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((k) => (
                    <SelectItem key={k} value={k}>{MEAL_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Depuis une recette</Label>
              <Select value={recipeId} onValueChange={setRecipeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Saisie libre</SelectItem>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meal-label">Nom *</Label>
            <Input id="meal-label" name="label" defaultValue={selectedRecipe?.title || ''} placeholder="ex: Oatmeal, Myrtilles" required />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meal-calories">Calories</Label>
              <Input id="meal-calories" name="calories" type="number" min={0} defaultValue={selectedRecipe?.calories ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal-protein">Protéines (g)</Label>
              <Input id="meal-protein" name="protein" type="number" min={0} defaultValue={selectedRecipe?.protein ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal-carbs">Glucides (g)</Label>
              <Input id="meal-carbs" name="carbs" type="number" min={0} defaultValue={selectedRecipe?.carbs ?? ''} />
            </div>
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
