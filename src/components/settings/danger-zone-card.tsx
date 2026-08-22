"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Trash2, Loader2, ShieldAlert } from 'lucide-react'
import { deleteUser } from 'firebase/auth'
import { useUser, useAuth, useFirestore } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { deleteAllUserData } from '@/lib/account-deletion'

const CONFIRM_WORD = 'SUPPRIMER'

export function DangerZoneCard() {
  const { user } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!user || !db || !auth.currentUser) return
    setIsDeleting(true)
    try {
      await deleteAllUserData(db, user.uid)
      await deleteUser(auth.currentUser)
      toast({ title: 'Compte supprimé', description: 'Toutes vos données ont été effacées.' })
      router.push('/')
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      if (code === 'auth/requires-recent-login') {
        toast({
          variant: 'destructive',
          title: 'Reconnexion requise',
          description: 'Par sécurité, déconnectez-vous puis reconnectez-vous avant de supprimer votre compte.',
        })
      } else {
        toast({ variant: 'destructive', title: 'Erreur', description: "La suppression a échoué. Réessayez." })
      }
    } finally {
      setIsDeleting(false)
      setOpen(false)
      setConfirmText('')
    }
  }

  return (
    <Card className="apple-card border-destructive/30">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-[10px] flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Zone dangereuse</CardTitle>
            <CardDescription className="text-sm">Suppression définitive et irréversible de votre compte.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <Button variant="destructive" className="rounded-xl gap-2" onClick={() => setOpen(true)}>
            <Trash2 className="w-4 h-4" /> Supprimer mon compte
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprime toutes vos données (vélos, recettes, tâches, mesures de santé, finances...)
                et votre compte de connexion. Elle est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-delete" className="text-xs text-muted-foreground">
                Tapez <span className="font-bold text-foreground">{CONFIRM_WORD}</span> pour confirmer
              </Label>
              <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText('')}>Annuler</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={confirmText !== CONFIRM_WORD || isDeleting}
                onClick={handleDelete}
                className="gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer définitivement
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
