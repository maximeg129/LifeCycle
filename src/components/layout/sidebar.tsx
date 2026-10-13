"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Sun,
  Calendar,
  Activity,
  Settings,
  Menu,
  LogOut,
  Search,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/firebase'

// Retour utilisateur : "je garderais Stella en bouton flottant" — Stella
// n'est plus un onglet de la page Coach (voir coach/page.tsx, fusion en un
// seul onglet "Aujourd'hui") mais un overlay flottant accessible partout
// dans l'app authentifiée, mobile ET desktop (avant ce correctif, seul le
// mobile avait ce bouton — juste un raccourci vers l'onglet Stella côté
// desktop, qui n'existe plus). Chargé à la demande (dynamic) : ce composant
// est monté sur CHAQUE page authentifiée, jamais question d'alourdir le
// bundle initial pour un chat qui ne s'ouvre qu'au clic.
const StellaChatTab = dynamic(() => import('@/components/cycling/stella-chat-tab').then(m => m.StellaChatTab), {
  loading: () => <div className="p-8 flex justify-center"><Sparkles className="w-5 h-5 animate-pulse text-primary" /></div>,
})
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/search/command-palette'
import { APP_VERSION, formatVersionLabel } from '@/lib/version'
import { LifeCycleMark } from './lifecycle-mark'
import { useIsMobile } from '@/hooks/use-mobile'

// Vie & Santé et Finances ont été retirées de la nav principale : leurs
// métriques les plus utiles (sommeil/HRV/readiness) vivent maintenant dans
// Aujourd'hui (ex-Cyclisme) > Vue d'ensemble, et les deux pages restent
// pleinement fonctionnelles (objectifs, analyse IA, budgets...) — juste
// accessibles via la carte "Autres modules" de Réglages plutôt que la nav
// principale. Garage/Nutrition/Maison, sortis de la nav à leur tour pour
// les mêmes raisons (retour utilisateur, inspiré de Frive/Join), suivent le
// même traitement.
//
// ⚠️ Nav à 3 destinations (refonte UI/IA, LifeCycle_Pro_UX_Engine_
// Review.md §3.1, "Adopt it" — AskUserQuestion) — renverse consciemment la
// nav à 2 items (Cyclisme/Coach) qui précédait : **Aujourd'hui** (/cycling,
// coup d'œil quotidien — fusionne ce qui vivait sur Cyclisme ET sur l'ex-
// onglet Coach "Aujourd'hui", voir cycling/page.tsx), **Plan** (/plan,
// gestion du plan périodisé — nouvelle page top-level, voir plan-tab.tsx,
// sortie de son ancien Sheet), **Activités** (/coach, Journal + détail +
// graphes — l'URL reste /coach, voir le commentaire de tête de ce fichier
// côté coach/page.tsx). `key` indexe le namespace Nav (messages/
// {locale}.json) — le libellé affiché est résolu dans le composant via
// useTranslations('Nav'), jamais stocké ici : ce tableau reste un
// module-scope constant (hors composant), où le hook de traduction n'est
// pas utilisable.
const navItems = [
  { key: 'today' as const, href: '/cycling', icon: Sun },
  { key: 'plan' as const, href: '/plan', icon: Calendar },
  { key: 'activities' as const, href: '/coach', icon: Activity },
]

export function AppNavigation() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const t = useTranslations('Nav')
  const [stellaOpen, setStellaOpen] = useState(false)
  const isMobile = useIsMobile()

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/login')
  }

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-background border-r border-border/60 z-40">
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <Link href="/" className="flex items-center gap-3 group">
            <LifeCycleMark className="w-9 h-9 shadow-md shadow-primary/25 group-hover:scale-105 transition-transform rounded-lg" />
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight">LifeCycle</span>
              <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase mt-0.5">Pro</span>
            </div>
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <button
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted transition-colors text-left"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="text-[13px] flex-1">{t('search')}</span>
            <kbd className="text-xs font-mono bg-background/80 border border-border/60 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest px-3 pb-2">
            {t('modules')}
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                {/* Actif : fond --surface (bg-card) + ring intérieur --border,
                    pas un lavis lime — restructuration complète
                    (lifecycle-ui-reference.html, ".nav[aria-current]") :
                    ".nav[aria-current]{background:var(--surface);...;
                    box-shadow:inset 0 0 0 1px var(--border)}". Seule l'icône
                    reste colorée brand (déjà le cas). */}
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
                  isActive
                    ? "bg-card text-foreground font-semibold shadow-[inset_0_0_0_1px_hsl(var(--border))]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
                  <span className="text-[13.5px] font-medium flex-1">{t(item.key)}</span>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom — Réglages + Déconnexion (voir leur propre commentaire :
            lifecycle-ui-reference.html montre aussi un item "Profil &
            coach" séparé, non construit ici — aucune page dédiée n'existe
            encore pour ce contenu, Profil restant une section de /settings,
            voir CLAUDE.md). */}
        <div className="px-3 pb-6 pt-3 border-t border-border/60 space-y-0.5">
          <Link href="/settings">
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
              pathname === '/settings'
                ? "bg-card text-foreground font-semibold shadow-[inset_0_0_0_1px_hsl(var(--border))]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <Settings className={cn("w-[18px] h-[18px] shrink-0 group-hover:rotate-45 transition-transform duration-500", pathname === '/settings' && "text-primary")} />
              <span className="text-[13.5px] font-medium">{t('settings')}</span>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-all duration-150 group"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="text-[13.5px] font-medium">{t('logout')}</span>
          </button>
          <p className="px-3 pt-2 text-xs font-mono text-muted-foreground/40 select-text">
            {formatVersionLabel(APP_VERSION.gitSha, APP_VERSION.buildTime)}
          </p>
        </div>
      </aside>

      {/* ── Mobile ───────────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Top bar */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-background/85 backdrop-blur-2xl border-b border-border/50 z-40 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LifeCycleMark className="w-7 h-7 shadow-sm shadow-primary/20 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight">LifeCycle</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-lg hover:bg-muted"
              onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            >
              <Search className="w-[18px] h-[18px]" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-lg hover:bg-muted">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-background w-64 p-0 border-r border-border/60">
                <div className="px-6 pt-8 pb-6 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <LifeCycleMark className="w-9 h-9 shadow-md shadow-primary/25 rounded-lg" />
                    <div>
                      <span className="text-[15px] font-semibold tracking-tight block">LifeCycle</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-widest">Pro</span>
                    </div>
                  </div>
                </div>
                <nav className="px-3 pt-3 space-y-0.5">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link key={item.href} href={item.href}>
                        {/* Même traitement actif que le rail desktop — voir son commentaire. */}
                        <div className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                          isActive ? "bg-card text-foreground font-semibold shadow-[inset_0_0_0_1px_hsl(var(--border))]" : "text-muted-foreground"
                        )}>
                          <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                          <span className="text-[14px] font-medium flex-1">{t(item.key)}</span>
                        </div>
                      </Link>
                    )
                  })}
                </nav>
                {/* Réglages + Déconnexion — mirrors the desktop sidebar's
                    bottom block. Réglages is also reachable from the bottom
                    pill nav, but sign-out previously existed only on
                    desktop: a mobile user had no way to log out at all. */}
                <div className="px-3 pt-3 pb-6 mt-3 border-t border-border/60 space-y-0.5">
                  <Link href="/settings">
                    <div className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg transition-all",
                      pathname === '/settings' ? "bg-card text-foreground font-semibold shadow-[inset_0_0_0_1px_hsl(var(--border))]" : "text-muted-foreground"
                    )}>
                      <Settings className={cn("w-5 h-5 shrink-0", pathname === '/settings' && "text-primary")} />
                      <span className="text-[14px] font-medium">{t('settings')}</span>
                    </div>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-all"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span className="text-[14px] font-medium">{t('logout')}</span>
                  </button>
                  <p className="px-3 pt-2 text-xs font-mono text-muted-foreground/40 select-text">
                    {formatVersionLabel(APP_VERSION.gitSha, APP_VERSION.buildTime)}
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Bottom nav — floating pill, 3 destinations seulement
            (Aujourd'hui/Plan/Activités) — restructuration complète
            (lifecycle-ui-reference.html, ".bottomnav" n'a que ces 3
            boutons) : Réglages, qui y vivait en 4ᵉ item, en est retiré —
            reste joignable via le menu ☰ (Sheet, voir plus haut), comme
            dans la référence (aucun Réglages dans son bottomnav non plus).
            Stella (bouton séparé, voir plus bas) n'est plus empilé dans
            cette rangée. */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1 safe-area-bottom">
          <div className="h-16 rounded-full bg-background/90 backdrop-blur-2xl border border-border/60 shadow-lg shadow-black/5 flex items-center justify-around px-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 min-w-[48px] py-1">
                  <div className={cn(
                    "relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200",
                    isActive ? "bg-primary/12 text-primary" : "text-muted-foreground"
                  )}>
                    <item.icon className="w-[20px] h-[20px]" />
                  </div>
                  <span className={cn(
                    "text-xs font-medium tracking-tight",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {t(item.key)}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Stella — bouton flottant, pill foncée + libellé sur desktop,
          icône seule repositionnée au-dessus du bottom nav sur mobile —
          restructuration complète (lifecycle-ui-reference.html, ".fab") :
          ".fab{height:44px;...;background:var(--text);color:var(--bg)}
          .fab svg{stroke:var(--brand)}" + sous 820px "bottom:84px;
          right:16px;padding:0 12px... .fab b{display:none}" (le libellé
          disparaît, pas la forme : un seul bouton, pas deux variantes
          visuellement différentes comme avant ce correctif). */}
      <button
        type="button"
        onClick={() => setStellaOpen(true)}
        aria-label="Stella"
        className="fixed z-40 h-11 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95 bg-foreground text-background bottom-[84px] right-4 px-3 md:bottom-6 md:right-6 md:px-4"
      >
        <Sparkles className="w-[18px] h-[18px] text-primary shrink-0" />
        <span className="hidden md:inline text-sm font-semibold">Stella</span>
      </button>

      {/* Panneau Stella — refonte UI/IA (LifeCycle_Pro_UX_Engine_Review.md
          §3.1/3.2, "persistent side panel desktop / bottom sheet mobile") :
          avant ce correctif, Stella s'ouvrait toujours en Sheet "bottom"
          (hérité du mobile), y compris sur desktop où un panneau latéral
          est l'attendu du brief. `useIsMobile()` (même seuil 768px que le
          reste de la nav — voir sidebar.tsx) choisit le côté : "right" sur
          desktop (large, 420px, plein hauteur, à la UI classique
          chat-dans-un-panneau) et "bottom" sur mobile (inchangé). Un seul
          `Sheet` monté à la fois plutôt que deux instances cachées en CSS —
          évite deux overlays/pièges de focus Radix superposés pour le même
          état. */}
      <Sheet open={stellaOpen} onOpenChange={setStellaOpen}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            isMobile
              ? 'max-h-[85vh] overflow-y-auto rounded-t-3xl sm:max-w-lg sm:mx-auto'
              : 'w-full sm:max-w-[420px] p-0 flex flex-col'
          )}
        >
          <SheetHeader className={cn('text-left', !isMobile && 'px-4 pt-4')}>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Stella
            </SheetTitle>
          </SheetHeader>
          <div className={cn(isMobile ? 'pt-3' : 'flex-1 overflow-y-auto px-4 pb-4')}>
            <StellaChatTab />
          </div>
        </SheetContent>
      </Sheet>

      <CommandPalette />
    </>
  )
}
