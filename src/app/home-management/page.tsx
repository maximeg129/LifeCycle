"use client"

import React from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Leaf, 
  Droplets, 
  Home, 
  Wrench, 
  CheckSquare, 
  Plus, 
  AlertTriangle,
  Calendar,
  ChevronRight,
  Wind,
  Sun,
  Thermometer
} from 'lucide-react'
import Image from 'next/image'

const PLANTS = [
  { id: 1, name: "Monstera Deliciosa", lastWatered: "Il y a 8 jours", health: 65, status: "needs-water", location: "Salon" },
  { id: 2, name: "Calathea Orbifolia", lastWatered: "Hier", health: 92, status: "healthy", location: "Chambre" },
  { id: 3, name: "Pothos Argenté", lastWatered: "Il y a 3 jours", health: 88, status: "healthy", location: "Bureau" },
  { id: 4, name: "Ficus Lyrata", lastWatered: "Il y a 12 jours", health: 45, status: "critical", location: "Entrée" },
]

const MAINTENANCE_TASKS = [
  { id: 1, task: "Nettoyer filtre VMC", due: "Dans 2 jours", category: "Technique", priority: "high" },
  { id: 2, task: "Payer loyer / charges", due: "Le 1er du mois", category: "Admin", priority: "medium" },
  { id: 3, task: "Détartrage cafetière", due: "Passé de 5 jours", category: "Cuisine", priority: "urgent" },
  { id: 4, task: "Vérifier détecteur fumée", due: "Dans 15 jours", category: "Sécurité", priority: "low" },
]

export default function HomeManagementPage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">LifeCycle Home</h2>
            <h1 className="text-3xl font-bold">Gestion Maison & Plantes</h1>
          </div>
          <div className="flex gap-2">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Ajouter
            </Button>
            <Button variant="outline" className="border-border hover:bg-muted">
              Historique
            </Button>
          </div>
        </header>

        <Tabs defaultValue="plants" className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1">
            <TabsTrigger value="plants" className="px-6 py-2">
              <Leaf className="w-4 h-4 mr-2 text-green-500" /> Vos Plantes
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="px-6 py-2">
              <Home className="w-4 h-4 mr-2 text-primary" /> Entretien Maison
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plants" className="space-y-8">
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <Droplets className="w-3 h-3 text-blue-500" /> Hydratation Globale
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">74%</div>
                  <Progress value={74} className="h-1.5 mt-2 bg-blue-500/10" />
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-orange-500" /> Alertes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2</div>
                  <p className="text-[10px] text-orange-500 mt-2 font-medium">Soif détectée</p>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <Sun className="w-3 h-3 text-yellow-500" /> Luminosité
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">Optimale</div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Basé sur capteurs (sim.)</p>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                    <Thermometer className="w-3 h-3 text-red-500" /> Température
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-500">24.5°C</div>
                  <p className="text-[10px] text-muted-foreground mt-2">Un peu chaud pour Calathea</p>
                </CardContent>
              </Card>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {PLANTS.map((plant) => (
                <Card key={plant.id} className="bg-card/40 border-border overflow-hidden hover:border-primary/50 transition-all group">
                  <div className="h-40 bg-muted relative">
                    <Image 
                      src={`https://picsum.photos/seed/plant-${plant.id}/400/300`} 
                      alt={plant.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      data-ai-hint="house plant"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant={plant.status === 'healthy' ? 'default' : plant.status === 'critical' ? 'destructive' : 'secondary'}>
                        {plant.status === 'healthy' ? 'Vigoureuse' : plant.status === 'critical' ? 'Urgent' : 'Soif'}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="pt-4 space-y-4">
                    <div>
                      <h3 className="font-bold text-lg">{plant.name}</h3>
                      <p className="text-xs text-muted-foreground">{plant.location}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                        <span>Santé</span>
                        <span>{plant.health}%</span>
                      </div>
                      <Progress value={plant.health} className="h-1.5" />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase">Dernier arrosage</span>
                        <span className="text-xs font-medium">{plant.lastWatered}</span>
                      </div>
                      <Button size="icon" variant="ghost" className="rounded-full text-blue-500 hover:bg-blue-500/10">
                        <Droplets className="w-5 h-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 bg-card/40 border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Calendrier d'Entretien</CardTitle>
                    <CardDescription>Tâches récurrentes et ponctuelles</CardDescription>
                  </div>
                  <Wrench className="w-6 h-6 text-primary" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {MAINTENANCE_TASKS.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-2 rounded-lg",
                            task.priority === 'urgent' ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                          )}>
                            <CheckSquare className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold">{task.task}</div>
                            <div className="text-xs text-muted-foreground">{task.category} • {task.due}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={task.priority === 'urgent' ? 'destructive' : 'outline'}>
                            {task.priority.toUpperCase()}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors cursor-pointer" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wind className="w-5 h-5 text-accent" /> Qualité de l'Air
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center p-4 bg-accent/5 border border-accent/20 rounded-xl">
                      <div className="text-4xl font-bold text-accent">Excellente</div>
                      <p className="text-xs text-muted-foreground mt-1">Dernière mesure : il y a 5 min</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Humidité</span>
                          <span>45%</span>
                        </div>
                        <Progress value={45} className="h-1.5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>CO2</span>
                          <span>420 ppm</span>
                        </div>
                        <Progress value={42} className="h-1.5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" /> Rappels IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                      <p className="text-xs italic text-muted-foreground">
                        "La météo annonce de fortes pluies demain. Pensez à vérifier l'évacuation de la terrasse."
                      </p>
                      <Button variant="link" className="text-primary p-0 h-auto text-[10px] mt-2">Marquer comme fait</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
