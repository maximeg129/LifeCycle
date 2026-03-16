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
  Home, 
  CheckCircle2, 
  Plus, 
  AlertTriangle,
  Clock,
  Camera,
  Loader2,
  Sparkles,
  Trash2,
  Calendar,
  LayoutDashboard,
  CheckSquare
} from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'
import { identifyPlant } from '@/ai/flows/identify-plant-flow'
import { useUser, useFirestore, useCollection } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, serverTimestamp, query, where, Timestamp } from 'firebase/firestore'
import { format, addDays, isBefore, isToday, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

interface HouseholdTask {
  id?: string
  name: string
  description: string
  room: string
  estimatedMinutes: number
  recurrenceDays: number
  priority: 'low' | 'medium' | 'high'
  lastCompleted?: any
  nextDueDate: any
  isActive: boolean
  createdAt: any
}

const TASK_TEMPLATES = [
  { name: "Nettoyer le four", room: "Cuisine", duration: 45, freq: 90, priority: "medium" },
  { name: "Passer l'aspirateur", room: "Général", duration: 20, freq: 7, priority: "high" },
  { name: "Détartrer la douche", room: "SdB", duration: 30, freq: 14, priority: "medium" },
  { name: "Nettoyer le frigo", room: "Cuisine", duration: 30, freq: 30, priority: "medium" },
  { name: "Changer les draps", room: "Chambre", duration: 15, freq: 7, priority: "high" },
]

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

  const overdueTasks = useMemo(() => 
    sortedTasks.filter(t => t.nextDueDate && isBefore(new Date(t.nextDueDate.seconds * 1000), new Date()) && !isToday(new Date(t.nextDueDate.seconds * 1000))), 
  [sortedTasks])

  const todayTasks = useMemo(() => 
    sortedTasks.filter(t => t.nextDueDate && isToday(new Date(t.nextDueDate.seconds * 1000))), 
  [sortedTasks])

  const tasksByRoom = useMemo(() => {
    const groups: Record<string, any[]> = {}
    sortedTasks.forEach(t => {
      if (!groups[t.room]) groups[t.room] = []
      groups[t.room].push(t)
    })
    return groups
  }, [sortedTasks])

  const handleMarkDone = (task: any) => {
    if (!user || !db) return
    const now = new Date()
    const nextDue = addDays(now, task.recurrenceDays || 7)
    const taskRef = doc(db, `users/${user.uid}/tasks`, task.id)
    
    setDoc(taskRef, {
      lastCompleted: serverTimestamp(),
      nextDueDate: Timestamp.fromDate(nextDue)
    }, { merge: true })
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: taskRef.path,
          operation: 'update',
          requestResourceData: { lastCompleted: 'now', nextDueDate: nextDue },
        })
        errorEmitter.emit('permission-error', permissionError)
      })
    
    toast({
      title: "Bien joué !",
      description: `${task.name} reprogrammé pour le ${format(nextDue, 'dd MMM', { locale: fr })}.`
    })
  }

  const handleDeleteTask = (taskId: string) => {
    if (!user || !db) return
    const taskRef = doc(db, `users/${user.uid}/tasks`, taskId)
    deleteDoc(taskRef)
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: taskRef.path,
          operation: 'delete',
        })
        errorEmitter.emit('permission-error', permissionError)
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
    const description = formData.get('description')?.toString() || ""
    
    if (!name) {
      toast({ variant: "destructive", title: "Nom requis" })
      setIsSavingTask(false)
      return
    }

    const nextDue = addDays(new Date(), recurrenceDays)
    const newTask = {
      name,
      room,
      description,
      estimatedMinutes: duration,
      recurrenceDays,
      priority,
      nextDueDate: Timestamp.fromDate(nextDue),
      isActive: true,
      createdAt: serverTimestamp()
    }

    const newTaskRef = doc(collection(db, `users/${user.uid}/tasks`))
    setDoc(newTaskRef, newTask)
      .then(() => {
        setIsAddTaskOpen(false)
        toast({ title: "Tâche enregistrée" })
      })
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: newTaskRef.path,
          operation: 'create',
          requestResourceData: newTask,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setIsSavingTask(false))
  }

  const getUrgencyColor = (dueDate: any) => {
    if (!dueDate) return "bg-muted"
    const date = new Date(dueDate.seconds * 1000)
    const diff = differenceInDays(date, new Date())
    if (isBefore(date, new Date()) && !isToday(date)) return "bg-destructive"
    if (isToday(date) || diff <= 1) return "bg-orange-500"
    if (diff <= 3) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">LifeCycle Home</h2>
            <h1 className="text-3xl font-bold tracking-tight text-gradient">Gestion Maison</h1>
          </div>
          <div className="flex gap-2">
             <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full px-6 bg-primary text-primary-foreground hover:shadow-lg shadow-primary/20 transition-all">
                  <Plus className="w-4 h-4 mr-2" /> Nouvelle Tâche
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-[24px]">
                <DialogHeader>
                  <DialogTitle>Créer une tâche intelligente</DialogTitle>
                </DialogHeader>
                <form id="task-form" onSubmit={handleAddTask} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskName">Nom de la tâche</Label>
                    <Input id="taskName" name="taskName" placeholder="ex: Nettoyer le four" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pièce</Label>
                      <Select value={room} onValueChange={setRoom}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Cuisine", "Salon", "Chambre", "SdB", "Extérieur", "Général"].map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priorité</Label>
                      <Select value={priority} onValueChange={(val) => setPriority(val as any)}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
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
                      <Label htmlFor="duration">Minutes</Label>
                      <Input id="duration" name="duration" type="number" defaultValue={15} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recurrenceDays">Tous les (jours)</Label>
                      <Input id="recurrenceDays" name="recurrenceDays" type="number" defaultValue={7} />
                    </div>
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full rounded-xl py-6" disabled={isSavingTask}>
                      {isSavingTask && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 border-none p-1 rounded-full w-fit">
            <TabsTrigger value="dashboard" className="px-8 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Tableau de bord
            </TabsTrigger>
            <TabsTrigger value="plants" className="px-8 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Vos Plantes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
            {/* Urgence Section */}
            {(overdueTasks.length > 0 || todayTasks.length > 0) && (
              <section className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                  <AlertTriangle className="w-5 h-5 text-orange-500" /> À traiter d'urgence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...overdueTasks, ...todayTasks].map((task) => (
                    <Card key={task.id} className="apple-card border-none relative group overflow-hidden">
                      <div className={cn("absolute top-0 right-0 w-2 h-full opacity-60", getUrgencyColor(task.nextDueDate))} />
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest">{task.room}</Badge>
                        </div>
                        <CardTitle className="text-xl mt-3">{task.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase mb-6 tracking-wider">
                          <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {task.estimatedMinutes} min</span>
                          <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr })}</span>
                        </div>
                        <Button 
                          onClick={() => handleMarkDone(task)}
                          className="w-full bg-primary/5 text-primary hover:bg-primary hover:text-white rounded-2xl py-6 font-bold"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Terminé
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Par pièce */}
            <section className="space-y-8">
              {Object.entries(tasksByRoom).map(([roomName, roomTasks]) => (
                <div key={roomName} className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">{roomName}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {roomTasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-5 bg-card border border-border/40 rounded-[20px] group hover:shadow-lg transition-all">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-2.5 h-2.5 rounded-full", getUrgencyColor(task.nextDueDate))} />
                          <div>
                            <div className="font-bold">{task.name}</div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                              Tous les {task.recurrenceDays} j • {task.estimatedMinutes} min
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-primary hover:bg-primary/5" onClick={() => handleMarkDone(task)}>
                            <CheckCircle2 className="w-5 h-5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive/40 hover:text-destructive hover:bg-destructive/5" onClick={() => handleDeleteTask(task.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="plants" className="space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-end gap-2 px-1">
                <Dialog>
                    <DialogTrigger asChild>
                      <Button className="rounded-full px-6 bg-accent text-white shadow-xl shadow-accent/20">
                        <Camera className="w-4 h-4 mr-2" /> Scanner Plante AI
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] rounded-[32px]">
                      <DialogHeader>
                        <DialogTitle>Identification par IA</DialogTitle>
                        <DialogDescription>Analysez l'état de santé et obtenez un plan d'arrosage.</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col items-center gap-6 py-6">
                        <div className="w-full aspect-square bg-muted/30 rounded-[24px] flex items-center justify-center overflow-hidden relative border-2 border-dashed border-border/40">
                          {previewUrl ? (
                            <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                          ) : (
                            <Camera className="w-12 h-12 text-muted-foreground/20" />
                          )}
                        </div>
                        <input type="file" accept="image/*" className="hidden" id="plant-photo" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onloadend = () => setPreviewUrl(reader.result as string)
                            reader.readAsDataURL(file)
                          }
                        }} />
                        <Button variant="outline" onClick={() => document.getElementById('plant-photo')?.click()} className="w-full rounded-2xl h-14">
                          {previewUrl ? "Changer l'image" : "Prendre une photo"}
                        </Button>
                        
                        {previewUrl && !scanResult && (
                          <Button onClick={async () => {
                             setIsScanning(true)
                             try {
                               const res = await identifyPlant({ photoDataUri: previewUrl })
                               setScanResult(res)
                             } catch (e) {
                               toast({ variant: "destructive", title: "Analyse impossible" })
                             } finally {
                               setIsScanning(false)
                             }
                          }} disabled={isScanning} className="w-full bg-primary h-14 rounded-2xl shadow-xl shadow-primary/20">
                            {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Lancer l'analyse
                          </Button>
                        )}

                        {scanResult && (
                          <div className="w-full space-y-6 animate-in slide-in-from-bottom-2">
                            <div className="p-6 bg-accent/5 rounded-[24px] border border-accent/20">
                              <h4 className="font-bold text-2xl text-accent">{scanResult.name}</h4>
                              <p className="text-sm italic text-muted-foreground/70">{scanResult.species}</p>
                            </div>
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Droplets className="w-4 h-4 text-blue-500" /> Plan d'Hydratation
                              </h5>
                              <p className="text-sm text-foreground leading-relaxed">{scanResult.hydrationPlan.frequency} — {scanResult.hydrationPlan.tips}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                </Dialog>
             </div>

             <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { name: "Monstera Deliciosa", id: 1, health: 65, status: "critical" },
                  { name: "Calathea Orbifolia", id: 2, health: 92, status: "healthy" },
                  { name: "Pothos Argenté", id: 3, health: 88, status: "healthy" },
                  { name: "Ficus Lyrata", id: 4, health: 45, status: "critical" },
                ].map((plant) => (
                  <Card key={plant.id} className="apple-card border-none overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="h-48 bg-muted relative">
                      <Image 
                        src={`https://picsum.photos/seed/plant-${plant.id}/400/400`} 
                        alt={plant.name}
                        fill
                        className="object-cover"
                        data-ai-hint="indoor plant"
                      />
                      <div className="absolute top-3 right-3">
                        <Badge className={cn("rounded-full border-none backdrop-blur-md", plant.status === 'healthy' ? 'bg-green-500/20 text-green-600' : 'bg-destructive/20 text-destructive')}>
                          {plant.status === 'healthy' ? 'Vigoureuse' : 'Soif'}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-5 space-y-5">
                      <h3 className="font-bold text-lg">{plant.name}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                          <span>Santé</span>
                          <span>{plant.health}%</span>
                        </div>
                        <Progress value={plant.health} className="h-1" />
                      </div>
                      <Button size="icon" variant="ghost" className="w-full flex justify-between px-4 py-6 rounded-2xl bg-blue-500/5 text-blue-600 hover:bg-blue-500/10">
                        <span className="text-xs font-bold uppercase tracking-wider">Hydrater</span>
                        <Droplets className="w-5 h-5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
             </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
