"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { getDayId } from './lifestyle-types'

export function LogMetricDialog() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const dateStr = fd.get('date')?.toString()
    const date = dateStr ? new Date(dateStr) : new Date()

    const num = (key: string) => {
      const v = fd.get(key)?.toString()
      return v ? Number(v) : undefined
    }

    const sleepHours = num('sleepHours')
    const sleepQuality = num('sleepQuality')
    const hrv = num('hrv')
    const stressScore = num('stressScore')
    const mood = num('mood')
    const bedTime = fd.get('bedTime')?.toString() || undefined

    if ([sleepHours, sleepQuality, hrv, stressScore, mood].every((v) => v === undefined) && !bedTime) {
      toast({ variant: 'destructive', title: 'Renseignez au moins une mesure' })
      return
    }

    setIsSaving(true)
    const dayId = getDayId(date)
    const metricData: Record<string, unknown> = {
      userId: user.uid,
      date: Timestamp.fromDate(date),
      updatedAt: serverTimestamp(),
    }
    if (sleepHours !== undefined) metricData.sleepHours = sleepHours
    if (sleepQuality !== undefined) metricData.sleepQuality = sleepQuality
    if (hrv !== undefined) metricData.hrv = hrv
    if (stressScore !== undefined) metricData.stressScore = stressScore
    if (mood !== undefined) metricData.mood = mood
    if (bedTime) metricData.bedTime = bedTime

    const ref = doc(db, `users/${user.uid}/healthMetrics/${dayId}`)

    try {
      await setDoc(ref, metricData, { merge: true })
      setOpen(false)
      toast({ title: 'Mesures enregistrées', description: format(date, 'dd/MM/yyyy') })
    } catch {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: metricData })
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full h-11 px-6 font-bold gap-2">
          <Plus className="w-4 h-4" /> Enregistrer mes mesures
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Journal du jour</DialogTitle>
          <DialogDescription>Toutes les mesures sont optionnelles — renseignez ce que vous avez.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metric-date">Date</Label>
            <Input id="metric-date" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sleepHours">Sommeil (h)</Label>
              <Input id="sleepHours" name="sleepHours" type="number" min={0} max={24} step={0.1} placeholder="7.5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sleepQuality">Qualité (%)</Label>
              <Input id="sleepQuality" name="sleepQuality" type="number" min={0} max={100} placeholder="85" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hrv">HRV (ms)</Label>
              <Input id="hrv" name="hrv" type="number" min={0} placeholder="65" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stressScore">Stress (0-100)</Label>
              <Input id="stressScore" name="stressScore" type="number" min={0} max={100} placeholder="25" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mood">Humeur (0-10)</Label>
              <Input id="mood" name="mood" type="number" min={0} max={10} placeholder="8" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bedTime">Heure de coucher</Label>
              <Input id="bedTime" name="bedTime" type="time" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
