"use client"

// Retour utilisateur : "Sur la page aujourd'hui je devrais pouvoir
// Sélectionner une recette du livre de recette pour qu'elle soit ajoutée à
// la consommation du jour." — LogMealDialog savait déjà le faire (un Select
// "Depuis une recette" dans "Ajouter un repas"), mais enterré dans un
// formulaire générique où l'utilisateur ne l'a pas retrouvé. Ici : une
// action en un tap, directement sur l'onglet Aujourd'hui, sans dialogue —
// tap une recette, elle est loggée immédiatement (type de repas déduit de
// l'heure via inferMealType, corrigible en supprimant/re-saisissant comme
// n'importe quelle entrée du Journal du Jour). Le sélecteur dans "Ajouter un
// repas" reste en place pour qui veut choisir le type de repas à la main.

import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { CookingPot, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { MEAL_TYPE_LABELS, inferMealType } from './nutrition-types'
import type { Recipe } from './recipe-types'

export function RecipeQuickLog({ recipes }: { recipes: Recipe[] }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  if (recipes.length === 0) return null

  const handleQuickLog = (recipe: Recipe) => {
    if (!user || !db) return
    const now = new Date()
    const mealType = inferMealType(now)
    const mealData = {
      userId: user.uid,
      label: recipe.title,
      mealType,
      recipeId: recipe.id,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      date: Timestamp.fromDate(now),
      createdAt: serverTimestamp(),
    }
    const ref = doc(collection(db, `users/${user.uid}/mealLogs`))
    setDoc(ref, mealData)
      .then(() => toast({ title: 'Ajouté au journal', description: `${recipe.title} — ${MEAL_TYPE_LABELS[mealType]}` }))
      .catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: mealData }))
      })
  }

  return (
    <Card className="lc-card border-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CookingPot className="w-4 h-4 text-primary" /> Depuis votre livre de recettes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        <div className="flex gap-3 overflow-x-auto px-6 pb-1 -mb-1">
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => handleQuickLog(recipe)}
              className="shrink-0 w-40 text-left rounded-2xl border border-border/60 bg-card p-3 space-y-2 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold leading-snug line-clamp-2">{recipe.title}</span>
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{recipe.calories} kcal</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
