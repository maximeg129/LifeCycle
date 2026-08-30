"use client"

import { useState } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { AuthGuard } from '@/components/layout/auth-guard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CookingPot,
  Droplets,
  Utensils,
  Flame,
  Beef,
  Wheat,
  Calendar,
  BookOpen,
  Trash2,
} from 'lucide-react'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, deleteDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useNutritionData } from '@/components/nutrition/use-nutrition-data'
import { FuelingWidget } from '@/components/nutrition/fueling-widget'
import { LogMealDialog } from '@/components/nutrition/log-meal-dialog'
import { NutritionGoalsDialog } from '@/components/nutrition/nutrition-goals-dialog'
import { RecipeAddDialog } from '@/components/nutrition/recipe-add-dialog'
import { RecipeCard } from '@/components/nutrition/recipe-card'
import { RecipeDetailDialog } from '@/components/nutrition/recipe-detail-dialog'
import type { Recipe } from '@/components/nutrition/recipe-types'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { MEAL_TYPE_LABELS, progressPct } from '@/components/nutrition/nutrition-types'
import { MealPlanWeekView } from '@/components/nutrition/meal-plan-week-view'

export default function NutritionPage() {
  const { user } = useUser()
  const db = useFirestore()

  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Firestore Recipes
  const recipesRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return collection(db, `users/${user.uid}/recipes`)
  }, [db, user])
  const { data: recipes, isLoading: loadingRecipes } = useCollection<Recipe>(recipesRef)
  // Regardé par id plutôt que gardé comme copie locale de son propre état :
  // une modification se reflète immédiatement (le listener temps réel de
  // useCollection la pousse), sans merge manuel après un setDoc réussi.
  const selectedRecipe = recipes?.find((r) => r.id === selectedRecipeId) ?? null

  // Today's nutrition log (meals, hydration, goals)
  const { meals, totals, hydrationLiters, goals, isLoading: loadingNutrition, todayId } = useNutritionData()

  const handleDeleteMeal = async (id: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/mealLogs`, id)
    deleteDoc(ref).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    })
  }

  const handleAddWater = async (liters: number) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/hydrationLogs/${todayId}`)
    setDoc(ref, { userId: user.uid, liters: increment(liters), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update' }))
    })
  }

  const handleDeleteRecipe = async (id: string) => {
    if (!user || !db) return
    const recipeRef = doc(db, `users/${user.uid}/recipes`, id)
    if (selectedRecipeId === id) setIsDetailOpen(false)

    deleteDoc(recipeRef).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: recipeRef.path, operation: 'delete' }))
    })
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <PageHeader
          category="Nutrition & Fueling"
          title="Plan & Livre de Cuisine"
          actions={
            <>
              <NutritionGoalsDialog current={goals} />
              <RecipeAddDialog />
            </>
          }
        />

        <Tabs defaultValue="plan" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/40 p-1 rounded-full w-fit mx-auto md:mx-0">
            <TabsTrigger value="plan" className="px-8 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Utensils className="w-4 h-4 mr-2" /> Aujourd&apos;hui
            </TabsTrigger>
            <TabsTrigger value="cookbook" className="px-8 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BookOpen className="w-4 h-4 mr-2" /> Livre de Recettes
            </TabsTrigger>
            <TabsTrigger value="planning" className="px-8 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4 mr-2" /> Planning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-8 animate-in fade-in duration-500">
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="lc-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Flame className="w-3 h-3 text-orange-500" /> Calories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totals.calories} / {goals.calorieTarget}</div>
                  <Progress value={progressPct(totals.calories, goals.calorieTarget)} className="h-1 mt-3" />
                </CardContent>
              </Card>
              <Card className="lc-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Beef className="w-3 h-3 text-red-500" /> Protéines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totals.protein}g / {goals.proteinTarget}g</div>
                  <Progress value={progressPct(totals.protein, goals.proteinTarget)} className="h-1 mt-3 bg-red-500/10" />
                </CardContent>
              </Card>
              <Card className="lc-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Wheat className="w-3 h-3 text-yellow-500" /> Glucides
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totals.carbs}g / {goals.carbsTarget}g</div>
                  <Progress value={progressPct(totals.carbs, goals.carbsTarget)} className="h-1 mt-3 bg-yellow-500/10" />
                </CardContent>
              </Card>
              <Card className="lc-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Droplets className="w-3 h-3 text-blue-500" /> Hydratation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{hydrationLiters.toFixed(1)} / {goals.hydrationTargetLiters}L</div>
                  <Progress value={progressPct(hydrationLiters, goals.hydrationTargetLiters)} className="h-1 mt-3 bg-blue-500/10" />
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] rounded-full" onClick={() => handleAddWater(0.25)}>+250ml</Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] rounded-full" onClick={() => handleAddWater(0.5)}>+500ml</Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card className="lc-card border-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Journal du Jour</CardTitle>
                  <CardDescription>Optimisez votre fueling.</CardDescription>
                </div>
                <LogMealDialog recipes={(recipes || []).map((r) => ({ id: r.id, title: r.title, calories: r.calories, protein: r.protein, carbs: r.carbs }))} />
              </CardHeader>
              <CardContent className="p-0">
                {loadingNutrition ? (
                  <div className="p-6 space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/20 animate-pulse" />)}
                  </div>
                ) : meals.length === 0 ? (
                  <EmptyState size="compact" icon={Utensils} title="Aucun repas enregistré aujourd'hui." />
                ) : (
                  <div className="divide-y divide-border/40">
                    {meals.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-2xl bg-primary/5 text-primary">
                            <Utensils className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold">{MEAL_TYPE_LABELS[entry.mealType]}</div>
                            <div className="text-xs text-muted-foreground">{entry.label}</div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-6">
                          <div>
                            <div className="font-bold">{entry.calories} kcal</div>
                            <div className="text-[10px] text-muted-foreground">
                              {entry.date?.seconds ? new Date(entry.date.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                            onClick={() => handleDeleteMeal(entry.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cookbook" className="space-y-8 animate-in slide-in-from-right duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {loadingRecipes ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="lc-card border-none h-40 animate-pulse bg-muted/20" />
                ))
              ) : recipes?.length === 0 ? (
                <EmptyState
                  className="col-span-full"
                  icon={CookingPot}
                  title="Votre livre de cuisine est vide"
                  description="Ajoutez une première recette pour la retrouver au moment de logger un repas."
                />
              ) : (
                recipes?.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onOpen={() => { setSelectedRecipeId(recipe.id); setIsDetailOpen(true) }}
                    onDelete={() => handleDeleteRecipe(recipe.id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="planning" className="animate-in fade-in duration-500">
            <MealPlanWeekView />
          </TabsContent>
        </Tabs>

        <FuelingWidget />
      </main>

      <RecipeDetailDialog recipe={selectedRecipe} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </div>
    </AuthGuard>
  )
}
