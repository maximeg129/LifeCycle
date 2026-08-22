"use client"

import { collection, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { type ClothingItem } from './clothing-types'

export function useClothingInventory() {
  const { user } = useUser()
  const db = useFirestore()

  const itemsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/cyclingClothingItems`), orderBy('name'))
  }, [db, user])

  const { data, isLoading } = useCollection<ClothingItem>(itemsQuery)

  return { items: data || [], isLoading }
}
