import { type MealType } from './nutrition-types'

// ── Firestore document shapes ─────────────────────────────────────────

export interface PlannedIngredient {
  name: string
  quantity: number
  unit: string
}

/**
 * Fat/lipides is tracked per planned meal (shown in the week view) but not
 * folded into mealLogs/the daily macro cards, which only track
 * calories/protein/carbs — extending those is a separate piece of work.
 */
export interface PlannedMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type MealPlanStatus = 'propose' | 'confirme' | 'modifie' | 'saute'

export interface PlannedMeal {
  userId: string
  weekId: string
  date: { seconds: number; nanoseconds: number } | null
  mealType: MealType
  recipeName: string
  ingredients: PlannedIngredient[]
  instructions?: string
  macros: PlannedMacros
  status: MealPlanStatus
  /** Id of the matching users/{uid}/recipes doc, when the JSON's `recettes` was resolved/upserted at import time. */
  recipeId?: string | null
  /** Id of the linked users/{uid}/mealLogs doc, set once confirmed/modifié so re-saving updates it in place. */
  mealLogId?: string
  confirmedAt?: unknown
  createdAt?: unknown
}

export interface MealPlanWeek {
  userId: string
  weekStart: { seconds: number; nanoseconds: number } | null
  createdAt?: unknown
}

// ── Day / week helpers (pure, unit-tested) ────────────────────────────

const FRENCH_DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

/** Monday 00:00 (local time) of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  return d
}

/** ISO-8601 week id, e.g. '2026-W35'. */
export function getIsoWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/** The 7 dates (Monday..Sunday) of the week starting at `weekStart`. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** Maps a French day name (accents/case-insensitive) to 0=lundi..6=dimanche. Returns -1 if unrecognized. */
export function dayNameToIndex(name: string): number {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .trim()
  return FRENCH_DAY_NAMES.indexOf(normalized)
}

export function indexToDayName(index: number): string {
  return FRENCH_DAY_NAMES[((index % 7) + 7) % 7]
}

// ── Meal type normalization ───────────────────────────────────────────

const MEAL_TYPE_ALIASES: Record<string, MealType> = {
  'petit-dejeuner': 'breakfast', 'petit dejeuner': 'breakfast', 'petit-dej': 'breakfast',
  'breakfast': 'breakfast',
  'dejeuner': 'lunch', 'lunch': 'lunch', 'midi': 'lunch',
  'diner': 'dinner', 'dinner': 'dinner', 'soir': 'dinner',
  'collation': 'snack', 'snack': 'snack', 'gouter': 'snack', 'en-cas': 'snack',
}

export function normalizeMealType(raw: string): MealType | null {
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return MEAL_TYPE_ALIASES[normalized] ?? null
}

// ── Macro key normalization (accepts FR or EN keys from a pasted JSON) ──

function readMacroValue(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v)
  }
  return 0
}

export function normalizeMacros(raw: unknown): PlannedMacros {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    calories: readMacroValue(obj, ['calories', 'kcal']),
    protein: readMacroValue(obj, ['protein', 'proteines', 'protéines']),
    carbs: readMacroValue(obj, ['carbs', 'glucides']),
    fat: readMacroValue(obj, ['fat', 'lipides']),
  }
}

// ── JSON import parsing ────────────────────────────────────────────────

export interface ParsedMeal {
  dayIndex: number // 0 = lundi .. 6 = dimanche
  mealType: MealType
  recipeName: string
  ingredients: PlannedIngredient[]
  instructions: string
  macros: PlannedMacros
}

/** A reusable recipe "fiche technique" found in the JSON's `recettes` array. */
export interface ParsedRecipe {
  title: string
  ingredients: PlannedIngredient[]
  instructions: string
  macros: PlannedMacros
}

export interface ParseResult {
  meals: ParsedMeal[]
  recipes: ParsedRecipe[]
  errors: string[]
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase()
}

/** Formats a structured ingredient as the free-text line the recipe book expects, e.g. "150g Poulet". */
export function formatIngredientLine(ing: PlannedIngredient): string {
  const qty = [ing.quantity || '', ing.unit].filter(Boolean).join('')
  return qty ? `${qty} ${ing.name}` : ing.name
}

function parseIngredientsArray(raw: unknown): PlannedIngredient[] {
  const list = Array.isArray(raw) ? raw : []
  return list
    .filter((ing): ing is Record<string, unknown> => !!ing && typeof ing === 'object')
    .map((ing) => ({
      name: typeof ing.nom === 'string' ? ing.nom : '',
      quantity: typeof ing.quantite === 'number' ? ing.quantite : Number(ing.quantite) || 0,
      unit: typeof ing.unite === 'string' ? ing.unite : '',
    }))
    .filter((ing) => ing.name !== '')
}

/**
 * Parses the JSON pasted from an external chat. Accepts either:
 * - `{ semaine_du, recettes: [{titre, ingredients, instructions, macros}],
 *    repas: [{jour, type_repas, recette /* references recettes[].titre * /}] }`
 * - the legacy shape where each `repas[]` entry carries its own
 *   `ingredients`/`macros` inline (no `recettes` array, or a repas entry
 *   whose `recette`/`nom_recette` doesn't match any parsed recipe)
 *
 * Never throws — malformed entries are skipped and reported in `errors` so
 * the import UI can show what to fix, rather than losing the whole paste
 * over one bad line.
 */
export function parseMealPlanJson(raw: string): ParseResult {
  const errors: string[] = []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { meals: [], recipes: [], errors: ['JSON invalide — vérifiez la syntaxe.'] }
  }

  const root = Array.isArray(data) ? {} : (data as Record<string, unknown>) ?? {}
  const repas: unknown[] = Array.isArray(data) ? data : Array.isArray(root.repas) ? root.repas as unknown[] : []
  const recettesRaw: unknown[] = Array.isArray(root.recettes) ? root.recettes as unknown[] : []

  if (repas.length === 0) {
    return { meals: [], recipes: [], errors: ['Aucun repas trouvé (attendu: un tableau "repas", ou un tableau JSON direct).'] }
  }

  // Parse the recipe "fiches techniques", deduped by title within this import.
  const recipesByTitle = new Map<string, ParsedRecipe>()
  recettesRaw.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`Recette #${i + 1}: entrée invalide.`)
      return
    }
    const e = entry as Record<string, unknown>
    const titre = typeof e.titre === 'string' ? e.titre.trim() : ''
    if (!titre) {
      errors.push(`Recette #${i + 1}: titre manquant.`)
      return
    }
    recipesByTitle.set(normalizeTitle(titre), {
      title: titre,
      ingredients: parseIngredientsArray(e.ingredients),
      instructions: typeof e.instructions === 'string' ? e.instructions : '',
      macros: normalizeMacros(e.macros),
    })
  })

  const meals: ParsedMeal[] = []
  repas.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`Repas #${i + 1}: entrée invalide.`)
      return
    }
    const e = entry as Record<string, unknown>
    const jour = typeof e.jour === 'string' ? e.jour : ''
    const typeRepas = typeof e.type_repas === 'string' ? e.type_repas : ''
    // `recette` references recettes[].titre; `nom_recette` is the legacy
    // inline form, kept as a fallback name when there's no matching recette.
    const recetteRef = typeof e.recette === 'string' ? e.recette : ''
    const nomRecette = typeof e.nom_recette === 'string' ? e.nom_recette : recetteRef

    const dayIndex = dayNameToIndex(jour)
    const mealType = normalizeMealType(typeRepas)

    if (dayIndex === -1) {
      errors.push(`Repas #${i + 1} ("${nomRecette || '?'}"): jour "${jour}" non reconnu.`)
      return
    }
    if (!mealType) {
      errors.push(`Repas #${i + 1} ("${nomRecette || '?'}"): type de repas "${typeRepas}" non reconnu.`)
      return
    }
    if (!nomRecette) {
      errors.push(`Repas #${i + 1}: nom de recette manquant.`)
      return
    }

    const linkedRecipe = recipesByTitle.get(normalizeTitle(nomRecette))
    meals.push(linkedRecipe ? {
      dayIndex,
      mealType,
      recipeName: linkedRecipe.title,
      ingredients: linkedRecipe.ingredients,
      instructions: linkedRecipe.instructions,
      macros: linkedRecipe.macros,
    } : {
      dayIndex,
      mealType,
      recipeName: nomRecette,
      ingredients: parseIngredientsArray(e.ingredients),
      instructions: typeof e.instructions === 'string' ? e.instructions : '',
      macros: normalizeMacros(e.macros),
    })
  })

  return { meals, recipes: Array.from(recipesByTitle.values()), errors }
}
