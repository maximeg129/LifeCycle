"use client"

// "Ajouter une recette" — suit désormais le patron CrudDialogShell/useCrudSubmit
// partagé (voir CLAUDE.md, section Dialogues CRUD) plutôt que le formulaire
// ad-hoc que nutrition/page.tsx portait jusqu'ici.

import { useState } from 'react'
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CrudDialogShell } from '@/components/ui/crud-dialog-shell'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { RecipeFormFields } from './recipe-form-fields'
import { parseIngredientsText } from './recipe-types'

export function RecipeAddDialog() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const { isSaving, submit } = useCrudSubmit()
  const [open, setOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db) return
    const fd = new FormData(e.currentTarget)
    const title = fd.get('title')?.toString().trim()
    if (!title) {
      toast({ variant: 'destructive', title: 'Le titre est requis' })
      return
    }

    const recipeData = {
      userId: user.uid,
      title,
      ingredients: parseIngredientsText(fd.get('ingredients')?.toString() || ''),
      instructions: fd.get('instructions')?.toString() || '',
      calories: Number(fd.get('calories')) || 0,
      protein: Number(fd.get('protein')) || 0,
      carbs: Number(fd.get('carbs')) || 0,
      createdAt: serverTimestamp(),
    }

    const ref = doc(collection(db, `users/${user.uid}/recipes`))
    const ok = await submit(() => setDoc(ref, recipeData), { path: ref.path, operation: 'create', requestResourceData: recipeData })
    if (ok) {
      setOpen(false)
      toast({ title: 'Recette ajoutée', description: 'Votre livre de cuisine s’agrandit !' })
    }
  }

  return (
    <CrudDialogShell
      title="Nouvelle recette"
      description="Enregistrez vos créations culinaires dans votre coffre-fort personnel."
      trigger={
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Ajouter une recette
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      isSaving={isSaving}
      onSubmit={handleSubmit}
      contentClassName="max-w-lg"
    >
      <RecipeFormFields />
    </CrudDialogShell>
  )
}
