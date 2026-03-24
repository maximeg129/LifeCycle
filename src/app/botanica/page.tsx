"use client"

import React, { useState, useMemo, useRef } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Leaf,
  Droplets,
  Plus,
  Camera,
  Loader2,
  Sparkles,
  Trash2,
  Calendar,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Info,
  Flower2,
  History,
} from 'lucide-react'
import { Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { identifyPlant } from '@/ai/flows/identify-plant-flow'
import type { IdentifyPlantOutput } from '@/ai/flows/identify-plant-flow'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, query, orderBy } from 'firebase/firestore'
import { format, differenceInDays, addDays } from 'date-fns'
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

const ANALYSIS_FREQUENCY_DAYS = 30

function isAnalysisOverdue(plant: any): boolean {
  if (!plant.lastAnalysisDate?.seconds) return true // never analyzed
  const lastAnalysis = new Date(plant.lastAnalysisDate.seconds * 1000)
  return differenceInDays(new Date(), lastAnalysis) >= ANALYSIS_FREQUENCY_DAYS
}

// --- Component ---

export default function BotanicaPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  const plantsPath = user ? `users/${user.uid}/plants` : null
  const plantsQuery = useMemoFirebase(() => {
    if (!plantsPath || !db) return null
    return collection(db, plantsPath)
  }, [db, plantsPath])
  const { data: plants, isLoading: loadingPlants } = useCollection(plantsQuery)

  // --- Analyses history for selected plant ---
  const analysesQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedPlant) return null
    return query(
      collection(db, `users/${user.uid}/plants/${selectedPlant.id}/analyses`),
      orderBy('createdAt', 'asc')
    )
  }, [db, user, selectedPlant])
  const { data: analyses } = useCollection(analysesQuery)

  const chartData = useMemo(() => {
    if (!analyses || analyses.length === 0) return []
    return (analyses as any[]).map((a) => ({
      date: a.createdAt?.seconds
        ? format(new Date(a.createdAt.seconds * 1000), 'dd/MM', { locale: fr })
        : '?',
      score: a.healthScore ?? 0,
    }))
  }, [analyses])

  const overdueCount = useMemo(
    () => plants?.filter((p: any) => getDaysUntilWatering(p) < 0).length ?? 0,
    [plants]
  )

  // --- Add plant dialog state ---
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<IdentifyPlantOutput | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [nickname, setNickname] = useState('')
  const [location, setLocation] = useState('Salon')
  const [wateringDays, setWateringDays] = useState(7)
  const [wateringAmount, setWateringAmount] = useState(200)
  const [lastWateringDate, setLastWateringDate] = useState(() => new Date().toISOString().split('T')[0])
  const [purchaseDate, setPurchaseDate] = useState('')
  const [notes, setNotes] = useState('')

  // --- Detail dialog state ---
  const detailFileInputRef = useRef<HTMLInputElement>(null)
  const [selectedPlant, setSelectedPlant] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editNickname, setEditNickname] = useState('')
  const [editLocation, setEditLocation] = useState('Salon')
  const [editWateringDays, setEditWateringDays] = useState(7)
  const [editWateringAmount, setEditWateringAmount] = useState(200)
  const [editNotes, setEditNotes] = useState('')
  const [editPurchaseDate, setEditPurchaseDate] = useState('')
  const [isDetailSaving, setIsDetailSaving] = useState(false)
  const [detailPreviewUrl, setDetailPreviewUrl] = useState<string | null>(null)
  const [isDetailScanning, setIsDetailScanning] = useState(false)
  const [detailScanResult, setDetailScanResult] = useState<IdentifyPlantOutput | null>(null)

  // --- Delete state ---
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // --- Handlers ---
  const resetDialog = () => {
    setPreviewUrl(null)
    setScanResult(null)
    setNickname('')
    setNotes('')
    setLocation('Salon')
    setWateringDays(7)
    setWateringAmount(200)
    setPurchaseDate('')
    setLastWateringDate(new Date().toISOString().split('T')[0])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleScan = async () => {
    if (!previewUrl) return
    setIsScanning(true)
    try {
      const compressed = await compressImage(previewUrl)
      const res = await identifyPlant({ photoDataUri: compressed })
      setScanResult(res)
      setNickname(res.name)
      const daysMatch = res.hydrationPlan?.frequency?.match(/(\d+)/)
      if (daysMatch) setWateringDays(Number(daysMatch[1]))
      const mlMatch = res.hydrationPlan?.amount?.match(/(\d+)/)
      if (mlMatch) setWateringAmount(Number(mlMatch[1]))
    } catch {
      toast({ variant: 'destructive', title: "Erreur d'analyse" })
    } finally {
      setIsScanning(false)
    }
  }

  const handleSave = async () => {
    if (!user || !db) return
    if (!nickname.trim()) {
      toast({ variant: 'destructive', title: 'Un surnom est requis' })
      return
    }
    setIsSaving(true)
    try {
      const thumbnail = previewUrl ? await compressImage(previewUrl) : null
      const plantRef = doc(collection(db, `users/${user.uid}/plants`))
      await setDoc(plantRef, {
        nickname,
        species: scanResult?.species ?? '',
        location,
        wateringFrequencyDays: wateringDays,
        wateringAmountMl: wateringAmount,
        lastWateringDate: lastWateringDate
          ? Timestamp.fromDate(new Date(lastWateringDate + 'T12:00:00'))
          : serverTimestamp(),
        purchaseDate: purchaseDate
          ? Timestamp.fromDate(new Date(purchaseDate + 'T12:00:00'))
          : null,
        healthScore: scanResult?.healthScore ?? 75,
        healthStatus: getHealthStatus(scanResult?.healthScore ?? 75),
        lastAnalysisAlerts: scanResult?.alerts ?? [],
        lastHealthAnalysis: scanResult?.healthAnalysis ?? '',
        lastAnalysisDate: scanResult ? serverTimestamp() : null,
        thumbnailUrl: thumbnail,
        notes,
        userId: user.uid,
        createdAt: serverTimestamp(),
      })
      // Save first analysis to history sub-collection
      if (scanResult) {
        const analysisRef = doc(collection(db, `users/${user.uid}/plants/${plantRef.id}/analyses`))
        await setDoc(analysisRef, {
          healthScore: scanResult.healthScore,
          healthAnalysis: scanResult.healthAnalysis,
          alerts: scanResult.alerts,
          hydrationPlan: scanResult.hydrationPlan,
          generalCare: scanResult.generalCare,
          thumbnailUrl: thumbnail,
          createdAt: serverTimestamp(),
        })
      }
      setIsAddOpen(false)
      toast({ title: 'Plante ajoutée', description: `${nickname} rejoint votre jardin.` })
    } catch {
      toast({ variant: 'destructive', title: "Erreur lors de l'enregistrement" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenDetail = (plant: any) => {
    setSelectedPlant(plant)
    setEditNickname(plant.nickname || '')
    setEditLocation(plant.location || 'Salon')
    setEditWateringDays(plant.wateringFrequencyDays || 7)
    setEditWateringAmount(plant.wateringAmountMl || 200)
    setEditNotes(plant.notes || '')
    setEditPurchaseDate(
      plant.purchaseDate?.seconds
        ? format(new Date(plant.purchaseDate.seconds * 1000), 'yyyy-MM-dd')
        : ''
    )
    setDetailPreviewUrl(null)
    setDetailScanResult(null)
    if (detailFileInputRef.current) detailFileInputRef.current.value = ''
    setIsDetailOpen(true)
  }

  const handleDetailScan = async () => {
    if (!detailPreviewUrl || !selectedPlant) return
    setIsDetailScanning(true)
    try {
      const compressed = await compressImage(detailPreviewUrl)
      const res = await identifyPlant({
        photoDataUri: compressed,
        locationContext: selectedPlant.location,
        plantContext: {
          name: selectedPlant.nickname,
          species: selectedPlant.species,
          previousHealthAnalysis: selectedPlant.lastHealthAnalysis,
          daysSinceLastAnalysis: selectedPlant.lastAnalysisDate?.seconds
            ? differenceInDays(new Date(), new Date(selectedPlant.lastAnalysisDate.seconds * 1000))
            : undefined,
        },
      })
      setDetailScanResult(res)
    } catch {
      toast({ variant: 'destructive', title: "Erreur d'analyse" })
    } finally {
      setIsDetailScanning(false)
    }
  }

  const handleSaveDetail = async () => {
    if (!user || !db || !selectedPlant) return
    if (!editNickname.trim()) {
      toast({ variant: 'destructive', title: 'Un surnom est requis' })
      return
    }
    setIsDetailSaving(true)
    try {
      const ref = doc(db, `users/${user.uid}/plants`, selectedPlant.id)
      const updateData: any = {
        nickname: editNickname,
        location: editLocation,
        wateringFrequencyDays: editWateringDays,
        wateringAmountMl: editWateringAmount,
        notes: editNotes,
        purchaseDate: editPurchaseDate
          ? Timestamp.fromDate(new Date(editPurchaseDate + 'T12:00:00'))
          : null,
      }

      // If a new scan was done, update plant + save analysis to history
      if (detailScanResult) {
        const newThumbnail = detailPreviewUrl ? await compressImage(detailPreviewUrl) : null
        if (newThumbnail) updateData.thumbnailUrl = newThumbnail
        updateData.healthScore = detailScanResult.healthScore
        updateData.healthStatus = getHealthStatus(detailScanResult.healthScore)
        updateData.lastAnalysisAlerts = detailScanResult.alerts
        updateData.lastHealthAnalysis = detailScanResult.healthAnalysis
        updateData.lastAnalysisDate = serverTimestamp()

        // Save to analyses sub-collection
        const analysisRef = doc(collection(db, `users/${user.uid}/plants/${selectedPlant.id}/analyses`))
        await setDoc(analysisRef, {
          healthScore: detailScanResult.healthScore,
          healthAnalysis: detailScanResult.healthAnalysis,
          alerts: detailScanResult.alerts,
          hydrationPlan: detailScanResult.hydrationPlan,
          generalCare: detailScanResult.generalCare,
          thumbnailUrl: newThumbnail,
          createdAt: serverTimestamp(),
        })
      }

      await setDoc(ref, updateData, { merge: true })
      setIsDetailOpen(false)
      toast({ title: 'Plante mise à jour' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur lors de la mise à jour' })
    } finally {
      setIsDetailSaving(false)
    }
  }

  const handleWater = async (plant: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || !db) return
    await setDoc(doc(db, `users/${user.uid}/plants`, plant.id), { lastWateringDate: serverTimestamp() }, { merge: true })
    toast({ title: 'Arrosage enregistré' })
  }

  const handleDelete = async (plant: any, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user || !db) return
    setDeletingId(plant.id)
    try {
      await deleteDoc(doc(db, `users/${user.uid}/plants`, plant.id))
      toast({ title: 'Plante supprimée' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur lors de la suppression' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

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
        }}
      />

      <main className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest opacity-70">Botanica</h2>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-gradient">Votre jardin d'hiver</h1>
          </div>
          <Button
            onClick={() => { resetDialog(); setIsAddOpen(true) }}
            className="rounded-full h-14 px-8 bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:bg-green-600 hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5 mr-2" /> Ajouter une plante
            {overdueCount > 0 && (
              <span className="ml-3 w-5 h-5 rounded-full bg-orange-400 text-white text-[10px] flex items-center justify-center font-bold">{overdueCount}</span>
            )}
          </Button>
        </header>

        {/* Plant grid */}
        {loadingPlants ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 rounded-[32px] bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : !plants || plants.length === 0 ? (
          <div className="py-32 text-center flex flex-col items-center gap-4 opacity-40">
            <Flower2 className="w-16 h-16 text-muted-foreground/30" />
            <p className="font-bold uppercase tracking-widest text-xs">Votre jardin est vide</p>
            <p className="text-sm text-muted-foreground">Ajoutez votre première plante</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {(plants as any[]).map((plant) => {
              const daysUntil = getDaysUntilWatering(plant)
              const needsWater = daysUntil < 0
              const score = plant.healthScore ?? 75
              const acquisitionDate = plant.purchaseDate?.seconds
                ? new Date(plant.purchaseDate.seconds * 1000)
                : null
              const lastWatered = plant.lastWateringDate?.seconds
                ? new Date(plant.lastWateringDate.seconds * 1000)
                : null

              return (
                <div key={plant.id} onClick={() => handleOpenDetail(plant)} className="apple-card border-none overflow-hidden group flex flex-col cursor-pointer">
                  <div className="h-52 relative bg-green-900/20 flex-shrink-0">
                    {plant.thumbnailUrl ? (
                      <Image src={plant.thumbnailUrl} alt={plant.nickname || plant.name} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Leaf className="w-16 h-16 text-green-500/30" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge className={cn(
                        "rounded-full backdrop-blur shadow-sm font-bold border-none px-3 py-1 text-[10px] flex items-center gap-1.5",
                        needsWater ? "bg-orange-500/90 text-white" : "bg-white/95 text-green-600"
                      )}>
                        {needsWater
                          ? <><AlertTriangle className="w-3 h-3" /> En retard {Math.abs(daysUntil)}j</>
                          : <><CheckCircle2 className="w-3 h-3" /> {getHealthLabel(score)}</>
                        }
                      </Badge>
                    </div>
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      <Badge className="rounded-full bg-black/40 backdrop-blur text-white font-bold border-none px-3 py-1 text-[10px] flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> {plant.location || 'Non défini'}
                      </Badge>
                      {isAnalysisOverdue(plant) && (
                        <Badge className="rounded-full bg-purple-500/90 backdrop-blur text-white font-bold border-none px-3 py-1 text-[10px] flex items-center gap-1.5">
                          <Camera className="w-3 h-3" /> Analyse recommandée
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-4 flex flex-col flex-1">
                    <div>
                      <h3 className="font-bold text-xl tracking-tight leading-none">{plant.nickname || plant.name}</h3>
                      {plant.species && <p className="text-xs text-muted-foreground italic mt-1">{plant.species}</p>}
                    </div>

                    <div className="space-y-1.5">
                      {acquisitionDate && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <ShoppingBag className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                          <span className="font-medium">Acquis le</span>
                          <span className="ml-auto font-bold text-foreground/70">{format(acquisitionDate, 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Droplets className={cn("w-3.5 h-3.5 shrink-0", needsWater ? "text-orange-400" : "text-blue-400")} />
                        <span className="font-medium">Dernier arrosage</span>
                        <span className={cn("ml-auto font-bold", needsWater ? "text-orange-400" : "text-foreground/70")}>
                          {lastWatered ? format(lastWatered, 'dd MMM yyyy', { locale: fr }) : 'Jamais'}
                        </span>
                      </div>
                      {!needsWater && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                          <span className="font-medium">Prochain arrosage</span>
                          <span className="ml-auto font-bold text-foreground/70">dans {daysUntil}j</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                        <span>Santé</span>
                        <span className={getHealthColor(score)}>{score}%</span>
                      </div>
                      <Progress value={score} className="h-1 bg-secondary" />
                    </div>

                    <div className="flex gap-2 mt-auto pt-2">
                      <Button
                        onClick={(e) => handleWater(plant, e)}
                        className={cn(
                          "flex-1 h-12 rounded-2xl font-bold border-none shadow-none transition-all",
                          needsWater
                            ? "bg-orange-500/15 text-orange-400 hover:bg-orange-500 hover:text-white"
                            : "bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white"
                        )}
                      >
                        <Droplets className="w-4 h-4 mr-2" /> Arroser
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(plant, e)}
                        disabled={deletingId === plant.id}
                        className="w-12 h-12 rounded-2xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      >
                        {deletingId === plant.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Unified add plant dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetDialog() }}>
        <DialogContent className="sm:max-w-[540px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-8 pt-8 pb-4 shrink-0">
            <DialogTitle className="text-2xl font-bold">Ajouter une plante</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-8 pb-8 space-y-6">

              {/* Photo + AI zone */}
              <div className="space-y-3">
                <div
                  className="w-full h-52 bg-secondary/30 rounded-[24px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border cursor-pointer transition-all hover:bg-secondary/50 group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                  ) : (
                    <div className="text-center text-muted-foreground/40 group-hover:scale-105 transition-transform">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">Appuyer pour ajouter une photo</p>
                      <p className="text-xs opacity-60 mt-1">Optionnel · Permet l'identification IA</p>
                    </div>
                  )}
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
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="ex: Mon Monstera, Ficus du salon…"
                    className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Emplacement</Label>
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger className="h-12 rounded-2xl bg-secondary/50 border-none px-5"><SelectValue /></SelectTrigger>
                      <SelectContent>{['Salon', 'Cuisine', 'Chambre', 'Salle de bain', 'Bureau', 'Balcon', 'Jardin'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Fréquence (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={wateringDays}
                      onChange={e => setWateringDays(Number(e.target.value))}
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
                      value={wateringAmount}
                      onChange={e => setWateringAmount(Number(e.target.value))}
                      className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Dernier arrosage</Label>
                    <Input
                      type="date"
                      value={lastWateringDate}
                      onChange={e => setLastWateringDate(e.target.value)}
                      className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Date d'acquisition</Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="h-12 rounded-2xl bg-secondary/50 border-none px-5"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observations, emplacement précis…"
                    className="rounded-2xl bg-secondary/50 border-none px-5 py-3 min-h-[80px] resize-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleSave}
                className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Leaf className="w-5 h-5 mr-2" />}
                Ajouter au jardin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail file input */}
      <input
        ref={detailFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onloadend = () => setDetailPreviewUrl(reader.result as string)
            reader.readAsDataURL(file)
          }
        }}
      />

      {/* Plant detail dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[540px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-8 pt-8 pb-4 shrink-0">
            <DialogTitle className="text-2xl font-bold">{selectedPlant?.nickname || 'Détail'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-8 pb-8 space-y-6">
              {/* Photo with re-upload */}
              <div className="space-y-3">
                <div
                  className="w-full h-52 rounded-[24px] overflow-hidden relative bg-secondary/30 flex items-center justify-center cursor-pointer group"
                  onClick={() => detailFileInputRef.current?.click()}
                >
                  {detailPreviewUrl ? (
                    <Image src={detailPreviewUrl} alt="Nouvelle photo" fill className="object-cover" />
                  ) : selectedPlant?.thumbnailUrl ? (
                    <Image src={selectedPlant.thumbnailUrl} alt={selectedPlant.nickname} fill className="object-cover" />
                  ) : (
                    <Leaf className="w-16 h-16 text-green-500/30" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-center">
                      <Camera className="w-8 h-8 mx-auto mb-1" />
                      <p className="text-xs font-bold">Nouvelle photo</p>
                    </div>
                  </div>
                </div>

                {detailPreviewUrl && (
                  <Button
                    onClick={handleDetailScan}
                    className="w-full h-12 rounded-2xl bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white font-bold border border-green-500/20 transition-all"
                    disabled={isDetailScanning}
                  >
                    {isDetailScanning
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyse de suivi en cours…</>
                      : <><Sparkles className="w-4 h-4 mr-2" /> Analyser l'évolution</>
                    }
                  </Button>
                )}
              </div>

              {/* Detail scan results */}
              {detailScanResult && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-400">
                  <div className="bg-green-500/8 border border-green-500/20 rounded-[20px] p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-lg text-green-400 leading-tight">{detailScanResult.name}</p>
                        <p className="text-xs italic text-muted-foreground mt-0.5">{detailScanResult.species}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("text-2xl font-bold", getHealthColor(detailScanResult.healthScore))}>{detailScanResult.healthScore}%</span>
                        <span className="text-[10px] uppercase font-bold opacity-40">Santé</span>
                      </div>
                    </div>
                    <Progress value={detailScanResult.healthScore} className="h-1.5" />
                    <p className="text-sm leading-relaxed text-muted-foreground">{detailScanResult.healthAnalysis}</p>
                    {detailScanResult.alerts.length > 0 && (
                      <div className="space-y-1.5">
                        {detailScanResult.alerts.map((alert, i) => (
                          <div key={i} className="flex items-start gap-2 text-orange-400 text-xs font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{alert}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Health summary */}
              {selectedPlant && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                    <span>Santé</span>
                    <span className={getHealthColor(selectedPlant.healthScore ?? 75)}>{selectedPlant.healthScore ?? 75}%</span>
                  </div>
                  <Progress value={selectedPlant.healthScore ?? 75} className="h-1.5" />
                  {selectedPlant.species && (
                    <p className="text-xs text-muted-foreground italic">{selectedPlant.species}</p>
                  )}
                </div>
              )}

              <Separator className="opacity-20" />

              {/* Editable fields */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Modifier les informations</p>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Surnom *</Label>
                  <Input value={editNickname} onChange={e => setEditNickname(e.target.value)} className="h-12 rounded-2xl bg-secondary/50 border-none px-5" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Emplacement</Label>
                    <Select value={editLocation} onValueChange={setEditLocation}>
                      <SelectTrigger className="h-12 rounded-2xl bg-secondary/50 border-none px-5"><SelectValue /></SelectTrigger>
                      <SelectContent>{['Salon', 'Cuisine', 'Chambre', 'Salle de bain', 'Bureau', 'Balcon', 'Jardin'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Fréquence (jours)</Label>
                    <Input type="number" min={1} value={editWateringDays} onChange={e => setEditWateringDays(Number(e.target.value))} className="h-12 rounded-2xl bg-secondary/50 border-none px-5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Quantité (ml)</Label>
                    <Input type="number" min={10} step={10} value={editWateringAmount} onChange={e => setEditWateringAmount(Number(e.target.value))} className="h-12 rounded-2xl bg-secondary/50 border-none px-5" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Date d'acquisition</Label>
                    <Input type="date" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} className="h-12 rounded-2xl bg-secondary/50 border-none px-5" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 tracking-widest">Notes</Label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Observations…" className="rounded-2xl bg-secondary/50 border-none px-5 py-3 min-h-[80px] resize-none" />
                </div>
              </div>

              {/* Analysis history */}
              {analyses && (analyses as any[]).length > 0 && (
                <>
                  <Separator className="opacity-20" />
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-2">
                      <History className="w-3.5 h-3.5" /> Historique des analyses
                    </p>

                    {/* Chart */}
                    {chartData.length >= 2 && (
                      <div className="bg-secondary/30 rounded-[20px] p-4">
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={chartData}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} width={30} />
                            <Tooltip
                              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                              formatter={(value: number) => [`${value}%`, 'Santé']}
                            />
                            <Line type="monotone" dataKey="score" stroke="hsl(130, 60%, 50%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(130, 60%, 50%)' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="space-y-3">
                      {([...(analyses as any[])].reverse()).map((analysis, i) => (
                        <div key={analysis.id || i} className="bg-secondary/20 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">
                              {analysis.createdAt?.seconds
                                ? format(new Date(analysis.createdAt.seconds * 1000), 'dd MMMM yyyy', { locale: fr })
                                : 'Date inconnue'}
                            </span>
                            <span className={cn("text-sm font-bold", getHealthColor(analysis.healthScore))}>
                              {analysis.healthScore}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{analysis.healthAnalysis}</p>
                          {analysis.alerts?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {analysis.alerts.map((alert: string, j: number) => (
                                <Badge key={j} variant="outline" className="text-[10px] text-orange-400 border-orange-400/30">{alert}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={handleSaveDetail}
                className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all"
                disabled={isDetailSaving}
              >
                {isDetailSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Leaf className="w-5 h-5 mr-2" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
