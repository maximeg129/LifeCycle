"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { INJURY_STATUS_LABELS, type InjuryStatus } from './coach-memory-types'

export function AddInjuryDialog() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const { isSaving, submit } = useCrudSubmit()
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

    const ok = await submit(
      () => setDoc(ref, injuryData),
      { path: ref.path, operation: 'create', requestResourceData: injuryData }
    )
    if (ok) {
      setOpen(false)
      toast({ title: 'Blessure enregistrée', description: bodyRegion })
    }
  }

  return (
    <CrudDialogShell
      title="Nouvelle blessure"
      description="Le coach IA en tiendra compte dans ses recommandations d'entraînement."
      trigger={
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nouvelle blessure
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      onSubmit={handleSubmit}
    >
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
    </CrudDialogShell>
  )
}
