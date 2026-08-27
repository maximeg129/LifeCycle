import { format } from 'date-fns'

export interface ClothingItem {
  userId: string
  name: string
  type: ClothingType
  temperatureRangeCelsius: string
  windproof: boolean
  waterproof: boolean
  layer: ClothingLayer
  createdAt?: unknown
}

export type ClothingType =
  | 'jersey' | 'jacket' | 'tights' | 'baselayer' | 'gloves' | 'shoe_covers' | 'socks' | 'cap' | 'other'

export const CLOTHING_TYPE_LABELS: Record<ClothingType, string> = {
  jersey: 'Maillot',
  jacket: 'Veste / Gilet',
  tights: 'Cuissard',
  baselayer: 'Sous-couche',
  gloves: 'Gants',
  shoe_covers: 'Couvre-chaussures',
  socks: 'Chaussettes',
  cap: 'Bonnet / Casquette',
  other: 'Autre',
}

export type ClothingLayer = 'base' | 'mid' | 'outer'

export const CLOTHING_LAYER_LABELS: Record<ClothingLayer, string> = {
  base: 'Base',
  mid: 'Intermédiaire',
  outer: 'Extérieure',
}

/** Shape expected by the cyclingOutfitRecommendation AI flow input. */
export interface ClothingInventoryItem {
  name: string
  type: string
  temperatureRangeCelsius: string
  windproof: boolean
  waterproof: boolean
  layer: string
}

export function toFlowInventoryItem(item: ClothingItem): ClothingInventoryItem {
  return {
    name: item.name,
    type: CLOTHING_TYPE_LABELS[item.type] ?? item.type,
    temperatureRangeCelsius: item.temperatureRangeCelsius,
    windproof: item.windproof,
    waterproof: item.waterproof,
    layer: item.layer,
  }
}

/** Combines the outing's date and time inputs into the ISO-ish dateTime string the AI flow expects. */
export function buildOutfitDateTime(date: Date, time: string): string {
  return `${format(date, 'yyyy-MM-dd')}T${time}:00`
}
