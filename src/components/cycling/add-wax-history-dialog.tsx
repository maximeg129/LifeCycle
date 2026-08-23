"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { History, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { type Chain } from './chain-types'

interface Props {
  chain: Chain
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddWaxHistoryDialog({ chain, open, onOpenChange }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)
  const [addToTotal, setAddToTotal] = useState(true)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const waxDate = fd.get('waxDate')?.toString()
    const mountDate = fd.get('mountDate')?.toString() || null
    const unmountDate = fd.get('unmountDate')?.toString() || null
    const km = Number(fd.get('km')) || 0
    const notes = fd.get('notes')?.toString() || ''

    if (!waxDate) {
      toast({ variant: 'destructive', title: 'La date de fartage est requise' })
      return
    }

    setIsSaving(true)
    const entryData = {
      userId: user.uid,
      chainId: chain.id,
      waxDate,
      mountDate,
      unmountDate,
      km,
      notes,
      createdAt: serverTimestamp(),
    }
    const historyRef = doc(collection(db, `users/${user.uid}/chains/${chain.id}/waxHistory`))

    try {
      await setDoc(historyRef, entryData)
      if (addToTotal && km > 0) {
        await updateDoc(doc(db, `users/${user.uid}/chains`, chain.id), { totalKm: increment(km) })
      }
      toast({ title: 'Historique ajouté', description: `${km} km — ${waxDate}` })
      ;(e.target as HTMLFormElement).reset()
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: historyRef.path, operation: 'create', requestResourceData: entryData }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="w-4 h-4" /> Historique de fartage — {chain.label}</DialogTitle>
          <DialogDescription>
            Pour rattraper des rotations déjà faites. Le formulaire reste ouvert après ajout pour en saisir plusieurs à la suite.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="waxDate" className="text-xs">Date de fartage *</Label>
              <Input id="waxDate" name="waxDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mountDate" className="text-xs">Date de montage</Label>
              <Input id="mountDate" name="mountDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unmountDate" className="text-xs">Date de démontage</Label>
              <Input id="unmountDate" name="unmountDate" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="km">Km parcourus pendant ce cycle</Label>
            <Input id="km" name="km" type="number" min={0} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="optionnel" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="addToTotal" checked={addToTotal} onCheckedChange={(v) => setAddToTotal(!!v)} />
            <Label htmlFor="addToTotal" className="text-xs font-normal text-muted-foreground">
              Ajouter ces km au cumul total de la chaîne ({chain.totalKm} km actuellement)
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Terminé</Button>
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
