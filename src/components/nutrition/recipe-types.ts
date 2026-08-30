// ── Livre de recettes — types + helpers purs (pas de dépendance Firebase) ──
//
// Extrait de nutrition/page.tsx lors de la refonte mobile du livre de
// recettes (retour utilisateur, capture d'écran : le titre d'une recette
// chevauchait les boutons Modifier/Fermer sur mobile, symptôme d'une refonte
// plus large nécessaire — voir recipe-detail-dialog.tsx).

/** Document Firestore réel sous users/{uid}/recipes/{id} (voir CLAUDE.md). */
export interface Recipe {
  id: string
  title: string
  ingredients: string[]
  instructions: string
  calories: number
  protein: number
  carbs: number
}

/** Champ "Ingrédients (un par ligne)" du formulaire → tableau stocké. */
export function parseIngredientsText(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '')
}

/** Tableau stocké → texte pour pré-remplir le textarea d'édition. */
export function ingredientsToText(ingredients: string[] | undefined): string {
  return (ingredients || []).join('\n')
}

/** Retire un préfixe "1.", "2)", "3 -" etc. déjà présent dans le texte saisi. */
function stripLeadingNumber(step: string): string {
  return step.replace(/^\d+\s*[.):-]\s*/, '').trim()
}

/**
 * Découpe le texte libre "Instructions" en étapes numérotées pour un
 * affichage scannable pendant la cuisson (plutôt qu'un bloc de texte brut) —
 * retour utilisateur : rendre le livre de recettes "plus user friendly,
 * moderne/simple". La plupart des recettes sont déjà saisies une étape par
 * ligne (le placeholder du formulaire le suggère : "1. Cuire..."), donc le
 * découpage par ligne est le cas courant ; un bloc saisi sur une seule ligne
 * avec une numérotation inline ("1. ... 2. ... 3. ...") est aussi géré. Si
 * rien de tout ça ne s'applique, le texte entier devient une seule étape —
 * jamais d'étape vide inventée.
 */
export function parseInstructionSteps(text: string): string[] {
  const trimmed = (text || '').trim()
  if (!trimmed) return []

  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) return lines.map(stripLeadingNumber)

  const inlineSteps = trimmed.split(/(?=\d+[.)]\s)/).map((s) => s.trim()).filter(Boolean)
  if (inlineSteps.length > 1) return inlineSteps.map(stripLeadingNumber)

  return [stripLeadingNumber(trimmed)]
}
