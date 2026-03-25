"use client"

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { type BikeType, BIKE_TYPE_LABELS } from './gear-types'

export function AddBikeDialog() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bikeType, setBikeType] = useState<BikeType>('road')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const name = fd.get('name')?.toString()
    if (!name) {
      toast({ variant: 'destructive', title: 'Le nom est requis' })
      return
    }

    setIsSaving(true)
    const bikeData = {
      name,
      type: bikeType,
      brand: fd.get('brand')?.toString() || '',
      model: fd.get('model')?.toString() || '',
      totalKm: Number(fd.get('totalKm')) || 0,
      purchaseDate: fd.get('purchaseDate')?.toString() || format(new Date(), 'yyyy-MM-dd'),
      purchasePrice: fd.get('purchasePrice') ? Number(fd.get('purchasePrice')) : null,
      retailer: fd.get('retailer')?.toString() || '',
      productUrl: fd.get('productUrl')?.toString() || '',
      notes: fd.get('notes')?.toString() || '',
      isActive: true,
      createdAt: serverTimestamp(),
    }

    const bikeRef = doc(collection(db, `users/${user.uid}/bikes`))
    setDoc(bikeRef, bikeData)
      .then(() => {
        setOpen(false)
        toast({ title: 'Velo ajoute', description: `${name} a ete ajoute a votre garage.` })
      })
      .catch(() => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({ path: bikeRef.path, operation: 'create', requestResourceData: bikeData })
        )
      })
      .finally(() => setIsSaving(false))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Ajouter un velo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau velo</DialogTitle>
          <DialogDescription>Ajoutez un velo a votre garage pour suivre ses composants.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bike-name">Nom *</Label>
              <Input id="bike-name" name="name" placeholder="Mon velo route" required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={bikeType} onValueChange={(v) => setBikeType(v as BikeType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BIKE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bike-brand">Marque</Label>
              <Input id="bike-brand" name="brand" placeholder="Canyon, Specialized..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bike-model">Modele</Label>
              <Input id="bike-model" name="model" placeholder="Ultimate CF SLX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bike-km">Kilometrage actuel</Label>
              <Input id="bike-km" name="totalKm" type="number" min={0} defaultValue={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bike-purchase-date">Date d&apos;achat</Label>
              <Input id="bike-purchase-date" name="purchaseDate" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bike-price">Prix d&apos;achat</Label>
              <Input id="bike-price" name="purchasePrice" type="number" min={0} step={0.01} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bike-retailer">Revendeur</Label>
              <Input id="bike-retailer" name="retailer" placeholder="Magasin ou site web" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bike-url">Lien produit</Label>
            <Input id="bike-url" name="productUrl" type="url" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bike-notes">Notes</Label>
            <Textarea id="bike-notes" name="notes" placeholder="Taille, couleur, details..." rows={2} />
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
