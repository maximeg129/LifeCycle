"use client"

import React, { useState, useMemo } from 'react'
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
  Calendar
} from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { identifyPlant } from '@/ai/flows/identify-plant-flow'
import { useUser, useFirestore, useCollection } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, where, Timestamp } from 'firebase/firestore'
import { format, addDays, isBefore, isToday, differenceInDays } from 'date-fns'
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

  // Form states
  const [room, setRoom] = useState("Cuisine")
  const [priority, setPriority] = useState<any>("medium")

  // Firestore Tasks
  const tasksPath = user ? `users/${user.uid}/tasks` : null
  const tasksQuery = useMemo(() => {
    if (!tasksPath || !db) return null
    return query(collection(db, tasksPath), where("isActive", "==", true))
  }, [db, tasksPath])
  
  const { data: tasks, loading: loadingTasks } = useCollection(tasksQuery)

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

  const handleDeleteTask = async (taskId: string) => {
    if (!user || !db) return
    await deleteDoc(doc(db, `users/${user.uid}/tasks`, taskId))
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
    <div className="min-h-screen bg-[#FBFBFD] pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-sm font-bold text-primary uppercase tracking-[0.2em] mb-2 opacity-60">Gestion Maison</h2>
            <h1 className="text-4xl font-bold tracking-tight">Bienvenue chez vous.</h1>
          </div>
          <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-14 px-8 bg-foreground text-background font-bold shadow-xl transition-all hover:scale-[1.02]">
                <Plus className="w-5 h-5 mr-2" /> Nouvelle Tâche
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] rounded-[32px] p-8">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Créer une tâche</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50 ml-1">Nom</Label>
                  <Input id="taskName" name="taskName" placeholder="Nettoyer le four..." className="rounded-2xl bg-gray-50 border-none h-14 px-5" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50 ml-1">Pièce</Label>
                    <Select value={room} onValueChange={setRoom}>
                      <SelectTrigger className="rounded-2xl bg-gray-50 border-none h-14"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Cuisine", "Salon", "Chambre", "SdB", "Extérieur", "Général"].map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50 ml-1">Priorité</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="rounded-2xl bg-gray-50 border-none h-14"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50 ml-1">Durée (min)</Label>
                    <Input id="duration" name="duration" type="number" defaultValue={15} className="rounded-2xl bg-gray-50 border-none h-14 px-5" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50 ml-1">Récurrence (j)</Label>
                    <Input id="recurrenceDays" name="recurrenceDays" type="number" defaultValue={7} className="rounded-2xl bg-gray-50 border-none h-14 px-5" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-16 rounded-2xl font-bold bg-foreground text-background" disabled={isSavingTask}>
                  {isSavingTask ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Enregistrer la tâche"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-gray-100/80 p-1.5 rounded-2xl w-fit">
            <TabsTrigger value="dashboard" className="px-8 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold">Tableau de bord</TabsTrigger>
            <TabsTrigger value="plants" className="px-8 py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold">Vos Plantes</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {loadingTasks ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 rounded-[32px] bg-white animate-pulse" />)
              ) : sortedTasks.length === 0 ? (
                <div className="col-span-full py-20 text-center opacity-40">Aucune tâche prévue. Profitez !</div>
              ) : (
                sortedTasks.map((task) => (
                  <Card key={task.id} className="apple-card border-none p-8 flex flex-col justify-between h-full">
                    <div className="space-y-6">
                      <div className="flex justify-between items-start">
                        <Badge variant="secondary" className="bg-gray-50 text-gray-500 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border-none">
                          {task.room}
                        </Badge>
                        <div className={cn("w-3 h-3 rounded-full", 
                          task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                        )} />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight leading-none">{task.name}</h3>
                      <div className="flex gap-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {task.estimatedMinutes} min</span>
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr })}</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleMarkDone(task)}
                      className="w-full h-14 rounded-2xl bg-gray-50 text-foreground hover:bg-foreground hover:text-white transition-all font-bold mt-10 shadow-none border-none"
                    >
                      Marquer comme fait
                    </Button>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="plants" className="space-y-8">
             <div className="flex justify-end mb-8">
                <Dialog>
                    <DialogTrigger asChild>
                      <Button className="rounded-full h-14 px-8 bg-green-500 text-white font-bold shadow-xl shadow-green-500/10 hover:bg-green-600 transition-all">
                        <Camera className="w-5 h-5 mr-2" /> Scanner une plante (IA)
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px] rounded-[32px] p-8">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Identification IA</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col items-center gap-8 py-6">
                        <div className="w-full aspect-square bg-gray-50 rounded-[32px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-gray-200">
                          {previewUrl ? <Image src={previewUrl} alt="Preview" fill className="object-cover" /> : <Camera className="w-16 h-16 text-gray-200" />}
                        </div>
                        <input type="file" accept="image/*" className="hidden" id="plant-photo" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onloadend = () => setPreviewUrl(reader.result as string)
                            reader.readAsDataURL(file)
                          }
                        }} />
                        <Button variant="outline" onClick={() => document.getElementById('plant-photo')?.click()} className="w-full h-14 rounded-2xl border-gray-200 font-bold">
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
                          }} className="w-full h-14 rounded-2xl bg-green-500 text-white font-bold" disabled={isScanning}>
                            {isScanning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                            Lancer l'analyse
                          </Button>
                        )}
                      </div>
                    </DialogContent>
                </Dialog>
             </div>

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { name: "Monstera Deliciosa", id: 1, health: 85 },
                  { name: "Calathea Orbifolia", id: 2, health: 92 },
                  { name: "Pothos Argenté", id: 3, health: 78 },
                  { name: "Ficus Lyrata", id: 4, health: 65 },
                ].map((plant) => (
                  <div key={plant.id} className="apple-card border-none overflow-hidden group">
                    <div className="h-56 relative">
                      <Image src={`https://picsum.photos/seed/plant-${plant.id}/500/500`} alt={plant.name} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute top-4 right-4">
                        <Badge className="rounded-full bg-white/90 backdrop-blur shadow-sm text-foreground font-bold border-none px-4 py-1.5 text-[10px]">
                          Vigoureuse
                        </Badge>
                      </div>
                    </div>
                    <div className="p-6 space-y-6">
                      <h3 className="font-bold text-xl tracking-tight">{plant.name}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest opacity-40">
                          <span>Santé</span>
                          <span>{plant.health}%</span>
                        </div>
                        <Progress value={plant.health} className="h-1 bg-gray-50" />
                      </div>
                      <Button className="w-full h-12 rounded-xl bg-blue-500/5 text-blue-500 hover:bg-blue-500 hover:text-white transition-all font-bold border-none shadow-none">
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
