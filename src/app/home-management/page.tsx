"use client"

import React, { useState, useMemo } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  DialogDescription
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  Plus,
  Clock,
  Loader2,
  Calendar,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp, query, where, Timestamp } from 'firebase/firestore'
import { format, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export default function HomeManagementPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  
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
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-6">
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