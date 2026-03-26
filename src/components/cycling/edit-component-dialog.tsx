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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { type BikeComponent, COMPONENT_CATEGORY_LABELS } from './gear-types'

interface Props {
  component: BikeComponent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditComponentDialog({ component, open, onOpenChange }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)

  const isTire = component.category === 'tire_front' || component.category === 'tire_rear'

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    setIsSaving(true)
    const fd = new FormData(e.currentTarget)

    const updates: Record<string, unknown> = {
      brand: fd.get('brand')?.toString() || '',
      model: fd.get('model')?.toString() || '',
      installedDate: fd.get('installedDate')?.toString() || component.installedDate,
      installedAtKm: Number(fd.get('installedAtKm')) ?? component.installedAtKm,
      currentKm: Number(fd.get('currentKm')) ?? component.currentKm,
      thresholdKm: Number(fd.get('thresholdKm')) || component.thresholdKm,
      purchaseDate: fd.get('purchaseDate')?.toString() || component.purchaseDate,
      purchasePrice: fd.get('purchasePrice') ? Number(fd.get('purchasePrice')) : null,
      retailer: fd.get('retailer')?.toString() || '',
      productUrl: fd.get('productUrl')?.toString() || '',
      warrantyMonths: fd.get('warrantyMonths') ? Number(fd.get('warrantyMonths')) : null,
      notes: fd.get('notes')?.toString() || '',
    }

    if (isTire) {
      updates.tireWidth = Number(fd.get('tireWidth')) || 28
    }

    // Recalculate status
    const km = Number(updates.currentKm)
    const threshold = Number(updates.thresholdKm)
    if (km >= threshold) updates.status = 'critical'
    else if (km >= threshold * 0.8) updates.status = 'warning'
    else updates.status = 'active'

    const compRef = doc(db, `users/${user.uid}/components`, component.id)
    updateDoc(compRef, updates)
      .then(() => {
        onOpenChange(false)
        toast({ title: 'Composant mis a jour', description: COMPONENT_CATEGORY_LABELS[component.category] })
      })
      .catch(() => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({ path: compRef.path, operation: 'update', requestResourceData: updates })
        )
      })
      .finally(() => setIsSaving(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier : {COMPONENT_CATEGORY_LABELS[component.category]}</DialogTitle>
          <DialogDescription>Completez ou modifiez les informations du composant.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-brand">Marque</Label>
              <Input id="edit-brand" name="brand" defaultValue={component.brand} placeholder="Shimano, SRAM..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-model">Modele / Reference</Label>
              <Input id="edit-model" name="model" defaultValue={component.model} placeholder="Ultegra, XX Eagle..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-installed-date">Date d&apos;installation</Label>
              <Input id="edit-installed-date" name="installedDate" type="date" defaultValue={component.installedDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-installed-km">Km au montage</Label>
              <Input id="edit-installed-km" name="installedAtKm" type="number" min={0} defaultValue={component.installedAtKm} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-current-km">Km actuels</Label>
              <Input id="edit-current-km" name="currentKm" type="number" min={0} defaultValue={component.currentKm} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-threshold">Seuil remplacement (km)</Label>
              <Input id="edit-threshold" name="thresholdKm" type="number" min={0} defaultValue={component.thresholdKm} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Prix</Label>
              <Input id="edit-price" name="purchasePrice" type="number" min={0} step={0.01} defaultValue={component.purchasePrice ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purchase-date">Date d&apos;achat</Label>
              <Input id="edit-purchase-date" name="purchaseDate" type="date" defaultValue={component.purchaseDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-retailer">Revendeur</Label>
              <Input id="edit-retailer" name="retailer" defaultValue={component.retailer} placeholder="Magasin ou site" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-warranty">Garantie (mois)</Label>
              <Input id="edit-warranty" name="warrantyMonths" type="number" min={0} defaultValue={component.warrantyMonths ?? ''} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-url">Lien produit</Label>
            <Input id="edit-url" name="productUrl" type="url" defaultValue={component.productUrl} placeholder="https://..." />
          </div>

          {isTire && (
            <div className="space-y-2">
              <Label htmlFor="edit-tire-width">Largeur pneu (mm)</Label>
              <Input id="edit-tire-width" name="tireWidth" type="number" min={20} max={80} defaultValue={component.tireWidth || 28} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" name="notes" rows={2} defaultValue={component.notes} />
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
