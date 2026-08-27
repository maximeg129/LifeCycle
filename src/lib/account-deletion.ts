import { collection, doc, getDocs, deleteDoc, type Firestore } from 'firebase/firestore'

const TOP_LEVEL_COLLECTIONS = [
  'activities', 'trainingPlans', 'bikes', 'maintenanceRecords', 'recipes',
  'tags', 'ingredients', 'cyclingClothingItems', 'plants', 'pantryItems',
  'shoppingListItems', 'expenseCategories', 'monthlyBudgets', 'expenses',
  'tasks', 'healthMetrics', 'healthGoals',
]

// parent collection -> its nested subcollection name(s), deleted before the parent doc.
const NESTED_SUBCOLLECTIONS: Record<string, string[]> = {
  bikes: ['components', 'tirePressureSetups'],
  recipes: ['recipeIngredients'],
  plants: ['analyses'],
  trainingPlans: ['trainingSessions'],
  monthlyBudgets: ['budgetAllocations'],
}

const SETTINGS_DOCS = ['intervals', 'finance', 'notifications']

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

  await Promise.all(SETTINGS_DOCS.map((id) => deleteDoc(doc(db, `users/${uid}/settings/${id}`)).catch(() => {})))
}
