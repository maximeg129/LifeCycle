"use client"

import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Droplets, Bike as BikeIcon, ArrowDownToLine, ArrowUpFromLine, History, Plus, Trash2, ChevronDown, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, deleteDoc, setDoc, updateDoc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import {
  type Chain, type WaxHistoryEntry, CHAIN_STATUS_LABELS,
  computeWaxLevel, needsReplacementCheck, waxProgressPct,
} from './chain-types'
import { type Bike } from './gear-types'
import { AddWaxHistoryDialog } from './add-wax-history-dialog'

const WAX_LEVEL_STYLES = {
  ok: 'bg-green-500/10 text-green-600',
  warning: 'bg-yellow-500/10 text-yellow-600',
  critical: 'bg-red-500/10 text-red-600',
}

interface Props {
  chain: Chain
  bike: Bike | undefined
  otherMountedOnSameBike: Chain | undefined
}

export function ChainCard({ chain, bike, otherMountedOnSameBike }: Props) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [showHistory, setShowHistory] = useState(false)
  const [addingHistory, setAddingHistory] = useState(false)

  const historyQuery = useMemoFirebase(() => {
    if (!user || !db || !showHistory) return null
    return query(collection(db, `users/${user.uid}/chains/${chain.id}/waxHistory`), orderBy('waxDate', 'desc'))
  }, [db, user, chain.id, showHistory])
  const { data: history } = useCollection<WaxHistoryEntry>(historyQuery)

  const waxLevel = computeWaxLevel(chain)
  const needsCheck = needsReplacementCheck(chain)
  const progress = waxProgressPct(chain)

  const chainRef = () => doc(db!, `users/${user!.uid}/chains`, chain.id)

  const handleWax = async () => {
    if (!user || !db) return
    const today = format(new Date(), 'yyyy-MM-dd')
    try {
      const historyRef = doc(collection(db, `users/${user.uid}/chains/${chain.id}/waxHistory`))
      await setDoc(historyRef, {
        userId: user.uid,
        chainId: chain.id,
        waxDate: today,
        mountDate: null,
        unmountDate: null,
        km: chain.kmSinceWax,
        notes: '',
        createdAt: serverTimestamp(),
      })
      await updateDoc(chainRef(), { kmSinceWax: 0, lastWaxDate: today })
      toast({ title: 'Chaîne fartée', description: `${chain.label} — ${chain.kmSinceWax} km depuis le fartage précédent` })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: chainRef().path, operation: 'update' }))
    }
  }

  const handleMount = async () => {
    if (!user || !db) return
    const today = format(new Date(), 'yyyy-MM-dd')
    try {
      if (otherMountedOnSameBike) {
        await updateDoc(doc(db, `users/${user.uid}/chains`, otherMountedOnSameBike.id), { status: 'stockage', mountedDate: null })
      }
      await updateDoc(chainRef(), { status: 'montee', mountedDate: today })
      toast({ title: 'Chaîne montée', description: `${chain.label} sur ${bike?.name ?? 'le vélo'}` })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: chainRef().path, operation: 'update' }))
    }
  }

  const handleUnmount = async () => {
    if (!user || !db) return
    updateDoc(chainRef(), { status: 'stockage', mountedDate: null }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: chainRef().path, operation: 'update' }))
    })
  }

  const handleDelete = async () => {
    if (!user || !db) return
    try {
      const historySnap = await getDocs(collection(db, `users/${user.uid}/chains/${chain.id}/waxHistory`))
      await Promise.all(historySnap.docs.map((d) => deleteDoc(d.ref)))
      await deleteDoc(chainRef())
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: chainRef().path, operation: 'delete' }))
    }
  }

  return (
    <Card className="apple-card border-none p-6 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-lg">{chain.label}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <BikeIcon className="w-3 h-3" /> {bike?.name ?? 'Vélo inconnu'}
          </p>
        </div>
        <Badge variant="outline" className={cn('text-[10px] border-none px-2', chain.status === 'montee' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          {CHAIN_STATUS_LABELS[chain.status]}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-bold tracking-tight">{chain.kmSinceWax} km</span>
          <Badge variant="outline" className={cn('text-[10px] border-none px-2', WAX_LEVEL_STYLES[waxLevel])}>
            {waxLevel === 'critical' ? 'À farter' : waxLevel === 'warning' ? 'Bientôt' : 'OK'}
          </Badge>
        </div>
        <Progress value={progress} className="h-1.5" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Depuis le fartage · seuil {chain.waxThresholdKm} km
        </p>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Cumul total : {chain.totalKm} km</span>
        {chain.lastWaxDate && <span>Farté le {format(parseISO(chain.lastWaxDate), 'dd MMM', { locale: fr })}</span>}
      </div>

      {needsCheck && (
        <div className="p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 flex items-center gap-2 text-[11px] text-orange-600">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {chain.totalKm} km au total — vérifiez l&apos;usure avec un outil dédié.
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleWax}>
          <Droplets className="w-3.5 h-3.5" /> Farter
        </Button>
        {chain.status === 'montee' ? (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleUnmount}>
            <ArrowUpFromLine className="w-3.5 h-3.5" /> Démonter
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleMount}>
            <ArrowDownToLine className="w-3.5 h-3.5" /> Monter
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete} title="Supprimer">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <History className="w-3 h-3" /> Historique de fartage
              <ChevronDown className={cn('w-3 h-3 transition-transform', showHistory && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <button
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            onClick={() => { setAddingHistory(true); setShowHistory(true) }}
          >
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        </div>
        <CollapsibleContent className="pt-3 space-y-1.5">
          {!history || history.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Aucun fartage enregistré.</p>
          ) : history.map((h) => (
            <div key={h.id} className="flex flex-col gap-0.5 text-[11px] text-muted-foreground border-b border-border/30 pb-1.5 last:border-none">
              <div className="flex justify-between">
                <span className="font-medium text-foreground">Farté le {format(parseISO(h.waxDate), 'dd MMM yyyy', { locale: fr })}</span>
                <span>{h.km} km</span>
              </div>
              {(h.mountDate || h.unmountDate) && (
                <span>
                  {h.mountDate && `Monté le ${format(parseISO(h.mountDate), 'dd MMM yyyy', { locale: fr })}`}
                  {h.mountDate && h.unmountDate && ' — '}
                  {h.unmountDate && `Démonté le ${format(parseISO(h.unmountDate), 'dd MMM yyyy', { locale: fr })}`}
                </span>
              )}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <AddWaxHistoryDialog chain={chain} open={addingHistory} onOpenChange={setAddingHistory} />
    </Card>
  )
}
