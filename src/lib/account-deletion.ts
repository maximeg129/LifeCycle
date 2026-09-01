import { collection, getDocs, deleteDoc, type Firestore } from 'firebase/firestore'

// ⚠️ Audit trouvé en vérifiant la protection des données (retour utilisateur :
// "assurer... de la sécurité et de la protection des données") : cette liste
// avait dérivé de la vraie structure Firestore — près de la moitié des
// collections réelles de l'app en étaient absentes, ce qui voulait dire que
// "Supprimer mon compte" laissait ces données orphelines derrière lui plutôt
// que de les effacer, et que l'export personnel ne les incluait pas non plus
// (voir data-export-types.ts : ce même tableau est réexporté tel quel comme
// unique source de vérité pour les deux usages).
//
// Manquaient : chains/waxHistory (entretien chaîne), coachInjuries/coachGoals
// (mémoire coach), sessionFeedback (RPE/ressenti alimentant le gouverneur),
// rideAnalyses (analyses IA de sortie), mealPlans/meals (planning repas),
// mealLogs, hydrationLogs — neuf collections, dont plusieurs contiennent des
// données personnelles sensibles (blessures, notes de style de vie).
//
// Recroisé une bonne fois avec firestore.rules (chaque `match` direct sous
// /users/{userId}/ y correspond) plutôt que reconstruit à la main — c'est la
// façon dont ce déséquilibre a pu passer inaperçu la première fois.
export const TOP_LEVEL_COLLECTIONS = [
  'settings', 'coachMemory', 'activities', 'trainingPlans', 'bikes', 'components',
  'chains', 'coachInjuries', 'coachGoals', 'coachLibrary', 'sessionFeedback', 'strengthSessionLogs', 'workoutProposals',
  'rideAnalyses', 'coachChatMessages', 'maintenanceRecords', 'recipes', 'tags',
  'ingredients', 'cyclingClothingItems', 'plants', 'pantryItems', 'shoppingListItems',
  'mealPlans', 'mealLogs', 'hydrationLogs', 'expenseCategories', 'monthlyBudgets',
  'expenses', 'tasks', 'healthMetrics', 'healthGoals',
]

// parent collection -> its nested subcollection name(s), deleted before the parent doc.
// ⚠️ `components` used to be listed here as a child of `bikes` — wrong: per
// firestore.rules' own comment, it's a FLAT top-level collection
// (users/{uid}/components, with a bikeId field), never actually nested under
// a bike document. Listed here it silently swept a path nothing ever wrote
// to, so real component records were never deleted — moved up into
// TOP_LEVEL_COLLECTIONS instead, where it belongs.
const NESTED_SUBCOLLECTIONS: Record<string, string[]> = {
  bikes: ['tirePressureSetups'],
  chains: ['waxHistory'],
  recipes: ['recipeIngredients'],
  plants: ['analyses'],
  trainingPlans: ['trainingSessions'],
  mealPlans: ['meals'],
  monthlyBudgets: ['budgetAllocations'],
}

// `settings` and `coachMemory` are singleton-doc collections (fixed ids like
// `settings/intervals`, `coachMemory/lifestyle` — see firestore.rules) rather
// than auto-id documents, but a plain collection-level getDocs() sweep finds
// and deletes them exactly the same way — no need to enumerate doc ids by
// hand (the previous SETTINGS_DOCS = ['intervals', 'finance', 'notifications']
// approach silently missed 'powerCurve'/'biometrics'/'language'/'nutrition'
// every time a new settings doc was added elsewhere without this list being
// updated too — a generic sweep can't drift out of date the same way).
async function deleteCollectionDocs(db: Firestore, path: string) {
  const snap = await getDocs(collection(db, path))
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  return snap.docs.map((d) => d.id)
}

/**
 * Best-effort deletion of everything under users/{uid}/ — top-level
 * collections plus the nested subcollections we know about. Does not
 * (and, per firestore.rules, cannot from the client) delete the
 * users/{uid} profile document itself.
 */
export async function deleteAllUserData(db: Firestore, uid: string): Promise<void> {
  for (const collectionName of TOP_LEVEL_COLLECTIONS) {
    const basePath = `users/${uid}/${collectionName}`
    const nested = NESTED_SUBCOLLECTIONS[collectionName]
    if (nested) {
      const parentIds = await getDocs(collection(db, basePath)).then((s) => s.docs.map((d) => d.id))
      for (const parentId of parentIds) {
        for (const subName of nested) {
          await deleteCollectionDocs(db, `${basePath}/${parentId}/${subName}`)
        }
      }
    }
    await deleteCollectionDocs(db, basePath)
  }
}
