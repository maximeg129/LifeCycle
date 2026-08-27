"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_LABELS,
  CATEGORY_COLORS,
  type CategoryIconKey,
  type CategoryColorKey,
} from './finance-types'

export function AddCategoryDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [open, setOpen] = useState(false)
  const { isSaving, submit } = useCrudSubmit()
  const [icon, setIcon] = useState<CategoryIconKey>('other')
  const [color, setColor] = useState<CategoryColorKey>('primary')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return

    const fd = new FormData(e.currentTarget)
    const name = fd.get('name')?.toString().trim()
    if (!name) {
      toast({ variant: 'destructive', title: 'Le nom est requis' })
      return
    }

    const categoryData = { userId: user.uid, name, icon, color, createdAt: serverTimestamp() }
    const ref = doc(collection(db, `users/${user.uid}/expenseCategories`))

    const ok = await submit(
      () => setDoc(ref, categoryData),
      { path: ref.path, operation: 'create', requestResourceData: categoryData }
    )
    if (ok) {
      setOpen(false)
      toast({ title: 'Catégorie créée', description: name })
    }
  }

  return (
    <CrudDialogShell
      title="Nouvelle catégorie"
      description="Créez une catégorie pour classer vos dépenses."
      trigger={trigger ?? (
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <Plus className="w-4 h-4" /> Nouvelle catégorie
        </Button>
      )}
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      submitLabel="Créer"
      onSubmit={handleSubmit}
      contentClassName="max-w-md"
    >
      <div className="space-y-2">
        <Label htmlFor="cat-name">Nom *</Label>
        <Input id="cat-name" name="name" placeholder="ex: Cyclisme, Alimentation..." required />
      </div>

      <div className="space-y-2">
        <Label>Icône</Label>
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(CATEGORY_ICONS) as CategoryIconKey[]).map((key) => {
            const Icon = CATEGORY_ICONS[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                title={CATEGORY_ICON_LABELS[key]}
                className={cn(
                  'aspect-square rounded-xl border-2 flex items-center justify-center transition-all',
                  icon === key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:bg-muted/50'
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Couleur</Label>
        <div className="grid grid-cols-8 gap-2">
          {(Object.keys(CATEGORY_COLORS) as CategoryColorKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              className={cn(
                'aspect-square rounded-full',
                CATEGORY_COLORS[key].dot,
                color === key ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''
              )}
            />
          ))}
        </div>
      </div>
    </CrudDialogShell>
  )
}
