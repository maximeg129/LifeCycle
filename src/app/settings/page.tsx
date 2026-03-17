"use client"

import React, { useState, useEffect } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { ShieldCheck, ExternalLink, Save, Loader2, Key, User, Sun, Moon, Palette } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useTheme } from '@/hooks/use-theme'

export default function SettingsPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const { isDark, setTheme } = useTheme()

  const settingsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])
  const { data: settings, isLoading: loadingSettings } = useDoc(settingsRef)

  const [athleteId, setAthleteId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setAthleteId(settings.intervalsAthleteId || '')
      setApiKey(settings.intervalsApiKey || '')
    }
  }, [settings])

  const handleSave = async () => {
    if (!user || !db) return

    setSaving(true)
    const settingsData = {
      intervalsAthleteId: athleteId,
      intervalsApiKey: apiKey,
    }

    const ref = doc(db, `users/${user.uid}/settings/intervals`)

    setDoc(ref, settingsData)
      .then(() => {
        toast({ title: "Paramètres enregistrés", description: "Vos identifiants Intervals.icu sont à jour." })
      })
      .catch(() => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: settingsData,
        })
        errorEmitter.emit('permission-error', permissionError)
      })
      .finally(() => setSaving(false))
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <header className="mt-16 md:mt-0">
          <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Compte</h2>
          <h1 className="text-3xl font-bold">Réglages</h1>
        </header>

        {/* ── Apparence ────────────────────────────────────────────── */}
        <Card className="apple-card">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-[10px] flex items-center justify-center">
                <Palette className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Apparence</CardTitle>
                <CardDescription className="text-sm">Choisissez votre thème d'affichage.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                {isDark
                  ? <Moon className="w-5 h-5 text-indigo-400" />
                  : <Sun className="w-5 h-5 text-yellow-500" />
                }
                <div>
                  <p className="text-sm font-medium">{isDark ? 'Mode sombre' : 'Mode clair'}</p>
                  <p className="text-xs text-muted-foreground">{isDark ? 'Interface sombre, style Apple dark' : 'Interface claire, style Apple'}</p>
                </div>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked)}
                className="data-[state=checked]:bg-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => setTheme(false)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  !isDark ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-[#F5F5F7] border border-[#E5E5EA] shadow-sm flex items-center justify-center">
                  <Sun className="w-4 h-4 text-[#1D1D1F]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Clair</p>
                  <p className="text-xs text-muted-foreground">Style Apple</p>
                </div>
              </button>

              <button
                onClick={() => setTheme(true)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  isDark ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-[#1C1C1E] border border-[#3A3A3C] flex items-center justify-center">
                  <Moon className="w-4 h-4 text-[#F5F5F7]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Sombre</p>
                  <p className="text-xs text-muted-foreground">Style Apple dark</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* ── Intervals.icu ────────────────────────────────────────── */}
        <Card className="apple-card">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-[10px] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Intégration Intervals.icu</CardTitle>
                  <CardDescription className="text-sm">Synchronisation des données de performance.</CardDescription>
                </div>
              </div>
              {settings?.intervalsAthleteId && (
                <Badge className="rounded-full bg-green-500/10 text-green-600 border-none text-xs px-3">Connecté</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
              <p className="text-sm font-semibold mb-1">Besoin d'aide ?</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                L'ID Athlète et la Clé API se trouvent dans vos paramètres Intervals.icu, tout en bas de la page.
              </p>
              <a
                href="https://intervals.icu/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary font-semibold hover:underline gap-1 text-xs"
              >
                Aller sur Intervals.icu <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid gap-5">
              <div className="space-y-2">
                <Label htmlFor="athleteId" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3 h-3" /> ID Athlète
                </Label>
                <Input
                  id="athleteId"
                  placeholder="ex: i12345"
                  value={athleteId}
                  onChange={(e) => setAthleteId(e.target.value)}
                  className="h-11 rounded-xl bg-muted/40 border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Key className="w-3 h-3" /> Clé API
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Clé secrète"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-11 rounded-xl bg-muted/40 border-border/60"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || loadingSettings || !user}
              className="h-10 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
