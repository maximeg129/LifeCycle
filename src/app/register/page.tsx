"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bike, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth'
import { useAuth } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function RegisterPage() {
  const router = useRouter()
  const auth = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthError(null)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name })
      }
      toast({ title: "Compte créé !", description: "Bienvenue sur LifeCycle." })
      router.push('/home-management')
    } catch (error: any) {
      setAuthError(error.message || "Impossible de créer le compte.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setAuthError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
      toast({ title: "Succès", description: "Bienvenue sur LifeCycle !" })
      router.push('/home-management')
    } catch (error: any) {
      let message = "Impossible de s'inscrire avec Google."
      if (error.code === 'auth/popup-blocked') message = "Veuillez autoriser les fenêtres surgissantes."
      else if (error.code === 'auth/unauthorized-domain') message = "Ce domaine n'est pas autorisé dans Firebase."
      setAuthError(message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <Link href="/" className="mb-10 flex flex-col items-center gap-2.5 group">
        <div className="w-14 h-14 bg-primary rounded-[16px] flex items-center justify-center shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
          <Bike className="w-7 h-7 text-white" />
        </div>
        <span className="text-xl font-semibold tracking-tight">LifeCycle</span>
      </Link>

      <div className="w-full max-w-[400px] bg-card rounded-2xl p-8 shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-border/50">
        {/* Tab switcher */}
        <div className="flex bg-muted p-1 rounded-xl mb-8">
          <Link href="/login" className="flex-1 text-center py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            Connexion
          </Link>
          <Link href="/register" className="flex-1 text-center py-2 text-[13px] font-semibold rounded-[10px] bg-card shadow-sm text-foreground">
            Inscription
          </Link>
        </div>

        {authError && (
          <Alert variant="destructive" className="mb-6 rounded-xl border-none bg-destructive/8 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs ml-1">{authError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">Nom complet</Label>
            <Input
              id="name"
              placeholder="Jane Doe"
              className="h-11 rounded-xl bg-muted/50 border-border/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              className="h-11 rounded-xl bg-muted/50 border-border/50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="h-11 rounded-xl bg-muted/50 border-border/50 pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full h-11 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Créer mon compte
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/50" />
          </div>
          <span className="relative flex justify-center bg-card px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            ou
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 rounded-xl border-border/60 bg-card font-semibold hover:bg-muted transition-all"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (
            <svg className="w-4 h-4 mr-2.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Continuer avec Google
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
