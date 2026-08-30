"use client"

// Champs de formulaire partagés entre "Ajouter une recette" (recipe-add-dialog.tsx)
// et l'édition en place dans le détail (recipe-detail-dialog.tsx) — mêmes noms de
// champs, mêmes FormData keys des deux côtés (title/calories/protein/carbs/
// ingredients/instructions), pour que le même code de lecture serve les deux.

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ingredientsToText, type Recipe } from './recipe-types'

export function RecipeFormFields({ recipe }: { recipe?: Recipe }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Titre</Label>
        <Input id="title" name="title" placeholder="ex: Risotto de Quinoa" defaultValue={recipe?.title} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="calories">Calories</Label>
          <Input id="calories" name="calories" type="number" min={0} placeholder="450" defaultValue={recipe?.calories} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="protein">Protéines (g)</Label>
          <Input id="protein" name="protein" type="number" min={0} placeholder="25" defaultValue={recipe?.protein} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="carbs">Glucides (g)</Label>
          <Input id="carbs" name="carbs" type="number" min={0} placeholder="60" defaultValue={recipe?.carbs} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ingredients">Ingrédients (un par ligne)</Label>
        <Textarea id="ingredients" name="ingredients" placeholder="100g Quinoa..." rows={4} defaultValue={ingredientsToText(recipe?.ingredients)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="instructions">Préparation (une étape par ligne, idéalement)</Label>
        <Textarea id="instructions" name="instructions" placeholder="Cuire le quinoa...&#10;Faire revenir les légumes..." rows={4} defaultValue={recipe?.instructions} />
      </div>
    </div>
  )
}
