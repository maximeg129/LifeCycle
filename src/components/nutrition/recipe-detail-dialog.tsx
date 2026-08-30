"use client"

// Détail d'une recette — refonte mobile complète (retour utilisateur, capture
// d'écran : sur mobile, le titre en overlay sur la photo chevauchait les
// boutons Modifier/Fermer, et le contenu semblait coupé en bas). Décisions :
//
// 1. Plein écran sur mobile, dialogue centré sur desktop (une seule classe
//    responsive plutôt qu'un composant séparé par taille d'écran) — plus de
//    hauteur fixe en dvh laissant deviner la nav du bas derrière un voile.
// 2. Un bandeau d'en-tête compact en flux normal (Fermer / Titre tronqué /
//    Modifier sur une seule ligne flex) plutôt que des boutons en position
//    absolute superposés à un titre qui peut faire 4 lignes — impossible à
//    faire chevaucher, quelle que soit la longueur du titre.
// 3. Plus de photo stock aléatoire (picsum.photos) — voir recipe-card.tsx.
// 4. Ingrédients en checklist (coche pendant la préparation) et Préparation
//    en étapes numérotées (parseInstructionSteps) plutôt qu'un bloc de texte
//    brut — plus scannable en cuisine, mains occupées, appli pensée pour un
//    sportif qui veut être efficace plutôt que feuilleter un magazine.

import { useEffect, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { Pencil, X, Loader2, Utensils, ListChecks, Flame, Beef, Wheat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useCrudSubmit } from '@/hooks/use-crud-submit'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore } from '@/firebase'
import { cn } from '@/lib/utils'
import { RecipeFormFields } from './recipe-form-fields'
import { parseIngredientsText, parseInstructionSteps, type Recipe } from './recipe-types'

// Plein écran (moins la barre d'état, gérée par le header fixe de l'app) sur
// mobile ; dialogue centré classique à partir de sm. Remplace entièrement les
// classes de positionnement par défaut de DialogContent plutôt que de les
// composer, pour ne pas hériter du centrage translate-x/y à toutes tailles.
const CONTENT_CLASS = cn(
  'fixed inset-0 z-50 translate-x-0 translate-y-0 w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-none p-0 gap-0',
  'sm:inset-auto sm:left-[50%] sm:top-[50%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-3xl sm:border'
)

export function RecipeDetailDialog({ recipe, open, onOpenChange }: { recipe: Recipe | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const { isSaving, submit } = useCrudSubmit()

  const [isEditing, setIsEditing] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  // Belt-and-suspenders on top of Radix's own scroll lock — iOS Chrome
  // doesn't reliably honor Radix's JS-based touchmove interception (see the
  // hook's own doc comment).
  useBodyScrollLock(open)

  // Repart d'un état propre à chaque recette ouverte (jamais l'édition ou
  // les coches de la précédente qui traînent) et quand le dialogue se ferme.
  useEffect(() => {
    setIsEditing(false)
    setChecked(new Set())
  }, [recipe?.id, open])

  const toggleChecked = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user || !db || !recipe) return
    const fd = new FormData(e.currentTarget)
    const title = fd.get('title')?.toString().trim()
    if (!title) {
      toast({ variant: 'destructive', title: 'Le titre est requis' })
      return
    }

    const recipeData = {
      title,
      ingredients: parseIngredientsText(fd.get('ingredients')?.toString() || ''),
      instructions: fd.get('instructions')?.toString() || '',
      calories: Number(fd.get('calories')) || 0,
      protein: Number(fd.get('protein')) || 0,
      carbs: Number(fd.get('carbs')) || 0,
    }

    const ref = doc(db, `users/${user.uid}/recipes`, recipe.id)
    const ok = await submit(() => setDoc(ref, recipeData, { merge: true }), { path: ref.path, operation: 'update', requestResourceData: recipeData })
    if (ok) {
      setIsEditing(false)
      toast({ title: 'Recette modifiée', description: 'Les macros ont été mises à jour.' })
    }
  }

  if (!recipe) return null

  const steps = parseInstructionSteps(recipe.instructions)

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setIsEditing(false) }}>
      <DialogContent className={CONTENT_CLASS} hideDefaultClose>
        {/* min-w-0: DialogContent is `display:grid` by default (dialog.tsx) —
            without it, this grid item's track sizes to its content's
            max-content width (the untruncated title), overflowing the fixed
            390px mobile viewport instead of letting the title's own
            `truncate` do its job. Same family of bug as the flex min-width:
            auto gotcha, one level up. */}
        <div className="flex flex-col h-full min-w-0">
          {/* En-tête en flux normal — jamais en overlay, donc jamais de
              chevauchement possible avec le titre, quelle que soit sa
              longueur (il tronque avec une ellipse plutôt que de passer sous
              les boutons). */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0">
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full shrink-0" onClick={() => onOpenChange(false)} aria-label="Fermer">
              <X className="w-4 h-4" />
            </Button>
            <DialogTitle asChild>
              <h2 className="flex-1 min-w-0 truncate font-bold text-base">{recipe.title}</h2>
            </DialogTitle>
            {!isEditing && (
              <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full shrink-0" onClick={() => setIsEditing(true)} aria-label="Modifier">
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} key={recipe.id} className="flex flex-col flex-1 min-h-0">
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', transform: 'translateZ(0)' }}
              >
                <RecipeFormFields recipe={recipe} />
              </div>
              <div className="p-4 bg-muted/20 border-t border-border/60 flex justify-end gap-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="rounded-full px-6">
                  Annuler
                </Button>
                <Button type="submit" disabled={isSaving} className="rounded-full px-8">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-8"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', transform: 'translateZ(0)' }}
              >
                {/* Puces de macros en flex-wrap plutôt qu'une grille 3 colonnes
                    fixe — jamais squishé, quelle que soit la largeur d'écran. */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-sm font-bold">
                    <Flame className="w-3.5 h-3.5" /> {recipe.calories} kcal
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-bold">
                    <Beef className="w-3.5 h-3.5" /> {recipe.protein}g protéines
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-sm font-bold">
                    <Wheat className="w-3.5 h-3.5" /> {recipe.carbs}g glucides
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-primary" /> Ingrédients
                  </h3>
                  {recipe.ingredients?.length ? (
                    <ul className="space-y-1">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i}>
                          <label className="flex items-start gap-3 py-1.5 cursor-pointer select-none">
                            <Checkbox checked={checked.has(i)} onCheckedChange={() => toggleChecked(i)} className="mt-0.5" />
                            <span className={cn('text-sm leading-relaxed', checked.has(i) && 'line-through text-muted-foreground/60')}>{ing}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun ingrédient renseigné.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-primary" /> Préparation
                  </h3>
                  {steps.length > 0 ? (
                    <ol className="space-y-3">
                      {steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune instruction renseignée.</p>
                  )}
                </div>
              </div>

              <div className="p-4 bg-muted/20 border-t border-border/60 flex justify-end gap-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-full px-6">
                  <Pencil className="w-4 h-4 mr-2" /> Modifier
                </Button>
                <Button variant="secondary" onClick={() => onOpenChange(false)} className="rounded-full px-8">Fermer</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
