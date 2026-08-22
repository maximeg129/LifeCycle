"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Bell } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export interface NotificationPrefs {
  tasksReminders?: boolean
  plantsReminders?: boolean
}

export function NotificationPrefsCard() {
  const { user } = useUser()
  const db = useFirestore()

  const ref = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/notifications`)
  }, [db, user])
  const { data: prefs } = useDoc<NotificationPrefs>(ref)

  const tasksReminders = prefs?.tasksReminders ?? true
  const plantsReminders = prefs?.plantsReminders ?? true

  const update = (patch: Partial<NotificationPrefs>) => {
    if (!user || !db) return
    const r = doc(db, `users/${user.uid}/settings/notifications`)
    setDoc(r, patch, { merge: true }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: r.path, operation: 'update', requestResourceData: patch }))
    })
  }

  return (
    <Card className="apple-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 rounded-[10px] flex items-center justify-center">
            <Bell className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Rappels</CardTitle>
            <CardDescription className="text-sm">Affichage des rappels en retard dans l&apos;app.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
          <div>
            <p className="text-sm font-medium">Tâches maison en retard</p>
            <p className="text-xs text-muted-foreground">Badge dans la navigation quand des tâches sont dues.</p>
          </div>
          <Switch checked={tasksReminders} onCheckedChange={(v) => update({ tasksReminders: v })} />
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
          <div>
            <p className="text-sm font-medium">Plantes à arroser</p>
            <p className="text-xs text-muted-foreground">Badge dans la navigation quand des plantes ont besoin d&apos;eau.</p>
          </div>
          <Switch checked={plantsReminders} onCheckedChange={(v) => update({ plantsReminders: v })} />
        </div>
      </CardContent>
    </Card>
  )
}
