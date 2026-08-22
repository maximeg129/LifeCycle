"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Search, Bike, CookingPot, Home, Flower2, HeartPulse, Wallet, CloudSun, Settings, CornerDownLeft,
} from 'lucide-react'

interface ResultItem {
  id: string
  label: string
  sublabel?: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  group: string
}

const PAGES: ResultItem[] = [
  { id: 'page-cycling', label: 'Cyclisme', href: '/cycling', icon: Bike, group: 'Pages' },
  { id: 'page-nutrition', label: 'Nutrition', href: '/nutrition', icon: CookingPot, group: 'Pages' },
  { id: 'page-weather', label: 'Météo AI', href: '/weather', icon: CloudSun, group: 'Pages' },
  { id: 'page-home', label: 'Maison', href: '/home-management', icon: Home, group: 'Pages' },
  { id: 'page-botanica', label: 'Botanica', href: '/botanica', icon: Flower2, group: 'Pages' },
  { id: 'page-lifestyle', label: 'Vie & Santé', href: '/lifestyle', icon: HeartPulse, group: 'Pages' },
  { id: 'page-finance', label: 'Finances', href: '/finance', icon: Wallet, group: 'Pages' },
  { id: 'page-settings', label: 'Réglages', href: '/settings', icon: Settings, group: 'Pages' },
]

interface RecipeDoc { title?: string }
interface TaskDoc { name?: string; room?: string }
interface BikeDoc { name?: string; brand?: string; model?: string }
interface PlantDoc { name?: string; species?: string }

export function CommandPalette() {
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [queryText, setQueryText] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    // Also opened programmatically by the sidebar's search button.
    const openHandler = () => setOpen(true)
    window.addEventListener('keydown', handler)
    window.addEventListener('open-command-palette', openHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('open-command-palette', openHandler)
    }
  }, [])

  useEffect(() => {
    if (!open) setQueryText('')
  }, [open])

  const recipesQuery = useMemoFirebase(() => {
    if (!open || !user || !db) return null
    return collection(db, `users/${user.uid}/recipes`)
  }, [open, db, user])
  const { data: recipes } = useCollection<RecipeDoc>(recipesQuery)

  const tasksQuery = useMemoFirebase(() => {
    if (!open || !user || !db) return null
    return collection(db, `users/${user.uid}/tasks`)
  }, [open, db, user])
  const { data: tasks } = useCollection<TaskDoc>(tasksQuery)

  const bikesQuery = useMemoFirebase(() => {
    if (!open || !user || !db) return null
    return collection(db, `users/${user.uid}/bikes`)
  }, [open, db, user])
  const { data: bikes } = useCollection<BikeDoc>(bikesQuery)

  const plantsQuery = useMemoFirebase(() => {
    if (!open || !user || !db) return null
    return collection(db, `users/${user.uid}/plants`)
  }, [open, db, user])
  const { data: plants } = useCollection<PlantDoc>(plantsQuery)

  const allItems = useMemo<ResultItem[]>(() => {
    const items: ResultItem[] = [...PAGES]
    for (const r of recipes || []) {
      if (r.title) items.push({ id: `recipe-${r.id}`, label: r.title, sublabel: 'Recette', href: '/nutrition', icon: CookingPot, group: 'Nutrition' })
    }
    for (const t of tasks || []) {
      if (t.name) items.push({ id: `task-${t.id}`, label: t.name, sublabel: t.room || 'Tâche', href: '/home-management', icon: Home, group: 'Maison' })
    }
    for (const b of bikes || []) {
      const label = b.name || [b.brand, b.model].filter(Boolean).join(' ')
      if (label) items.push({ id: `bike-${b.id}`, label, sublabel: 'Vélo', href: '/cycling', icon: Bike, group: 'Cyclisme' })
    }
    for (const p of plants || []) {
      if (p.name) items.push({ id: `plant-${p.id}`, label: p.name, sublabel: p.species || 'Plante', href: '/botanica', icon: Flower2, group: 'Botanica' })
    }
    return items
  }, [recipes, tasks, bikes, plants])

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase()
    if (!q) return PAGES
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(q) || item.sublabel?.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [allItems, queryText])

  const grouped = useMemo(() => {
    const map = new Map<string, ResultItem[]>()
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)!.push(item)
    }
    return Array.from(map.entries())
  }, [filtered])

  const handleSelect = (item: ResultItem) => {
    setOpen(false)
    router.push(item.href)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Recherche</DialogTitle>
        <div className="flex items-center gap-3 pl-4 pr-10 border-b border-border/60">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Rechercher une page, une recette, une tâche..."
            className="h-14 border-none shadow-none focus-visible:ring-0 px-0"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun résultat</p>
          ) : grouped.map(([group, items]) => (
            <div key={group} className="mb-2">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{group}</p>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                  {item.sublabel && item.group !== 'Pages' && (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">{item.sublabel}</span>
                  )}
                  <CornerDownLeft className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
