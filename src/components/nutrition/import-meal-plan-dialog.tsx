"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Upload, Loader2, AlertTriangle, FileJson } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { parseMealPlanJson, getIsoWeekId, getWeekDays } from './meal-plan-types'

export function ImportMealPlanDialog({ weekStart }: { weekStart: Date }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!user || !db) return
    const { meals, errors: parseErrors } = parseMealPlanJson(text)
    setErrors(parseErrors)

    if (meals.length === 0) {
      if (parseErrors.length === 0) {
        toast({ variant: 'destructive', title: 'Rien à importer', description: 'Collez le JSON du plan de repas.' })
      }
      return
    }

    setIsImporting(true)
    const weekId = getIsoWeekId(weekStart)
    const weekDays = getWeekDays(weekStart)
    const weekRef = doc(db, `users/${user.uid}/mealPlans/${weekId}`)

    try {
      await setDoc(weekRef, { userId: user.uid, weekStart: Timestamp.fromDate(weekStart), createdAt: serverTimestamp() }, { merge: true })

      await Promise.all(meals.map((meal) => {
        const mealRef = doc(collection(db, `users/${user.uid}/mealPlans/${weekId}/meals`))
        const mealData = {
          userId: user.uid,
          weekId,
          date: Timestamp.fromDate(weekDays[meal.dayIndex]),
          mealType: meal.mealType,
          recipeName: meal.recipeName,
          ingredients: meal.ingredients,
          macros: meal.macros,
          status: 'propose' as const,
          createdAt: serverTimestamp(),
        }
        return setDoc(mealRef, mealData)
      }))

      toast({ title: 'Plan importé', description: `${meals.length} repas ajoutés${parseErrors.length > 0 ? ` (${parseErrors.length} ignorés)` : ''}.` })
      if (parseErrors.length === 0) {
        setOpen(false)
        setText('')
      }
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: weekRef.path, operation: 'create' }))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Upload className="w-4 h-4" /> Importer plan de la semaine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer un plan de repas</DialogTitle>
          <DialogDescription>
            Collez le JSON généré par Claude chat, ou importez un fichier. Chaque import ajoute des repas —
            supprimez les anciens d&apos;abord si vous réimportez la même semaine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="meal-plan-file" className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
              <FileJson className="w-4 h-4" /> Choisir un fichier .json
            </Label>
            <input id="meal-plan-file" type="file" accept="application/json,.json" onChange={handleFileUpload} className="hidden" />
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{"semaine_du": "2026-08-24", "repas": [...]}'
            rows={10}
            className="font-mono text-xs"
          />

          {errors.length > 0 && (
            <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 space-y-1">
              <p className="text-xs font-bold text-yellow-600 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> {errors.length} entrée(s) ignorée(s)
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-5 list-disc">
                {errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={handleImport} disabled={isImporting || !text.trim()}>
            {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
