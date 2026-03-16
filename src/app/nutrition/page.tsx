
"use client"

import React, { useState } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  DialogFooter
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
  Info,
  CheckCircle2
} from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'

export default function NutritionPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('plan')

  const handleAction = (title: string) => {
    toast({
      title: title,
      description: "Cette fonctionnalité sera bientôt connectée à votre base de données réelle.",
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
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" /> Log Repas
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Enregistrer un repas</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="meal-name">Nom du repas</Label>
                    <Input id="meal-name" placeholder="ex: Petit-déjeuner Avoine" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="calories">Estimation Calories (kcal)</Label>
                    <Input id="calories" type="number" placeholder="450" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => handleAction("Repas enregistré")}>Confirmer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="border-border hover:bg-muted" onClick={() => handleAction("Planning hebdomadaire ouvert")}>
              Planifier la semaine
            </Button>
          </div>
        </header>

        <Tabs defaultValue="plan" onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1">
            <TabsTrigger value="plan" className="px-6 py-2">
              <Calendar className="w-4 h-4 mr-2" /> Plan Nutrition
            </TabsTrigger>
            <TabsTrigger value="cookbook" className="px-6 py-2">
              <BookOpen className="w-4 h-4 mr-2" /> Livre de Recettes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-8 animate-in fade-in duration-500">
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <Flame className="w-3 h-3 text-orange-500" /> Calories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">1,840 / 2,600</div>
                  <Progress value={70} className="h-1.5 mt-2" />
                  <p className="text-[10px] text-muted-foreground mt-2">760 kcal restantes</p>
                </CardContent>
              </Card>
              
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <Beef className="w-3 h-3 text-red-500" /> Protéines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">120g / 160g</div>
                  <Progress value={75} className="h-1.5 mt-2 bg-red-500/10" />
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <Wheat className="w-3 h-3 text-yellow-500" /> Glucides
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">210g / 320g</div>
                  <Progress value={65} className="h-1.5 mt-2 bg-yellow-500/10" />
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <Droplets className="w-3 h-3 text-blue-500" /> Hydratation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2.1 / 3.5 L</div>
                  <Progress value={60} className="h-1.5 mt-2 bg-blue-500/10" />
                </CardContent>
              </Card>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-card/40 border-border">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Journal du Jour</CardTitle>
                      <CardDescription>Jeudi 22 Mai</CardDescription>
                    </div>
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {[
                        { meal: 'Petit-déjeuner', items: 'Oatmeal, Myrtilles, Protéine', cal: 450, time: '08:15' },
                        { meal: 'Déjeuner', items: 'Poulet, Quinoa, Brocoli', cal: 620, time: '12:30' },
                        { meal: 'Collation', items: 'Pomme, Beurre d\'amande', cal: 210, time: '16:00' },
                        { meal: 'Dîner', items: 'Saumon, Patate douce, Asperges', cal: 560, time: '19:45' }
                      ].map((entry, i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              <Utensils className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-semibold">{entry.meal}</div>
                              <div className="text-xs text-muted-foreground">{entry.items}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-sm font-medium">{entry.cal} kcal</div>
                              <div className="text-[10px] text-muted-foreground">{entry.time}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/40 border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Apple className="w-5 h-5 text-accent" /> Recommandations AI
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-3">
                      <p className="text-sm italic text-muted-foreground leading-relaxed">
                        "Basé sur votre sortie vélo de demain (Sortie Seuil de 2h), je recommande d'augmenter votre apport en glucides ce soir de 40g (environ une portion de riz supplémentaire) pour saturer vos réserves de glycogène."
                      </p>
                      <Button variant="link" className="text-accent p-0 h-auto text-xs" onClick={() => handleAction("Plan ajusté")}>Ajuster mon plan du soir</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">Suppléments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: 'Multivitamines', status: 'Pris', time: 'Matin' },
                      { name: 'Omega 3', status: 'À prendre', time: 'Soir' },
                      { name: 'Magnésium', status: 'À prendre', time: 'Soir' }
                    ].map((supp, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                        <span className="text-sm font-medium">{supp.name}</span>
                        <Badge 
                          variant={supp.status === 'Pris' ? 'default' : 'secondary'} 
                          className="text-[10px] cursor-pointer"
                          onClick={() => handleAction(`${supp.name} marqué comme pris`)}
                        >
                          {supp.status}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-lg overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Pantry / Stock</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="px-6 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-3 tracking-wider">Urgent - Fin de stock</p>
                      <div className="space-y-3 pb-4">
                        <div className="flex justify-between items-center text-sm">
                          <span>Lait d'Avoine</span>
                          <Badge variant="destructive" className="h-5">1/2 L</Badge>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span>Beurre d'Amande</span>
                          <Badge variant="destructive" className="h-5">Bas</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/30 p-4 border-t border-border">
                      <Button variant="outline" className="w-full text-xs" onClick={() => handleAction("Liste de courses générée")}>
                        Générer Liste de Courses
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cookbook" className="space-y-8 animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Input placeholder="Rechercher une recette..." className="pl-10" />
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="ml-4">
                    <Plus className="w-4 h-4 mr-2" /> Nouvelle Recette
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Ajouter au Livre de Cuisine</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Titre de la recette</Label>
                      <Input id="title" placeholder="ex: Risotto de Quinoa aux Champignons" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ingredients">Ingrédients (un par ligne)</Label>
                      <Textarea id="ingredients" placeholder="100g Quinoa..." />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="instructions">Instructions</Label>
                      <Textarea id="instructions" placeholder="1. Cuire le quinoa..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => handleAction("Recette ajoutée")}>Sauvegarder</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[
                { id: 1, title: "Pâtes au Pesto de Kale", cal: 520, time: "15 min", type: "Performance", image: "https://picsum.photos/seed/recipe1/400/300" },
                { id: 2, title: "Bol de Poké Saumon", cal: 480, time: "20 min", type: "Récupération", image: "https://picsum.photos/seed/recipe2/400/300" },
                { id: 3, title: "Oatmeal Protéiné", cal: 410, time: "10 min", type: "Énergie", image: "https://picsum.photos/seed/recipe3/400/300" },
                { id: 4, title: "Salade de Lentilles & Feta", cal: 390, time: "15 min", type: "Santé", image: "https://picsum.photos/seed/recipe4/400/300" },
              ].map((recipe) => (
                <Card key={recipe.id} className="bg-card/40 border-border overflow-hidden group hover:border-primary transition-all cursor-pointer">
                  <div className="h-48 bg-muted relative">
                    <Image 
                      src={recipe.image} 
                      alt={recipe.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-background/80 backdrop-blur text-foreground border-none">
                        {recipe.type}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="pt-4 space-y-3">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{recipe.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {recipe.cal} kcal</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {recipe.time}</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t border-border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Voir Détails</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
