'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { doc } from 'firebase/firestore'
import type { IntervalsAthlete, IntervalsActivity, IntervalsWellness, IntervalsFitnessDay } from '@/lib/intervals-api'

interface IntervalsCredentials {
  intervalsAthleteId: string
  intervalsApiKey: string
}

function useIntervalsCredentials() {
  const { user } = useUser()
  const db = useFirestore()

  const settingsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])

  const { data, isLoading } = useDoc<IntervalsCredentials>(settingsRef)

  const isConfigured = !!data?.intervalsAthleteId && !!data?.intervalsApiKey

  return {
    athleteId: data?.intervalsAthleteId ?? null,
    apiKey: data?.intervalsApiKey ?? null,
    isConfigured,
    isLoading,
  }
}

function buildHeaders(athleteId: string, apiKey: string) {
  return {
    'x-intervals-athlete-id': athleteId,
    'x-intervals-api-key': apiKey,
  }
}

async function fetchProxy<T>(path: string, athleteId: string, apiKey: string): Promise<T> {
  const res = await fetch(path, { headers: buildHeaders(athleteId, apiKey) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error ${res.status}`)
  }
  return res.json()
}

// ── Hook : Profil athlète (CTL/ATL/TSB/FTP) ─────────────────────────

export function useAthlete() {
  const creds = useIntervalsCredentials()
  const [data, setData] = useState<IntervalsAthlete | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!creds.athleteId || !creds.apiKey) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await fetchProxy<IntervalsAthlete>(
        '/api/intervals/athlete',
        creds.athleteId,
        creds.apiKey,
      )
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [creds.athleteId, creds.apiKey])

  useEffect(() => {
    if (creds.isConfigured) refresh()
  }, [creds.isConfigured, refresh])

  return { data, isLoading: creds.isLoading || isLoading, error, isConfigured: creds.isConfigured, refresh }
}

// ── Hook : Activités récentes ────────────────────────────────────────

export function useActivities(oldest: string, newest?: string) {
  const creds = useIntervalsCredentials()
  const [data, setData] = useState<IntervalsActivity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!creds.athleteId || !creds.apiKey) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ oldest })
      if (newest) params.set('newest', newest)
      const result = await fetchProxy<IntervalsActivity[]>(
        `/api/intervals/activities?${params}`,
        creds.athleteId,
        creds.apiKey,
      )
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [creds.athleteId, creds.apiKey, oldest, newest])

  useEffect(() => {
    if (creds.isConfigured) refresh()
  }, [creds.isConfigured, refresh])

  return { data, isLoading: creds.isLoading || isLoading, error, isConfigured: creds.isConfigured, refresh }
}

// ── Hook : Courbe fitness (PMC) ──────────────────────────────────────

export function useFitnessChart(oldest: string, newest: string) {
  const creds = useIntervalsCredentials()
  const [data, setData] = useState<IntervalsFitnessDay[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!creds.athleteId || !creds.apiKey) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ oldest, newest })
      const result = await fetchProxy<IntervalsFitnessDay[]>(
        `/api/intervals/fitness-chart?${params}`,
        creds.athleteId,
        creds.apiKey,
      )
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [creds.athleteId, creds.apiKey, oldest, newest])

  useEffect(() => {
    if (creds.isConfigured) refresh()
  }, [creds.isConfigured, refresh])

  return { data, isLoading: creds.isLoading || isLoading, error, isConfigured: creds.isConfigured, refresh }
}

// ── Hook : Wellness ──────────────────────────────────────────────────

export function useWellness(oldest: string, newest: string) {
  const creds = useIntervalsCredentials()
  const [data, setData] = useState<IntervalsWellness[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!creds.athleteId || !creds.apiKey) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ oldest, newest })
      const result = await fetchProxy<IntervalsWellness[]>(
        `/api/intervals/wellness?${params}`,
        creds.athleteId,
        creds.apiKey,
      )
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [creds.athleteId, creds.apiKey, oldest, newest])

  useEffect(() => {
    if (creds.isConfigured) refresh()
  }, [creds.isConfigured, refresh])

  return { data, isLoading: creds.isLoading || isLoading, error, isConfigured: creds.isConfigured, refresh }
}
