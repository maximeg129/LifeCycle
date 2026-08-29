"use client"

import React, { useMemo, useState } from 'react'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { useUser, useFirestore } from '@/firebase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Gauge, Loader2, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { usePowerCurve } from './use-power-curve'
import { fitPowerDurationCurve, computeTTE, type PowerRecord } from './riegel-types'

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  if (m > 0) return `${m}min${sec > 0 ? String(sec).padStart(2, '0') : ''}`
  return `${sec}s`
}

export function PowerCurveCard() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const { data, manual, auto, isConfigured, isLoading, ref } = usePowerCurve()
  const [isSaving, setIsSaving] = useState(false)
  const [targetWatts, setTargetWatts] = useState('')

  // A field is showing an auto-computed value (not yet overridden by hand)
  // when Intervals.icu supplied it and no manual record exists for it.
  const isAuto = {
    short: !manual?.shortRecord && !!auto.shortRecord,
    medium: !manual?.mediumRecord && !!auto.mediumRecord,
    long: !manual?.longRecord && !!auto.longRecord,
  }
  const anyAuto = isAuto.short || isAuto.medium || isAuto.long

  const curve = useMemo(() => {
    const records = [data?.shortRecord, data?.mediumRecord, data?.longRecord].filter((r): r is PowerRecord => !!r)
    return fitPowerDurationCurve(records)
  }, [data])

  const tte = useMemo(() => {
    const watts = Number(targetWatts)
    if (!curve || !watts || watts <= 0) return null
    return computeTTE(watts, curve)
  }, [curve, targetWatts])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db || !ref) return
    const fd = new FormData(e.currentTarget)

    const parseRecord = (durationKey: string, wattsKey: string): PowerRecord | undefined => {
      const minutes = Number(fd.get(durationKey))
      const watts = Number(fd.get(wattsKey))
      if (!minutes || !watts) return undefined
      return { seconds: Math.round(minutes * 60), watts }
    }

    const recordData = {
      shortRecord: parseRecord('shortMinutes', 'shortWatts'),
      mediumRecord: parseRecord('mediumMinutes', 'mediumWatts'),
      longRecord: parseRecord('longMinutes', 'longWatts'),
      updatedAt: serverTimestamp(),
    }

    setIsSaving(true)
    try {
      await setDoc(ref, recordData, { merge: true })
      toast({ title: 'Records de puissance enregistrés' })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: recordData }))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-card/40 border-border">
        <CardHeader className="pb-2"><Skeleton className="h-3 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5" /> Courbe puissance-durée (indice d&apos;endurance de Riegel)
        </CardTitle>
        <CardDescription className="text-xs">3 records perso plutôt qu&apos;une puissance critique ou des seuils supposés fixes</CardDescription>
        {anyAuto && (
          <p className="text-xs text-primary flex items-center gap-1.5 pt-1">
            <Sparkles className="w-3 h-3" /> Calculés depuis votre courbe de puissance Intervals.icu — corrigez si besoin.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              Court (3-7 min) {isAuto.short && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Auto</Badge>}
            </Label>
            <div className="flex gap-2">
              <Input name="shortMinutes" type="number" step={0.1} min={0} placeholder="min" defaultValue={data?.shortRecord ? data.shortRecord.seconds / 60 : undefined} />
              <Input name="shortWatts" type="number" min={0} placeholder="W" defaultValue={data?.shortRecord?.watts} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              Moyen (~20 min) {isAuto.medium && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Auto</Badge>}
            </Label>
            <div className="flex gap-2">
              <Input name="mediumMinutes" type="number" step={0.1} min={0} placeholder="min" defaultValue={data?.mediumRecord ? data.mediumRecord.seconds / 60 : undefined} />
              <Input name="mediumWatts" type="number" min={0} placeholder="W" defaultValue={data?.mediumRecord?.watts} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              Long (&gt;60 min) {isAuto.long && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Auto</Badge>}
            </Label>
            <div className="flex gap-2">
              <Input name="longMinutes" type="number" step={0.1} min={0} placeholder="min" defaultValue={data?.longRecord ? data.longRecord.seconds / 60 : undefined} />
              <Input name="longWatts" type="number" min={0} placeholder="W" defaultValue={data?.longRecord?.watts} />
            </div>
          </div>
          <div className="md:col-span-3">
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer les records
            </Button>
          </div>
        </form>

        {curve ? (
          <div className="pt-4 border-t border-border space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{curve.enduranceIndex.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">indice d&apos;endurance</span>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Calculer le TTE à une puissance cible</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" min={0} placeholder="Watts cible" value={targetWatts} onChange={(e) => setTargetWatts(e.target.value)} className="max-w-[160px]" />
                {tte != null && (
                  <span className="text-sm font-medium">≈ {formatDuration(tte)} de tenue théorique</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Une séance proche de ce temps est une séance dure (RPE élevé), quelle que soit la puissance absolue.</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            {isConfigured
              ? "Pas encore assez d'historique d'activités sur Intervals.icu pour calculer automatiquement 2 records — renseignez-en manuellement ci-dessus."
              : 'Renseignez au moins 2 records pour calculer votre indice d’endurance (ou connectez Intervals.icu dans Réglages pour un calcul automatique).'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
