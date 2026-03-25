import { Timestamp } from 'firebase/firestore'

// ── Types ────────────────────────────────────────────────────────────

export type BikeType = 'road' | 'mtb' | 'gravel' | 'tt' | 'track' | 'other'

export interface Bike {
  id: string
  name: string
  type: BikeType
  brand: string
  model: string
  totalKm: number
  purchaseDate: string // ISO date
  purchasePrice: number | null
  retailer: string
  productUrl: string
  notes: string
  isActive: boolean
  createdAt: Timestamp
}

export type ComponentCategory =
  | 'chain'
  | 'cassette'
  | 'chainrings'
  | 'brake_pads_front'
  | 'brake_pads_rear'
  | 'disc_rotor_front'
  | 'disc_rotor_rear'
  | 'tire_front'
  | 'tire_rear'
  | 'bar_tape'
  | 'cables_shift'
  | 'cables_brake'
  | 'bottom_bracket'
  | 'cleats'
  | 'tubeless_sealant'
  | 'other'

export interface BikeComponent {
  id: string
  bikeId: string
  category: ComponentCategory
  brand: string
  model: string
  installedDate: string
  installedAtKm: number
  currentKm: number
  thresholdKm: number
  purchaseDate: string
  purchasePrice: number | null
  retailer: string
  productUrl: string
  warrantyMonths: number | null
  barcode: string
  notes: string
  status: 'active' | 'warning' | 'critical' | 'retired'
  retiredDate: string | null
  retiredAtKm: number | null
  retiredReason: string | null
  createdAt: Timestamp
}

export interface MaintenanceLog {
  id: string
  bikeId: string
  componentId: string | null
  date: string
  description: string
  cost: number | null
  shop: string
  createdAt: Timestamp
}

// ── Constantes ───────────────────────────────────────────────────────

export const BIKE_TYPE_LABELS: Record<BikeType, string> = {
  road: 'Route',
  mtb: 'VTT',
  gravel: 'Gravel',
  tt: 'Contre-la-montre',
  track: 'Piste',
  other: 'Autre',
}

export const BIKE_TYPE_COLORS: Record<BikeType, string> = {
  road: 'bg-accent/20 text-accent border-accent/20',
  mtb: 'bg-green-500/20 text-green-400 border-green-500/20',
  gravel: 'bg-orange-500/20 text-orange-400 border-orange-500/20',
  tt: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
  track: 'bg-pink-500/20 text-pink-400 border-pink-500/20',
  other: 'bg-muted text-muted-foreground border-border',
}

export const COMPONENT_CATEGORY_LABELS: Record<ComponentCategory, string> = {
  chain: 'Chaine',
  cassette: 'Cassette',
  chainrings: 'Plateaux',
  brake_pads_front: 'Plaquettes avant',
  brake_pads_rear: 'Plaquettes arriere',
  disc_rotor_front: 'Disque avant',
  disc_rotor_rear: 'Disque arriere',
  tire_front: 'Pneu avant',
  tire_rear: 'Pneu arriere',
  bar_tape: 'Guidoline',
  cables_shift: 'Cables vitesses',
  cables_brake: 'Cables freins',
  bottom_bracket: 'Boitier de pedalier',
  cleats: 'Cales',
  tubeless_sealant: 'Liquide tubeless',
  other: 'Autre',
}

export const DEFAULT_THRESHOLDS: Record<ComponentCategory, number> = {
  chain: 4000,
  cassette: 12000,
  chainrings: 18000,
  brake_pads_front: 8000,
  brake_pads_rear: 8000,
  disc_rotor_front: 20000,
  disc_rotor_rear: 20000,
  tire_front: 5000,
  tire_rear: 4000,
  bar_tape: 5000,
  cables_shift: 8000,
  cables_brake: 8000,
  bottom_bracket: 20000,
  cleats: 8000,
  tubeless_sealant: 3000,
  other: 10000,
}

export const COMPONENT_GROUPS: { label: string; categories: ComponentCategory[] }[] = [
  {
    label: 'Transmission',
    categories: ['chain', 'cassette', 'chainrings'],
  },
  {
    label: 'Freinage',
    categories: ['brake_pads_front', 'brake_pads_rear', 'disc_rotor_front', 'disc_rotor_rear'],
  },
  {
    label: 'Roues & Pneus',
    categories: ['tire_front', 'tire_rear', 'tubeless_sealant'],
  },
  {
    label: 'Contact & Cables',
    categories: ['bar_tape', 'cables_shift', 'cables_brake', 'bottom_bracket', 'cleats'],
  },
]
