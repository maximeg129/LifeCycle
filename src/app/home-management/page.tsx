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
  ShieldAlert
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

  // Watering alert on first load
  const hasAlertedRef = useRef(false)
  const toastRef = useRef(toast)
  toastRef.current = toast
  useEffect(() => {
    if (!plants || plants.length === 0 || hasAlertedRef.current) return
    const overdue = plants.filter((p: any) => getDaysUntilWatering(p) < 0)
    if (overdue.length > 0) {
      hasAlertedRef.current = true
      toastRef.current({
        title: `${overdue.length} plante${overdue.length > 1 ? 's ont' : ' a'} besoin d'eau`,
        description: overdue.map((p: any) => p.nickname).join(', ')
      })
    }
  }, [plants])

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
      isActive: true, createdAt: serverTimestamp()
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
      // Pre-fill watering fields from AI recommendation
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
        lastWateringDate: plantLastWateringDate
          ? Timestamp.fromDate(new Date(plantLastWateringDate))
          : serverTimestamp(),
        purchaseDate: plantPurchaseDate
          ? Timestamp.fromDate(new Date(plantPurchaseDate))
          : null,
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
      toast({ title: "Plante ajoutée", description: `${plantNickname || scanResult.name} est maintenant suivie.` })
    } catch {
      toast({ variant: "destructive", title: "Erreur lors de l'enregistrement" })
    } finally {
      setIsSavingPlant(false)
    }
  }

  const handleWater = async (plant: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || !db) return
    await setDoc(doc(db, `users/${user.uid}/plants`, plant.id),
      { lastWateringDate: serverTimestamp() }, { merge: true })
    await setDoc(doc(collection(db, `users/${user.uid}/plants/${plant.id}/plantActions`)), {
      actionType: 'watering', actionDate: serverTimestamp(), userId: user.uid, plantId: plant.id
    })
    toast({ title: "Arrosage enregistré", description: `${plant.nickname} a été hydratée.` })
  }

  const handleDeletePlant = async (plant: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || !db) return
    await deleteDoc(doc(db, `users/${user.uid}/plants`, plant.id))
    if (isDetailOpen && selectedPlant?.id === plant.id) setIsDetailOpen(false)
    toast({ title: "Plante supprimée" })
  }

  const fetchAnalyses = async (plantId: string) => {
    if (!user || !db) return
    setLoadingAnalyses(true)
    try {
      const q = query(
        collection(db, `users/${user.uid}/plants/${plantId}/analyses`),
        orderBy('analyzedAt', 'desc'),
        limit(10)
      )
      const snap = await getDocs(q)
      setPlantAnalyses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })))
    } finally {
      setLoadingAnalyses(false)
    }
  }

  const handleOpenDetail = async (plant: any) => {
    setSelectedPlant(plant)
    setIsDetailOpen(true)
    setReanalysisPreviewUrl(null)
    setPlantAnalyses([])
    await fetchAnalyses(plant.id)
  }

  const handleReanalyze = async () => {
    if (!reanalysisPreviewUrl || !selectedPlant || !user || !db) return
    setIsReanalyzing(true)
    try {
      const lastAnalysis = plantAnalyses[0]
      const daysSince = lastAnalysis?.analyzedAt?.seconds
        ? Math.floor((Date.now() - lastAnalysis.analyzedAt.seconds * 1000) / (1000 * 60 * 60 * 24))
        : undefined

      const result = await identifyPlant({
        photoDataUri: reanalysisPreviewUrl,
        plantContext: {
          name: selectedPlant.nickname,
          species: selectedPlant.species,
          previousHealthAnalysis: lastAnalysis?.healthAnalysis,
          daysSinceLastAnalysis: daysSince
        }
      })

      const thumbnail = await compressImage(reanalysisPreviewUrl)
      await setDoc(doc(collection(db, `users/${user.uid}/plants/${selectedPlant.id}/analyses`)), {
        ...result,
        photoUrl: thumbnail,
        analyzedAt: serverTimestamp()
      })
      await setDoc(doc(db, `users/${user.uid}/plants`, selectedPlant.id), {
        healthScore: result.healthScore,
        healthStatus: getHealthStatus(result.healthScore),
        lastAnalysisAlerts: result.alerts,
        thumbnailUrl: thumbnail
      }, { merge: true })

      setSelectedPlant((prev: any) => prev ? {
        ...prev,
        healthScore: result.healthScore,
        healthStatus: getHealthStatus(result.healthScore),
        lastAnalysisAlerts: result.alerts,
        thumbnailUrl: thumbnail
      } : prev)
      setReanalysisPreviewUrl(null)
      await fetchAnalyses(selectedPlant.id)

      toast({ title: "Analyse mise à jour" })
      if (result.alerts.length > 0) {
        toast({ variant: "destructive", title: "Alertes détectées", description: result.alerts.join(' • ') })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur d'analyse" })
    } finally {
      setIsReanalyzing(false)
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
            <Button
              onClick={() => setIsAddTaskOpen(true)}
              className="rounded-full h-14 px-8 bg-primary text-primary-foreground font-bold shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-5 h-5 mr-2" /> Nouvelle Tâche
            </Button>
            <DialogContent className="sm:max-w-[480px] rounded-[32px] p-8 border-none shadow-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tight">Nouvelle routine</DialogTitle>
                <DialogDescription>Ajoutez une tâche à votre planning automatisé.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Quoi de neuf ?</Label>
                  <Input id="taskName" name="taskName" placeholder="ex: Nettoyer la machine à café..." className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Pièce</Label>
                    <Select value={room} onValueChange={setRoom}>
                      <SelectTrigger className="rounded-2xl bg-secondary/50 border-none h-14"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        {["Cuisine", "Salon", "Chambre", "SdB", "Extérieur", "Général"].map(r => (
                          <SelectItem key={r} value={r} className="rounded-lg">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Priorité</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="rounded-2xl bg-secondary/50 border-none h-14"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        <SelectItem value="low" className="rounded-lg">Basse</SelectItem>
                        <SelectItem value="medium" className="rounded-lg">Moyenne</SelectItem>
                        <SelectItem value="high" className="rounded-lg">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Durée (min)</Label>
                    <Input id="duration" name="duration" type="number" defaultValue={15} className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Récurrence (j)</Label>
                    <Input id="recurrenceDays" name="recurrenceDays" type="number" defaultValue={7} className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-16 rounded-2xl font-bold bg-primary text-primary-foreground shadow-xl shadow-primary/20" disabled={isSavingTask}>
                  {isSavingTask ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Planifier maintenant"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {/* Hidden file inputs (outside dialogs for reliable gesture handling) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              const reader = new FileReader()
              reader.onloadend = () => setPreviewUrl(reader.result as string)
              reader.readAsDataURL(file)
            }
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />
        <input
          ref={reanalysisFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              const reader = new FileReader()
              reader.onloadend = () => setReanalysisPreviewUrl(reader.result as string)
              reader.readAsDataURL(file)
            }
            if (reanalysisFileInputRef.current) reanalysisFileInputRef.current.value = ''
          }}
        />

        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
            <TabsTrigger value="dashboard" className="px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <LayoutGrid className="w-4 h-4 mr-2" /> Routine
            </TabsTrigger>
            <TabsTrigger value="plants" className="relative px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Leaf className="w-4 h-4 mr-2" /> Jardin d'Hiver
              {overdueCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {overdueCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* --- Tasks tab --- */}
          <TabsContent value="dashboard" className="space-y-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loadingTasks ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-[32px] bg-muted/20 animate-pulse" />)
              ) : sortedTasks.length === 0 ? (
                <div className="col-span-full py-32 text-center flex flex-col items-center gap-4 opacity-40">
                  <CheckCircle2 className="w-16 h-16 text-muted-foreground/30" />
                  <p className="font-bold uppercase tracking-widest text-xs">Tout est sous contrôle</p>
                </div>
              ) : (
                sortedTasks.map((task) => (
                  <Card key={task.id} className="apple-card border-none p-8 flex flex-col justify-between h-full">
                    <div className="space-y-6">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="bg-primary/5 text-primary font-bold px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest border-none">
                          {task.room}
                        </Badge>
                        <div className={cn("w-2 h-2 rounded-full ring-4 ring-opacity-20",
                          task.priority === 'high' ? 'bg-red-500 ring-red-500' : task.priority === 'medium' ? 'bg-orange-500 ring-orange-500' : 'bg-green-500 ring-green-500'
                        )} />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight leading-tight">{task.name}</h3>
                      <div className="flex gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {task.estimatedMinutes} min</span>
                        <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {task.nextDueDate?.seconds ? format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr }) : 'N/A'}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleMarkDone(task)}
                      className="w-full h-14 rounded-2xl bg-secondary text-foreground hover:bg-primary hover:text-white transition-all font-bold mt-10 shadow-none border-none"
                    >
                      Terminer
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* --- Plants tab --- */}
          <TabsContent value="plants" className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-end">
              <Button
                onClick={() => { resetIdentifyDialog(); setIsIdentifyOpen(true) }}
                className="rounded-full h-14 px-8 bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all active:scale-95"
              >
                <Camera className="w-5 h-5 mr-2" /> Identification IA
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {loadingPlants ? (
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-80 rounded-[32px] bg-muted/20 animate-pulse" />)
              ) : !plants || plants.length === 0 ? (
                <div className="col-span-full py-32 text-center flex flex-col items-center gap-4 opacity-40">
                  <Flower2 className="w-16 h-16 text-muted-foreground/30" />
                  <p className="font-bold uppercase tracking-widest text-xs">Aucune plante suivie</p>
                  <p className="text-sm text-muted-foreground mt-1">Utilisez "Identification IA" pour commencer</p>
                </div>
              ) : (
                (plants as any[]).map((plant) => {
                  const daysUntil = getDaysUntilWatering(plant)
                  const score = plant.healthScore ?? 75
                  return (
                    <div
                      key={plant.id}
                      className="apple-card border-none overflow-hidden group cursor-pointer"
                      onClick={() => handleOpenDetail(plant)}
                    >
                      <div className="h-52 relative bg-gradient-to-br from-green-900/30 to-green-700/10">
                        {plant.thumbnailUrl ? (
                          <img src={plant.thumbnailUrl} alt={plant.nickname} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Leaf className="w-16 h-16 text-green-500/30" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                          <Badge className={cn(
                            "rounded-full bg-white/95 backdrop-blur shadow-sm font-bold border-none px-3 py-1 text-[10px]",
                            score >= 75 ? 'text-green-600' : score >= 50 ? 'text-orange-500' : 'text-red-500'
                          )}>
                            {getHealthLabel(score)}
                          </Badge>
                          {(plant.lastAnalysisAlerts?.length ?? 0) > 0 && (
                            <Badge className="rounded-full bg-red-500 text-white font-bold border-none px-3 py-1 text-[10px]">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Alerte
                            </Badge>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeletePlant(plant, e)}
                          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-5 space-y-4">
                        <div>
                          <h3 className="font-bold text-lg tracking-tight leading-none">{plant.nickname}</h3>
                          <p className="text-xs text-muted-foreground mt-1 italic">{plant.species}</p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                            <span>Santé</span>
                            <span className={getHealthColor(score)}>{score}%</span>
                          </div>
                          <Progress
                            value={score}
                            className={cn("h-1", score >= 75 ? '[&>div]:bg-green-500' : score >= 50 ? '[&>div]:bg-orange-400' : '[&>div]:bg-red-500')}
                          />
                        </div>
                        <div className={cn(
                          "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                          daysUntil < 0 ? 'text-red-500' : daysUntil <= 1 ? 'text-orange-400' : 'text-muted-foreground'
                        )}>
                          <Droplets className="w-3.5 h-3.5" />
                          {daysUntil < 0
                            ? `En retard de ${Math.abs(daysUntil)}j`
                            : daysUntil === 0 ? "À arroser aujourd'hui"
                            : daysUntil === 1 ? "À arroser demain"
                            : `Dans ${daysUntil} jours`}
                        </div>
                        <Button
                          onClick={(e) => handleWater(plant, e)}
                          className="w-full h-11 rounded-2xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all font-bold border-none shadow-none text-sm"
                        >
                          Arroser <Droplets className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* === Identify Dialog === */}
      <Dialog open={isIdentifyOpen} onOpenChange={(open) => { setIsIdentifyOpen(open); if (!open) resetIdentifyDialog() }}>
        <DialogContent className="sm:max-w-[500px] rounded-[32px] p-8 border-none shadow-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {identifyStep === 'photo' ? 'Analyse Botanique' : "Confirmer l'ajout"}
            </DialogTitle>
            <DialogDescription>
              {identifyStep === 'photo'
                ? "Prenez une photo pour identifier la plante."
                : "Vérifiez et complétez les informations avant d'ajouter."}
            </DialogDescription>
          </DialogHeader>

          {identifyStep === 'photo' ? (
            <div className="flex flex-col items-center gap-6 py-4">
              <div
                className="w-full aspect-square bg-secondary/30 rounded-[28px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
                    <Camera className="w-16 h-16" />
                    <p className="text-sm font-medium">Appuyer pour prendre une photo</p>
                  </div>
                )}
              </div>
              <div className="w-full space-y-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-12 rounded-2xl border-border bg-transparent font-bold"
                >
                  {previewUrl ? 'Changer la photo' : 'Prendre une photo'}
                </Button>
                {previewUrl && (
                  <Button
                    onClick={handleScan}
                    className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold shadow-lg shadow-green-500/20"
                    disabled={isScanning}
                  >
                    {isScanning
                      ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyse en cours...</>
                      : <><Sparkles className="w-5 h-5 mr-2" /> Identifier la plante</>}
                  </Button>
                )}
              </div>
            </div>
          ) : scanResult ? (
            <div className="flex flex-col gap-4">
              <ScrollArea className="max-h-[55vh]">
                <div className="space-y-5 py-2 pr-2">
                  {/* AI result summary */}
                  <div className="bg-green-500/10 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-green-500">Identifiée par IA</span>
                    </div>
                    <p className="font-bold text-lg">{scanResult.name}</p>
                    <p className="text-sm text-muted-foreground italic">{scanResult.species}</p>
                    <span className={cn("text-sm font-bold", getHealthColor(scanResult.healthScore))}>
                      Santé : {scanResult.healthScore}/100
                    </span>
                    {scanResult.alerts.length > 0 && (
                      <div className="flex items-start gap-2 mt-2 bg-red-500/10 rounded-xl p-3">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          {scanResult.alerts.map((alert, i) => (
                            <p key={i} className="text-xs text-red-400">{alert}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{scanResult.healthAnalysis}</p>
                  </div>

                  {/* Editable fields */}
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Surnom</Label>
                    <Input
                      value={plantNickname}
                      onChange={e => setPlantNickname(e.target.value)}
                      className="rounded-2xl bg-secondary/50 border-none h-12 px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Emplacement</Label>
                    <Select value={plantLocation} onValueChange={setPlantLocation}>
                      <SelectTrigger className="rounded-2xl bg-secondary/50 border-none h-12"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-xl">
                        {["Salon", "Cuisine", "Chambre", "Salle de bain", "Balcon", "Jardin"].map(l => (
                          <SelectItem key={l} value={l} className="rounded-lg">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Purchase date + last watering date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Date d'achat</Label>
                      <Input
                        type="date"
                        value={plantPurchaseDate}
                        onChange={e => setPlantPurchaseDate(e.target.value)}
                        className="rounded-2xl bg-secondary/50 border-none h-12 px-4"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Dernier arrosage</Label>
                      <Input
                        type="date"
                        value={plantLastWateringDate}
                        onChange={e => setPlantLastWateringDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="rounded-2xl bg-secondary/50 border-none h-12 px-4"
                      />
                    </div>
                  </div>

                  {/* Watering fields with AI hints */}
                  <div className="bg-blue-500/5 rounded-2xl p-4 space-y-3 border border-blue-500/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-blue-400">Cycle d'arrosage</span>
                    </div>
                    {scanResult.hydrationPlan && (
                      <p className="text-[11px] text-muted-foreground italic">
                        IA recommande : {scanResult.hydrationPlan.frequency} · {scanResult.hydrationPlan.amount}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Fréquence (jours)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={plantWateringDays}
                          onChange={e => setPlantWateringDays(Number(e.target.value))}
                          className="rounded-2xl bg-secondary/50 border-none h-12 px-4"
                        />
                        <p className="text-[10px] text-muted-foreground ml-1">Arroser tous les X jours</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Quantité (ml)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          value={plantWateringAmount}
                          onChange={e => setPlantWateringAmount(Number(e.target.value))}
                          className="rounded-2xl bg-secondary/50 border-none h-12 px-4"
                        />
                        <p className="text-[10px] text-muted-foreground ml-1">Eau par session</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Notes (optionnel)</Label>
                    <Textarea
                      value={plantNotes}
                      onChange={e => setPlantNotes(e.target.value)}
                      placeholder="Notes personnelles..."
                      className="rounded-2xl bg-secondary/50 border-none resize-none px-4 py-3"
                      rows={2}
                    />
                  </div>
                </div>
              </ScrollArea>

              {/* Action buttons outside ScrollArea — always visible */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIdentifyStep('photo')}
                  className="flex-1 h-12 rounded-2xl border-border"
                >
                  Retour
                </Button>
                <Button
                  onClick={handleSavePlant}
                  className="flex-1 h-14 rounded-2xl bg-green-500 text-white font-bold shadow-lg shadow-green-500/20"
                  disabled={isSavingPlant}
                >
                  {isSavingPlant ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                  Ajouter
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* === Plant Detail Dialog === */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) { setSelectedPlant(null); setReanalysisPreviewUrl(null) } }}>
        <DialogContent className="sm:max-w-[560px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden">
          {selectedPlant && (
            <>
              <div className="h-40 relative bg-gradient-to-br from-green-900/40 to-green-700/20">
                {selectedPlant.thumbnailUrl && (
                  <img src={selectedPlant.thumbnailUrl} alt={selectedPlant.nickname} className="w-full h-full object-cover opacity-60" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <h2 className="text-2xl font-bold">{selectedPlant.nickname}</h2>
                  <p className="text-sm text-muted-foreground italic">{selectedPlant.species}</p>
                </div>
              </div>

              <div className="p-6">
                <Tabs defaultValue="soins">
                  <TabsList className="bg-secondary/50 p-1 rounded-[16px] w-full mb-6">
                    <TabsTrigger value="soins" className="flex-1 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary font-bold text-sm">
                      <Heart className="w-4 h-4 mr-2" /> Soins
                    </TabsTrigger>
                    <TabsTrigger value="historique" className="flex-1 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary font-bold text-sm">
                      <History className="w-4 h-4 mr-2" /> Historique
                    </TabsTrigger>
                    <TabsTrigger value="analyser" className="flex-1 rounded-xl data-[state=active]:bg-card data-[state=active]:text-primary font-bold text-sm">
                      <Camera className="w-4 h-4 mr-2" /> Analyser
                    </TabsTrigger>
                  </TabsList>

                  {/* Soins */}
                  <TabsContent value="soins">
                    {loadingAnalyses ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted/20 animate-pulse" />)}
                      </div>
                    ) : plantAnalyses[0] ? (
                      <ScrollArea className="max-h-[45vh]">
                        <div className="space-y-4 pr-2">
                          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-2xl">
                            <span className="text-sm font-bold">État de santé</span>
                            <div className="flex items-center gap-3">
                              <Progress
                                value={plantAnalyses[0].healthScore}
                                className={cn("w-24 h-1.5",
                                  plantAnalyses[0].healthScore >= 75 ? '[&>div]:bg-green-500' :
                                  plantAnalyses[0].healthScore >= 50 ? '[&>div]:bg-orange-400' : '[&>div]:bg-red-500'
                                )}
                              />
                              <span className={cn("text-sm font-bold tabular-nums", getHealthColor(plantAnalyses[0].healthScore))}>
                                {plantAnalyses[0].healthScore}/100
                              </span>
                            </div>
                          </div>
                          {plantAnalyses[0].alerts?.length > 0 && (
                            <div className="bg-red-500/10 rounded-2xl p-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-red-500" />
                                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Alertes</span>
                              </div>
                              {plantAnalyses[0].alerts.map((a: string, i: number) => (
                                <p key={i} className="text-sm text-red-400">• {a}</p>
                              ))}
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Analyse</p>
                            <p className="text-sm leading-relaxed">{plantAnalyses[0].healthAnalysis}</p>
                          </div>
                          <div className="bg-blue-500/10 rounded-2xl p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <Droplets className="w-4 h-4 text-blue-500" />
                              <span className="text-xs font-bold uppercase tracking-widest text-blue-500">Arrosage</span>
                            </div>
                            <div className="flex gap-4 flex-wrap">
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Cycle</p>
                                <p className="text-sm font-bold">{selectedPlant.wateringFrequencyDays ?? '—'} jours</p>
                              </div>
                              {selectedPlant.wateringAmountMl ? (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Quantité</p>
                                  <p className="text-sm font-bold">{selectedPlant.wateringAmountMl} ml</p>
                                </div>
                              ) : null}
                              {selectedPlant.lastWateringDate?.seconds ? (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Dernier arrosage</p>
                                  <p className="text-sm font-bold">{format(new Date(selectedPlant.lastWateringDate.seconds * 1000), 'dd MMM yyyy', { locale: fr })}</p>
                                </div>
                              ) : null}
                            </div>
                            {selectedPlant.purchaseDate?.seconds ? (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Achetée le {format(new Date(selectedPlant.purchaseDate.seconds * 1000), 'dd MMM yyyy', { locale: fr })}
                              </p>
                            ) : null}
                            <p className="text-sm font-medium">{plantAnalyses[0].hydrationPlan?.frequency}</p>
                            <p className="text-sm text-muted-foreground">{plantAnalyses[0].hydrationPlan?.tips}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conseils d'entretien</p>
                            <div className="space-y-1.5">
                              {plantAnalyses[0].generalCare?.map((tip: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                  <span>{tip}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground/50">
                            Analysé le {plantAnalyses[0].analyzedAt?.seconds
                              ? format(new Date(plantAnalyses[0].analyzedAt.seconds * 1000), 'dd MMM yyyy', { locale: fr })
                              : '—'}
                          </p>
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="py-12 text-center opacity-40">
                        <Leaf className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm">Aucune analyse disponible</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Historique */}
                  <TabsContent value="historique">
                    <ScrollArea className="max-h-[45vh]">
                      {loadingAnalyses ? (
                        <div className="space-y-3">
                          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted/20 animate-pulse" />)}
                        </div>
                      ) : plantAnalyses.length === 0 ? (
                        <div className="py-12 text-center opacity-40">
                          <History className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                          <p className="text-sm">Aucun historique</p>
                        </div>
                      ) : (
                        <div className="space-y-3 pr-2">
                          {plantAnalyses.map((analysis: any, index: number) => (
                            <div key={analysis.id} className="flex gap-3 p-3 bg-secondary/20 rounded-2xl">
                              {analysis.photoUrl && (
                                <img src={analysis.photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                              )}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    {analysis.analyzedAt?.seconds
                                      ? format(new Date(analysis.analyzedAt.seconds * 1000), 'dd MMM yyyy', { locale: fr })
                                      : '—'}
                                  </span>
                                  {index === 0 && (
                                    <Badge className="text-[9px] bg-primary/10 text-primary border-none px-2 py-0.5 font-bold">Dernière</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={analysis.healthScore ?? 75}
                                    className={cn("flex-1 h-1",
                                      (analysis.healthScore ?? 75) >= 75 ? '[&>div]:bg-green-500' :
                                      (analysis.healthScore ?? 75) >= 50 ? '[&>div]:bg-orange-400' : '[&>div]:bg-red-500'
                                    )}
                                  />
                                  <span className={cn("text-xs font-bold tabular-nums shrink-0", getHealthColor(analysis.healthScore ?? 75))}>
                                    {analysis.healthScore ?? '—'}
                                  </span>
                                </div>
                                {analysis.alerts?.length > 0 && (
                                  <p className="text-[10px] text-red-400 truncate">⚠ {analysis.alerts.join(' • ')}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  {/* Analyser */}
                  <TabsContent value="analyser" className="space-y-4">
                    <div
                      className="w-full aspect-[4/3] bg-secondary/30 rounded-[24px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border cursor-pointer"
                      onClick={() => reanalysisFileInputRef.current?.click()}
                    >
                      {reanalysisPreviewUrl ? (
                        <img src={reanalysisPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
                          <Camera className="w-12 h-12" />
                          <p className="text-sm font-medium">Prendre une nouvelle photo</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        onClick={() => reanalysisFileInputRef.current?.click()}
                        className="w-full h-12 rounded-2xl border-border"
                      >
                        {reanalysisPreviewUrl ? 'Changer la photo' : 'Choisir une photo'}
                      </Button>
                      {reanalysisPreviewUrl && (
                        <Button
                          onClick={handleReanalyze}
                          className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold shadow-lg shadow-green-500/20"
                          disabled={isReanalyzing}
                        >
                          {isReanalyzing
                            ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyse en cours...</>
                            : <><RefreshCw className="w-5 h-5 mr-2" /> Analyser l'évolution</>}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      L'IA comparera avec l'analyse précédente pour détecter les évolutions.
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingTasks ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-[32px] bg-muted/20 animate-pulse" />)
            ) : sortedTasks.length === 0 ? (
              <div className="col-span-full py-32 text-center flex flex-col items-center gap-4 opacity-40">
                <CheckCircle2 className="w-16 h-16 text-muted-foreground/30" />
                <p className="font-bold uppercase tracking-widest text-xs">Tout est sous contrôle</p>
              </div>
            ) : (
              sortedTasks.map((task) => (
                <Card key={task.id} className="apple-card border-none p-8 flex flex-col justify-between h-full">
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline" className="bg-primary/5 text-primary font-bold px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest border-none">
                        {task.room}
                      </Badge>
                      <div className={cn("w-2 h-2 rounded-full ring-4 ring-opacity-20",
                        task.priority === 'high' ? 'bg-red-500 ring-red-500' : task.priority === 'medium' ? 'bg-orange-500 ring-orange-500' : 'bg-green-500 ring-green-500'
                      )} />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight leading-tight">{task.name}</h3>
                    <div className="flex gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {task.estimatedMinutes} min</span>
                      <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {task.nextDueDate?.seconds ? format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr }) : 'N/A'}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleMarkDone(task)}
                    className="w-full h-14 rounded-2xl bg-secondary text-foreground hover:bg-primary hover:text-white transition-all font-bold mt-10 shadow-none border-none"
                  >
                    Terminer
                  </Button>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
