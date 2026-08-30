"use client"

// Tient le cookie NEXT_LOCALE (résolu côté serveur, voir request.ts) à jour
// avec la préférence Firestore de l'utilisateur (users/{uid}/settings/
// language, même patron "un doc par préoccupation" que settings/
// notifications) — c'est ce qui permet à un utilisateur connecté sur
// un nouvel appareil (donc sans le cookie) de retrouver sa langue
// automatiquement, sans repasser par Réglages. Monté une seule fois, tout en
// haut de l'arbre (layout.tsx), aux côtés de FirebaseClientProvider dont il
// dépend (useUser/useDoc).
//
// N'écrit JAMAIS dans l'autre sens ici (Firestore → cookie uniquement) —
// écrire la préférence elle-même est le rôle de language-card.tsx (l'action
// consciente de l'utilisateur dans Réglages), pas de ce composant silencieux.

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { doc } from 'firebase/firestore'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { isLocale, LOCALE_COOKIE } from './config'

export function LocaleSync() {
  const { user } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const currentLocale = useLocale()

  const ref = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/language`)
  }, [db, user])
  const { data } = useDoc<{ language?: string }>(ref)

  useEffect(() => {
    const preferred = data?.language
    if (!isLocale(preferred) || preferred === currentLocale) return
    document.cookie = `${LOCALE_COOKIE}=${preferred}; path=/; max-age=31536000; SameSite=Lax`
    router.refresh()
  }, [data?.language, currentLocale, router])

  return null
}
