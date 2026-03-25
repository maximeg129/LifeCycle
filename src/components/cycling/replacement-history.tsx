"use client"

import React, { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Archive, Euro, TrendingDown } from 'lucide-react'
import { type BikeComponent, type Bike, COMPONENT_CATEGORY_LABELS } from './gear-types'

const RETIRE_REASON_LABELS: Record<string, string> = {
  worn: 'Usure normale',
  broken: 'Casse',
  upgrade: 'Amelioration',
  preventive: 'Preventif',
  other: 'Autre',
}

interface Props {
  components: BikeComponent[]
  bikes: Bike[]
}

export function ReplacementHistory({ components, bikes }: Props) {
  const retiredComponents = useMemo(() => {
    return components
      .filter(c => c.status === 'retired')
      .sort((a, b) => (b.retiredDate || '').localeCompare(a.retiredDate || ''))
  }, [components])

  if (retiredComponents.length === 0) return null

  // Stats
  const totalRetired = retiredComponents.length
  const totalSpent = retiredComponents.reduce((sum, c) => sum + (c.purchasePrice || 0), 0)
  const totalKmServed = retiredComponents.reduce((sum, c) => sum + (c.retiredAtKm || c.currentKm || 0), 0)

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <Archive className="w-6 h-6 text-muted-foreground" /> Historique de remplacement
      </h3>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-card/40 border border-border rounded-lg text-center">
          <div className="text-lg font-bold">{totalRetired}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Composants remplaces</div>
        </div>
        <div className="p-3 bg-card/40 border border-border rounded-lg text-center">
          <div className="text-lg font-bold">{totalSpent.toFixed(0)} <span className="text-xs">EUR</span></div>
          <div className="text-[10px] text-muted-foreground uppercase">Total depense</div>
        </div>
        <div className="p-3 bg-card/40 border border-border rounded-lg text-center">
          <div className="text-lg font-bold">{totalKmServed.toLocaleString('fr-FR')}</div>
          <div className="text-[10px] text-muted-foreground uppercase">Km cumules</div>
        </div>
      </div>

      <Card className="bg-card/40 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Composants retires</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-border">
              {retiredComponents.map(comp => {
                const bike = bikes.find(b => b.id === comp.bikeId)
                const kmServed = comp.retiredAtKm || comp.currentKm || 0
                const cpk = comp.purchasePrice && kmServed > 0
                  ? comp.purchasePrice / kmServed
                  : null

                return (
                  <div key={comp.id} className="p-4 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{COMPONENT_CATEGORY_LABELS[comp.category]}</span>
                        {comp.brand && (
                          <span className="text-xs text-muted-foreground">{comp.brand} {comp.model}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {comp.retiredReason ? RETIRE_REASON_LABELS[comp.retiredReason] || comp.retiredReason : 'Retire'}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-3 flex-wrap">
                      {bike && <span>{bike.name}</span>}
                      <span>{kmServed.toLocaleString('fr-FR')} km parcourus</span>
                      {comp.retiredDate && (
                        <span>Retire le {format(parseISO(comp.retiredDate), 'dd MMM yyyy', { locale: fr })}</span>
                      )}
                      {comp.purchasePrice != null && comp.purchasePrice > 0 && (
                        <span className="flex items-center gap-1"><Euro className="w-3 h-3" /> {comp.purchasePrice.toFixed(2)} EUR</span>
                      )}
                      {cpk != null && (
                        <span className="flex items-center gap-1 text-primary">
                          <TrendingDown className="w-3 h-3" />
                          {cpk >= 1 ? `${cpk.toFixed(2)} EUR/km` : `${(cpk * 100).toFixed(1)} ct/km`}
                        </span>
                      )}
                    </div>
                    {comp.installedDate && comp.retiredDate && (
                      <div className="text-[10px] text-muted-foreground">
                        Duree de vie : {format(parseISO(comp.installedDate), 'dd/MM/yy')} → {format(parseISO(comp.retiredDate), 'dd/MM/yy')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </section>
  )
}
