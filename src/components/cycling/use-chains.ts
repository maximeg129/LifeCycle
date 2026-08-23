"use client"

import { collection, query, orderBy } from 'firebase/firestore'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { type Chain } from './chain-types'

export function useChains() {
  const { user } = useUser()
  const db = useFirestore()

  const chainsQuery = useMemoFirebase(() => {
    if (!user || !db) return null
    return query(collection(db, `users/${user.uid}/chains`), orderBy('createdAt', 'asc'))
  }, [db, user])
  const { data, isLoading } = useCollection<Chain>(chainsQuery)

  return { chains: data || [], isLoading }
}
