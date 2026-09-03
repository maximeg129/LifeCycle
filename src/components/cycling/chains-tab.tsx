"use client"

import React, { useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Droplets } from 'lucide-react'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection } from 'firebase/firestore'
import { type Bike } from './gear-types'
import { type Chain } from './chain-types'
import { useChains } from './use-chains'
import { AddChainDialog } from './add-chain-dialog'
import { ChainCard } from './chain-card'
import { EmptyState } from '@/components/ui/empty-state'

export function ChainsTab() {
  const { user } = useUser()
  const db = useFirestore()

  const bikesRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return collection(db, `users/${user.uid}/bikes`)
  }, [db, user])
  const { data: bikes, isLoading: loadingBikes } = useCollection<Bike>(bikesRef)

  const { chains, isLoading: loadingChains } = useChains()

  const activeBikes = useMemo(() => (bikes || []).filter((b) => b.isActive), [bikes])
  const bikeById = useMemo(() => new Map((bikes || []).map((b) => [b.id, b])), [bikes])

  const mountedByBike = useMemo(() => {
    const map = new Map<string, Chain>()
    for (const c of chains) {
      if (c.status === 'montee') map.set(c.bikeId, c)
    }
    return map
  }, [chains])

  const isLoading = loadingBikes || loadingChains

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" /> Rotation Hot Wax
          </h3>
          <p className="text-sm text-muted-foreground">Suivi des chaînes fartées, dédiées chacune à un vélo.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            La chaîne montée sur un vélo reçoit automatiquement les km à chaque synchronisation Intervals.icu — déclenchée seule à l&apos;ouverture de l&apos;app, ou manuellement depuis Réglages.
          </p>
        </div>
        <AddChainDialog bikes={activeBikes} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : chains.length === 0 ? (
        <EmptyState icon={Droplets} title="Aucune chaîne suivie pour l'instant." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chains.map((chain) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              bike={bikeById.get(chain.bikeId)}
              otherMountedOnSameBike={mountedByBike.get(chain.bikeId)?.id !== chain.id ? mountedByBike.get(chain.bikeId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
