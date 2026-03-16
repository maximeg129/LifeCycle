"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Bike, 
  CookingPot, 
  CloudSun, 
  Leaf, 
  HeartPulse, 
  Wallet,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-foreground font-body selection:bg-primary/20">
      {/* Navbar */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4 flex items-center justify-between",
        isScrolled ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-border/40 py-3" : "bg-transparent"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-background" />
          </div>
          <span className="text-xl font-bold tracking-tighter">LifeCycle <span className="font-light opacity-60">Pro</span></span>
        </div>

        <div className="hidden md:flex items-center gap-10 text-sm font-medium opacity-70">
          <Link href="#features" className="hover:opacity-100 transition-opacity">Univers</Link>
          <Link href="/pricing" className="hover:opacity-100 transition-opacity">Tarifs</Link>
          <Link href="/login" className="hover:opacity-100 transition-opacity">Connexion</Link>
          <Button asChild className="rounded-full px-6 font-semibold shadow-xl shadow-primary/20">
            <Link href="/register">Essai Gratuit</Link>
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-24 px-6 max-w-7xl mx-auto text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10" />
        
        <Badge variant="secondary" className="bg-primary/10 text-primary border-none mb-8 px-5 py-1.5 rounded-full animate-in fade-in slide-in-from-bottom-2 duration-700">
          <Sparkles className="w-4 h-4 mr-2" /> Votre vie, synchronisée.
        </Badge>
        
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter max-w-5xl mx-auto mb-8 leading-[1.05] animate-in fade-in slide-in-from-bottom-4 duration-1000 text-gradient">
          Un seul coffre-fort pour toute votre performance.
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000">
          De vos sorties vélo à votre nutrition, de votre maison à vos finances. Centralisez tout avec l'élégance et l'intelligence que vous méritez.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Button asChild size="lg" className="rounded-full px-10 py-7 text-lg font-bold shadow-2xl shadow-primary/30">
            <Link href="/register">Commencer l'aventure</Link>
          </Button>
          <Button variant="ghost" size="lg" className="rounded-full px-10 py-7 text-lg font-semibold hover:bg-muted" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            Découvrir les modules <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Dynamic App Preview */}
        <div className="mt-28 relative max-w-6xl mx-auto animate-in fade-in zoom-in duration-1000">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="apple-card p-6 flex flex-col items-center gap-3">
              <Bike className="w-8 h-8 text-primary" />
              <div className="text-sm font-bold uppercase tracking-widest opacity-50">Cyclisme</div>
              <div className="text-2xl font-bold">84 CTL</div>
            </div>
            <div className="apple-card p-6 flex flex-col items-center gap-3">
              <CookingPot className="w-8 h-8 text-accent" />
              <div className="text-sm font-bold uppercase tracking-widest opacity-50">Nutrition</div>
              <div className="text-2xl font-bold">1,840 kcal</div>
            </div>
            <div className="apple-card p-6 flex flex-col items-center gap-3">
              <Leaf className="w-8 h-8 text-green-500" />
              <div className="text-sm font-bold uppercase tracking-widest opacity-50">Maison</div>
              <div className="text-2xl font-bold">3 Alertes</div>
            </div>
            <div className="apple-card p-6 flex flex-col items-center gap-3">
              <HeartPulse className="w-8 h-8 text-red-500" />
              <div className="text-sm font-bold uppercase tracking-widest opacity-50">Santé</div>
              <div className="text-2xl font-bold">92/100</div>
            </div>
          </div>
        </div>
      </section>

      {/* Univers Section */}
      <section id="features" className="py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Un écosystème complet.</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Chaque aspect de votre vie optimisé par des algorithmes intelligents et une interface épurée.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1: Performance */}
            <div className="apple-card p-10 space-y-6">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-[18px] flex items-center justify-center">
                <Bike className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold">Performance Athlétique</h3>
              <p className="text-muted-foreground leading-relaxed">Synchronisez vos données Intervals.icu pour suivre votre fitness, fatigue et forme en temps réel.</p>
            </div>

            {/* Feature 2: Fueling */}
            <div className="apple-card p-10 space-y-6">
              <div className="w-14 h-14 bg-accent/10 text-accent rounded-[18px] flex items-center justify-center">
                <CookingPot className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold">Nutrition & Recettes</h3>
              <p className="text-muted-foreground leading-relaxed">Gérez votre livre de recettes et votre plan nutritionnel pour un fueling parfait avant chaque effort.</p>
            </div>

            {/* Feature 3: Smart Home */}
            <div className="apple-card p-10 space-y-6">
              <div className="w-14 h-14 bg-green-500/10 text-green-500 rounded-[18px] flex items-center justify-center">
                <Leaf className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold">Maison Intelligente</h3>
              <p className="text-muted-foreground leading-relaxed">Maintenance ménagère à récurrence intelligente et scanner de plantes par IA pour un foyer serein.</p>
            </div>

            {/* Feature 4: AI Weather */}
            <div className="apple-card p-10 space-y-6">
              <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-[18px] flex items-center justify-center">
                <CloudSun className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold">Assistant Météo AI</h3>
              <p className="text-muted-foreground leading-relaxed">Prévisions réelles combinées à une IA qui recommande votre tenue cycliste idéale selon les conditions.</p>
            </div>

            {/* Feature 5: Lifestyle */}
            <div className="apple-card p-10 space-y-6">
              <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-[18px] flex items-center justify-center">
                <HeartPulse className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold">Santé & HRV</h3>
              <p className="text-muted-foreground leading-relaxed">Suivi du sommeil, de la variabilité cardiaque et du stress pour une récupération optimale.</p>
            </div>

            {/* Feature 6: Finance */}
            <div className="apple-card p-10 space-y-6">
              <div className="w-14 h-14 bg-yellow-500/10 text-yellow-500 rounded-[18px] flex items-center justify-center">
                <Wallet className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold">Coffre-fort Financier</h3>
              <p className="text-muted-foreground leading-relaxed">Maîtrisez vos budgets lifestyle et anticipez vos projets futurs avec clarté.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-24 text-center border-y border-border/40">
        <div className="max-w-4xl mx-auto px-6 space-y-8">
          <ShieldCheck className="w-12 h-12 mx-auto text-primary opacity-20" />
          <p className="text-muted-foreground font-semibold uppercase tracking-[0.25em] text-xs">Propulsé par Firebase & Intelligence Artificielle de pointe</p>
          <div className="flex justify-center items-center gap-12 opacity-30 grayscale contrast-125">
             <div className="text-2xl font-black">FIREBASE</div>
             <div className="text-2xl font-black">GENKIT</div>
             <div className="text-2xl font-black">GOOGLE CLOUD</div>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-32 px-6 text-center max-w-5xl mx-auto">
        <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-10 text-gradient">Prêt pour le prochain niveau ?</h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Rejoignez les passionnés qui ne laissent rien au hasard. Homly est gratuit pour commencer, évolutif pour performer.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="rounded-full px-12 py-8 text-xl font-bold shadow-2xl">
            <Link href="/register">Créer mon compte gratuit</Link>
          </Button>
          <Link href="/pricing" className="text-sm font-semibold hover:underline decoration-primary underline-offset-8 transition-all">
            Voir nos offres Premium
          </Link>
        </div>
      </section>

      {/* Real Footer */}
      <footer className="py-16 px-6 border-t border-border/40 bg-muted/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
             <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-foreground rounded flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-background" />
              </div>
              <span className="font-bold text-xl tracking-tighter">LifeCycle Pro</span>
            </div>
            <p className="text-sm text-muted-foreground">Votre vie, enfin organisée.</p>
          </div>
          <div className="flex gap-12 text-sm font-medium text-muted-foreground">
            <Link href="#" className="hover:text-foreground transition-colors">Confidentialité</Link>
            <Link href="#" className="hover:text-foreground transition-colors">CGU</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <p className="text-sm text-muted-foreground opacity-50">© 2024 Homly Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}