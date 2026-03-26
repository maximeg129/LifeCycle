"use client"

import React from 'react'
import { format, parseISO, addMonths, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Euro, ExternalLink, Pencil, RefreshCw, Shield, Trash2, TrendingDown } from 'lucide-react'
import { type BikeComponent, COMPONENT_CATEGORY_LABELS } from './gear-types'

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

function costPerKm(comp: BikeComponent): string | null {
  if (!comp.purchasePrice || comp.purchasePrice <= 0 || comp.currentKm <= 0) return null
  const cpk = comp.purchasePrice / comp.currentKm
  if (cpk >= 1) return `${cpk.toFixed(2)} EUR/km`
  return `${(cpk * 100).toFixed(1)} ct/km`
}

interface Props {
  comp: BikeComponent
  onEdit: (comp: BikeComponent) => void
  onReplace: (comp: BikeComponent) => void
  onDelete: (compId: string) => void
}

export function ComponentRow({ comp, onEdit, onReplace, onDelete }: Props) {
  const status = computeStatus(comp)
  const ratio = Math.min(100, (comp.currentKm / comp.thresholdKm) * 100)
  const hasWarranty = warrantyActive(comp)
  const cpk = costPerKm(comp)

  return (
    <div className="flex flex-col gap-2 p-4 hover:bg-muted/10 transition-colors">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{COMPONENT_CATEGORY_LABELS[comp.category]}</span>
          {comp.brand && <span className="text-xs text-muted-foreground">{comp.brand} {comp.model}</span>}
          {hasWarranty && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Shield className="w-3 h-3" /> Garantie {formatWarrantyExpiry(comp)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'critical' ? 'destructive' : status === 'warning' ? 'secondary' : 'outline'}>
            {status === 'critical' ? 'Remplacer' : status === 'warning' ? 'Surveiller' : 'OK'}
          </Badge>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onEdit(comp)}>
            <Pencil className="w-3 h-3 mr-1" /> Modifier
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onReplace(comp)}>
            <RefreshCw className="w-3 h-3 mr-1" /> Remplacer
          </Button>
          {comp.productUrl && (
            <a href={comp.productUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3 h-3" /></Button>
            </a>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(comp.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <Progress value={ratio} className="h-1.5" />
      <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-tight">
        <span>Usage: {comp.currentKm.toLocaleString('fr-FR')} km</span>
        <span>Seuil: {comp.thresholdKm.toLocaleString('fr-FR')} km</span>
      </div>
      {(comp.purchasePrice != null && comp.purchasePrice > 0 || cpk) && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-3 flex-wrap">
          {comp.purchasePrice != null && comp.purchasePrice > 0 && (
            <span className="flex items-center gap-1"><Euro className="w-3 h-3" /> {comp.purchasePrice.toFixed(2)} EUR</span>
          )}
          {cpk && (
            <span className="flex items-center gap-1 text-primary"><TrendingDown className="w-3 h-3" /> {cpk}</span>
          )}
          {comp.retailer && <span>{comp.retailer}</span>}
          {comp.installedDate && <span>Installe le {format(parseISO(comp.installedDate), 'dd MMM yyyy', { locale: fr })}</span>}
        </div>
      )}
    </div>
  )
}

export { computeStatus, warrantyActive, formatWarrantyExpiry, costPerKm }
