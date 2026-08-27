"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { collection, getDocs } from 'firebase/firestore'
import { useUser, useFirestore } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { TOP_LEVEL_COLLECTIONS, buildExportPayload, buildExportFilename } from './data-export-types'

// Nested subcollections (bike components, recipe ingredients, plant
// actions, budget allocations...) aren't walked here — this is a personal
// data export, not a full backup.

export function DataExportCard() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!user || !db) return
    setExporting(true)
    try {
      const result: Record<string, unknown[]> = {}
      await Promise.all(TOP_LEVEL_COLLECTIONS.map(async (name) => {
        const snap = await getDocs(collection(db, `users/${user.uid}/${name}`))
        result[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      }))

      const blob = new Blob([JSON.stringify(buildExportPayload(user.uid, result), null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildExportFilename(new Date())
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast({ title: 'Export terminé', description: 'Vos données ont été téléchargées.' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: "L'export a échoué." })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="apple-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/10 rounded-[10px] flex items-center justify-center">
            <Download className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Exporter mes données</CardTitle>
            <CardDescription className="text-sm">Téléchargez toutes vos données au format JSON.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} disabled={exporting || !user} variant="outline" className="rounded-xl gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Télécharger un export
        </Button>
      </CardContent>
    </Card>
  )
}
