"use client"

import React, { useState, useMemo } from 'react'
import { format, parseISO, addMonths, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Bike,
  Wrench,
  Zap,
  Gauge,
  ChevronRight,
  ChevronDown,
  History,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Euro,
  RefreshCw,
  Shield,
  ScanBarcode,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase'
import { collection, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useToast } from '@/hooks/use-toast'
import { useAthlete } from '@/hooks/use-intervals'
import type { IntervalsGear } from '@/lib/intervals-api'
import {
  type Bike as BikeType,
  type BikeComponent,
  BIKE_TYPE_LABELS,
  BIKE_TYPE_COLORS,
  COMPONENT_CATEGORY_LABELS,
  COMPONENT_GROUPS,
} from './gear-types'
import { AddBikeDialog } from './add-bike-dialog'
import { AddComponentDialog } from './add-component-dialog'
import { ReplaceComponentDialog } from './replace-component-dialog'
import { useGearSync } from './use-gear-sync'

// ── Helpers ──────────────────────────────────────────────────────────

function computeStatus(comp: BikeComponent): 'active' | 'warning' | 'critical' {
  if (comp.status === 'retired') return 'active'
  const ratio = comp.currentKm / comp.thresholdKm
  if (ratio >= 1) return 'critical'
  if (ratio >= 0.8) return 'warning'
  return 'active'
}

function warrantyActive(comp: BikeComponent): boolean {
  if (!comp.warrantyMonths || !comp.purchaseDate) return false
  const expiry = addMonths(parseISO(comp.purchaseDate), comp.warrantyMonths)
  return isBefore(new Date(), expiry)
}

function formatWarrantyExpiry(comp: BikeComponent): string {
  if (!comp.warrantyMonths || !comp.purchaseDate) return ''
  const expiry = addMonths(parseISO(comp.purchaseDate), comp.warrantyMonths)
  return format(expiry, 'dd MMM yyyy', { locale: fr })
}

// ── Tire pressure calculator ─────────────────────────────────────────

function calcPressure(weightKg: number, tireWidthMm: number): { front: number; rear: number } {
  // Simplified formula based on rider weight and tire width
  // Base: 28mm tire, 75kg rider => ~5.0/5.2 bar
  const baseWidth = 28
  const baseWeight = 75
  const basePressure = 5.1

  const widthFactor = baseWidth / tireWidthMm
  const weightFactor = weightKg / baseWeight

  const avgPressure = basePressure * widthFactor * weightFactor
  const front = Math.round((avgPressure * 0.96) * 10) / 10 // Front slightly less
  const rear = Math.round((avgPressure * 1.04) * 10) / 10  // Rear slightly more

  return {
    front: Math.max(2.0, Math.min(9.0, front)),
    rear: Math.max(2.0, Math.min(9.0, rear)),
  }
}

// ── Main component ───────────────────────────────────────────────────

export function GearTab() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()

  // Firestore subscriptions
  const bikesRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return collection(db, `users/${user.uid}/bikes`)
  }, [db, user])
  const { data: bikes, isLoading: loadingBikes } = useCollection<BikeType>(bikesRef)

  const componentsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return collection(db, `users/${user.uid}/components`)
  }, [db, user])
  const { data: components, isLoading: loadingComponents } = useCollection<BikeComponent>(componentsRef)

  // Intervals.icu integration
  const athlete = useAthlete()
  const intervalsSettingsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])
  const { data: intervalsSettings } = useDoc<{ intervalsAthleteId: string; intervalsApiKey: string }>(intervalsSettingsRef)

  const { syncKm, linkBike, isSyncing } = useGearSync({
    bikes: (bikes || []) as BikeType[],
    components: (components || []) as BikeComponent[],
    athleteId: intervalsSettings?.intervalsAthleteId || null,
    apiKey: intervalsSettings?.intervalsApiKey || null,
  })

  const externalBikes: IntervalsGear[] = athlete.data?.bikes?.filter(b => !b.retired) || []
  const isIntervalsConfigured = !!intervalsSettings?.intervalsAthleteId

  // Local state
  const [expandedBike, setExpandedBike] = useState<string | null>(null)
  const [replacingComponent, setReplacingComponent] = useState<BikeComponent | null>(null)
  const [weight, setWeight] = useState(75)
  const [tireWidth, setTireWidth] = useState(28)
  const [pressure, setPressure] = useState<{ front: number; rear: number } | null>(null)

  // Active bikes
  const activeBikes = useMemo(() => {
    return (bikes || []).filter(b => b.isActive).sort((a, b) => b.totalKm - a.totalKm)
  }, [bikes])

  // Active components grouped by bike
  const componentsByBike = useMemo(() => {
    const map = new Map<string, BikeComponent[]>()
    for (const comp of (components || [])) {
      if (comp.status === 'retired') continue
      const list = map.get(comp.bikeId) || []
      list.push(comp)
      map.set(comp.bikeId, list)
    }
    return map
  }, [components])

  // Maintenance alerts (warning + critical)
  const alerts = useMemo(() => {
    return (components || [])
      .filter(c => c.status !== 'retired')
      .map(c => ({ ...c, computedStatus: computeStatus(c) }))
      .filter(c => c.computedStatus === 'warning' || c.computedStatus === 'critical')
      .sort((a, b) => (b.currentKm / b.thresholdKm) - (a.currentKm / a.thresholdKm))
  }, [components])

  // Recent costs
  const recentCosts = useMemo(() => {
    return (components || [])
      .filter(c => c.purchasePrice && c.purchasePrice > 0)
      .sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''))
      .slice(0, 8)
  }, [components])

  // Total cost
  const totalCost = useMemo(() => {
    let bikesCost = 0
    let componentsCost = 0
    for (const b of (bikes || [])) bikesCost += b.purchasePrice || 0
    for (const c of (components || [])) componentsCost += c.purchasePrice || 0
    return { bikes: bikesCost, components: componentsCost, total: bikesCost + componentsCost }
  }, [bikes, components])

  // Warranty alerts
  const warrantyAlerts = useMemo(() => {
    const now = new Date()
    const in30Days = addMonths(now, 1)
    return (components || [])
      .filter(c => {
        if (c.status === 'retired' || !c.warrantyMonths || !c.purchaseDate) return false
        const expiry = addMonths(parseISO(c.purchaseDate), c.warrantyMonths)
        return isBefore(expiry, in30Days) && isBefore(now, expiry)
      })
  }, [components])

  // Handlers
  const handleDeleteBike = (bikeId: string, bikeName: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/bikes`, bikeId)
    deleteDoc(ref)
      .then(() => toast({ title: 'Velo supprime', description: bikeName }))
      .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' })))
  }

  const handleDeleteComponent = (compId: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/components`, compId)
    deleteDoc(ref)
      .then(() => toast({ title: 'Composant supprime' }))
      .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' })))
  }

  const handleUpdateKm = (bikeId: string, newKm: number) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/bikes`, bikeId)
    updateDoc(ref, { totalKm: newKm })
      .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update' })))

    // Update all active components for this bike proportionally
    const bikeComponents = componentsByBike.get(bikeId) || []
    const bike = activeBikes.find(b => b.id === bikeId)
    if (!bike) return
    const delta = newKm - bike.totalKm
    if (delta <= 0) return

    for (const comp of bikeComponents) {
      const compRef = doc(db, `users/${user.uid}/components`, comp.id)
      const updatedKm = comp.currentKm + delta
      const status = updatedKm >= comp.thresholdKm ? 'critical' : updatedKm >= comp.thresholdKm * 0.8 ? 'warning' : 'active'
      updateDoc(compRef, { currentKm: updatedKm, status })
        .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: compRef.path, operation: 'update' })))
    }
  }

  const handleCalcPressure = () => {
    setPressure(calcPressure(weight, tireWidth))
  }

  if (!user) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ── Left Column: Bikes + Alerts ── */}
      <div className="lg:col-span-2 space-y-6">

        {/* Bikes section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Bike className="w-6 h-6 text-primary" /> Vos Velos
            </h3>
            <div className="flex gap-2">
              {isIntervalsConfigured && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={syncKm}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sync...' : 'Sync km'}
                </Button>
              )}
              <AddComponentDialog bikes={activeBikes} />
              <AddBikeDialog />
            </div>
          </div>

          {loadingBikes ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ) : activeBikes.length === 0 ? (
            <Card className="bg-card/40 border-border border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun velo. Ajoutez votre premier velo pour commencer le suivi.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeBikes.map(bike => {
                const bikeComps = componentsByBike.get(bike.id) || []
                const isExpanded = expandedBike === bike.id
                const criticalCount = bikeComps.filter(c => computeStatus(c) === 'critical').length
                const warningCount = bikeComps.filter(c => computeStatus(c) === 'warning').length

                return (
                  <Card key={bike.id} className="bg-card/40 border-border overflow-hidden hover:border-primary/50 transition-all">
                    {/* Bike header */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Bike className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-lg">{bike.name}</h4>
                            <Badge className={BIKE_TYPE_COLORS[bike.type]}>{BIKE_TYPE_LABELS[bike.type]}</Badge>
                            {criticalCount > 0 && <Badge variant="destructive">{criticalCount} alerte{criticalCount > 1 ? 's' : ''}</Badge>}
                            {warningCount > 0 && !criticalCount && <Badge variant="secondary">{warningCount} a surveiller</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {bike.brand} {bike.model} &middot; {bike.totalKm.toLocaleString('fr-FR')} km
                            {bike.purchaseDate && ` &middot; Achat: ${format(parseISO(bike.purchaseDate), 'MMM yyyy', { locale: fr })}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {bike.productUrl && (
                          <a href={bike.productUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-4 h-4" /></Button>
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setExpandedBike(isExpanded ? null : bike.id)}
                        >
                          {bikeComps.length} composant{bikeComps.length !== 1 ? 's' : ''}
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded: components list */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {/* Quick km update */}
                        <div className="p-3 bg-muted/30 flex items-center gap-3">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Mettre a jour km :</span>
                          <Input
                            type="number"
                            className="h-8 w-32"
                            defaultValue={bike.totalKm}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              if (v > bike.totalKm) handleUpdateKm(bike.id, v)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = Number((e.target as HTMLInputElement).value)
                                if (v > bike.totalKm) handleUpdateKm(bike.id, v)
                              }
                            }}
                          />
                          <span className="text-xs text-muted-foreground">km</span>
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive text-xs"
                            onClick={() => handleDeleteBike(bike.id, bike.name)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Supprimer velo
                          </Button>
                        </div>

                        {/* Intervals.icu gear linking */}
                        {isIntervalsConfigured && externalBikes.length > 0 && (
                          <div className="p-3 bg-muted/20 flex items-center gap-3 border-t border-border">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Lier a Intervals.icu :</span>
                            <Select
                              value={bike.externalGearId || '_none'}
                              onValueChange={(v) => linkBike(bike.id, v === '_none' ? null : v)}
                            >
                              <SelectTrigger className="h-8 w-64 text-xs">
                                <SelectValue placeholder="Non lie" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">Non lie</SelectItem>
                                {externalBikes.map(g => (
                                  <SelectItem key={g.id} value={g.id}>
                                    {g.name || `${g.brand_name} ${g.model_name}`}
                                    {g.distance ? ` (${Math.round(g.distance / 1000)} km)` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {bike.lastSyncDate && (
                              <span className="text-[10px] text-muted-foreground">
                                Derniere sync : {bike.lastSyncDate}
                              </span>
                            )}
                          </div>
                        )}

                        {bikeComps.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Aucun composant. Ajoutez-en pour suivre l&apos;usure.
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {COMPONENT_GROUPS.map(group => {
                              const groupComps = bikeComps.filter(c => group.categories.includes(c.category))
                              if (groupComps.length === 0) return null
                              return (
                                <div key={group.label}>
                                  <div className="px-4 py-2 bg-muted/20">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{group.label}</span>
                                  </div>
                                  {groupComps.map(comp => {
                                    const status = computeStatus(comp)
                                    const ratio = Math.min(100, (comp.currentKm / comp.thresholdKm) * 100)
                                    const hasWarranty = warrantyActive(comp)
                                    return (
                                      <div key={comp.id} className="flex flex-col gap-2 p-4 hover:bg-muted/10 transition-colors">
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{COMPONENT_CATEGORY_LABELS[comp.category]}</span>
                                            {comp.brand && <span className="text-xs text-muted-foreground">{comp.brand} {comp.model}</span>}
                                            {hasWarranty && (
                                              <Badge variant="outline" className="text-[10px] gap-1">
                                                <Shield className="w-3 h-3" /> Garantie {formatWarrantyExpiry(comp)}
                                              </Badge>
                                            )}
                                            {comp.barcode && (
                                              <Badge variant="outline" className="text-[10px] gap-1">
                                                <ScanBarcode className="w-3 h-3" /> {comp.barcode}
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant={status === 'critical' ? 'destructive' : status === 'warning' ? 'secondary' : 'outline'}>
                                              {status === 'critical' ? 'Remplacer' : status === 'warning' ? 'Surveiller' : 'OK'}
                                            </Badge>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="text-xs h-7"
                                              onClick={() => setReplacingComponent(comp)}
                                            >
                                              <RefreshCw className="w-3 h-3 mr-1" /> Remplacer
                                            </Button>
                                            {comp.productUrl && (
                                              <a href={comp.productUrl} target="_blank" rel="noopener noreferrer">
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                  <ExternalLink className="w-3 h-3" />
                                                </Button>
                                              </a>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7 text-destructive"
                                              onClick={() => handleDeleteComponent(comp.id)}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </div>
                                        <Progress value={ratio} className="h-1.5" />
                                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-tight">
                                          <span>Usage: {comp.currentKm.toLocaleString('fr-FR')} km</span>
                                          <span>Seuil: {comp.thresholdKm.toLocaleString('fr-FR')} km</span>
                                        </div>
                                        {comp.purchasePrice != null && comp.purchasePrice > 0 && (
                                          <div className="text-[10px] text-muted-foreground flex items-center gap-3">
                                            <span className="flex items-center gap-1"><Euro className="w-3 h-3" /> {comp.purchasePrice.toFixed(2)}</span>
                                            {comp.retailer && <span>{comp.retailer}</span>}
                                            {comp.installedDate && <span>Installe le {format(parseISO(comp.installedDate), 'dd MMM yyyy', { locale: fr })}</span>}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                            {/* Components not in any group */}
                            {bikeComps.filter(c => !COMPONENT_GROUPS.some(g => g.categories.includes(c.category))).map(comp => {
                              const status = computeStatus(comp)
                              const ratio = Math.min(100, (comp.currentKm / comp.thresholdKm) * 100)
                              return (
                                <div key={comp.id} className="flex flex-col gap-2 p-4 hover:bg-muted/10">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">{COMPONENT_CATEGORY_LABELS[comp.category]} {comp.brand} {comp.model}</span>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={status === 'critical' ? 'destructive' : status === 'warning' ? 'secondary' : 'outline'}>
                                        {status === 'critical' ? 'Remplacer' : status === 'warning' ? 'Surveiller' : 'OK'}
                                      </Badge>
                                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setReplacingComponent(comp)}>
                                        <RefreshCw className="w-3 h-3 mr-1" /> Remplacer
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteComponent(comp.id)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <Progress value={ratio} className="h-1.5" />
                                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase">
                                    <span>Usage: {comp.currentKm.toLocaleString('fr-FR')} km</span>
                                    <span>Seuil: {comp.thresholdKm.toLocaleString('fr-FR')} km</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Alerts section */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-accent" /> Alertes Maintenance
          </h3>
          {loadingComponents ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : alerts.length === 0 ? (
            <Card className="bg-card/40 border-border">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Aucune alerte. Tous vos composants sont en bon etat.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => {
                const bike = activeBikes.find(b => b.id === alert.bikeId)
                const ratio = Math.min(100, (alert.currentKm / alert.thresholdKm) * 100)
                return (
                  <div key={alert.id} className="flex flex-col gap-2 p-4 bg-card/40 border border-border rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {COMPONENT_CATEGORY_LABELS[alert.category]}
                        {bike && <span className="text-muted-foreground text-xs ml-2">({bike.name})</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={alert.computedStatus === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.computedStatus === 'critical' ? 'Remplacer' : 'Surveiller'}
                        </Badge>
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setReplacingComponent(alert)}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Remplacer
                        </Button>
                      </div>
                    </div>
                    <Progress value={ratio} className="h-2" />
                    <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-tight">
                      <span>Usage: {alert.currentKm.toLocaleString('fr-FR')} km</span>
                      <span>Seuil: {alert.thresholdKm.toLocaleString('fr-FR')} km</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Warranty alerts */}
          {warrantyAlerts.length > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" /> Garanties expirant bientot
              </h4>
              {warrantyAlerts.map(comp => (
                <div key={comp.id} className="flex justify-between items-center p-3 bg-card/40 border border-yellow-500/30 rounded-xl">
                  <div>
                    <span className="text-sm font-medium">{COMPONENT_CATEGORY_LABELS[comp.category]}</span>
                    <span className="text-xs text-muted-foreground ml-2">{comp.brand} {comp.model}</span>
                  </div>
                  <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">
                    Expire le {formatWarrantyExpiry(comp)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Right Column: Tools ── */}
      <div className="space-y-6">
        {/* Tire pressure calculator */}
        <Card className="bg-card border-border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-primary" /> Pression Pneus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Poids Cycliste (kg)</label>
                  <Input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Largeur Pneu (mm)</label>
                  <Input type="number" value={tireWidth} onChange={e => setTireWidth(Number(e.target.value))} className="h-8" />
                </div>
              </div>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleCalcPressure}>
                Calculer Pression
              </Button>
            </div>
            {pressure && (
              <div className="pt-6 border-t border-border grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xl font-bold">{pressure.front}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Avant (Bar)</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xl font-bold">{pressure.rear}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Arriere (Bar)</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost summary */}
        <Card className="bg-card border-border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="w-5 h-5 text-primary" /> Resume Couts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{totalCost.bikes.toFixed(0)}<span className="text-xs ml-0.5">EUR</span></div>
                <div className="text-[10px] text-muted-foreground uppercase">Velos</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">{totalCost.components.toFixed(0)}<span className="text-xs ml-0.5">EUR</span></div>
                <div className="text-[10px] text-muted-foreground uppercase">Composants</div>
              </div>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg text-center">
              <div className="text-2xl font-bold text-primary">{totalCost.total.toFixed(0)}<span className="text-sm ml-1">EUR</span></div>
              <div className="text-[10px] text-muted-foreground uppercase">Total investi</div>
            </div>
          </CardContent>
        </Card>

        {/* Recent costs */}
        <Card className="bg-card border-border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> Derniers Achats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Aucun achat enregistre</p>
            ) : (
              recentCosts.map(cost => (
                <div key={cost.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-medium">{COMPONENT_CATEGORY_LABELS[cost.category]}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {cost.brand} {cost.model}
                      {cost.purchaseDate && ` · ${format(parseISO(cost.purchaseDate), 'dd MMM yyyy', { locale: fr })}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent">{cost.purchasePrice?.toFixed(2)} EUR</div>
                    {cost.retailer && <div className="text-[10px] text-muted-foreground">{cost.retailer}</div>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Replace component dialog */}
      {replacingComponent && (
        <ReplaceComponentDialog
          component={replacingComponent}
          open={!!replacingComponent}
          onOpenChange={(open) => { if (!open) setReplacingComponent(null) }}
        />
      )}
    </div>
  )
}
