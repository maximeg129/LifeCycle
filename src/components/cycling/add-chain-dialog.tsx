"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
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
  DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { DEFAULT_WAX_THRESHOLD_KM, DEFAULT_REPLACE_THRESHOLD_KM } from './chain-types'
import { type Bike } from './gear-types'

export function AddChainDialog({ bikes }: { bikes: Bike[] }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bikeId, setBikeId] = useState(bikes[0]?.id ?? '')

  React.useEffect(() => {
    if (!bikeId && bikes.length > 0) setBikeId(bikes[0].id)
  }, [bikes, bikeId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const label = fd.get('label')?.toString().trim()
    const bike = bikes.find((b) => b.id === bikeId)
    if (!label) {
      toast({ variant: 'destructive', title: 'Le nom est requis' })
      return
    }
    if (!bike) {
      toast({ variant: 'destructive', title: 'Choisissez un vélo' })
      return
    }

    setIsSaving(true)
    const chainData = {
      userId: user.uid,
      bikeId: bike.id,
      label,
      status: 'stockage' as const,
      lastWaxDate: null,
      mountedDate: null,
      kmSinceWax: 0,
      totalKm: 0,
      waxThresholdKm: Number(fd.get('waxThresholdKm')) || DEFAULT_WAX_THRESHOLD_KM,
      replaceThresholdKm: Number(fd.get('replaceThresholdKm')) || DEFAULT_REPLACE_THRESHOLD_KM,
      createdAt: serverTimestamp(),
    }
    const ref = doc(collection(db, `users/${user.uid}/chains`))

    try {
      await setDoc(ref, chainData)
      setOpen(false)
      toast({ title: 'Chaîne ajoutée', description: `${label} — ${bike.name}` })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: chainData }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nouvelle chaîne
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle chaîne</DialogTitle>
          <DialogDescription>Une chaîne est dédiée à un vélo — elle ne pourra pas être déplacée vers un autre.</DialogDescription>
        </DialogHeader>

        {bikes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Ajoutez d&apos;abord un vélo dans l&apos;onglet Matériel.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chain-label">Nom *</Label>
              <Input id="chain-label" name="label" placeholder="ex: Chaîne A" required />
            </div>
            <div className="space-y-2">
              <Label>Vélo dédié</Label>
              <Select value={bikeId} onValueChange={setBikeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bikes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="waxThresholdKm">Seuil fartage (km)</Label>
                <Input id="waxThresholdKm" name="waxThresholdKm" type="number" min={1} defaultValue={DEFAULT_WAX_THRESHOLD_KM} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replaceThresholdKm">Seuil remplacement (km)</Label>
                <Input id="replaceThresholdKm" name="replaceThresholdKm" type="number" min={1} defaultValue={DEFAULT_REPLACE_THRESHOLD_KM} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
