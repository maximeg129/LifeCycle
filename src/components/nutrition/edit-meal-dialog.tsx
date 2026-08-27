"use client"

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
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
  const { isSaving, submit } = useCrudSubmit()
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

    const mealRef = doc(db, `users/${user.uid}/mealPlans/${weekId}/meals`, meal.id)
    const mealDate = new Date(meal.date.seconds * 1000)

    const ok = await submit(async () => {
      const mealLogId = await syncMealLog({
        db, uid: user.uid, mealLogId: meal.mealLogId, recipeId: meal.recipeId,
        label: recipeName, mealType, date: mealDate,
        calories: macros.calories, protein: macros.protein, carbs: macros.carbs,
      })

      await updateDoc(mealRef, {
        recipeName, mealType, ingredients, macros,
        status: 'modifie',
        mealLogId,
        confirmedAt: serverTimestamp(),
      })
    }, { path: mealRef.path, operation: 'update' })

    if (ok) {
      toast({ title: 'Repas modifié', description: recipeName })
      onOpenChange(false)
    }
  }

  return (
    <CrudDialogShell
      key={meal.id}
      title="Modifier le repas"
      description="Ajustez la recette, les quantités ou les macros — utile si vous avez inversé des repas d'un jour sur l'autre."
      open={!!meal}
      onOpenChange={onOpenChange}
      isSaving={isSaving}
      onSubmit={handleSubmit}
      contentClassName="max-w-lg max-h-[85vh] overflow-y-auto"
    >
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
    </CrudDialogShell>
  )
}
