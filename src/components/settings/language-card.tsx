"use client"

// Langue de l'app — retour utilisateur : "le multilangue de l'app", puis
// "Préférence explicite en Réglages" (jamais une détection automatique du
// navigateur, décision actée avant de commencer ce chantier). Écrit dans
// users/{uid}/settings/language (même patron "un doc par préoccupation" que
// settings/notifications) ET pose directement le cookie NEXT_LOCALE + router
// .refresh() pour un effet immédiat — <LocaleSync> (i18n/locale-sync.tsx)
// fait le même travail en silence pour un nouvel appareil qui n'a pas
// encore ce cookie, donc les deux convergent sans jamais se contredire.

import { useEffect, useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUser, useFirestore } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { locales, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config'

export function LanguageCard() {
  const t = useTranslations('LanguageCard')
  const locale = useLocale()
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()

  // Bug attrapé en direct par l'utilisateur ("I can't select anglais") : le
  // Select était contrôlé directement par `locale` (next-intl), qui ne
  // change qu'après le aller-retour cookie + setDoc + router.refresh() — le
  // clic semblait n'avoir aucun effet le temps de ce round-trip (voire pour
  // de bon si le refresh échouait). État local optimiste à la place : le
  // menu reflète la sélection instantanément, resynchronisé avec `locale`
  // une fois le refresh réellement arrivé (sans effet s'ils convergent déjà).
  const [selected, setSelected] = useState<Locale>(isLocale(locale) ? locale : 'fr')
  useEffect(() => {
    if (isLocale(locale)) setSelected(locale)
  }, [locale])

  const LOCALE_LABELS: Record<Locale, string> = { fr: t('french'), en: t('english') }

  const handleChange = async (value: string) => {
    if (!isLocale(value) || !user || !db) return
    setSelected(value)

    // Effet immédiat, sans attendre le listener Firestore.
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`

    const ref = doc(db, `users/${user.uid}/settings/language`)
    const data = { language: value, updatedAt: serverTimestamp() }
    try {
      await setDoc(ref, data, { merge: true })
      router.refresh()
      toast({ title: t('saved') })
    } catch {
      setSelected(isLocale(locale) ? locale : 'fr')
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: data }))
      toast({ variant: 'destructive', title: t('error'), description: t('errorDescription') })
    }
  }

  return (
    <Card className="lc-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
            <CardDescription className="text-sm">{t('description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Select value={selected} onValueChange={handleChange}>
          <SelectTrigger className="h-11 rounded-xl bg-muted/40 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((l) => (
              <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
