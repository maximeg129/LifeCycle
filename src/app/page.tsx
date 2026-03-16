"use client"

import React, { useState, useEffect } from 'react'
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
import { cn } from '@/lib/utils'

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    { icon: Bike, title: "Performance", desc: "Suivez votre fitness et fatigue avec Intervals.icu.", color: "text-primary", bg: "bg-primary/5" },
    { icon: CookingPot, title: "Fueling", desc: "Gérez votre nutrition et votre livre de recettes.", color: "text-orange-500", bg: "bg-orange-500/5" },
    { icon: Leaf, title: "Maison", desc: "Tâches intelligentes et soin des plantes par IA.", color: "text-green-500", bg: "bg-green-500/5" },
    { icon: CloudSun, title: "Météo AI", desc: "Anticipez votre tenue cycliste idéale.", color: "text-blue-500", bg: "bg-blue-500/5" },
    { icon: HeartPulse, title: "Santé", desc: "Analyse HRV, sommeil et récupération.", color: "text-red-500", bg: "bg-red-500/5" },
    { icon: Wallet, title: "Finances", desc: "Maîtrisez vos budgets lifestyle avec clarté.", color: "text-yellow-500", bg: "bg-yellow-500/5" },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] text-foreground font-body selection:bg-primary/10">
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4 flex items-center justify-between",
        isScrolled ? "bg-white/70 dark:bg-black/70 backdrop-blur-2xl border-b border-border/40 py-3" : "bg-transparent"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-foreground rounded-[10px] flex items-center justify-center shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-background" />
          </div>
          <span className="text-xl font-bold tracking-tight">Homly <span className="font-light opacity-40">Pro</span></span>
        </div>

        <div className="hidden md:flex items-center gap-10 text-[13px] font-semibold tracking-wide opacity-70">
          <Link href="#features" className="hover:opacity-100 transition-opacity">Univers</Link>
          <Link href="/pricing" className="hover:opacity-100 transition-opacity">Tarifs</Link>
          <Link href="/login" className="hover:opacity-100 transition-opacity">Connexion</Link>
          <Button asChild className="rounded-full px-7 bg-foreground text-background hover:bg-foreground/90 font-bold shadow-xl shadow-black/5">
            <Link href="/register">Essai Gratuit</Link>
          </Button>
        </div>
      </nav>

      <section className="relative pt-48 pb-32 px-6 max-w-7xl mx-auto text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />
        
        <Badge variant="secondary" className="bg-primary/5 text-primary border-none mb-10 px-6 py-2 rounded-full text-xs font-bold tracking-wider uppercase animate-in fade-in slide-in-from-bottom-2 duration-700">
          <Sparkles className="w-3.5 h-3.5 mr-2" /> Votre vie, synchronisée.
        </Badge>
        
        <h1 className="text-6xl md:text-[90px] font-bold tracking-tighter max-w-5xl mx-auto mb-10 leading-[0.95] animate-in fade-in slide-in-from-bottom-4 duration-1000">
          Un seul coffre-fort pour votre performance.
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-14 leading-relaxed opacity-80 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          Centralisez vos données athlétiques, votre foyer et votre bien-être dans une interface conçue pour la clarté.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Button asChild size="lg" className="rounded-full h-16 px-12 text-lg font-bold bg-foreground text-background hover:bg-foreground/90 shadow-2xl transition-all hover:scale-[1.02]">
            <Link href="/register">Commencer gratuitement</Link>
          </Button>
          <Button variant="ghost" size="lg" className="rounded-full h-16 px-12 text-lg font-semibold hover:bg-muted/50" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            Découvrir Homly <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      <section id="features" className="py-40 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-28">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Un écosystème holistique.</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto opacity-70">Chaque module est conçu pour simplifier votre quotidien et booster votre potentiel.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="apple-card p-12 group">
                <div className={cn("w-16 h-16 rounded-[22px] flex items-center justify-center mb-10 transition-transform duration-500 group-hover:scale-110", f.bg, f.color)}>
                  <f.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-lg opacity-80">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-40 px-6 text-center max-w-5xl mx-auto">
        <ShieldCheck className="w-16 h-16 mx-auto text-primary/20 mb-12" />
        <h2 className="text-5xl md:text-[80px] font-bold tracking-tighter mb-12 leading-none">Prêt pour le prochain niveau ?</h2>
        <p className="text-xl text-muted-foreground mb-16 max-w-2xl mx-auto leading-relaxed opacity-70">
          Rejoignez ceux qui ne laissent rien au hasard. Homly est gratuit pour commencer, exceptionnel pour performer.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Button asChild size="lg" className="rounded-full h-20 px-16 text-xl font-bold shadow-2xl bg-foreground text-background transition-all hover:scale-[1.03]">
            <Link href="/register">Créer mon compte</Link>
          </Button>
          <Link href="/pricing" className="text-sm font-bold opacity-60 hover:opacity-100 transition-opacity border-b-2 border-transparent hover:border-foreground pb-1">
            Voir les offres Premium
          </Link>
        </div>
      </section>

      <footer className="py-24 px-6 border-t border-border/40 bg-muted/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-16">
          <div className="flex flex-col items-center md:items-start gap-4">
             <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-foreground rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-background" />
              </div>
              <span className="font-bold text-xl tracking-tight">Homly</span>
            </div>
            <p className="text-sm text-muted-foreground opacity-60">Votre vie, enfin organisée.</p>
          </div>
          <div className="flex gap-16 text-sm font-bold opacity-60">
            <Link href="#" className="hover:opacity-100 transition-opacity">Confidentialité</Link>
            <Link href="#" className="hover:opacity-100 transition-opacity">Contact</Link>
          </div>
          <p className="text-sm text-muted-foreground opacity-40">© 2024 Homly Inc.</p>
        </div>
      </footer>
    </div>
  )
}
