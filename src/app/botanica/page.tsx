"use client"

import React, { useState, useRef } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Plus,
  Camera,
  Loader2,
  Sparkles,
  Trash2,
  Calendar,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  MapPin
} from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { identifyPlant } from '@/ai/flows/identify-plant-flow'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { format, differenceInDays, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

function needsWatering(lastWatering: any, frequencyDays: number): boolean {
  if (!lastWatering) return true
  const last = new Date(lastWatering.seconds * 1000)
  return differenceInDays(new Date(), last) >= frequencyDays
}

function daysUntilWatering(lastWatering: any, frequencyDays: number): number {
  if (!lastWatering) return 0
  const last = new Date(lastWatering.seconds * 1000)
  const next = addDays(last, frequencyDays)
  return Math.max(0, differenceInDays(next, new Date()))
}

export default function BotanicaPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isScanOpen, setIsScanOpen] = useState(false)
  const [location, setLocation] = useState('Salon')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const plantsPath = user ? `users/${user.uid}/plants` : null
  const plantsQuery = useMemoFirebase(() => {
    if (!plantsPath || !db) return null
    return collection(db, plantsPath)
  }, [db, plantsPath])

  const { data: plants, isLoading: loadingPlants } = useCollection(plantsQuery)

  const handleAddPlant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    setIsSaving(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name')?.toString()
    const species = formData.get('species')?.toString() || ''
    const wateringFrequencyDays = Number(formData.get('wateringFrequencyDays')) || 7
    const acquisitionDateStr = formData.get('acquisitionDate')?.toString()
    const notes = formData.get('notes')?.toString() || ''

    if (!name) {
      toast({ variant: 'destructive', title: 'Nom requis' })
      setIsSaving(false)
      return
    }

    const acquisitionDate = acquisitionDateStr
      ? Timestamp.fromDate(new Date(acquisitionDateStr))
      : Timestamp.fromDate(new Date())

    const newPlant = {
      name,
      species,
      location,
      wateringFrequencyDays,
      acquisitionDate,
      lastWateringDate: null,
      health: 80,
      notes,
      imageUrl: null,
      createdAt: serverTimestamp(),
    }

    try {
      await setDoc(doc(collection(db, `users/${user.uid}/plants`)), newPlant)
      setIsAddOpen(false)
      toast({ title: 'Plante ajoutée !', description: `${name} rejoint votre jardin.` })
    } catch {
      toast({ variant: 'destructive', title: "Erreur lors de l'enregistrement" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleWater = async (plant: any) => {
    if (!user || !db) return
    const plantRef = doc(db, `users/${user.uid}/plants`, plant.id)
    await setDoc(plantRef, { lastWateringDate: serverTimestamp() }, { merge: true })
    toast({
      title: 'Arrosage enregistré',
      description: `${plant.name} a été hydratée.`,
    })
  }

  const handleDelete = async (plant: any) => {
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

  const handleScanResult = async () => {
    if (!previewUrl) return
    setIsScanning(true)
    try {
      const res = await identifyPlant({ photoDataUri: previewUrl })
      setScanResult(res)
    } catch {
      toast({ variant: 'destructive', title: "Erreur d'analyse" })
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      {/* Hidden file input outside dialogs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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

      <main className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest opacity-70">Botanica</h2>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-gradient">Votre jardin d'hiver</h1>
          </div>
          <div className="flex gap-3">
            {/* AI Identification */}
            <Dialog open={isScanOpen} onOpenChange={(open) => {
              setIsScanOpen(open)
              if (!open) { setPreviewUrl(null); setScanResult(null) }
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-full h-14 px-8 bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all active:scale-95">
                  <Camera className="w-5 h-5 mr-2" /> Identifier
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px] rounded-[32px] p-8 border-none shadow-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold tracking-tight">Analyse Botanique</DialogTitle>
                  <DialogDescription>Utilisez l'IA pour identifier et soigner vos plantes.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-6 py-4">
                  <div
                    className="w-full aspect-square bg-secondary/30 rounded-[28px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl
                      ? <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                      : <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
                          <Camera className="w-16 h-16" />
                          <span className="text-xs font-bold uppercase tracking-widest">Appuyer pour choisir</span>
                        </div>
                    }
                  </div>

                  {previewUrl && !scanResult && (
                    <Button
                      onClick={handleScanResult}
                      className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold shadow-lg shadow-green-500/20"
                      disabled={isScanning}
                    >
                      {isScanning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                      Démarrer l'analyse
                    </Button>
                  )}

                  {scanResult && (
                    <div className="w-full space-y-4 text-sm">
                      <div className="p-5 rounded-2xl bg-green-500/10 border border-green-500/20 space-y-3">
                        <p className="font-bold text-lg text-green-400">{scanResult.name}</p>
                        <p className="text-muted-foreground text-xs italic">{scanResult.species}</p>
                        <p className="text-muted-foreground">{scanResult.healthAnalysis}</p>
                      </div>
                      {scanResult.hydrationPlan && (
                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                          <p className="font-bold text-blue-400 text-xs uppercase tracking-widest flex items-center gap-2">
                            <Droplets className="w-3.5 h-3.5" /> Plan d'hydratation
                          </p>
                          <p className="text-muted-foreground text-xs">{scanResult.hydrationPlan.frequency} · {scanResult.hydrationPlan.amount}</p>
                          <p className="text-muted-foreground text-xs">{scanResult.hydrationPlan.tips}</p>
                        </div>
                      )}
                      {scanResult.generalCare?.length > 0 && (
                        <ul className="space-y-1.5">
                          {scanResult.generalCare.map((tip: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> {tip}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Add plant */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full h-14 px-8 bg-primary text-primary-foreground font-bold shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
                  <Plus className="w-5 h-5 mr-2" /> Nouvelle plante
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px] rounded-[32px] p-8 border-none shadow-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold tracking-tight">Ajouter une plante</DialogTitle>
                  <DialogDescription>Enregistrez une nouvelle plante dans votre jardin.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddPlant} className="space-y-5 pt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Nom de la plante *</Label>
                    <Input name="name" placeholder="ex: Monstera Deliciosa" className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Espèce / Nom scientifique</Label>
                    <Input name="species" placeholder="ex: Monstera deliciosa" className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Emplacement</Label>
                      <Select value={location} onValueChange={setLocation}>
                        <SelectTrigger className="rounded-2xl bg-secondary/50 border-none h-14"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          {['Salon', 'Chambre', 'Cuisine', 'Bureau', 'Salle de bain', 'Balcon', 'Extérieur'].map(l => (
                            <SelectItem key={l} value={l} className="rounded-lg">{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Arrosage (jours)</Label>
                      <Input name="wateringFrequencyDays" type="number" defaultValue={7} min={1} className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Date d'achat</Label>
                    <Input
                      name="acquisitionDate"
                      type="date"
                      defaultValue={format(new Date(), 'yyyy-MM-dd')}
                      className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Notes</Label>
                    <Input name="notes" placeholder="Observations, conseils..." className="rounded-2xl bg-secondary/50 border-none h-14 px-5 focus-visible:ring-2 focus-visible:ring-primary/20" />
                  </div>
                  <Button type="submit" className="w-full h-16 rounded-2xl font-bold bg-primary text-primary-foreground shadow-xl shadow-primary/20" disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'Ajouter au jardin'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
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
            <Leaf className="w-16 h-16 text-muted-foreground/30" />
            <p className="font-bold uppercase tracking-widest text-xs">Votre jardin est vide</p>
            <p className="text-sm text-muted-foreground">Ajoutez votre première plante</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {plants.map((plant) => {
              const needsWater = needsWatering(plant.lastWateringDate, plant.wateringFrequencyDays || 7)
              const daysLeft = daysUntilWatering(plant.lastWateringDate, plant.wateringFrequencyDays || 7)
              const acquisitionDate = plant.acquisitionDate
                ? new Date(plant.acquisitionDate.seconds * 1000)
                : null
              const lastWateringDate = plant.lastWateringDate
                ? new Date(plant.lastWateringDate.seconds * 1000)
                : null

              return (
                <div key={plant.id} className="apple-card border-none overflow-hidden group flex flex-col">
                  {/* Plant image */}
                  <div className="h-52 relative bg-green-900/20 flex-shrink-0">
                    {plant.imageUrl ? (
                      <Image src={plant.imageUrl} alt={plant.name} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Leaf className="w-16 h-16 text-green-500/30" />
                      </div>
                    )}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                      {needsWater ? (
                        <Badge className="rounded-full bg-orange-500/90 backdrop-blur shadow-sm text-white font-bold border-none px-3 py-1 text-[10px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3" /> Arrosage
                        </Badge>
                      ) : (
                        <Badge className="rounded-full bg-green-500/90 backdrop-blur shadow-sm text-white font-bold border-none px-3 py-1 text-[10px] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </Badge>
                      )}
                    </div>
                    <div className="absolute top-4 left-4">
                      <Badge className="rounded-full bg-black/40 backdrop-blur text-white font-bold border-none px-3 py-1 text-[10px] flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> {plant.location || 'Non défini'}
                      </Badge>
                    </div>
                  </div>

                  {/* Plant info */}
                  <div className="p-6 space-y-5 flex flex-col flex-1">
                    <div>
                      <h3 className="font-bold text-xl tracking-tight leading-none">{plant.name}</h3>
                      {plant.species && (
                        <p className="text-xs text-muted-foreground italic mt-1">{plant.species}</p>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <ShoppingBag className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                        <span className="font-medium">Acquis le</span>
                        <span className="ml-auto font-bold text-foreground/70">
                          {acquisitionDate
                            ? format(acquisitionDate, 'dd MMM yyyy', { locale: fr })
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Droplets className={cn("w-3.5 h-3.5 shrink-0", needsWater ? "text-orange-400" : "text-blue-400")} />
                        <span className="font-medium">Dernier arrosage</span>
                        <span className={cn("ml-auto font-bold", needsWater ? "text-orange-400" : "text-foreground/70")}>
                          {lastWateringDate
                            ? format(lastWateringDate, 'dd MMM yyyy', { locale: fr })
                            : 'Jamais'}
                        </span>
                      </div>
                      {!needsWater && daysLeft > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                          <span className="font-medium">Prochain arrosage</span>
                          <span className="ml-auto font-bold text-foreground/70">
                            dans {daysLeft} j
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Health bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                        <span>Santé</span>
                        <span>{plant.health ?? 80}%</span>
                      </div>
                      <Progress value={plant.health ?? 80} className="h-1 bg-secondary" />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto pt-2">
                      <Button
                        onClick={() => handleWater(plant)}
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
                        onClick={() => handleDelete(plant)}
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
    </div>
  )
}
