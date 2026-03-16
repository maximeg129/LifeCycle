"use client"

import React, { useState, useRef } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Thermometer,
  Camera,
  Loader2,
  Sparkles
} from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { identifyPlant, type IdentifyPlantOutput } from '@/ai/flows/identify-plant-flow'

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
  const { toast } = useToast()
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<IdentifyPlantOutput | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleScan = async () => {
    if (!previewUrl) return
    setIsScanning(true)
    try {
      const result = await identifyPlant({ photoDataUri: previewUrl })
      setScanResult(result)
      toast({ title: "Analyse terminée", description: `${result.name} identifiée !` })
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'analyser la plante." })
    } finally {
      setIsScanning(false)
    }
  }

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
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Camera className="w-4 h-4 mr-2" /> Scanner Plante AI
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Scanner une Plante</DialogTitle>
                  <DialogDescription>Prenez une photo pour identifier votre plante et obtenir un plan d'arrosage.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-full aspect-video bg-muted rounded-xl flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border">
                    {previewUrl ? (
                      <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                    ) : (
                      <Camera className="w-12 h-12 text-muted-foreground opacity-20" />
                    )}
                  </div>
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                    {previewUrl ? "Changer de photo" : "Prendre / Choisir une photo"}
                  </Button>
                  
                  {previewUrl && !scanResult && (
                    <Button onClick={handleScan} disabled={isScanning} className="w-full bg-primary">
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Analyser avec l'IA
                    </Button>
                  )}

                  {scanResult && (
                    <div className="w-full space-y-4 animate-in fade-in duration-500">
                      <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                        <h4 className="font-bold text-lg text-accent">{scanResult.name}</h4>
                        <p className="text-xs italic text-muted-foreground">{scanResult.species}</p>
                      </div>
                      <div className="space-y-2">
                        <h5 className="text-sm font-bold flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-500" /> Plan d'Hydratation</h5>
                        <p className="text-xs text-muted-foreground">Fréquence : {scanResult.hydrationPlan.frequency}</p>
                        <p className="text-xs text-muted-foreground">{scanResult.hydrationPlan.tips}</p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => { setPreviewUrl(null); setScanResult(null); }}>Réinitialiser</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Ajouter Plante
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
                    <h3 className="font-bold text-lg">{plant.name}</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
                        <span>Santé</span>
                        <span>{plant.health}%</span>
                      </div>
                      <Progress value={plant.health} className="h-1.5" />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-medium">{plant.lastWatered}</span>
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
            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle>Tâches d'Entretien</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {MAINTENANCE_TASKS.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={task.priority === 'urgent' ? "text-red-500" : "text-primary"}>
                          <CheckSquare className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold">{task.task}</div>
                          <div className="text-xs text-muted-foreground">{task.category} • {task.due}</div>
                        </div>
                      </div>
                      <Badge variant={task.priority === 'urgent' ? 'destructive' : 'outline'}>
                        {task.priority.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
