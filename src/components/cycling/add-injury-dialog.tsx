"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { INJURY_STATUS_LABELS, type InjuryStatus } from './coach-memory-types'

export function AddInjuryDialog() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [severity, setSeverity] = useState('3')
  const [status, setStatus] = useState<InjuryStatus>('active')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const bodyRegion = fd.get('bodyRegion')?.toString().trim()
    if (!bodyRegion) {
      toast({ variant: 'destructive', title: 'La zone du corps est requise' })
      return
    }

    setIsSaving(true)
    const injuryData = {
      userId: user.uid,
      bodyRegion,
      severity: Number(severity),
      status,
      startDate: fd.get('startDate')?.toString() || format(new Date(), 'yyyy-MM-dd'),
      description: fd.get('description')?.toString().trim() || '',
      physioInstructions: fd.get('physioInstructions')?.toString().trim() || '',
      createdAt: serverTimestamp(),
    }
    const ref = doc(collection(db, `users/${user.uid}/coachInjuries`))

    try {
      await setDoc(ref, injuryData)
      setOpen(false)
      toast({ title: 'Blessure enregistrée', description: bodyRegion })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: injuryData }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nouvelle blessure
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle blessure</DialogTitle>
          <DialogDescription>Le coach IA en tiendra compte dans ses recommandations d&apos;entraînement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="injury-region">Zone du corps *</Label>
            <Input id="injury-region" name="bodyRegion" placeholder="ex: Genou droit" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sévérité (1-5)</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InjuryStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(INJURY_STATUS_LABELS) as InjuryStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>{INJURY_STATUS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="injury-start">Date de début</Label>
            <Input id="injury-start" name="startDate" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="injury-description">Description</Label>
            <Textarea id="injury-description" name="description" placeholder="Ce qui fait mal, quand, à quelle intensité…" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="injury-physio">Consignes kiné / auto-soin</Label>
            <Textarea id="injury-physio" name="physioInstructions" placeholder="Exercices de renfo, mouvements à éviter…" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
