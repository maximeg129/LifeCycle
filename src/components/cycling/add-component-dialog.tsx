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
import {
  type Bike,
  type ComponentCategory,
  COMPONENT_CATEGORY_LABELS,
  DEFAULT_THRESHOLDS,
  COMPONENT_GROUPS,
} from './gear-types'

interface Props {
  bikes: Bike[]
  preselectedBikeId?: string
}

export function AddComponentDialog({ bikes, preselectedBikeId }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bikeId, setBikeId] = useState(preselectedBikeId || '')
  const [category, setCategory] = useState<ComponentCategory>('chain')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLDS.chain)

  const handleCategoryChange = (cat: ComponentCategory) => {
    setCategory(cat)
    setThreshold(DEFAULT_THRESHOLDS[cat])
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const selectedBike = bikeId || bikes[0]?.id
    if (!selectedBike) {
      toast({ variant: 'destructive', title: 'Ajoutez d\'abord un velo' })
      return
    }

    setIsSaving(true)
    const fd = new FormData(e.currentTarget)

    const componentData = {
      bikeId: selectedBike,
      category,
      brand: fd.get('brand')?.toString() || '',
      model: fd.get('model')?.toString() || '',
      installedDate: fd.get('installedDate')?.toString() || format(new Date(), 'yyyy-MM-dd'),
      installedAtKm: Number(fd.get('installedAtKm')) || 0,
      currentKm: Number(fd.get('currentKm')) || 0,
      thresholdKm: threshold,
      purchaseDate: fd.get('purchaseDate')?.toString() || format(new Date(), 'yyyy-MM-dd'),
      purchasePrice: fd.get('purchasePrice') ? Number(fd.get('purchasePrice')) : null,
      retailer: fd.get('retailer')?.toString() || '',
      productUrl: fd.get('productUrl')?.toString() || '',
      warrantyMonths: fd.get('warrantyMonths') ? Number(fd.get('warrantyMonths')) : null,
      tireWidth: (category === 'tire_front' || category === 'tire_rear')
        ? (Number(fd.get('tireWidth')) || 28)
        : null,
      notes: fd.get('notes')?.toString() || '',
      status: 'active' as const,
      retiredDate: null,
      retiredAtKm: null,
      retiredReason: null,
      createdAt: serverTimestamp(),
    }

    const compRef = doc(collection(db, `users/${user.uid}/components`))
    setDoc(compRef, componentData)
      .then(() => {
        setOpen(false)
        toast({ title: 'Composant ajoute', description: `${COMPONENT_CATEGORY_LABELS[category]} installe.` })
      })
      .catch(() => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({ path: compRef.path, operation: 'create', requestResourceData: componentData })
        )
      })
      .finally(() => setIsSaving(false))
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Composant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau composant</DialogTitle>
          <DialogDescription>Ajoutez un composant pour suivre son usure et planifier le remplacement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bike selector */}
          <div className="space-y-2">
            <Label>Velo</Label>
            <Select value={bikeId || bikes[0]?.id || ''} onValueChange={setBikeId}>
              <SelectTrigger><SelectValue placeholder="Choisir un velo" /></SelectTrigger>
              <SelectContent>
                {bikes.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category selector - grouped */}
          <div className="space-y-2">
            <Label>Type de composant</Label>
            <Select value={category} onValueChange={(v) => handleCategoryChange(v as ComponentCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPONENT_GROUPS.map(group => (
                  <React.Fragment key={group.label}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                    {group.categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{COMPONENT_CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </React.Fragment>
                ))}
                <SelectItem value="other">{COMPONENT_CATEGORY_LABELS.other}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-brand">Marque</Label>
              <Input id="comp-brand" name="brand" placeholder="Shimano, SRAM..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-model">Modele / Reference</Label>
              <Input id="comp-model" name="model" placeholder="Ultegra, XX Eagle..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-installed-date">Date d&apos;installation</Label>
              <Input id="comp-installed-date" name="installedDate" type="date" defaultValue={today} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-installed-km">Km au montage</Label>
              <Input id="comp-installed-km" name="installedAtKm" type="number" min={0} defaultValue={0} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-current-km">Km actuels</Label>
              <Input id="comp-current-km" name="currentKm" type="number" min={0} defaultValue={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-threshold">Seuil remplacement (km)</Label>
              <Input
                id="comp-threshold"
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-price">Prix</Label>
              <Input id="comp-price" name="purchasePrice" type="number" min={0} step={0.01} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-purchase-date">Date d&apos;achat</Label>
              <Input id="comp-purchase-date" name="purchaseDate" type="date" defaultValue={today} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-retailer">Revendeur</Label>
              <Input id="comp-retailer" name="retailer" placeholder="Magasin ou site" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-warranty">Garantie (mois)</Label>
              <Input id="comp-warranty" name="warrantyMonths" type="number" min={0} placeholder="24" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comp-url">Lien produit</Label>
            <Input id="comp-url" name="productUrl" type="url" placeholder="https://..." />
          </div>

          {(category === 'tire_front' || category === 'tire_rear') && (
            <div className="space-y-2">
              <Label htmlFor="comp-tire-width">Largeur pneu (mm)</Label>
              <Input id="comp-tire-width" name="tireWidth" type="number" min={20} max={80} defaultValue={28} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comp-notes">Notes</Label>
            <Textarea id="comp-notes" name="notes" rows={2} placeholder="Details supplementaires..." />
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
