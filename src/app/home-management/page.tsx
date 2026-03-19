"use client"

import React, { useState, useMemo, useRef } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Leaf,
  Droplets,
  CheckCircle2,
  Plus,
  Clock,
  Loader2,
  Calendar,
  Flower2,
  Camera,
  Sparkles,
  Trash2,
  AlertTriangle,
  Heart,
  Info
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
  const [isAddPlantOpen, setIsAddPlantOpen] = useState(false)
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
  const resetAddPlantDialog = () => {
    setPreviewUrl(null)
    setScanResult(null)
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
      // scroll to results — no step change needed in unified flow
    } catch {
      toast({ variant: "destructive", title: "Erreur d'analyse" })
    } finally {
      setIsScanning(false)
    }
  }

  const handleSavePlant = async () => {
    if (!user || !db) return
    if (!plantNickname.trim()) {
      toast({ variant: "destructive", title: "Un surnom est requis" })
      return
    }
    setIsSavingPlant(true)
    try {
      const thumbnail = previewUrl ? await compressImage(previewUrl) : null
      const plantRef = doc(collection(db, `users/${user.uid}/plants`))
      const plantData = {
        nickname: plantNickname,
        species: scanResult?.species ?? '',
        location: plantLocation,
        wateringFrequencyDays: plantWateringDays,
        wateringAmountMl: plantWateringAmount,
        lastWateringDate: plantLastWateringDate ? Timestamp.fromDate(new Date(plantLastWateringDate)) : serverTimestamp(),
        purchaseDate: plantPurchaseDate ? Timestamp.fromDate(new Date(plantPurchaseDate)) : null,
        healthScore: scanResult?.healthScore ?? 75,
        healthStatus: getHealthStatus(scanResult?.healthScore ?? 75),
        lastAnalysisAlerts: scanResult?.alerts ?? [],
        thumbnailUrl: thumbnail,
        notes: plantNotes,
        userId: user.uid,
        createdAt: serverTimestamp()
      }
      await setDoc(plantRef, plantData)
      if (scanResult) {
        await setDoc(doc(collection(db, `users/${user.uid}/plants/${plantRef.id}/analyses`)), {
          ...scanResult,
          photoUrl: thumbnail,
          analyzedAt: serverTimestamp()
        })
      }
      setIsAddPlantOpen(false)
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
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddTaskOpen(true)} className="rounded-full h-14 px-8 bg-primary text-primary-foreground font-bold shadow-2xl shadow-primary/20 transition-all hover:scale-105">
                <Plus className="w-5 h-5 mr-2" /> Nouvelle Tâche
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] rounded-[32px] p-8 border-none shadow-3xl">
              <DialogHeader><DialogTitle className="text-2xl font-bold">Nouvelle routine</DialogTitle></DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Tâche</Label>
                  <Input name="taskName" placeholder="ex: Nettoyer la machine à café..." className="rounded-2xl bg-secondary/50 border-none h-14 px-5" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Pièce</Label>
                    <Select value={room} onValueChange={setRoom}>
                      <SelectTrigger className="rounded-2xl h-14"><SelectValue /></SelectTrigger>
                      <SelectContent>{["Cuisine", "Salon", "Chambre", "SdB", "Extérieur", "Général"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Priorité</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="rounded-2xl h-14"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="low">Basse</SelectItem><SelectItem value="medium">Moyenne</SelectItem><SelectItem value="high">Haute</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Durée (min)</Label>
                    <Input name="duration" type="number" defaultValue={15} className="rounded-2xl h-14" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Récurrence (jours)</Label>
                    <Input name="recurrenceDays" type="number" defaultValue={7} className="rounded-2xl h-14" />
                  </div>
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
            <TabsTrigger value="dashboard" className="px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary font-bold transition-all">Routine</TabsTrigger>
            <TabsTrigger value="plants" className="relative px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary font-bold transition-all">Jardin d'Hiver
              {overdueCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center animate-pulse shadow-lg">{overdueCount}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loadingTasks ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-[32px] bg-muted/20 animate-pulse" />) : sortedTasks.length === 0 ? (
                <div className="col-span-full py-32 text-center opacity-40"><CheckCircle2 className="w-16 h-16 mx-auto mb-4" /><p className="font-bold uppercase text-xs tracking-widest">Tout est sous contrôle</p></div>
              ) : sortedTasks.map((task) => (
                <Card key={task.id} className="apple-card border-none p-8 flex flex-col justify-between h-full">
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="bg-primary/5 text-primary font-bold rounded-full text-[10px] border-none px-3 py-1 uppercase tracking-wider">{task.room}</Badge>
                      <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-orange-500' : 'bg-green-500')} />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">{task.name}</h3>
                    <div className="flex gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 opacity-60" /> {task.estimatedMinutes} min</span>
                      <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 opacity-60" /> {task.nextDueDate?.seconds ? format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr }) : 'N/A'}</span>
                    </div>
                  </div>
                  <Button onClick={() => handleMarkDone(task)} className="w-full h-14 rounded-2xl bg-secondary text-foreground hover:bg-primary hover:text-white transition-all font-bold mt-10">Terminer</Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="plants" className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-end">
              <Button onClick={() => { resetAddPlantDialog(); setIsAddPlantOpen(true) }} className="rounded-full h-14 px-8 bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:scale-105 transition-all">
                <Plus className="w-5 h-5 mr-2" /> Ajouter une plante
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {loadingPlants ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-80 rounded-[32px] bg-muted/20 animate-pulse" />) : !plants || plants.length === 0 ? (
                <div className="col-span-full py-32 text-center opacity-40"><Flower2 className="w-16 h-16 mx-auto mb-4" /><p className="font-bold uppercase text-xs tracking-widest">Aucune plante suivie</p></div>
              ) : (plants as any[]).map((plant) => {
                const daysUntil = getDaysUntilWatering(plant); const score = plant.healthScore ?? 75
                return (
                  <div key={plant.id} className="apple-card border-none overflow-hidden group cursor-pointer" onClick={() => handleOpenDetail(plant)}>
                    <div className="h-52 relative bg-gradient-to-br from-green-900/30 to-green-700/10">
                      {plant.thumbnailUrl ? <img src={plant.thumbnailUrl} alt={plant.nickname} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" /> : <div className="w-full h-full flex items-center justify-center"><Leaf className="w-16 h-16 text-green-500/30" /></div>}
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                        <Badge className={cn("rounded-full bg-white/95 backdrop-blur font-bold border-none px-3 py-1 text-[10px] shadow-sm", score >= 75 ? 'text-green-600' : score >= 50 ? 'text-orange-500' : 'text-red-500')}>{getHealthLabel(score)}</Badge>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div><h3 className="font-bold text-lg leading-none">{plant.nickname}</h3><p className="text-xs text-muted-foreground mt-1 italic">{plant.species}</p></div>
                      <div className="space-y-1.5"><div className="flex justify-between text-[10px] font-bold uppercase opacity-40"><span>Santé</span><span className={getHealthColor(score)}>{score}%</span></div><Progress value={score} className="h-1" /></div>
                      <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest", daysUntil < 0 ? 'text-red-500' : 'text-muted-foreground')}><Droplets className="w-3.5 h-3.5" />{daysUntil < 0 ? `En retard de ${Math.abs(daysUntil)}j` : `Dans ${daysUntil} jours`}</div>
                      <Button onClick={(e) => handleWater(plant, e)} className="w-full h-11 rounded-2xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white font-bold text-sm transition-all shadow-sm">Arroser</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isAddPlantOpen} onOpenChange={(open) => { setIsAddPlantOpen(open); if (!open) resetAddPlantDialog() }}>
        <DialogContent className="sm:max-w-[540px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-8 pt-8 pb-4 shrink-0">
            <DialogTitle className="text-2xl font-bold">Ajouter une plante</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-8 pb-8 space-y-6">

              {/* Photo + AI identification zone */}
              <div className="space-y-3">
                <div
                  className="w-full h-52 bg-secondary/30 rounded-[24px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border cursor-pointer transition-all hover:bg-secondary/50 group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl
                    ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    : (
                      <div className="text-center text-muted-foreground/40 group-hover:scale-105 transition-transform">
                        <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">Appuyer pour ajouter une photo</p>
                        <p className="text-xs opacity-60 mt-1">Optionnel · Permet l'identification IA</p>
                      </div>
                    )
                  }
                  {previewUrl && (
                    <div className="absolute bottom-3 right-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                        className="bg-black/60 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-black/80 transition-all"
                      >
                        Changer
                      </button>
                    </div>
                  )}
                </div>

                {previewUrl && (
                  <Button
                    onClick={handleScan}
                    className="w-full h-12 rounded-2xl bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white font-bold border border-green-500/20 transition-all"
                    disabled={isScanning}
                  >
                    {isScanning
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyse en cours…</>
                      : <><Sparkles className="w-4 h-4 mr-2" /> Identifier avec l'IA</>
                    }
                  </Button>
                )}
              </div>

              {/* AI Results */}
              {scanResult && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-400">
                  <div className="bg-green-500/8 border border-green-500/20 rounded-[20px] p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-lg text-green-400 leading-tight">{scanResult.name}</p>
                        <p className="text-xs italic text-muted-foreground mt-0.5">{scanResult.species}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-2xl font-bold", getHealthColor(scanResult.healthScore))}>{scanResult.healthScore}%</span>
                        <span className="text-[10px] uppercase font-bold opacity-40">Santé</span>
                      </div>
                    </div>

                    <Progress value={scanResult.healthScore} className="h-1.5" />

                    <p className="text-sm leading-relaxed text-muted-foreground">{scanResult.healthAnalysis}</p>

                    {scanResult.alerts.length > 0 && (
                      <div className="space-y-1.5">
                        {scanResult.alerts.map((alert, i) => (
                          <div key={i} className="flex items-start gap-2 text-orange-400 text-xs font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{alert}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Separator className="opacity-20" />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-500/10 rounded-2xl p-3 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Arrosage</p>
                        <p className="text-sm font-bold text-blue-400">{scanResult.hydrationPlan.frequency}</p>
                        <p className="text-xs text-muted-foreground">{scanResult.hydrationPlan.amount}</p>
                      </div>
                      <div className="bg-secondary/40 rounded-2xl p-3 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Conseil eau</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{scanResult.hydrationPlan.tips}</p>
                      </div>
                    </div>

                    {scanResult.generalCare.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Entretien</p>
                        {scanResult.generalCare.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-muted-foreground text-xs">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator className="opacity-20" />

              {/* Plant details form */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Détails de la plante</p>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Surnom *</Label>
                  <Input
                    value={plantNickname}
                    onChange={e => setPlantNickname(e.target.value)}
                    placeholder="ex: Mon Monstera, Ficus du salon…"
                    className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Emplacement</Label>
                    <Select value={plantLocation} onValueChange={setPlantLocation}>
                      <SelectTrigger className="h-12 rounded-2xl bg-secondary/50 border-none px-5"><SelectValue /></SelectTrigger>
                      <SelectContent>{["Salon", "Cuisine", "Chambre", "Salle de bain", "Balcon", "Jardin"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Fréquence (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={plantWateringDays}
                      onChange={e => setPlantWateringDays(Number(e.target.value))}
                      className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Quantité (ml)</Label>
                    <Input
                      type="number"
                      min={10}
                      step={10}
                      value={plantWateringAmount}
                      onChange={e => setPlantWateringAmount(Number(e.target.value))}
                      className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Dernier arrosage</Label>
                    <Input
                      type="date"
                      value={plantLastWateringDate}
                      onChange={e => setPlantLastWateringDate(e.target.value)}
                      className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Date d'acquisition</Label>
                  <Input
                    type="date"
                    value={plantPurchaseDate}
                    onChange={e => setPlantPurchaseDate(e.target.value)}
                    className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Notes</Label>
                  <Textarea
                    value={plantNotes}
                    onChange={e => setPlantNotes(e.target.value)}
                    placeholder="Observations, emplacement précis…"
                    className="rounded-2xl bg-secondary/50 border-none px-5 py-3 min-h-[80px] resize-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleSavePlant}
                className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all"
                disabled={isSavingPlant}
              >
                {isSavingPlant ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Leaf className="w-5 h-5 mr-2" />}
                Ajouter au jardin
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) setSelectedPlant(null) }}>
        <DialogContent className="sm:max-w-[560px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden">
          {selectedPlant && (
            <div className="flex flex-col h-full">
              <div className="h-48 relative bg-gradient-to-br from-green-900/40 to-green-700/20">
                {selectedPlant.thumbnailUrl && <img src={selectedPlant.thumbnailUrl} alt={selectedPlant.nickname} className="w-full h-full object-cover opacity-60" />}
                <div className="absolute bottom-6 left-8">
                  <h2 className="text-3xl font-bold tracking-tight">{selectedPlant.nickname}</h2>
                  <p className="text-sm text-muted-foreground italic opacity-80">{selectedPlant.species}</p>
                </div>
              </div>
              <div className="p-8 space-y-8">
                <div className="bg-secondary/30 p-5 rounded-2xl flex justify-between items-center border border-border/40">
                  <span className="text-sm font-bold opacity-60">État de santé</span>
                  <span className={cn("text-lg font-bold", getHealthColor(selectedPlant.healthScore ?? 75))}>{selectedPlant.healthScore ?? 75}%</span>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Historique d'analyses</p>
                  <ScrollArea className="h-48 pr-4">
                    {loadingAnalyses ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin opacity-20" /></div>
                    ) : plantAnalyses.map(a => (
                      <div key={a.id} className="p-4 bg-secondary/20 rounded-2xl mb-3 flex justify-between items-center border border-border/20">
                        <span className="text-sm font-medium">{a.analyzedAt?.seconds ? format(new Date(a.analyzedAt.seconds * 1000), 'dd MMM yyyy', { locale: fr }) : '—'}</span>
                        <Badge variant="outline" className={cn("border-none bg-background/50", getHealthColor(a.healthScore))}>{a.healthScore}%</Badge>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1 h-14 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/10 font-bold" onClick={async (e) => { 
                    e.stopPropagation(); 
                    if (!user) return;
                    await deleteDoc(doc(db, `users/${user.uid}/plants`, selectedPlant.id)); 
                    setIsDetailOpen(false); 
                    toast({ title: "Plante supprimée" });
                  }}>
                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                  </Button>
                  <Button className="flex-1 h-14 rounded-2xl font-bold" onClick={() => setIsDetailOpen(false)}>Fermer</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
