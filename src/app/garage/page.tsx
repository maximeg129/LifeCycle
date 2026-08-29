"use client"

// Garage — sorti de Cyclisme et promu en destination de nav à part entière
// (retour utilisateur : le garage doit vivre indépendamment du coaching/
// data, pas comme un sous-onglet noyé dans un autre module). Matériel et
// Chaînes restent regroupés en sous-onglets ici — c'est la même paire
// qu'avant, juste plus son propre onglet Cyclisme > Garage. Garde-robe
// s'y est ajoutée ensuite (retour utilisateur) : c'est du matériel comme
// le reste, ça n'avait pas de raison de rester coincée dans Coach > Météo
// & Tenue à côté de la fonctionnalité IA qui la consomme.

import dynamic from 'next/dynamic'
import { AppNavigation } from '@/components/layout/sidebar'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Wrench, Droplets, Shirt } from 'lucide-react'

const GearTab = dynamic(() => import('@/components/cycling/gear-tab').then(m => m.GearTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const ChainsTab = dynamic(() => import('@/components/cycling/chains-tab').then(m => m.ChainsTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})
const WardrobeTab = dynamic(() => import('@/components/cycling/wardrobe-tab').then(m => m.WardrobeTab), {
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
})

export default function GaragePage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader category="Matériel" title="Garage" />

        <Tabs defaultValue="gear">
          <TabsList className="bg-card/30 border border-border/60 p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="gear" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
              <Wrench className="w-3.5 h-3.5 mr-1.5" /> Matériel
            </TabsTrigger>
            <TabsTrigger value="chains" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
              <Droplets className="w-3.5 h-3.5 mr-1.5" /> Chaînes
            </TabsTrigger>
            <TabsTrigger value="wardrobe" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1.5 text-sm">
              <Shirt className="w-3.5 h-3.5 mr-1.5" /> Garde-robe
            </TabsTrigger>
          </TabsList>
          <TabsContent value="gear" className="space-y-8 pt-6">
            <GearTab />
          </TabsContent>
          <TabsContent value="chains" className="space-y-8 pt-6">
            <ChainsTab />
          </TabsContent>
          <TabsContent value="wardrobe" className="space-y-8 pt-6">
            <WardrobeTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
