"use client"

import React from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Bike, 
  Settings, 
  Wrench, 
  History, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Gauge
} from 'lucide-react'

export default function CyclingHub() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Performance</h2>
            <h1 className="text-3xl font-bold">LifeCycle Vault</h1>
          </div>
          <div className="flex gap-2">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Activité
            </Button>
            <Button variant="outline" className="border-border hover:bg-muted">
              Import .FIT
            </Button>
          </div>
        </header>

        <Tabs defaultValue="training" className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 h-auto grid grid-cols-2 max-w-md">
            <TabsTrigger value="training" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              <Activity className="w-4 h-4 mr-2" /> Entraînement
            </TabsTrigger>
            <TabsTrigger value="gear" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6 py-2">
              <Wrench className="w-4 h-4 mr-2" /> Matériel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="space-y-8">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase">Fitness (CTL)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">84</div>
                  <div className="mt-2 flex items-center text-xs text-accent">
                    <TrendingUp className="w-3 h-3 mr-1" /> En progression stable
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase">Fatigue (ATL)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">62</div>
                  <Progress value={62} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-card/40 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground uppercase">Forme (TSB)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-accent">+22</div>
                  <div className="mt-2 flex items-center text-xs text-muted-foreground">
                    Prêt pour un effort intense
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle>Journal d'activités</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {[
                    { name: 'Sortie Seuil', date: 'Hier', dist: '45.2 km', power: '245W', time: '1h24' },
                    { name: 'Endurance', date: '21 Mai', dist: '82.0 km', power: '185W', time: '2h55' },
                    { name: 'Côtes du Vexin', date: '19 Mai', dist: '65.5 km', power: '220W', time: '2h15' }
                  ].map((ride, i) => (
                    <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Bike className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold">{ride.name}</div>
                          <div className="text-xs text-muted-foreground">{ride.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="hidden md:flex flex-col items-end">
                          <span className="text-sm font-medium">{ride.dist}</span>
                          <span className="text-[10px] text-muted-foreground">Distance</span>
                        </div>
                        <div className="hidden md:flex flex-col items-end">
                          <span className="text-sm font-medium">{ride.power}</span>
                          <span className="text-[10px] text-muted-foreground">Puis. Moy</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium">{ride.time}</span>
                          <span className="text-[10px] text-muted-foreground">Durée</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gear" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Bike className="w-6 h-6 text-primary" /> Vos Vélos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-card/40 border-border overflow-hidden group hover:border-primary/50 transition-all">
                      <div className="h-32 bg-muted relative">
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Badge className="bg-accent/20 text-accent border-accent/20">Route</Badge>
                        </div>
                      </div>
                      <CardContent className="pt-4">
                        <h4 className="font-bold text-lg">Canyon Ultimate CF SLX</h4>
                        <p className="text-xs text-muted-foreground mb-4">Total: 8,420 km</p>
                        <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                          Gérer les composants <ChevronRight className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                    <Card className="bg-card/40 border-border overflow-hidden group hover:border-primary/50 transition-all">
                      <div className="h-32 bg-muted relative">
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Badge className="bg-primary/20 text-primary border-primary/20">VTT</Badge>
                        </div>
                      </div>
                      <CardContent className="pt-4">
                        <h4 className="font-bold text-lg">Specialized Epic Evo</h4>
                        <p className="text-xs text-muted-foreground mb-4">Total: 2,150 km</p>
                        <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                          Gérer les composants <ChevronRight className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Zap className="w-6 h-6 text-accent" /> Alertes Maintenance
                  </h3>
                  <div className="space-y-3">
                    {[
                      { item: 'Chaîne (Canyon Ultimate)', km: 3250, limit: 4000, status: 'warning' },
                      { item: 'Plaquettes Avant (Specialized)', km: 1800, limit: 2000, status: 'urgent' },
                      { item: 'Pneus GP5000 (Canyon)', km: 4500, limit: 5000, status: 'warning' }
                    ].map((maint, i) => (
                      <div key={i} className="flex flex-col gap-2 p-4 bg-card/40 border border-border rounded-xl">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{maint.item}</span>
                          <Badge variant={maint.status === 'urgent' ? 'destructive' : 'secondary'}>
                            {maint.status === 'urgent' ? 'Remplacer' : 'Surveiller'}
                          </Badge>
                        </div>
                        <Progress value={(maint.km / maint.limit) * 100} className="h-2" />
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-tight">
                          <span>Usage: {maint.km} km</span>
                          <span>Limite: {maint.limit} km</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-primary" /> Pression Pneus
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Poids Cycliste</label>
                          <Input type="number" defaultValue={75} className="h-8" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Largeur Pneu</label>
                          <Input type="number" defaultValue={28} className="h-8" />
                        </div>
                      </div>
                      <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                        Calculer Pression
                      </Button>
                    </div>
                    <div className="pt-6 border-t border-border grid grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xl font-bold">5.2</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Avant (Bar)</div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-xl font-bold">5.4</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Arrière (Bar)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5 text-primary" /> Derniers Coûts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { item: 'Chaîne Shimano 11v', price: '45€', date: '20 Mai' },
                      { item: 'Plaquettes Organiques', price: '18€', date: '12 Mai' },
                      { item: 'Lubrifiant SQUIRT', price: '12€', date: '05 Mai' }
                    ].map((cost, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                        <div>
                          <div className="text-sm font-medium">{cost.item}</div>
                          <div className="text-[10px] text-muted-foreground">{cost.date}</div>
                        </div>
                        <div className="font-bold text-accent">{cost.price}</div>
                      </div>
                    ))}
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
