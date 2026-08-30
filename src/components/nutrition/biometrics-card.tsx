"use client"

// Taille/âge/sexe pour le métabolisme de base — déplacé ici (page détail de
// Fueling vs Workload) plutôt que noyé dans Réglages, même logique que
// PowerCurveCard sur /cycling/metric/riegel : la saisie vit à côté du calcul
// qui la consomme.

import React, { useEffect, useState } from 'react'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Activity } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { useBiometrics } from './use-biometrics'
import type { Sex } from './fueling-types'

export function BiometricsCard() {
  const { toast } = useToast()
  const { data, isLoading, ref } = useBiometrics()
  const { isSaving, submit } = useCrudSubmit()
  const [sex, setSex] = useState<Sex>('male')

  // Le Select est contrôlé (Radix ne le lie pas au FormData natif comme un
  // <select> ordinaire — même pattern que le sélecteur de repas dans
  // LogMealDialog) — resynchronisé une fois le doc Firestore chargé.
  useEffect(() => {
    if (data?.sex) setSex(data.sex)
  }, [data?.sex])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!ref) return
    const fd = new FormData(e.currentTarget)
    const heightCm = Number(fd.get('heightCm'))
    const age = Number(fd.get('age'))
    if (!heightCm || !age) {
      toast({ variant: 'destructive', title: 'Taille et âge sont requis' })
      return
    }

    const biometricsData = { heightCm, age, sex, updatedAt: serverTimestamp() }
    const ok = await submit(() => setDoc(ref, biometricsData, { merge: true }), { path: ref.path, operation: 'update', requestResourceData: biometricsData })
    if (ok) toast({ title: 'Profil biométrique enregistré' })
  }

  if (isLoading) {
    return (
      <Card className="bg-card/40 border-border">
        <CardHeader className="pb-2"><Skeleton className="h-3 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-16 w-full" /></CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" /> Profil biométrique (métabolisme de base)
        </CardTitle>
        <CardDescription className="text-xs">Taille, âge et sexe — Intervals.icu ne fournit que le poids, le reste se saisit ici</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Taille (cm)</Label>
            <Input name="heightCm" type="number" min={0} placeholder="175" defaultValue={data?.heightCm} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Âge</Label>
            <Input name="age" type="number" min={0} placeholder="35" defaultValue={data?.age} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Sexe</Label>
            <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Homme</SelectItem>
                <SelectItem value="female">Femme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          Formule de Mifflin-St Jeor — la référence actuelle pour estimer le métabolisme de base, plus
          fiable que l&apos;ancienne formule de Harris-Benedict.
        </p>
      </CardContent>
    </Card>
  )
}
