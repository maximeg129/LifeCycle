"use client"

import React, { useState, useMemo } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { 
  CookingPot, 
  Droplets, 
  Utensils, 
  Apple, 
  Plus, 
  Flame, 
  ChevronRight,
  Beef,
  Wheat,
  Calendar,
  Search,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2
} from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export default function NutritionPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  
  const [activeTab, setActiveTab] = useState('plan')
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isAddingRecipe, setIsAddingRecipe] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Firestore Recipes
  const recipesPath = user ? `users/${user.uid}/recipes` : null
  const recipesRef = useMemoFirebase(() => {
    if (!recipesPath || !db) return null
    return collection(db, recipesPath)
  }, [db, recipesPath])
  const { data: recipes, isLoading: loadingRecipes } = useCollection(recipesRef)

  const handleAddRecipe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    const title = formData.get('title')?.toString()
    const ingredientsStr = formData.get('ingredients')?.toString() || ""
    const instructions = formData.get('instructions')?.toString() || ""
    const calories = Number(formData.get('calories')) || 0
    const protein = Number(formData.get('protein')) || 0
    const carbs = Number(formData.get('carbs')) || 0

    if (!title) {
      toast({ variant: "destructive", title: "Le titre est requis" })
      setIsSaving(false)
      return
    }

    const ingredients = ingredientsStr.split('\n').filter(i => i.trim() !== "")
    const recipeData = {
      title,
      ingredients,
      instructions,
      calories,
      protein,
      carbs,
      imageHint: "healthy food",
      createdAt: serverTimestamp()
    }

    const recipeRef = doc(collection(db, `users/${user.uid}/recipes`))
    
    setDoc(recipeRef, recipeData)
      .then(() => {
        setIsAddingRecipe(false)
        toast({ title: "Recette ajoutée", description: "Votre livre de cuisine s'agrandit !" })
      })
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: recipeRef.path,
          operation: 'create',
          requestResourceData: recipeData,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSaving(false))
  }

  const handleDeleteRecipe = async (id: string) => {
    if (!user || !db) return
    const recipeRef = doc(db, `users/${user.uid}/recipes`, id)
    
    deleteDoc(recipeRef)
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: recipeRef.path,
          operation: 'delete',
        })
        errorEmitter.emit('permission-error', permissionError)
      })
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Nutrition & Fueling</h2>
            <h1 className="text-3xl font-bold">Plan & Livre de Cuisine</h1>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddingRecipe} onOpenChange={setIsAddingRecipe}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" /> Ajouter une Recette
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Nouvelle Recette</DialogTitle>
                  <DialogDescription>Enregistrez vos créations culinaires dans votre coffre-fort personnel.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddRecipe} className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Titre</Label>
                    <Input id="title" name="title" placeholder="ex: Risotto de Quinoa" required />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="calories">Calories</Label>
                      <Input id="calories" name="calories" type="number" placeholder="450" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="protein">Protéines (g)</Label>
                      <Input id="protein" name="protein" type="number" placeholder="25" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="carbs">Glucides (g)</Label>
                      <Input id="carbs" name="carbs" type="number" placeholder="60" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ingredients">Ingrédients (un par ligne)</Label>
                    <Textarea id="ingredients" name="ingredients" placeholder="100g Quinoa..." rows={4} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="instructions">Instructions</Label>
                    <Textarea id="instructions" name="instructions" placeholder="1. Cuire..." rows={4} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Sauvegarder
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <Tabs defaultValue="plan" onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/40 p-1 rounded-full w-fit mx-auto md:mx-0">
            <TabsTrigger value="plan" className="px-8 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Calendar className="w-4 h-4 mr-2" /> Plan Nutrition
            </TabsTrigger>
            <TabsTrigger value="cookbook" className="px-8 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BookOpen className="w-4 h-4 mr-2" /> Livre de Recettes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-8 animate-in fade-in duration-500">
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="apple-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Flame className="w-3 h-3 text-orange-500" /> Calories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,840 / 2,600</div>
                  <Progress value={70} className="h-1 mt-3" />
                </CardContent>
              </Card>
              <Card className="apple-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Beef className="w-3 h-3 text-red-500" /> Protéines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">120g / 160g</div>
                  <Progress value={75} className="h-1 mt-3 bg-red-500/10" />
                </CardContent>
              </Card>
              <Card className="apple-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Wheat className="w-3 h-3 text-yellow-500" /> Glucides
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">210g / 320g</div>
                  <Progress value={65} className="h-1 mt-3 bg-yellow-500/10" />
                </CardContent>
              </Card>
              <Card className="apple-card border-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] text-muted-foreground uppercase flex items-center gap-2">
                    <Droplets className="w-3 h-3 text-blue-500" /> Hydratation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2.1 / 3.5 L</div>
                  <Progress value={60} className="h-1 mt-3 bg-blue-500/10" />
                </CardContent>
              </Card>
            </section>

            <Card className="apple-card border-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Journal du Jour</CardTitle>
                  <CardDescription>Optimisez votre fueling.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {[
                    { meal: 'Petit-déjeuner', items: 'Oatmeal, Myrtilles', cal: 450, time: '08:15' },
                    { meal: 'Déjeuner', items: 'Poulet, Quinoa, Brocoli', cal: 620, time: '12:30' },
                    { meal: 'Dîner', items: 'Saumon, Patate douce', cal: 560, time: '19:45' }
                  ].map((entry, i) => (
                    <div key={i} className="flex items-center justify-between p-6 hover:bg-muted/30 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/5 text-primary">
                          <Utensils className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold">{entry.meal}</div>
                          <div className="text-xs text-muted-foreground">{entry.items}</div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-6">
                        <div>
                          <div className="font-bold">{entry.cal} kcal</div>
                          <div className="text-[10px] text-muted-foreground">{entry.time}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cookbook" className="space-y-8 animate-in slide-in-from-right duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {loadingRecipes ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="apple-card border-none h-64 animate-pulse bg-muted/20" />
                ))
              ) : recipes?.length === 0 ? (
                <div className="col-span-full py-20 text-center space-y-4">
                  <CookingPot className="w-16 h-16 text-muted-foreground/20 mx-auto" />
                  <p className="text-muted-foreground">Votre livre de cuisine est vide. Commencez par ajouter une recette !</p>
                  <Button variant="outline" onClick={() => setIsAddingRecipe(true)} className="rounded-full">Créer une recette</Button>
                </div>
              ) : (
                recipes?.map((recipe) => (
                  <Card 
                    key={recipe.id} 
                    className="apple-card border-none overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer"
                    onClick={() => { setSelectedRecipe(recipe); setIsDetailOpen(true); }}
                  >
                    <div className="h-48 bg-muted relative">
                      <Image 
                        src={`https://picsum.photos/seed/${recipe.id}/600/400`} 
                        alt={recipe.title}
                        fill
                        className="object-cover"
                        data-ai-hint="healthy food recipe"
                      />
                      <div className="absolute top-3 right-3 flex gap-2">
                         <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-8 w-8 rounded-full bg-white/80 backdrop-blur shadow-sm hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(recipe.id); }}
                         >
                           <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                    </div>
                    <CardContent className="p-5 space-y-3">
                      <h3 className="font-bold text-lg">{recipe.title}</h3>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {recipe.calories} kcal</span>
                        <span className="flex items-center gap-1"><Beef className="w-3 h-3 text-red-500" /> {recipe.protein}g P</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] p-0 overflow-hidden border-none shadow-2xl rounded-[32px]">
          {selectedRecipe && (
            <div className="flex flex-col h-full">
              <div className="h-64 relative shrink-0">
                <Image 
                  src={`https://picsum.photos/seed/${selectedRecipe.id}/800/600`} 
                  alt={selectedRecipe.title} 
                  fill 
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-6 left-8">
                  <h2 className="text-4xl font-bold tracking-tighter">{selectedRecipe.title}</h2>
                </div>
              </div>

              <ScrollArea className="flex-1 px-8 py-6">
                <div className="grid grid-cols-3 gap-6 mb-10">
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Calories</div>
                    <div className="text-2xl font-bold">{selectedRecipe.calories}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-red-500">Protéines</div>
                    <div className="text-2xl font-bold">{selectedRecipe.protein}g</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-yellow-500">Glucides</div>
                    <div className="text-2xl font-bold">{selectedRecipe.carbs}g</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="font-bold text-xl flex items-center gap-3">
                      <Utensils className="w-5 h-5 text-primary" /> Ingrédients
                    </h3>
                    <ul className="space-y-3">
                      {selectedRecipe.ingredients?.map((ing: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-3 text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-bold text-xl flex items-center gap-3">
                      <Clock className="w-5 h-5 text-primary" /> Préparation
                    </h3>
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedRecipe.instructions}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <div className="p-6 bg-muted/20 border-t border-border/40 flex justify-end">
                <Button variant="secondary" onClick={() => setIsDetailOpen(false)} className="rounded-full px-8">Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
