"use client"

// Landing page publique — retour utilisateur : "revoir le site pour mettre
// en avant toutes les fonctions de l'application, avec des screenshoots
// exemple etc." Remplace la grille d'icônes génériques par une vitrine
// module par module, avec un vrai aperçu visuel de chaque écran
// (public/screenshots/*.png — des mockups fidèles au design system réel,
// composés à partir des vrais composants (RingGauge, RecipeCard...) avec
// des données d'exemple, jamais présentés comme un compte utilisateur réel).

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LifeCycleMark } from '@/components/layout/lifecycle-mark'
import {
  ArrowRight,
  Sparkles,
  Bike,
  BrainCircuit,
  CookingPot,
  Wrench,
  Home as HomeIcon,
  ShieldCheck,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShowcaseModule {
  icon: typeof Bike
  color: string
  bg: string
  eyebrow: string
  title: string
  points: string[]
  image: string
  imageW: number
  imageH: number
}

const modules: ShowcaseModule[] = [
  {
    icon: Bike,
    color: 'text-primary',
    bg: 'bg-primary/10',
    eyebrow: 'Cyclisme',
    title: 'Votre forme, en un coup d’œil',
    points: [
      'Anneaux Forme / Récupération / Sommeil façon Whoop, synchronisés avec Intervals.icu (CTL, ATL, TSB, FTP, HRV, FC repos).',
      'Budget kJ de la semaine et Gouverneur de charge interne — 6 signaux de récupération pour doser l’entraînement, pas un TSS arbitraire.',
      'Courbe de performance 12 semaines et calculateur d’indice d’endurance de Riegel.',
    ],
    image: '/screenshots/cycling.png',
    imageW: 960,
    imageH: 688,
  },
  {
    icon: BrainCircuit,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    eyebrow: 'Coach IA',
    title: 'Un coach qui connaît vraiment vos données',
    points: [
      'Proposition de séance quotidienne générée par IA, adaptée à votre récupération réelle et à la météo (vent inclus) — pas un plan figé.',
      'Stella, l’assistant conversationnel qui peut mettre à jour vos objectifs et votre mémoire coach sur simple demande.',
      'Plan d’entraînement structuré vers un objectif, et analyse complète de chaque sortie (pacing, zones, dérive cardiaque).',
    ],
    image: '/screenshots/coach.png',
    imageW: 960,
    imageH: 738,
  },
  {
    icon: CookingPot,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    eyebrow: 'Nutrition',
    title: 'Un fueling pensé pour l’entraînement',
    points: [
      'Livre de recettes avec macros, ingrédients en checklist et préparation en étapes — un tap pour logger une recette au journal du jour.',
      'Fueling vs Workload : calories brûlées à l’entraînement séparées du métabolisme de base, écart réel avec ce que vous avez mangé.',
      'Planning de repas hebdomadaire et cible protéines ajustée à votre poids.',
    ],
    image: '/screenshots/nutrition.png',
    imageW: 1040,
    imageH: 708,
  },
  {
    icon: Wrench,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    eyebrow: 'Garage',
    title: 'Votre matériel, sous contrôle',
    points: [
      'Vélos, composants et suivi d’entretien de chaîne (rotation à chaud) avec historique et rappels.',
      'Garde-robe cycliste reliée à la météo IA — la bonne tenue proposée pour la sortie du jour.',
      'Alertes avant que l’usure devienne un problème, pas après.',
    ],
    image: '/screenshots/garage.png',
    imageW: 960,
    imageH: 608,
  },
  {
    icon: HomeIcon,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    eyebrow: 'Maison',
    title: 'La vie de tous les jours, aussi',
    points: [
      'Tâches récurrentes avec rappels et indicateurs de retard — plus besoin de s’en souvenir.',
      'Soin des plantes avec diagnostic photo par IA et plan d’arrosage.',
      'Vie & Santé et Finances restent disponibles en un clic depuis Réglages, pour qui veut aller plus loin.',
    ],
    image: '/screenshots/home.png',
    imageW: 960,
    imageH: 614,
  },
]

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] text-foreground font-body selection:bg-primary/10">
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4 flex items-center justify-between",
        isScrolled ? "bg-white/70 dark:bg-black/70 backdrop-blur-2xl border-b border-border/40 py-3" : "bg-transparent"
      )}>
        <div className="flex items-center gap-2.5">
          <LifeCycleMark className="w-9 h-9 shadow-lg rounded-[10px]" />
          <span className="text-xl font-bold tracking-tight">LifeCycle <span className="font-light opacity-40">Pro</span></span>
        </div>

        <div className="hidden md:flex items-center gap-10 text-[13px] font-semibold tracking-wide opacity-70">
          <Link href="#features" className="hover:opacity-100 transition-opacity">Univers</Link>
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
            Découvrir LifeCycle <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      <section id="features" className="py-40 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-28">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Un écosystème holistique.</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto opacity-70">Chaque module est conçu pour simplifier votre quotidien et booster votre potentiel — voici à quoi ça ressemble, à l&apos;intérieur.</p>
          </div>

          <div className="space-y-32">
            {modules.map((m, i) => (
              <div
                key={m.eyebrow}
                className={cn(
                  "grid grid-cols-1 lg:grid-cols-2 gap-14 items-center",
                  i % 2 === 1 && "lg:[direction:rtl]"
                )}
              >
                <div className="lg:[direction:ltr]">
                  <div className={cn("w-14 h-14 rounded-[20px] flex items-center justify-center mb-8", m.bg, m.color)}>
                    <m.icon className="w-7 h-7" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{m.eyebrow}</div>
                  <h3 className="text-3xl md:text-4xl font-bold mb-8 tracking-tight leading-tight">{m.title}</h3>
                  <ul className="space-y-4">
                    {m.points.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-muted-foreground leading-relaxed opacity-90">
                        <span className={cn("mt-2 w-1.5 h-1.5 rounded-full shrink-0", m.bg.replace('/10', ''))} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lg:[direction:ltr]">
                  <div className="lc-card p-3 overflow-hidden">
                    <Image
                      src={m.image}
                      width={m.imageW}
                      height={m.imageH}
                      alt={`Aperçu du module ${m.eyebrow} dans LifeCycle Pro`}
                      className="w-full h-auto rounded-2xl"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-40 px-6 text-center max-w-5xl mx-auto">
        <ShieldCheck className="w-16 h-16 mx-auto text-primary/20 mb-12" />
        <h2 className="text-5xl md:text-[80px] font-bold tracking-tighter mb-12 leading-none">Prêt pour le prochain niveau ?</h2>
        <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed opacity-70">
          Rejoignez ceux qui ne laissent rien au hasard.
        </p>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-16 opacity-60">
          <Lock className="w-4 h-4" /> Vos données restent les vôtres — chiffrées en transit, isolées par compte, exportables et supprimables à tout moment.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Button asChild size="lg" className="rounded-full h-20 px-16 text-xl font-bold shadow-2xl bg-foreground text-background transition-all hover:scale-[1.03]">
            <Link href="/register">Créer mon compte</Link>
          </Button>
        </div>
      </section>

      <footer className="py-24 px-6 border-t border-border/40 bg-muted/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-16">
          <div className="flex flex-col items-center md:items-start gap-4">
             <div className="flex items-center gap-3">
              <LifeCycleMark className="w-9 h-9 rounded-lg" />
              <span className="font-bold text-xl tracking-tight">LifeCycle</span>
            </div>
            <p className="text-sm text-muted-foreground opacity-60">Votre vie, enfin organisée.</p>
          </div>
          <div className="flex gap-16 text-sm font-bold opacity-60">
            <Link href="#" className="hover:opacity-100 transition-opacity">Confidentialité</Link>
            <Link href="#" className="hover:opacity-100 transition-opacity">Contact</Link>
          </div>
          <p className="text-sm text-muted-foreground opacity-40">© 2026 LifeCycle Pro.</p>
        </div>
      </footer>
    </div>
  )
}
