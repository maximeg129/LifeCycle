"use client"

// Garde-robe cycliste — anciennement une simple boîte de dialogue accessible
// depuis Météo & Tenue (Coach), déplacée dans Garage lors de la refonte IA :
// c'est du matériel comme les vélos et les chaînes, ça n'a pas de raison de
// vivre à côté de la fonctionnalité IA qui la consomme plutôt qu'à côté du
// reste du matériel. Météo & Tenue garde un simple lien vers cet onglet.
// Les données (`cyclingClothingItems`, clothing-types.ts) n'ont pas bougé.

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Shirt, Plus, Trash2, Loader2, Wind, Droplets } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useClothingInventory } from '@/components/weather/use-clothing-inventory'
import { EmptyState } from '@/components/ui/empty-state'
import {
  CLOTHING_TYPE_LABELS,
  CLOTHING_LAYER_LABELS,
  type ClothingItem,
  type ClothingType,
  type ClothingLayer,
} from '@/components/weather/clothing-types'

type WithIdItem = ClothingItem & { id: string }

export function WardrobeTab() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const { items, isLoading } = useClothingInventory()

  const [isSaving, setIsSaving] = useState(false)
  const [type, setType] = useState<ClothingType>('jersey')
  const [layer, setLayer] = useState<ClothingLayer>('mid')
  const [windproof, setWindproof] = useState(false)
  const [waterproof, setWaterproof] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const name = fd.get('name')?.toString().trim()
    const temperatureRangeCelsius = fd.get('temperatureRangeCelsius')?.toString().trim() || 'n/a'
    if (!name) {
      toast({ variant: 'destructive', title: 'Le nom est requis' })
      return
    }

    setIsSaving(true)
    const itemData = { userId: user.uid, name, type, temperatureRangeCelsius, windproof, waterproof, layer, createdAt: serverTimestamp() }
    const ref = doc(collection(db, `users/${user.uid}/cyclingClothingItems`))

    try {
      await setDoc(ref, itemData)
      toast({ title: 'Vêtement ajouté', description: name })
      ;(e.target as HTMLFormElement).reset()
      setWindproof(false)
      setWaterproof(false)
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'create', requestResourceData: itemData }))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item: WithIdItem) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/cyclingClothingItems`, item.id)
    try {
      await deleteDoc(ref)
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="lc-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shirt className="w-5 h-5 text-primary" /> Garde-robe cycliste {items.length > 0 && `(${items.length})`}
          </CardTitle>
          <CardDescription>L&apos;IA (Coach &gt; Météo &amp; Tenue) ne recommandera que des vêtements de cette liste.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : items.length === 0 ? (
            <EmptyState size="compact" icon={Shirt} title="Aucun vêtement enregistré — ajoutez-en à droite." />
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    {CLOTHING_TYPE_LABELS[item.type]} · {item.temperatureRangeCelsius}
                    {item.windproof && <Wind className="w-3 h-3" />}
                    {item.waterproof && <Droplets className="w-3 h-3" />}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lc-card h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Ajouter un vêtement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cloth-name">Nom *</Label>
              <Input id="cloth-name" name="name" placeholder="ex: Veste Gore-Tex Shakedry" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as ClothingType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLOTHING_TYPE_LABELS) as ClothingType[]).map((k) => (
                      <SelectItem key={k} value={k}>{CLOTHING_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Couche</Label>
                <Select value={layer} onValueChange={(v) => setLayer(v as ClothingLayer)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLOTHING_LAYER_LABELS) as ClothingLayer[]).map((k) => (
                      <SelectItem key={k} value={k}>{CLOTHING_LAYER_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloth-temp">Plage de température</Label>
              <Input id="cloth-temp" name="temperatureRangeCelsius" placeholder="ex: 5-15°C" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <Label className="text-sm">Coupe-vent</Label>
                <Switch checked={windproof} onCheckedChange={setWindproof} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <Label className="text-sm">Imperméable</Label>
                <Switch checked={waterproof} onCheckedChange={setWaterproof} />
              </div>
            </div>
            <Button type="submit" disabled={isSaving} className="w-full gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter à la garde-robe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
