
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

// Types for Task
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

// Task Templates
const TASK_TEMPLATES = [
  { name: "Nettoyer le four", room: "Cuisine", duration: 45, freq: 90, priority: "medium" },
  { name: "Passer l'aspirateur", room: "Général", duration: 20, freq: 7, priority: "high" },
  { name: "Détartrer la douche", room: "SdB", duration: 30, freq: 14, priority: "medium" },
  { name: "Nettoyer le frigo", room: "Cuisine", duration: 30, freq: 30, priority: "medium" },
  { name: "Laver les vitres", room: "Général", duration: 60, freq: 60, priority: "low" },
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

  // Form states for Selects
  const [room, setRoom] = useState("Cuisine")
  const [priority, setPriority] = useState<any>("medium")

  // Firestore Tasks
  const tasksPath = user ? `users/${user.uid}/tasks` : null
  const tasksQuery = useMemo(() => {
    if (!tasksPath || !db) return null
    return query(collection(db, tasksPath), where("isActive", "==", true))
  }, [db, tasksPath])
  
  const { data: tasks } = useCollection(tasksQuery)

  // Logic & Sorting
  const sortedTasks = useMemo(() => {
    if (!tasks) return []
    return [...tasks].sort((a, b) => {
      const dateA = a.nextDueDate?.seconds ? a.nextDueDate.seconds : 0
      const dateB = b.nextDueDate?.seconds ? b.nextDueDate.seconds : 0
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
    
    toast({
      title: "Tâche terminée !",
      description: `${task.name} est maintenant prévu pour le ${format(nextDue, 'dd MMMM', { locale: fr })}.`
    })
  }

  const handleDeleteTask = (taskId: string) => {
    if (!user || !db) return
    deleteDoc(doc(db, `users/${user.uid}/tasks`, taskId))
    toast({ title: "Tâche supprimée" })
  }

  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!user || !db) {
      toast({
        variant: "destructive",
        title: "Connexion requise",
        description: "Vous devez être connecté pour enregistrer une tâche."
      })
      return
    }
    
    setIsSavingTask(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get('taskName')?.toString()
    const recurrenceDays = Number(formData.get('recurrenceDays')) || 7
    const duration = Number(formData.get('duration')) || 15
    const description = formData.get('description')?.toString() || ""
    
    if (!name || name.trim() === "") {
      toast({
        variant: "destructive",
        title: "Champ requis",
        description: "Veuillez donner un nom à la tâche."
      })
      setIsSavingTask(false)
      return
    }

    const nextDue = addDays(new Date(), recurrenceDays)

    const newTask: Omit<HouseholdTask, 'id'> = {
      name,
      room,
      description,
      estimatedMinutes: duration,
      recurrenceDays: recurrenceDays,
      priority,
      nextDueDate: Timestamp.fromDate(nextDue),
      isActive: true,
      createdAt: serverTimestamp()
    }

    try {
      const newDocRef = doc(collection(db, `users/${user.uid}/tasks`))
      setDoc(newDocRef, newTask)
      
      setIsAddTaskOpen(false)
      toast({ 
        title: "Tâche ajoutée", 
        description: "Votre nouveau rappel est enregistré." 
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer la tâche. Vérifiez vos permissions."
      })
    } finally {
      setIsSavingTask(false)
    }
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
            <h1 className="text-3xl font-bold">Gestion Maison & Tâches</h1>
          </div>
          <div className="flex gap-2">
             <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" /> Nouvelle Tâche
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Créer une tâche ménagère</DialogTitle>
                  <DialogDescription>Ajoutez une tâche récurrente intelligente.</DialogDescription>
                </DialogHeader>
                <form id="task-form" onSubmit={handleAddTask} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskName">Nom de la tâche</Label>
                    <Input id="taskName" name="taskName" placeholder="ex: Nettoyer le four" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Pièce / Zone</Label>
                      <Select value={room} onValueChange={setRoom}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <Label htmlFor="duration">Durée estimée (min)</Label>
                      <Input id="duration" name="duration" type="number" defaultValue={15} min={1} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recurrenceDays">Fréquence (jours)</Label>
                      <Input id="recurrenceDays" name="recurrenceDays" type="number" defaultValue={7} min={1} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">Suggestions rapides</Label>
                    <div className="flex flex-wrap gap-2">
                      {TASK_TEMPLATES.map((tmpl, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                          onClick={() => {
                            const form = document.getElementById('task-form') as HTMLFormElement
                            if (form) {
                              const nameInput = form.elements.namedItem('taskName') as HTMLInputElement
                              const durationInput = form.elements.namedItem('duration') as HTMLInputElement
                              const freqInput = form.elements.namedItem('recurrenceDays') as HTMLInputElement
                              if (nameInput) nameInput.value = tmpl.name
                              if (durationInput) durationInput.value = tmpl.duration.toString()
                              if (freqInput) freqInput.value = tmpl.freq.toString()
                              setRoom(tmpl.room)
                              setPriority(tmpl.priority)
                            }
                          }}
                        >
                          {tmpl.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full" disabled={isSavingTask}>
                      {isSavingTask ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 h-auto overflow-x-auto no-scrollbar">
            <TabsTrigger value="dashboard" className="px-6 py-2">
              <LayoutDashboard className="w-4 h-4 mr-2" /> Tableau de bord
            </TabsTrigger>
            <TabsTrigger value="all" className="px-6 py-2">
              <CheckSquare className="w-4 h-4 mr-2" /> Toutes les tâches
            </TabsTrigger>
            <TabsTrigger value="plants" className="px-6 py-2">
              <Leaf className="w-4 h-4 mr-2" /> Vos Plantes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8 animate-in fade-in duration-500">
            {/* Urgent Section */}
            {(overdueTasks.length > 0 || todayTasks.length > 0) && (
              <section className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" /> À faire en priorité
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...overdueTasks, ...todayTasks].map((task) => (
                    <Card key={task.id} className="bg-card/40 border-l-4 border-l-orange-500 relative group overflow-hidden">
                      <div className={cn("absolute top-0 right-0 w-16 h-16 opacity-10 -mr-4 -mt-4", getUrgencyColor(task.nextDueDate))} />
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="text-[10px] uppercase">{task.room}</Badge>
                          {isBefore(new Date(task.nextDueDate.seconds * 1000), new Date()) && !isToday(new Date(task.nextDueDate.seconds * 1000)) && (
                            <Badge variant="destructive" className="text-[10px]">EN RETARD</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg mt-2">{task.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.estimatedMinutes} min</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr })}</span>
                        </div>
                        <Button 
                          onClick={() => handleMarkDone(task)}
                          className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground group"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                          Marquer fait
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Room Breakdown */}
            <section className="space-y-6">
              <h3 className="text-lg font-bold">Par pièce</h3>
              <div className="space-y-8">
                {Object.entries(tasksByRoom).map(([roomName, roomTasks]) => (
                  <div key={roomName} className="space-y-3">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{roomName}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {roomTasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between p-4 bg-card/40 border border-border rounded-xl group hover:border-primary/50 transition-all">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-3 h-3 rounded-full shadow-sm", getUrgencyColor(task.nextDueDate))} />
                            <div>
                              <div className="font-medium">{task.name}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                <Clock className="w-2.5 h-2.5" /> {task.estimatedMinutes} min • Fait le {task.lastCompleted ? format(new Date(task.lastCompleted.seconds * 1000), 'dd/MM') : 'Jamais'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleMarkDone(task)}>
                              <CheckCircle2 className="w-5 h-5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTask(task.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="all" className="space-y-4 animate-in fade-in duration-500">
            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle>Journal des tâches</CardTitle>
                <CardDescription>Liste complète de votre inventaire de maintenance.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {sortedTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-2 h-8 rounded-full", getUrgencyColor(task.nextDueDate))} />
                        <div>
                          <div className="font-semibold">{task.name}</div>
                          <div className="text-xs text-muted-foreground">{task.room} • Tous les {task.recurrenceDays} jours</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs font-medium">Échéance</div>
                          <div className="text-[10px] text-muted-foreground">{format(new Date(task.nextDueDate.seconds * 1000), 'dd MMMM yyyy', { locale: fr })}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleMarkDone(task)}>
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!tasks || tasks.length === 0) && (
                    <div className="p-12 text-center space-y-4">
                      <Home className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                      <p className="text-muted-foreground italic">Aucune tâche enregistrée.</p>
                      <Button variant="outline" onClick={() => setIsAddTaskOpen(true)}>Ajouter ma première tâche</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plants" className="space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-end gap-2">
                <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20">
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
                        <input type="file" accept="image/*" className="hidden" id="plant-photo" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onloadend = () => setPreviewUrl(reader.result as string)
                            reader.readAsDataURL(file)
                          }
                        }} />
                        <Button variant="outline" onClick={() => document.getElementById('plant-photo')?.click()} className="w-full">
                          {previewUrl ? "Changer de photo" : "Prendre / Choisir une photo"}
                        </Button>
                        
                        {previewUrl && !scanResult && (
                          <Button onClick={async () => {
                             setIsScanning(true)
                             try {
                               const res = await identifyPlant({ photoDataUri: previewUrl })
                               setScanResult(res)
                             } catch (e) {
                               toast({ variant: "destructive", title: "Erreur" })
                             } finally {
                               setIsScanning(false)
                             }
                          }} disabled={isScanning} className="w-full bg-primary">
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
                              <p className="text-xs text-muted-foreground">{scanResult.hydrationPlan.frequency} • {scanResult.hydrationPlan.tips}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                </Dialog>
             </div>

             <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: "Monstera Deliciosa", id: 1, health: 65, status: "critical" },
                  { name: "Calathea Orbifolia", id: 2, health: 92, status: "healthy" },
                  { name: "Pothos Argenté", id: 3, health: 88, status: "healthy" },
                  { name: "Ficus Lyrata", id: 4, health: 45, status: "critical" },
                ].map((plant) => (
                  <Card key={plant.id} className="bg-card/40 border-border overflow-hidden group hover:border-primary/50 transition-all group">
                    <div className="h-40 bg-muted relative">
                      <Image 
                        src={`https://picsum.photos/seed/plant-${plant.id}/400/300`} 
                        alt={plant.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        data-ai-hint="house plant"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant={plant.status === 'healthy' ? 'default' : 'destructive'}>
                          {plant.status === 'healthy' ? 'Vigoureuse' : 'Soif'}
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
                      <Button size="icon" variant="ghost" className="w-full flex justify-between px-2 text-blue-500 hover:bg-blue-500/10">
                        <span className="text-xs">Arroser</span>
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
