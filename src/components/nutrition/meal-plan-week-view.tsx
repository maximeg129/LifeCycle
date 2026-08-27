"use client"

import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Check, Pencil, X as SkipIcon, RotateCcw, Trash2, CalendarDays,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { MEAL_TYPE_LABELS, type MealType } from './nutrition-types'
import { useMealPlan } from './use-meal-plan'
import { type PlannedMeal, getWeekStart, getWeekDays, indexToDayName } from './meal-plan-types'
import { ImportMealPlanDialog } from './import-meal-plan-dialog'
import { EditMealDialog } from './edit-meal-dialog'
import { syncMealLog } from './sync-meal-log'
import { EmptyState } from '@/components/ui/empty-state'

type WithIdMeal = PlannedMeal & { id: string }

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const STATUS_STYLES: Record<WithIdMeal['status'], string> = {
  propose: 'bg-muted text-muted-foreground',
  confirme: 'bg-green-500/10 text-green-600',
  modifie: 'bg-primary/10 text-primary',
  saute: 'bg-muted/50 text-muted-foreground/60 line-through',
}

const STATUS_LABELS: Record<WithIdMeal['status'], string> = {
  propose: 'Proposé',
  confirme: 'Confirmé',
  modifie: 'Modifié',
  saute: 'Sauté',
}

export function MealPlanWeekView() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const { weekId, meals, isLoading } = useMealPlan(weekStart)
  const [editingMeal, setEditingMeal] = useState<WithIdMeal | null>(null)
  const [dragMealId, setDragMealId] = useState<string | null>(null)

  const mealsByDay = useMemo(() => {
    const buckets: WithIdMeal[][] = Array.from({ length: 7 }, () => [])
    for (const meal of meals as WithIdMeal[]) {
      if (!meal.date?.seconds) continue
      const dayIndex = Math.round((meal.date.seconds * 1000 - weekStart.getTime()) / 86400000)
      if (dayIndex >= 0 && dayIndex < 7) buckets[dayIndex].push(meal)
    }
    for (const bucket of buckets) {
      bucket.sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType))
    }
    return buckets
  }, [meals, weekStart])

  const mealRef = (id: string) => doc(db!, `users/${user!.uid}/mealPlans/${weekId}/meals`, id)

  const handleConfirm = async (meal: WithIdMeal) => {
    if (!user || !db || !meal.date?.seconds) return
    try {
      const mealLogId = await syncMealLog({
        db, uid: user.uid, mealLogId: meal.mealLogId, recipeId: meal.recipeId,
        label: meal.recipeName, mealType: meal.mealType, date: new Date(meal.date.seconds * 1000),
        calories: meal.macros.calories, protein: meal.macros.protein, carbs: meal.macros.carbs,
      })
      await updateDoc(mealRef(meal.id), { status: 'confirme', mealLogId, confirmedAt: serverTimestamp() })
      toast({ title: 'Repas confirmé', description: meal.recipeName })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: mealRef(meal.id).path, operation: 'update' }))
    }
  }

  const handleSkip = async (meal: WithIdMeal) => {
    if (!user || !db) return
    updateDoc(mealRef(meal.id), { status: 'saute' }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: mealRef(meal.id).path, operation: 'update' }))
    })
  }

  const handleReactivate = async (meal: WithIdMeal) => {
    if (!user || !db) return
    updateDoc(mealRef(meal.id), { status: 'propose' }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: mealRef(meal.id).path, operation: 'update' }))
    })
  }

  const handleDelete = async (meal: WithIdMeal) => {
    if (!user || !db) return
    try {
      if (meal.mealLogId) await deleteDoc(doc(db, `users/${user.uid}/mealLogs`, meal.mealLogId))
      await deleteDoc(mealRef(meal.id))
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: mealRef(meal.id).path, operation: 'delete' }))
    }
  }

  const handleMove = async (meal: WithIdMeal, newDayIndex: number) => {
    if (!user || !db) return
    const newDate = weekDays[newDayIndex]
    try {
      await updateDoc(mealRef(meal.id), { date: Timestamp.fromDate(newDate) })
      if (meal.mealLogId) {
        await updateDoc(doc(db, `users/${user.uid}/mealLogs`, meal.mealLogId), { date: Timestamp.fromDate(newDate) })
      }
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: mealRef(meal.id).path, operation: 'update' }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-bold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            {format(weekDays[0], 'dd MMM', { locale: fr })} — {format(weekDays[6], 'dd MMM yyyy', { locale: fr })}
          </span>
          <Button variant="outline" size="icon" className="rounded-full h-9 w-9" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekStart(getWeekStart(new Date()))}>Cette semaine</Button>
        </div>
        <ImportMealPlanDialog weekStart={weekStart} />
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-80 w-56 shrink-0 rounded-2xl bg-muted/20 animate-pulse" />)}
        </div>
      ) : meals.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Aucun plan pour cette semaine" description="Importez-en un pour commencer." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {weekDays.map((day, dayIndex) => (
            <div
              key={dayIndex}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragMealId) handleMove((meals as WithIdMeal[]).find((m) => m.id === dragMealId)!, dayIndex) }}
              className="w-56 shrink-0 space-y-3"
            >
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{format(day, 'EEEE', { locale: fr })}</p>
                <p className="text-sm font-bold">{format(day, 'dd MMM', { locale: fr })}</p>
              </div>
              <div className="space-y-2 min-h-[80px]">
                {mealsByDay[dayIndex].length === 0 ? (
                  <div className="h-16 rounded-xl border border-dashed border-border/50 flex items-center justify-center text-[10px] text-muted-foreground/50">
                    Vide
                  </div>
                ) : mealsByDay[dayIndex].map((meal) => (
                  <Card
                    key={meal.id}
                    draggable
                    onDragStart={() => setDragMealId(meal.id)}
                    onDragEnd={() => setDragMealId(null)}
                    className={cn('apple-card border-none p-3 space-y-2 cursor-grab active:cursor-grabbing', meal.status === 'saute' && 'opacity-60')}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{MEAL_TYPE_LABELS[meal.mealType]}</span>
                      <Badge variant="outline" className={cn('text-[9px] border-none px-1.5 py-0', STATUS_STYLES[meal.status])}>
                        {STATUS_LABELS[meal.status]}
                      </Badge>
                    </div>
                    <p className={cn('text-sm font-bold leading-tight', meal.status === 'saute' && 'line-through')}>{meal.recipeName}</p>
                    <p className="text-[10px] text-muted-foreground">{meal.macros.calories} kcal</p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {meal.status === 'propose' && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full text-green-600 hover:bg-green-500/10" onClick={() => handleConfirm(meal)} title="Confirmer">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {meal.status === 'saute' ? (
                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => handleReactivate(meal)} title="Réactiver">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => handleSkip(meal)} title="Sauter">
                          <SkipIcon className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => setEditingMeal(meal)} title="Modifier">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive" onClick={() => handleDelete(meal)} title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <Select value={String(dayIndex)} onValueChange={(v) => handleMove(meal, Number(v))}>
                      <SelectTrigger className="h-6 text-[10px] px-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {weekDays.map((d, i) => (
                          <SelectItem key={i} value={String(i)} className="text-xs capitalize">{indexToDayName(i)} {format(d, 'dd/MM')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditMealDialog meal={editingMeal} weekId={weekId} onOpenChange={(open) => !open && setEditingMeal(null)} />
    </div>
  )
}
