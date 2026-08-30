"use client"

// Tuile du Livre de recettes — refonte : plus de photo stock aléatoire
// (picsum.photos, jamais une vraie photo du plat — voir l'auto-critique dans
// le résumé de la refonte). Un badge icône + les macros priment, cohérent
// avec le reste du design system ("Performance Lab" : icône + chiffres, pas
// de photographie décorative) et plus utile pour un sportif qui compare des
// recettes par macros plutôt que par appétit visuel.

import { CookingPot, Flame, Beef, Wheat, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Recipe } from './recipe-types'

export function RecipeCard({ recipe, onOpen, onDelete }: { recipe: Recipe; onOpen: () => void; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="lc-card border-none text-left p-5 space-y-4 group hover:scale-[1.02] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CookingPot className="w-5 h-5" />
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full shrink-0 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label={`Supprimer ${recipe.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <h3 className="font-bold text-lg leading-snug line-clamp-2">{recipe.title}</h3>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {recipe.calories} kcal</span>
        <span className="flex items-center gap-1"><Beef className="w-3 h-3 text-red-500" /> {recipe.protein}g</span>
        <span className="flex items-center gap-1"><Wheat className="w-3 h-3 text-yellow-500" /> {recipe.carbs}g</span>
      </div>
    </button>
  )
}
