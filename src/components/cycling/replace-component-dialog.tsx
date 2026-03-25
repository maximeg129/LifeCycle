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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import {
  type BikeComponent,
  COMPONENT_CATEGORY_LABELS,
  DEFAULT_THRESHOLDS,
} from './gear-types'

interface Props {
  component: BikeComponent
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RETIRE_REASONS = [
  { value: 'worn', label: 'Usure normale' },
  { value: 'broken', label: 'Casse / Defaillance' },
  { value: 'upgrade', label: 'Amelioration' },
  { value: 'preventive', label: 'Remplacement preventif' },
  { value: 'other', label: 'Autre' },
]

export function ReplaceComponentDialog({ component, open, onOpenChange }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)
  const [retireReason, setRetireReason] = useState('worn')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    const today = format(new Date(), 'yyyy-MM-dd')

    // 1. Retire old component
    const oldRef = doc(db, `users/${user.uid}/components`, component.id)
    const retireData = {
      status: 'retired' as const,
      retiredDate: today,
      retiredAtKm: component.currentKm,
      retiredReason: retireReason,
    }

    // 2. Create new component
    const newCompData = {
      bikeId: component.bikeId,
      category: component.category,
      brand: fd.get('brand')?.toString() || '',
      model: fd.get('model')?.toString() || '',
      installedDate: today,
      installedAtKm: 0,
      currentKm: 0,
      thresholdKm: Number(fd.get('thresholdKm')) || DEFAULT_THRESHOLDS[component.category],
      purchaseDate: fd.get('purchaseDate')?.toString() || today,
      purchasePrice: fd.get('purchasePrice') ? Number(fd.get('purchasePrice')) : null,
      retailer: fd.get('retailer')?.toString() || '',
      productUrl: fd.get('productUrl')?.toString() || '',
      warrantyMonths: fd.get('warrantyMonths') ? Number(fd.get('warrantyMonths')) : null,
      barcode: fd.get('barcode')?.toString() || '',
      notes: fd.get('notes')?.toString() || '',
      status: 'active' as const,
      retiredDate: null,
      retiredAtKm: null,
      retiredReason: null,
      createdAt: serverTimestamp(),
    }

    const newRef = doc(collection(db, `users/${user.uid}/components`))

    Promise.all([
      updateDoc(oldRef, retireData),
      setDoc(newRef, newCompData),
    ])
      .then(() => {
        onOpenChange(false)
        toast({
          title: 'Composant remplace',
          description: `${COMPONENT_CATEGORY_LABELS[component.category]} : ancien retire, nouveau installe.`,
        })
      })
      .catch(() => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({ path: newRef.path, operation: 'create', requestResourceData: newCompData })
        )
      })
      .finally(() => setIsSaving(false))
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remplacer : {COMPONENT_CATEGORY_LABELS[component.category]}</DialogTitle>
          <DialogDescription>
            L&apos;ancien composant ({component.brand} {component.model}, {component.currentKm} km) sera retire.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Retire reason */}
          <div className="space-y-2">
            <Label>Raison du remplacement</Label>
            <Select value={retireReason} onValueChange={setRetireReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RETIRE_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">Nouveau composant</h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="replace-brand">Marque</Label>
              <Input id="replace-brand" name="brand" defaultValue={component.brand} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-model">Modele</Label>
              <Input id="replace-model" name="model" defaultValue={component.model} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="replace-threshold">Seuil remplacement (km)</Label>
              <Input
                id="replace-threshold"
                name="thresholdKm"
                type="number"
                min={0}
                defaultValue={component.thresholdKm}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-price">Prix</Label>
              <Input id="replace-price" name="purchasePrice" type="number" min={0} step={0.01} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="replace-purchase-date">Date d&apos;achat</Label>
              <Input id="replace-purchase-date" name="purchaseDate" type="date" defaultValue={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-retailer">Revendeur</Label>
              <Input id="replace-retailer" name="retailer" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="replace-url">Lien produit</Label>
            <Input id="replace-url" name="productUrl" type="url" placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="replace-warranty">Garantie (mois)</Label>
              <Input id="replace-warranty" name="warrantyMonths" type="number" min={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-barcode">Code-barres</Label>
              <Input id="replace-barcode" name="barcode" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="replace-notes">Notes</Label>
            <Textarea id="replace-notes" name="notes" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remplacer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
