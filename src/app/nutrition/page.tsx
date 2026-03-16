"use client"

import React from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Activity,
  Calendar
} from 'lucide-react'

export default function NutritionPage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Nutrition & Fueling</h2>
            <h1 className="text-3xl font-bold">Plan de Nutrition</h1>
          </div>
          <div className="flex gap-2">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Log Repas
            </Button>
            <Button variant="outline" className="border-border hover:bg-muted">
              Planifier la semaine
            </Button>
          </div>
        </header>

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
                  <p className="text-sm italic text-muted-foreground">
                    "Basé sur votre sortie vélo de demain (Sortie Seuil de 2h), je recommande d'augmenter votre apport en glucides ce soir de 40g (environ une portion de riz supplémentaire) pour saturer vos réserves de glycogène."
                  </p>
                  <Button variant="link" className="text-accent p-0 h-auto text-xs">Ajuster mon plan du soir</Button>
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
                    <Badge variant={supp.status === 'Pris' ? 'default' : 'secondary'} className="text-[10px]">
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
                      <Badge variant="destructive" className="h-5">Fond du pot</Badge>
                    </div>
                  </div>
                </div>
                <div className="bg-muted/30 p-4 border-t border-border">
                  <Button variant="outline" className="w-full text-xs">
                    Générer Liste de Courses
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
