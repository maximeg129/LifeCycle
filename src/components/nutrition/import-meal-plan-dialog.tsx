"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { Upload, AlertTriangle, FileJson } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, query, orderBy, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { parseMealPlanJson, getIsoWeekId, getWeekDays, formatIngredientLine, type ParsedRecipe } from './meal-plan-types'

interface ExistingRecipe {
  id: string
  title: string
}

export function ImportMealPlanDialog({ weekStart }: { weekStart: Date }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const { isSaving, submit } = useCrudSubmit()

  const recipesQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/recipes`), orderBy('title'))
  }, [db, user])
  const { data: existingRecipes } = useCollection<{ title: string }>(recipesQuery)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    e.target.value = ''
  }

  /** Reuses an existing recipe by title (case-insensitive) or creates one from the JSON's fiche technique. */
  const upsertRecipe = async (recipe: ParsedRecipe, known: ExistingRecipe[]): Promise<string> => {
    const normalized = recipe.title.trim().toLowerCase()
    const existing = known.find((r) => r.title.trim().toLowerCase() === normalized)
    if (existing) return existing.id

    const recipeRef = doc(collection(db!, `users/${user!.uid}/recipes`))
    await setDoc(recipeRef, {
      title: recipe.title,
      ingredients: recipe.ingredients.map(formatIngredientLine),
      instructions: recipe.instructions,
      calories: recipe.macros.calories,
      protein: recipe.macros.protein,
      carbs: recipe.macros.carbs,
      imageHint: 'healthy food',
      createdAt: serverTimestamp(),
    })
    known.push({ id: recipeRef.id, title: recipe.title }) // avoid re-creating on a duplicate title within the same import
    return recipeRef.id
  }

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    const { meals, recipes, errors: parseErrors } = parseMealPlanJson(text)
    setErrors(parseErrors)

    if (meals.length === 0) {
      if (parseErrors.length === 0) {
        toast({ variant: 'destructive', title: 'Rien à importer', description: 'Collez le JSON du plan de repas.' })
      }
      return
    }

    const weekId = getIsoWeekId(weekStart)
    const weekDays = getWeekDays(weekStart)
    const weekRef = doc(db, `users/${user.uid}/mealPlans/${weekId}`)

    const ok = await submit(async () => {
      await setDoc(weekRef, { userId: user.uid, weekStart: Timestamp.fromDate(weekStart), createdAt: serverTimestamp() }, { merge: true })

      // Upsert every "fiche technique" first, sequentially, so within-import
      // duplicate titles reuse the same freshly-created recipe.
      const known: ExistingRecipe[] = (existingRecipes || []).map((r) => ({ id: r.id, title: r.title }))
      const recipeIdByTitle = new Map<string, string>()
      for (const recipe of recipes) {
        const id = await upsertRecipe(recipe, known)
        recipeIdByTitle.set(recipe.title.trim().toLowerCase(), id)
      }

      await Promise.all(meals.map((meal) => {
        const mealRef = doc(collection(db, `users/${user.uid}/mealPlans/${weekId}/meals`))
        const mealData = {
          userId: user.uid,
          weekId,
          date: Timestamp.fromDate(weekDays[meal.dayIndex]),
          mealType: meal.mealType,
          recipeName: meal.recipeName,
          recipeId: recipeIdByTitle.get(meal.recipeName.trim().toLowerCase()) ?? null,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          macros: meal.macros,
          status: 'propose' as const,
          createdAt: serverTimestamp(),
        }
        return setDoc(mealRef, mealData)
      }))
    }, { path: weekRef.path, operation: 'create' })

    if (ok) {
      const recipeNote = recipes.length > 0 ? `, ${recipes.length} recette(s) dans le livre de cuisine` : ''
      toast({ title: 'Plan importé', description: `${meals.length} repas ajoutés${recipeNote}${parseErrors.length > 0 ? ` (${parseErrors.length} ignorés)` : ''}.` })
      if (parseErrors.length === 0) {
        setOpen(false)
        setText('')
      }
    }
  }

  return (
    <CrudDialogShell
      title="Importer un plan de repas"
      description={
        <>
          Collez le JSON généré par Claude chat, ou importez un fichier. Les recettes (bloc &quot;recettes&quot;)
          sont ajoutées à votre livre de cuisine si elles n&apos;y sont pas déjà (par titre). Chaque import
          ajoute des repas — supprimez les anciens d&apos;abord si vous réimportez la même semaine.
        </>
      }
      trigger={
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Upload className="w-4 h-4" /> Importer plan de la semaine
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      submitLabel="Importer"
      disableSubmit={!text.trim()}
      onSubmit={handleImport}
      contentClassName="max-w-lg max-h-[85vh] overflow-y-auto"
    >
      <div>
        <Label htmlFor="meal-plan-file" className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
          <FileJson className="w-4 h-4" /> Choisir un fichier .json
        </Label>
        <input id="meal-plan-file" type="file" accept="application/json,.json" onChange={handleFileUpload} className="hidden" />
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"semaine_du": "2026-08-24", "recettes": [...], "repas": [...]}'
        rows={10}
        className="font-mono text-xs"
      />

      {errors.length > 0 && (
        <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-1">
          <p className="text-xs font-bold text-yellow-600 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {errors.length} entrée(s) ignorée(s)
          </p>
          <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-5 list-disc">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}
    </CrudDialogShell>
  )
}
