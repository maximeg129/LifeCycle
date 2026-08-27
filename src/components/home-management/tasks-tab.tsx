"use client"

import React, { useState } from 'react'
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
  DialogTrigger
} from '@/components/ui/dialog'
import { CheckCircle2, Plus, Clock, Loader2, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useTasks, type Task } from './use-tasks'
import { EmptyState } from '@/components/ui/empty-state'

const ROOMS = ['Cuisine', 'Salon', 'Chambre', 'SdB', 'Extérieur', 'Général']

export function TasksTab() {
  const { toast } = useToast()
  const { tasks, isLoading, addTask, markDone } = useTasks()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [room, setRoom] = useState(ROOMS[0])
  const [priority, setPriority] = useState<Task['priority']>('medium')

  const handleMarkDone = async (task: Task) => {
    const nextDue = await markDone(task).catch(() => null)
    if (!nextDue) return
    toast({ title: 'Bien joué !', description: `${task.name} reprogrammé pour le ${format(nextDue, 'dd MMM', { locale: fr })}.` })
  }

  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    const formData = new FormData(e.currentTarget)
    const name = formData.get('taskName')?.toString()
    if (!name) {
      toast({ variant: 'destructive', title: 'Nom requis' })
      setIsSaving(false)
      return
    }
    const recurrenceDays = Number(formData.get('recurrenceDays')) || 7
    const estimatedMinutes = Number(formData.get('duration')) || 15
    try {
      await addTask({ name, room, priority, recurrenceDays, estimatedMinutes })
      setIsAddOpen(false)
      toast({ title: 'Tâche enregistrée' })
    } catch {
      // errorEmitter already surfaced the permission dialog
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full h-12 px-6 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105">
              <Plus className="w-5 h-5 mr-2" /> Nouvelle tâche
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] rounded-3xl p-8 border-none shadow-3xl">
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
                    <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Priorité</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Task['priority'])}>
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
              <Button type="submit" className="w-full h-14 rounded-2xl font-bold bg-primary text-white" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'Planifier'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-muted/20 animate-pulse" />
          ))
        ) : tasks.length === 0 ? (
          <EmptyState className="col-span-full" icon={CheckCircle2} title="Tout est sous contrôle" />
        ) : tasks.map((task) => (
          <Card key={task.id} className="apple-card border-none p-6 flex flex-col justify-between h-full">
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="bg-primary/5 text-primary font-bold rounded-full text-[10px] border-none px-3 py-1 uppercase tracking-wider">{task.room}</Badge>
                <div className={cn('w-2.5 h-2.5 rounded-full shadow-sm', task.priority === 'high' ? 'bg-destructive' : task.priority === 'medium' ? 'bg-orange-500' : 'bg-green-500')} />
              </div>
              <h3 className="text-xl font-bold tracking-tight">{task.name}</h3>
              <div className="flex gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 opacity-60" /> {task.estimatedMinutes} min</span>
                <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 opacity-60" /> {task.nextDueDate?.seconds ? format(new Date(task.nextDueDate.seconds * 1000), 'dd MMM', { locale: fr }) : 'N/A'}</span>
              </div>
            </div>
            <Button onClick={() => handleMarkDone(task)} className="w-full h-12 rounded-2xl bg-secondary text-foreground hover:bg-primary hover:text-white transition-all font-bold mt-8">Terminer</Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
