"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { MEAL_TYPE_LABELS, type MealType } from './nutrition-types'
import { type PlannedMeal, type PlannedIngredient } from './meal-plan-types'
import { syncMealLog } from './sync-meal-log'

type WithIdMeal = PlannedMeal & { id: string }

function ingredientsToText(ingredients: PlannedIngredient[]): string {
  return ingredients.map((i) => [i.name, i.quantity || '', i.unit].filter(Boolean).join(', ')).join('\n')
}

function textToIngredients(text: string): PlannedIngredient[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name = '', quantity = '', unit = ''] = line.split(',').map((s) => s.trim())
    return { name, quantity: Number(quantity) || 0, unit }
  }).filter((i) => i.name !== '')
}

interface Props {
  meal: WithIdMeal | null
  weekId: string
  onOpenChange: (open: boolean) => void
}

export function EditMealDialog({ meal, weekId, onOpenChange }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)
  const [mealType, setMealType] = useState<MealType>(meal?.mealType ?? 'lunch')

  React.useEffect(() => {
    if (meal) setMealType(meal.mealType)
  }, [meal])

  if (!meal) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db || !meal.date?.seconds) return

    const fd = new FormData(e.currentTarget)
    const recipeName = fd.get('recipeName')?.toString().trim()
    if (!recipeName) {
      toast({ variant: 'destructive', title: 'Le nom de la recette est requis' })
      return
    }
    const ingredients = textToIngredients(fd.get('ingredients')?.toString() || '')
    const macros = {
      calories: Number(fd.get('calories')) || 0,
      protein: Number(fd.get('protein')) || 0,
      carbs: Number(fd.get('carbs')) || 0,
      fat: Number(fd.get('fat')) || 0,
    }

    setIsSaving(true)
    const mealRef = doc(db, `users/${user.uid}/mealPlans/${weekId}/meals`, meal.id)
    const mealDate = new Date(meal.date.seconds * 1000)

    try {
      const mealLogId = await syncMealLog({
        db, uid: user.uid, mealLogId: meal.mealLogId,
        label: recipeName, mealType, date: mealDate,
        calories: macros.calories, protein: macros.protein, carbs: macros.carbs,
      })

      await updateDoc(mealRef, {
        recipeName, mealType, ingredients, macros,
        status: 'modifie',
        mealLogId,
        confirmedAt: serverTimestamp(),
      })

      toast({ title: 'Repas modifié', description: recipeName })
      onOpenChange(false)
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: mealRef.path, operation: 'update' }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={!!meal} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le repas</DialogTitle>
          <DialogDescription>Ajustez la recette, les quantités ou les macros — utile si vous avez inversé des repas d&apos;un jour sur l&apos;autre.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} key={meal.id} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipeName">Recette *</Label>
              <Input id="recipeName" name="recipeName" defaultValue={meal.recipeName} required />
            </div>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingrédients (un par ligne : nom, quantité, unité)</Label>
            <Textarea id="ingredients" name="ingredients" defaultValue={ingredientsToText(meal.ingredients)} rows={4} placeholder="Poulet, 150, g" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="calories" className="text-xs">Calories</Label>
              <Input id="calories" name="calories" type="number" min={0} defaultValue={meal.macros.calories} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protein" className="text-xs">Protéines (g)</Label>
              <Input id="protein" name="protein" type="number" min={0} defaultValue={meal.macros.protein} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carbs" className="text-xs">Glucides (g)</Label>
              <Input id="carbs" name="carbs" type="number" min={0} defaultValue={meal.macros.carbs} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat" className="text-xs">Lipides (g)</Label>
              <Input id="fat" name="fat" type="number" min={0} defaultValue={meal.macros.fat} />
            </div>
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
