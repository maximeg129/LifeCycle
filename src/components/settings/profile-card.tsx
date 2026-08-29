"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Save, Loader2 } from 'lucide-react'
import { useUser, useAuth } from '@/firebase'
import { updateProfile } from 'firebase/auth'
import { useToast } from '@/hooks/use-toast'
import { getProfileInitials } from './profile-types'

export function ProfileCard() {
  const { user } = useUser()
  const auth = useAuth()
  const { toast } = useToast()
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    setDisplayName(user?.displayName || '')
  }, [user?.displayName])

  const initials = getProfileInitials(displayName, user?.email)

  const handleSave = async () => {
    if (!auth.currentUser) return
    setSaving(true)
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() || null })
      toast({ title: 'Profil mis à jour' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de mettre à jour le profil." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="lc-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-[10px] flex items-center justify-center">
            <User className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Profil</CardTitle>
            <CardDescription className="text-sm">Vos informations personnelles.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14">
            <AvatarImage src={user?.photoURL || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              {user?.emailVerified ? 'Email vérifié' : 'Email non vérifié'}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-xs font-semibold text-muted-foreground">Nom affiché</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Votre nom"
            className="h-11 rounded-xl bg-muted/40 border-border/60"
          />
        </div>
      </CardContent>
      <CardFooter className="pt-4 border-t border-border/50 flex justify-end">
        <Button onClick={handleSave} disabled={saving || !user} className="h-10 px-6 rounded-xl font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </Button>
      </CardFooter>
    </Card>
  )
}
