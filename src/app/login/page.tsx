"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth'
import { useAuth } from '@/firebase'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const auth = useAuth()
  const { toast } = useToast()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAuthError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast({ title: "Bon retour !", description: "Connexion réussie." })
      router.push('/home-management')
    } catch (error: any) {
      console.error("Login error:", error)
      setAuthError("Email ou mot de passe incorrect.")
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
      const result = await signInWithPopup(auth, provider)
      if (result.user) {
        toast({ title: "Succès", description: "Connexion Google réussie." })
        router.push('/home-management')
      }
    } catch (error: any) {
      console.error("Google Auth Error:", error)
      let message = "Impossible de se connecter avec Google."
      
      if (error.code === 'auth/popup-blocked') {
        message = "La fenêtre de connexion a été bloquée par votre navigateur. Veuillez autoriser les fenêtres surgissantes pour ce site."
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "La connexion Google n'est pas activée. Veuillez l'activer dans Authentication > Sign-in method de votre console Firebase."
      } else if (error.code === 'auth/unauthorized-domain') {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'ce domaine'
        message = `Le domaine ${domain} n'est pas autorisé. Ajoutez-le dans Authentication > Settings > Authorized domains.`
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = "Connexion annulée."
      }
      
      setAuthError(message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center p-6">
      <Link href="/" className="mb-12 flex flex-col items-center gap-3 group">
        <div className="w-14 h-14 bg-foreground rounded-[16px] flex items-center justify-center shadow-xl transition-transform group-hover:scale-105">
          <CheckCircle2 className="w-8 h-8 text-background" />
        </div>
        <span className="text-2xl font-bold tracking-tight">Homly</span>
      </Link>

      <div className="w-full max-w-[420px] bg-white rounded-[32px] p-10 shadow-[0_30px_60px_rgba(0,0,0,0.06)] border border-gray-100">
        <div className="flex bg-secondary/80 p-1.5 rounded-[18px] mb-10">
          <Link href="/login" className="flex-1 text-center py-2.5 text-sm font-bold rounded-[14px] bg-white shadow-md text-foreground ring-1 ring-black/5">Connexion</Link>
          <Link href="/register" className="flex-1 text-center py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">Inscription</Link>
        </div>

        {authError && (
          <Alert variant="destructive" className="mb-6 rounded-2xl border-none bg-red-50 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription className="text-xs">{authError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="votre@email.com" 
              className="rounded-2xl border border-border/60 bg-secondary/40 h-14 px-6 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:bg-white transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Mot de passe</Label>
              <Link href="#" className="text-[11px] text-primary hover:underline font-bold uppercase tracking-widest">Oublié ?</Link>
            </div>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="rounded-2xl border border-border/60 bg-secondary/40 h-14 px-6 pr-14 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:bg-white transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full bg-foreground text-background hover:bg-black/90 rounded-2xl h-14 text-base font-bold shadow-xl shadow-black/5 transition-all active:scale-[0.98]" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Se connecter"}
          </Button>
        </form>

        <div className="relative my-10 text-center">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
          <span className="relative bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">ou</span>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full rounded-2xl h-14 border-border bg-white font-bold hover:bg-secondary transition-all"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : (
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Continuer avec Google
        </Button>
      </div>
    </div>
  )
}