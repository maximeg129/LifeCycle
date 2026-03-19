"use client"

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Leaf,
  Droplets,
  CheckCircle2,
  Plus,
  AlertTriangle,
  Clock,
  Loader2,
  Calendar,
  LayoutGrid,
  Heart,
  RefreshCw,
  History,
  Flower2,
  ShieldAlert,
  Trash2,
  Camera,
  Sparkles
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { identifyPlant } from '@/ai/flows/identify-plant-flow'
import type { IdentifyPlantOutput } from '@/ai/flows/identify-plant-flow'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore'
import { format, addDays, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// --- Utilities ---

function compressImage(dataUri: string, maxSize = 400, quality = 0.65): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUri
  })
}

function getDaysUntilWatering(plant: any): number {
  if (!plant.lastWateringDate?.seconds) return -(plant.wateringFrequencyDays || 7)
  const lastWatered = new Date(plant.lastWateringDate.seconds * 1000)
  const nextWatering = addDays(lastWatered, plant.wateringFrequencyDays || 7)
  return differenceInDays(nextWatering, new Date())
}

function getHealthColor(score: number): string {
  if (score >= 75) return 'text-green-500'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-500'
}

function getHealthLabel(score: number): string {
  if (score >= 75) return 'Saine'
  if (score >= 50) return 'Surveiller'
  return 'Critique'
}

function getHealthStatus(score: number): string {
  if (score >= 75) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

// --- Component ---

export default function HomeManagementPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  const [activeTab, setActiveTab] = useState('dashboard')

  // --- Tasks state ---
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [room, setRoom] = useState("Cuisine")
  const [priority, setPriority] = useState<string>("medium")

  const tasksPath = user ? `users/${user.uid}/tasks` : null
  const tasksQuery = useMemoFirebase(() => {
    if (!tasksPath || !db) return null
    return query(collection(db, tasksPath), where("isActive", "==", true))
  }, [db, tasksPath])
  const { data: tasks, isLoading: loadingTasks } = useCollection(tasksQuery)

  const sortedTasks = useMemo(() => {
    if (!tasks) return []
    return [...tasks].sort((a, b) => {
      const dateA = a.nextDueDate?.seconds || 0
      const dateB = b.nextDueDate?.seconds || 0
      return dateA - dateB
    })
  }, [tasks])

  // --- Plants state ---
  const plantsPath = user ? `users/${user.uid}/plants` : null
  const plantsQuery = useMemoFirebase(() => {
    if (!plantsPath || !db) return null
    return collection(db, plantsPath)
  }, [db, plantsPath])
  const { data: plants, isLoading: loadingPlants } = useCollection(plantsQuery)

  const overdueCount = useMemo(
    () => plants?.filter((p: any) => getDaysUntilWatering(p) < 0).length ?? 0,
    [plants]
  )

  // --- Plant identification state ---
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isIdentifyOpen, setIsIdentifyOpen] = useState(false)
  const [identifyStep, setIdentifyStep] = useState<'photo' | 'confirm'>('photo')
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<IdentifyPlantOutput | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSavingPlant, setIsSavingPlant] = useState(false)
  const [plantNickname, setPlantNickname] = useState('')
  const [plantLocation, setPlantLocation] = useState('Salon')
  const [plantWateringDays, setPlantWateringDays] = useState(7)
  const [plantNotes, setPlantNotes] = useState('')
  const [plantWateringAmount, setPlantWateringAmount] = useState(200)
  const [plantPurchaseDate, setPlantPurchaseDate] = useState('')
  const [plantLastWateringDate, setPlantLastWateringDate] = useState(() => new Date().toISOString().split('T')[0])

  // --- Plant detail state ---
  const [selectedPlant, setSelectedPlant] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [plantAnalyses, setPlantAnalyses] = useState<any[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [reanalysisPreviewUrl, setReanalysisPreviewUrl] = useState<string | null>(null)
  const reanalysisFileInputRef = useRef<HTMLInputElement>(null)

  // --- Task handlers ---
  const handleMarkDone = async (task: any) => {
    if (!user || !db) return
    const now = new Date()
    const nextDue = addDays(now, task.recurrenceDays || 7)
    const taskRef = doc(db, `users/${user.uid}/tasks`, task.id)
    await setDoc(taskRef, {
      lastCompleted: serverTimestamp(),
      nextDueDate: Timestamp.fromDate(nextDue)
    }, { merge: true })
    toast({
      title: "Bien joué !",
      description: `${task.name} reprogrammé pour le ${format(nextDue, 'dd MMM', { locale: fr })}.`
    })
  }

  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    setIsSavingTask(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get('taskName')?.toString()
    const recurrenceDays = Number(formData.get('recurrenceDays')) || 7
    const duration = Number(formData.get('duration')) || 15
    if (!name) {
      toast({ variant: "destructive", title: "Nom requis" })
      setIsSavingTask(false)
      return
    }
    const nextDue = addDays(new Date(), recurrenceDays)
    const newTask = {
      name, room, description: "", estimatedMinutes: duration,
      recurrenceDays, priority, nextDueDate: Timestamp.fromDate(nextDue),
      isActive: true, createdAt: serverTimestamp(), userId: user.uid
    }
    try {
      await setDoc(doc(collection(db, `users/${user.uid}/tasks`)), newTask)
      setIsAddTaskOpen(false)
      toast({ title: "Tâche enregistrée" })
    } catch {
      toast({ variant: "destructive", title: "Erreur lors de l'enregistrement" })
    } finally {
      setIsSavingTask(false)
    }
  }

  // --- Plant handlers ---
  const resetIdentifyDialog = () => {
    setPreviewUrl(null)
    setScanResult(null)
    setIdentifyStep('photo')
    setPlantNickname('')
    setPlantNotes('')
    setPlantLocation('Salon')
    setPlantWateringDays(7)
    setPlantWateringAmount(200)
    setPlantPurchaseDate('')
    setPlantLastWateringDate(new Date().toISOString().split('T')[0])
  }

  const handleScan = async () => {
    if (!previewUrl) return
    setIsScanning(true)
    try {
      const res = await identifyPlant({ photoDataUri: previewUrl })
      setScanResult(res)
      setPlantNickname(res.name)
      const daysMatch = res.hydrationPlan?.frequency?.match(/(\d+)/)
      if (daysMatch) setPlantWateringDays(Number(daysMatch[1]))
      const mlMatch = res.hydrationPlan?.amount?.match(/(\d+)/)
      if (mlMatch) setPlantWateringAmount(Number(mlMatch[1]))
      setIdentifyStep('confirm')
    } catch {
      toast({ variant: "destructive", title: "Erreur d'analyse" })
    } finally {
      setIsScanning(false)
    }
  }

  const handleSavePlant = async () => {
    if (!user || !db || !scanResult) return
    setIsSavingPlant(true)
    try {
      const thumbnail = previewUrl ? await compressImage(previewUrl) : null
      const plantRef = doc(collection(db, `users/${user.uid}/plants`))
      await setDoc(plantRef, {
        nickname: plantNickname || scanResult.name,
        species: scanResult.species,
        location: plantLocation,
        wateringFrequencyDays: plantWateringDays,
        wateringAmountMl: plantWateringAmount,
        lastWateringDate: plantLastWateringDate ? Timestamp.fromDate(new Date(plantLastWateringDate)) : serverTimestamp(),
        purchaseDate: plantPurchaseDate ? Timestamp.fromDate(new Date(plantPurchaseDate)) : null,
        healthScore: scanResult.healthScore,
        healthStatus: getHealthStatus(scanResult.healthScore),
        lastAnalysisAlerts: scanResult.alerts,
        thumbnailUrl: thumbnail,
        notes: plantNotes,
        userId: user.uid,
        createdAt: serverTimestamp()
      })
      await setDoc(doc(collection(db, `users/${user.uid}/plants/${plantRef.id}/analyses`)), {
        ...scanResult,
        photoUrl: thumbnail,
        analyzedAt: serverTimestamp()
      })
      setIsIdentifyOpen(false)
      toast({ title: "Plante ajoutée" })
    } catch {
      toast({ variant: "destructive", title: "Erreur d'enregistrement" })
    } finally {
      setIsSavingPlant(false)
    }
  }

  const handleWater = async (plant: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || !db) return
    await setDoc(doc(db, `users/${user.uid}/plants`, plant.id), { lastWateringDate: serverTimestamp() }, { merge: true })
    toast({ title: "Arrosage enregistré" })
  }

  const handleOpenDetail = async (plant: any) => {
    setSelectedPlant(plant)
    setIsDetailOpen(true)
    setLoadingAnalyses(true)
    try {
      const q = query(collection(db, `users/${user.uid}/plants/${plant.id}/analyses`), orderBy('analyzedAt', 'desc'), limit(5))
      const snap = await getDocs(q)
      setPlantAnalyses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } finally {
      setLoadingAnalyses(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest opacity-70">Gestion Maison</h2>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-gradient">Votre espace personnel</h1>
          </div>
          <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
            <Button onClick={() => setIsAddTaskOpen(true)} className="rounded-full h-14 px-8 bg-primary text-primary-foreground font-bold shadow-2xl shadow-primary/20">
              <Plus className="w-5 h-5 mr-2" /> Nouvelle Tâche
            </Button>
            <DialogContent className="sm:max-w-[480px] rounded-[32px] p-8 border-none shadow-3xl">
              <DialogHeader><DialogTitle className="text-2xl font-bold">Nouvelle routine</DialogTitle></DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Tâche</Label>
                  <Input name="taskName" placeholder="ex: Nettoyer la machine à café..." className="rounded-2xl bg-secondary/50 border-none h-14 px-5" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select value={room} onValueChange={setRoom}><SelectTrigger className="rounded-2xl h-14"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Cuisine", "Salon", "Chambre", "SdB", "Extérieur", "Général"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={priority} onValueChange={setPriority}><SelectTrigger className="rounded-2xl h-14"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Basse</SelectItem><SelectItem value="medium">Moyenne</SelectItem><SelectItem value="high">Haute</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input name="duration" type="number" defaultValue={15} className="rounded-2xl h-14" />
                  <Input name="recurrenceDays" type="number" defaultValue={7} className="rounded-2xl h-14" />
                </div>
                <Button type="submit" className="w-full h-16 rounded-2xl font-bold bg-primary text-white" disabled={isSavingTask}>
                  {isSavingTask ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Planifier"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setPreviewUrl(reader.result as string); reader.readAsDataURL(file) }
        }} />

        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
            <TabsTrigger value="dashboard" className="px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary font-bold">Routine</TabsTrigger>
            <TabsTrigger value="plants" className="relative px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary font-bold">Jardin d'Hiver
              {overdueCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{overdueCount}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loadingTasks ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-[32px] bg-muted/20 animate-pulse" />) : sortedTasks.length === 0 ? (
                <div className="col-span-full py-32 text-center opacity-40"><CheckCircle2 className="w-16 h-16 mx-auto mb-4" /><p className="font-bold uppercase text-xs">Tout est sous contrôle</p></div>
              ) : sortedTasks.map((task) => (
                <Card key={task.id} className="apple-card border-none p-8 flex flex-col justify-between h-full">
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="bg-primary/5 text-primary font-bold rounded-full text-[10px] border-none">{task.room}</Badge>
                      <div className={cn("w-2 h-2 rounded-full", task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-orange-500' : 'bg-green-500')} />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">{task.name}</h3>
                    <div className="flex gap-6 text-[10px] font-bold text-muted-foreground uppercase">
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {task.estimatedMinutes} min</span>
                      <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {task.nextDueDate?.seconds ? format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr }) : 'N/A'}</span>
                    </div>
                  </div>
                  <Button onClick={() => handleMarkDone(task)} className="w-full h-14 rounded-2xl bg-secondary text-foreground hover:bg-primary hover:text-white transition-all font-bold mt-10">Terminer</Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="plants" className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-end">
              <Button onClick={() => { resetIdentifyDialog(); setIsIdentifyOpen(true) }} className="rounded-full h-14 px-8 bg-green-500 text-white font-bold">
                <Camera className="w-5 h-5 mr-2" /> Identification IA
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {loadingPlants ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-80 rounded-[32px] bg-muted/20 animate-pulse" />) : !plants || plants.length === 0 ? (
                <div className="col-span-full py-32 text-center opacity-40"><Flower2 className="w-16 h-16 mx-auto mb-4" /><p className="font-bold uppercase text-xs">Aucune plante suivie</p></div>
              ) : (plants as any[]).map((plant) => {
                const daysUntil = getDaysUntilWatering(plant); const score = plant.healthScore ?? 75
                return (
                  <div key={plant.id} className="apple-card border-none overflow-hidden group cursor-pointer" onClick={() => handleOpenDetail(plant)}>
                    <div className="h-52 relative bg-gradient-to-br from-green-900/30 to-green-700/10">
                      {plant.thumbnailUrl ? <img src={plant.thumbnailUrl} alt={plant.nickname} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" /> : <div className="w-full h-full flex items-center justify-center"><Leaf className="w-16 h-16 text-green-500/30" /></div>}
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                        <Badge className={cn("rounded-full bg-white/95 backdrop-blur font-bold border-none px-3 py-1 text-[10px]", score >= 75 ? 'text-green-600' : score >= 50 ? 'text-orange-500' : 'text-red-500')}>{getHealthLabel(score)}</Badge>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div><h3 className="font-bold text-lg leading-none">{plant.nickname}</h3><p className="text-xs text-muted-foreground mt-1 italic">{plant.species}</p></div>
                      <div className="space-y-1.5"><div className="flex justify-between text-[10px] font-bold uppercase opacity-40"><span>Santé</span><span className={getHealthColor(score)}>{score}%</span></div><Progress value={score} className="h-1" /></div>
                      <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase", daysUntil < 0 ? 'text-red-500' : 'text-muted-foreground')}><Droplets className="w-3.5 h-3.5" />{daysUntil < 0 ? `En retard de ${Math.abs(daysUntil)}j` : `Dans ${daysUntil} jours`}</div>
                      <Button onClick={(e) => handleWater(plant, e)} className="w-full h-11 rounded-2xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white font-bold text-sm">Arroser</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isIdentifyOpen} onOpenChange={(open) => { setIsIdentifyOpen(open); if (!open) resetIdentifyDialog() }}>
        <DialogContent className="sm:max-w-[500px] rounded-[32px] p-8 border-none shadow-3xl">
          <DialogHeader><DialogTitle className="text-2xl font-bold">{identifyStep === 'photo' ? 'Analyse Botanique' : "Confirmer l'ajout"}</DialogTitle></DialogHeader>
          {identifyStep === 'photo' ? (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="w-full aspect-square bg-secondary/30 rounded-[28px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {previewUrl ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center text-muted-foreground/40"><Camera className="w-16 h-16 mx-auto mb-2" /><p className="text-sm font-medium">Prendre une photo</p></div>}
              </div>
              <Button onClick={handleScan} className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold" disabled={isScanning || !previewUrl}>
                {isScanning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />} Identifier
              </Button>
            </div>
          ) : scanResult && (
            <div className="space-y-5">
              <div className="bg-green-500/10 p-4 rounded-2xl space-y-2">
                <p className="font-bold text-lg">{scanResult.name}</p>
                <p className="text-sm italic text-muted-foreground">{scanResult.species}</p>
                <p className="text-sm">{scanResult.healthAnalysis}</p>
              </div>
              <div className="space-y-4">
                <Input value={plantNickname} onChange={e => setPlantNickname(e.target.value)} placeholder="Surnom" className="h-12 rounded-2xl" />
                <Select value={plantLocation} onValueChange={setPlantLocation}><SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Salon", "Cuisine", "Chambre", "Salle de bain", "Balcon", "Jardin"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleSavePlant} className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold" disabled={isSavingPlant}>Ajouter</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) setSelectedPlant(null) }}>
        <DialogContent className="sm:max-w-[560px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden">
          {selectedPlant && (
            <div className="flex flex-col h-full">
              <div className="h-40 relative bg-gradient-to-br from-green-900/40 to-green-700/20">
                {selectedPlant.thumbnailUrl && <img src={selectedPlant.thumbnailUrl} alt={selectedPlant.nickname} className="w-full h-full object-cover opacity-60" />}
                <div className="absolute bottom-4 left-6"><h2 className="text-2xl font-bold">{selectedPlant.nickname}</h2><p className="text-sm text-muted-foreground italic">{selectedPlant.species}</p></div>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-secondary/30 p-4 rounded-2xl flex justify-between items-center"><span className="text-sm font-bold">État de santé</span><span className={cn("text-sm font-bold", getHealthColor(selectedPlant.healthScore ?? 75))}>{selectedPlant.healthScore ?? 75}%</span></div>
                <div className="space-y-2"><p className="text-[10px] font-bold uppercase opacity-40">Historique d'analyses</p>
                  <ScrollArea className="h-40">{loadingAnalyses ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : plantAnalyses.map(a => (
                    <div key={a.id} className="p-3 bg-secondary/20 rounded-xl mb-2 flex justify-between text-xs"><span>{a.analyzedAt?.seconds ? format(new Date(a.analyzedAt.seconds * 1000), 'dd/MM/yy') : '—'}</span><span className={getHealthColor(a.healthScore)}>{a.healthScore}%</span></div>
                  ))}</ScrollArea>
                </div>
                <Button variant="outline" className="w-full h-12 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, `users/${user!.uid}/plants`, selectedPlant.id)); setIsDetailOpen(false); toast({ title: "Plante supprimée" }) }}>Supprimer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
