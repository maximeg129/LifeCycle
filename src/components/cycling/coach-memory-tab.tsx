"use client"

import React, { useState } from 'react'
import { doc, deleteDoc, updateDoc, setDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore'
import { useUser, useFirestore } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, CheckCircle2, Loader2, BrainCircuit } from 'lucide-react'
import { useCoachMemory } from './use-coach-memory'
import { useKJBudget } from './use-kj-budget'
import { AddInjuryDialog } from './add-injury-dialog'
import { AddCoachGoalDialog } from './add-coach-goal-dialog'
import { INJURY_STATUS_LABELS, GOAL_PRIORITY_LABELS, countActiveInjuries, type CoachLifestyle } from './coach-memory-types'
import type { GovernorStatus } from './load-types'
import { EmptyState } from '@/components/ui/empty-state'
import { useAthlete } from '@/hooks/use-intervals'

const GOVERNOR_BADGE: Record<GovernorStatus, { emoji: string; label: string }> = {
  vert: { emoji: '🟢', label: 'Favorable' },
  orange: { emoji: '🟠', label: 'Stable' },
  rouge: { emoji: '🔴', label: 'Dégradé' },
  insufficient_data: { emoji: '⚪', label: 'Données insuffisantes' },
}

export function CoachMemoryTab({ governorStatus }: { governorStatus: GovernorStatus }) {
  const memory = useCoachMemory()
  const athlete = useAthlete()
  const budget = useKJBudget(governorStatus, athlete.data?.weight)
  const activeInjuries = countActiveInjuries(memory.injuries)
  const gov = GOVERNOR_BADGE[governorStatus]

  return (
    <div className="space-y-6">
      {/* Summary badge — proves the coach context is actually loaded before the user asks anything */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <BrainCircuit className="w-4 h-4 text-primary" /> Contexte coach
          </div>
          <span>Budget kJ/kg {budget.realized.toFixed(1)}/{budget.target ? budget.target.toFixed(1) : '—'}</span>
          <span>Charge interne {gov.emoji} {gov.label}</span>
          <span>{activeInjuries} blessure{activeInjuries > 1 ? 's' : ''} active{activeInjuries > 1 ? 's' : ''}</span>
          <span>{memory.goals.length} objectif{memory.goals.length > 1 ? 's' : ''}</span>
        </CardContent>
      </Card>

      <Tabs defaultValue="injuries" className="space-y-4">
        <TabsList className="bg-card/50 border border-border p-1 h-auto flex-wrap">
          <TabsTrigger value="injuries" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">Blessures</TabsTrigger>
          <TabsTrigger value="lifestyle" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">Style de vie</TabsTrigger>
          <TabsTrigger value="goals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">Objectifs</TabsTrigger>
          <TabsTrigger value="facts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">Faits retenus</TabsTrigger>
        </TabsList>

        <TabsContent value="injuries"><InjuriesPanel /></TabsContent>
        <TabsContent value="lifestyle"><LifestylePanel lifestyle={memory.lifestyle} isLoading={memory.isLoading} /></TabsContent>
        <TabsContent value="goals"><GoalsPanel /></TabsContent>
        <TabsContent value="facts"><FactsPanel facts={memory.rememberedFacts} isLoading={memory.isLoading} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ── Blessures ────────────────────────────────────────────────────────────

function InjuriesPanel() {
  const { user } = useUser()
  const db = useFirestore()
  const memory = useCoachMemory()

  const toggleStatus = async (id: string, current: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/coachInjuries/${id}`)
    const nextStatus = current === 'active' ? 'resolved' : 'active'
    try {
      await updateDoc(ref, { status: nextStatus })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { status: nextStatus } }))
    }
  }

  const remove = async (id: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/coachInjuries/${id}`)
    try {
      await deleteDoc(ref)
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    }
  }

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Blessures</CardTitle>
        <AddInjuryDialog />
      </CardHeader>
      <CardContent className="space-y-3">
        {memory.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : memory.injuries.length === 0 ? (
          <EmptyState size="compact" title="Aucune blessure enregistrée." className="py-4" />
        ) : (
          memory.injuries.map((i) => (
            <div key={i.id} className="p-4 rounded-lg border border-border bg-background/40 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{i.bodyRegion}</span>
                  <Badge variant={i.status === 'active' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {INJURY_STATUS_LABELS[i.status]} · sévérité {i.severity}/5
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(i.id, i.status)} title="Basculer le statut">
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Depuis le {i.startDate}</p>
              {i.description && <p className="text-sm">{i.description}</p>}
              {i.physioInstructions && <p className="text-xs text-primary">Kiné : {i.physioInstructions}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ── Style de vie ─────────────────────────────────────────────────────────

function LifestylePanel({ lifestyle, isLoading }: { lifestyle: CoachLifestyle | null; isLoading: boolean }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    const fd = new FormData(e.currentTarget)
    const data = {
      stress: fd.get('stress')?.toString().trim() || '',
      sleepHabits: fd.get('sleepHabits')?.toString().trim() || '',
      workConstraints: fd.get('workConstraints')?.toString().trim() || '',
      notes: fd.get('notes')?.toString().trim() || '',
      updatedAt: serverTimestamp(),
    }
    const ref = doc(db, `users/${user.uid}/coachMemory/lifestyle`)
    setIsSaving(true)
    try {
      await setDoc(ref, data, { merge: true })
      toast({ title: 'Style de vie mis à jour' })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: data }))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader><CardTitle className="text-base">Style de vie</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Stress</label>
            <Textarea name="stress" defaultValue={lifestyle?.stress} placeholder="Niveau de stress habituel, sources principales…" rows={2} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Sommeil habituel</label>
            <Textarea name="sleepHabits" defaultValue={lifestyle?.sleepHabits} placeholder="Heures de coucher/lever, qualité générale…" rows={2} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Contraintes professionnelles</label>
            <Textarea name="workConstraints" defaultValue={lifestyle?.workConstraints} placeholder="Horaires, déplacements, périodes chargées…" rows={2} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Notes libres</label>
            <Textarea name="notes" defaultValue={lifestyle?.notes} placeholder="Tout autre élément utile au coach…" rows={2} />
          </div>
          <Button type="submit" disabled={isSaving} size="sm">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Objectifs ────────────────────────────────────────────────────────────

function GoalsPanel() {
  const { user } = useUser()
  const db = useFirestore()
  const memory = useCoachMemory()

  const remove = async (id: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/coachGoals/${id}`)
    try {
      await deleteDoc(ref)
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'delete' }))
    }
  }

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Objectifs</CardTitle>
        <AddCoachGoalDialog />
      </CardHeader>
      <CardContent className="space-y-3">
        {memory.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : memory.goals.length === 0 ? (
          <EmptyState size="compact" title="Aucun objectif enregistré." className="py-4" />
        ) : (
          [...memory.goals].sort((a, b) => a.eventDate.localeCompare(b.eventDate)).map((g) => (
            <div key={g.id} className="p-4 rounded-lg border border-border bg-background/40 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{g.eventName}</span>
                  <Badge variant="secondary" className="text-[10px]">{GOAL_PRIORITY_LABELS[g.priority] ?? g.priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{g.eventDate}</p>
                {g.targetOutcome && <p className="text-sm mt-1">{g.targetOutcome}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(g.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ── Faits retenus ────────────────────────────────────────────────────────

function FactsPanel({ facts, isLoading }: { facts: string[]; isLoading: boolean }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState('')

  const add = async () => {
    const text = draft.trim()
    if (!text || !user || !db) return
    const ref = doc(db, `users/${user.uid}/coachMemory/facts`)
    setIsSaving(true)
    try {
      await setDoc(ref, { items: arrayUnion(text), updatedAt: serverTimestamp() }, { merge: true })
      setDraft('')
      toast({ title: 'Retenu' })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { items: text } }))
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (fact: string) => {
    if (!user || !db) return
    const ref = doc(db, `users/${user.uid}/coachMemory/facts`)
    try {
      await updateDoc(ref, { items: arrayRemove(fact) })
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update' }))
    }
  }

  return (
    <Card className="bg-card/40 border-border">
      <CardHeader><CardTitle className="text-base">Faits retenus</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Dis-moi ce que je dois retenir…"
            rows={1}
            className="min-h-0"
          />
          <Button onClick={add} disabled={isSaving || !draft.trim()} size="sm" className="shrink-0">
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Retenir
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : facts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">Rien de retenu pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {facts.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-background/40 text-sm">
                <span>{f}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => remove(f)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
