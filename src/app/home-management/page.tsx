"use client"

import React, { useState, useMemo, useRef } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  CheckCircle2, 
  Plus, 
  AlertTriangle,
  Clock,
  Camera,
  Loader2,
  Sparkles,
  Trash2,
  Calendar,
  LayoutGrid,
  Heart
} from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { identifyPlant } from '@/ai/flows/identify-plant-flow'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, where, Timestamp } from 'firebase/firestore'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function HomeManagementPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isSavingTask, setIsSavingTask] = useState(false)

  const [room, setRoom] = useState("Cuisine")
  const [priority, setPriority] = useState<string>("medium")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      name,
      room,
      description: "",
      estimatedMinutes: duration,
      recurrenceDays,
      priority,
      nextDueDate: Timestamp.fromDate(nextDue),
      isActive: true,
      createdAt: serverTimestamp()
    }

    try {
      await setDoc(doc(collection(db, `users/${user.uid}/tasks`)), newTask)
      setIsAddTaskOpen(false)
      toast({ title: "Tâche enregistrée" })
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'enregistrement" })
    } finally {
      setIsSavingTask(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-primary uppercase tracking-widest opacity-70">Gestion Maison</h2>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-gradient">Votre espace personnel</h1>
          </div>
          <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-14 px-8 bg-primary text-primary-foreground font-bold shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">
                <Plus className="w-5 h-5 mr-2" /> Nouvelle Tâche
              </Button>
            </DialogTrigger>
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

        {/* Input file hors Dialog pour garantir le geste utilisateur */}
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
            // Reset so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />

        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-secondary/50 p-1.5 rounded-[20px] w-fit border border-border/40">
            <TabsTrigger value="dashboard" className="px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <LayoutGrid className="w-4 h-4 mr-2" /> Routine
            </TabsTrigger>
            <TabsTrigger value="plants" className="px-10 py-3 rounded-2xl data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-lg font-bold transition-all">
              <Leaf className="w-4 h-4 mr-2" /> Jardin d'Hiver
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="plants" className="space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-end mb-8">
                <Dialog onOpenChange={(open) => { if (!open) { setPreviewUrl(null); setScanResult(null) } }}>
                    <DialogTrigger asChild>
                      <Button className="rounded-full h-14 px-8 bg-green-500 text-white font-bold shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all active:scale-95">
                        <Camera className="w-5 h-5 mr-2" /> Identification IA
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px] rounded-[32px] p-8 border-none shadow-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-tight">Analyse Botanique</DialogTitle>
                        <DialogDescription>Utilisez l'IA pour identifier et soigner vos plantes.</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col items-center gap-8 py-6">
                        <div className="w-full aspect-square bg-secondary/30 rounded-[32px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border">
                          {previewUrl ? <Image src={previewUrl} alt="Preview" fill className="object-cover" /> : <Camera className="w-16 h-16 text-muted-foreground/30" />}
                        </div>
                        <div className="grid grid-cols-1 w-full gap-4">
                          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full h-14 rounded-2xl border-border bg-transparent font-bold">
                            {previewUrl ? "Changer la photo" : "Prendre une photo"}
                          </Button>
                          {previewUrl && !scanResult && (
                            <Button onClick={async () => {
                               setIsScanning(true)
                               try {
                                 const res = await identifyPlant({ photoDataUri: previewUrl })
                                 setScanResult(res)
                               } catch (e) { toast({ variant: "destructive", title: "Erreur d'analyse" }) }
                               finally { setIsScanning(false) }
                            }} className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold shadow-lg shadow-green-500/20" disabled={isScanning}>
                              {isScanning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                              Démarrer l'analyse
                            </Button>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                </Dialog>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { name: "Monstera Deliciosa", id: 1, health: 85, status: "Vigoureuse" },
                  { name: "Calathea Orbifolia", id: 2, health: 92, status: "Saine" },
                  { name: "Pothos Argenté", id: 3, health: 78, status: "Stable" },
                  { name: "Ficus Lyrata", id: 4, health: 65, status: "Surveiller" },
                ].map((plant) => (
                  <div key={plant.id} className="apple-card border-none overflow-hidden group">
                    <div className="h-64 relative">
                      <Image src={`https://picsum.photos/seed/plant-${plant.id}/500/500`} alt={plant.name} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" />
                      <div className="absolute top-4 right-4">
                        <Badge className="rounded-full bg-white/95 backdrop-blur shadow-sm text-foreground font-bold border-none px-4 py-1.5 text-[10px]">
                          {plant.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-6 space-y-6">
                      <h3 className="font-bold text-xl tracking-tight leading-none">{plant.name}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                          <span>État de santé</span>
                          <span>{plant.health}%</span>
                        </div>
                        <Progress value={plant.health} className="h-1 bg-secondary" />
                      </div>
                      <Button className="w-full h-12 rounded-2xl bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-bold border-none shadow-none">
                        Hydrater <Droplets className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                ))}
             </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}