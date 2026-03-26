"use client"

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Gauge } from 'lucide-react'
import { type Bike, type BikeComponent } from './gear-types'

function calcPressure(weightKg: number, tireWidthMm: number): { front: number; rear: number } {
  const baseWidth = 28
  const baseWeight = 75
  const basePressure = 5.1
  const widthFactor = baseWidth / tireWidthMm
  const weightFactor = weightKg / baseWeight
  const avgPressure = basePressure * widthFactor * weightFactor
  return {
    front: Math.round(Math.max(2.0, Math.min(9.0, avgPressure * 0.96)) * 10) / 10,
    rear: Math.round(Math.max(2.0, Math.min(9.0, avgPressure * 1.04)) * 10) / 10,
  }
}

interface Props {
  bikes: Bike[]
  components: BikeComponent[]
}

export function TirePressureCard({ bikes, components }: Props) {
  const [weight, setWeight] = useState(75)
  const [selectedBikeId, setSelectedBikeId] = useState<string>('')
  const [pressure, setPressure] = useState<{ front: number; rear: number } | null>(null)

  // Get tire width from selected bike's tire components
  const tireInfo = useMemo(() => {
    const bikeId = selectedBikeId || bikes[0]?.id
    if (!bikeId) return { frontWidth: 28, rearWidth: 28, hasTires: false }

    const bikeComps = components.filter(c => c.bikeId === bikeId && c.status !== 'retired')
    const frontTire = bikeComps.find(c => c.category === 'tire_front')
    const rearTire = bikeComps.find(c => c.category === 'tire_rear')

    return {
      frontWidth: frontTire?.tireWidth || 28,
      rearWidth: rearTire?.tireWidth || 28,
      hasTires: !!(frontTire || rearTire),
      frontLabel: frontTire ? `${frontTire.brand} ${frontTire.model}`.trim() : null,
      rearLabel: rearTire ? `${rearTire.brand} ${rearTire.model}`.trim() : null,
    }
  }, [selectedBikeId, bikes, components])

  const handleCalc = () => {
    // Use average tire width if front/rear differ
    const avgWidth = (tireInfo.frontWidth + tireInfo.rearWidth) / 2
    setPressure(calcPressure(weight, avgWidth))
  }

  return (
    <Card className="bg-card border-border shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-primary" /> Pression Pneus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bike selector */}
        {bikes.length > 1 && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Velo</label>
            <Select value={selectedBikeId || bikes[0]?.id || ''} onValueChange={setSelectedBikeId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {bikes.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Poids (kg)</label>
            <Input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="h-8" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">
              Largeur {tireInfo.hasTires ? '(auto)' : '(mm)'}
            </label>
            <Input
              type="number"
              value={tireInfo.frontWidth}
              disabled={tireInfo.hasTires}
              className="h-8"
            />
          </div>
        </div>

        {tireInfo.hasTires && (tireInfo.frontLabel || tireInfo.rearLabel) && (
          <div className="text-[10px] text-muted-foreground">
            {tireInfo.frontLabel && <div>Avant : {tireInfo.frontLabel} ({tireInfo.frontWidth}mm)</div>}
            {tireInfo.rearLabel && <div>Arriere : {tireInfo.rearLabel} ({tireInfo.rearWidth}mm)</div>}
          </div>
        )}

        <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleCalc}>
          Calculer Pression
        </Button>

        {pressure && (
          <div className="pt-4 border-t border-border grid grid-cols-2 gap-4 text-center">
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
  )
}
