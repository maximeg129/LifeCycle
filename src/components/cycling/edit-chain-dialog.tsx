"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { type Chain } from './chain-types'

interface Props {
  chain: Chain | null
  onOpenChange: (open: boolean) => void
}

export function EditChainDialog({ chain, onOpenChange }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)

  if (!chain) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const label = fd.get('label')?.toString().trim()
    if (!label) {
      toast({ variant: 'destructive', title: 'Le nom est requis' })
      return
    }

    setIsSaving(true)
    const updates = {
      label,
      lastWaxDate: fd.get('lastWaxDate')?.toString() || null,
      kmSinceWax: Number(fd.get('kmSinceWax')) || 0,
      totalKm: Number(fd.get('totalKm')) || 0,
      waxThresholdKm: Number(fd.get('waxThresholdKm')) || chain.waxThresholdKm,
      replaceThresholdKm: Number(fd.get('replaceThresholdKm')) || chain.replaceThresholdKm,
    }
    const chainRef = doc(db, `users/${user.uid}/chains`, chain.id)

    try {
      await updateDoc(chainRef, updates)
      toast({ title: 'Chaîne mise à jour', description: label })
      onOpenChange(false)
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: chainRef.path, operation: 'update', requestResourceData: updates }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={!!chain} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier {chain.label}</DialogTitle>
          <DialogDescription>Corrige l&apos;état actuel de la chaîne (date de fartage, km depuis fartage, cumul total).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} key={chain.id} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Nom *</Label>
            <Input id="label" name="label" defaultValue={chain.label} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastWaxDate">Dernier fartage</Label>
            <Input id="lastWaxDate" name="lastWaxDate" type="date" defaultValue={chain.lastWaxDate ?? undefined} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kmSinceWax">Km depuis fartage</Label>
              <Input id="kmSinceWax" name="kmSinceWax" type="number" min={0} defaultValue={chain.kmSinceWax} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalKm">Cumul total (km)</Label>
              <Input id="totalKm" name="totalKm" type="number" min={0} defaultValue={chain.totalKm} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="waxThresholdKm">Seuil fartage (km)</Label>
              <Input id="waxThresholdKm" name="waxThresholdKm" type="number" min={1} defaultValue={chain.waxThresholdKm} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replaceThresholdKm">Seuil remplacement (km)</Label>
              <Input id="replaceThresholdKm" name="replaceThresholdKm" type="number" min={1} defaultValue={chain.replaceThresholdKm} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
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
