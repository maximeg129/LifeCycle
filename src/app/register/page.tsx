
"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth'
import { useAuth } from '@/firebase'
import { useToast } from '@/hooks/use-toast'

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name })
      }
      toast({ title: "Account created!", description: "Welcome to Homly." })
      router.push('/home-management')
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error.message || "Could not create account."
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
      router.push('/home-management')
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Google Login failed",
        description: error.message
      })
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center p-6 font-body">
      <Link href="/" className="mb-10 flex items-center gap-2">
        <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">Homly</span>
      </Link>

      <div className="w-full max-w-[420px] bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <div className="flex bg-gray-50 p-1 rounded-xl mb-8">
          <Link href="/login" className="flex-1 text-center py-2 text-sm font-semibold text-gray-400 hover:text-gray-600">Log in</Link>
          <Link href="/register" className="flex-1 text-center py-2 text-sm font-semibold rounded-lg bg-white shadow-sm">Register</Link>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              placeholder="Jane Doe" 
              className="rounded-xl border-gray-200 py-6"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              className="rounded-xl border-gray-200 py-6"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="rounded-xl border-gray-200 py-6 pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full bg-[#1A1A1A] text-white hover:bg-gray-800 rounded-xl py-6 text-base font-bold" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Create account
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-400 font-medium">or</span></div>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full rounded-xl py-6 border-gray-200 text-[#1A1A1A] hover:bg-gray-50 font-semibold"
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
          Continue with Google
        </Button>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account? <Link href="/login" className="text-[#4F6EF7] font-bold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
