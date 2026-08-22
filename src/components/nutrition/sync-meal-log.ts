import { collection, doc, setDoc, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore'
import { type MealType } from './nutrition-types'

interface SyncArgs {
  db: Firestore
  uid: string
  mealLogId?: string
  recipeId?: string | null
  label: string
  mealType: MealType
  date: Date
  calories: number
  protein: number
  carbs: number
}

/**
 * Confirming or editing a planned meal writes/updates a matching
 * users/{uid}/mealLogs entry, so the existing daily journal and macro
 * cards on /nutrition pick it up automatically — no separate display
 * logic needed for planned vs. ad-hoc meals. Returns the mealLogs id
 * (new or reused) so the caller can store it back on the plan doc.
 */
export async function syncMealLog(args: SyncArgs): Promise<string> {
  const { db, uid, mealLogId, recipeId, label, mealType, date, calories, protein, carbs } = args
  const ref = mealLogId ? doc(db, `users/${uid}/mealLogs`, mealLogId) : doc(collection(db, `users/${uid}/mealLogs`))

  const data = {
    userId: uid,
    label,
    mealType,
    recipeId: recipeId ?? null,
    calories,
    protein,
    carbs,
    date: Timestamp.fromDate(date),
    ...(mealLogId ? {} : { createdAt: serverTimestamp() }),
  }
  await setDoc(ref, data, { merge: true })
  return ref.id
}
