import React from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Bike, 
  Calendar, 
  CheckSquare, 
  Droplets, 
  Thermometer, 
  TrendingUp,
  Clock,
  ArrowRight,
  Leaf,
  CloudSun
} from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-16 md:mt-0">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Aujourd'hui</h2>
            <h1 className="text-3xl md:text-4xl font-bold">Bonjour, Champion.</h1>
          </div>
          <div className="flex items-center gap-4 bg-card p-3 rounded-xl border border-border">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Conditions Météo</span>
              <span className="font-semibold flex items-center gap-2 italic">
                <Thermometer className="w-4 h-4 text-accent" /> 22°C, Ciel dégagé
              </span>
            </div>
            <Link href="/weather">
              <div className="p-2 bg-accent/20 rounded-lg text-accent hover:bg-accent hover:text-accent-foreground transition-colors">
                <ArrowRight className="w-5 h-5" />
              </div>
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-morphism border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Fitness (CTL)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">84</div>
              <p className="text-xs text-accent flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" /> +2% vs semaine dernière
              </p>
            </CardContent>
          </Card>
          
          <Card className="glass-morphism border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Droplets className="w-4 h-4 text-primary" /> Hydratation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">1.5 / 3 L</div>
              <Progress value={50} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card className="glass-morphism border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" /> Tâches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">3 / 8</div>
              <p className="text-xs text-muted-foreground mt-1">
                Prochain : Nettoyer filtre VMC
              </p>
            </CardContent>
          </Card>

          <Card className="glass-morphism border-none shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Leaf className="w-4 h-4 text-primary" /> Plantes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">2 alertes</div>
              <div className="mt-2 flex gap-1">
                <Badge variant="destructive" className="text-[10px]">Monstera assoiffée</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/40 border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-xl">Entraînement récent</CardTitle>
                  <CardDescription>Vos 3 dernières sorties vélo</CardDescription>
                </div>
                <Link href="/cycling" className="text-primary text-sm hover:underline">Voir tout</Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { title: 'Sortie Seuil Matinale', date: 'Hier', dist: '42 km', dur: '1h20', tss: 95 },
                    { title: 'Endurance de Base', date: 'Mardi', dist: '75 km', dur: '2h45', tss: 120 },
                    { title: 'Intervalles VO2 Max', date: 'Dimanche', dist: '35 km', dur: '1h05', tss: 110 }
                  ].map((ride, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10 text-primary">
                          <Bike className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium">{ride.title}</div>
                          <div className="text-xs text-muted-foreground">{ride.date} • {ride.dist} • {ride.dur}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-primary border-primary/30">
                        {ride.tss} TSS
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Stock Pantry Urgent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: 'Lait d\'Avoine', days: 2, cat: 'Frigo' },
                    { name: 'Épinards Frais', days: 1, cat: 'Frigo' },
                    { name: 'Poulet', days: -1, cat: 'Frigo' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-[10px] text-muted-foreground">{item.cat}</span>
                      </div>
                      <Badge variant={item.days < 0 ? "destructive" : item.days < 3 ? "secondary" : "default"}>
                        {item.days < 0 ? 'Expiré' : `${item.days}j restants`}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Actions Maison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { task: 'Arroser Calathea', type: 'Plante' },
                    { task: 'Payer loyer', type: 'Admin' },
                    { task: 'Graisser chaîne vélo', type: 'Maintenance' }
                  ].map((todo, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded border border-primary/50 flex items-center justify-center text-transparent hover:text-primary hover:bg-primary/10 transition-all cursor-pointer">
                        <CheckSquare className="w-3 h-3" />
                      </div>
                      <span className="text-sm">{todo.task}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="bg-card/40 border-border overflow-hidden">
              <CardHeader className="bg-accent/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CloudSun className="w-5 h-5 text-accent" /> Assistant Météo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-sm text-muted-foreground italic">
                  "Température fraîche aujourd'hui (12°C) avec 15km/h de vent. Pour votre sortie de 2h..."
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg text-xs">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    Maillot thermique Castelli
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg text-xs">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    Gilet coupe-vent Rapha
                  </div>
                </div>
                <Button variant="outline" className="w-full text-accent border-accent/30 hover:bg-accent hover:text-accent-foreground">
                  Configuration Complète
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Statut Matériel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Chaîne (Canyon Ultimate)</span>
                    <span className="text-muted-foreground">3,250 / 4,000 km</span>
                  </div>
                  <Progress value={81} className="h-2" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Plaquettes (Canyon Aeroad)</span>
                    <span className="text-muted-foreground">800 / 2,000 km</span>
                  </div>
                  <Progress value={40} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
