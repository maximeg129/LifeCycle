"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bike,
  CookingPot,
  CloudSun,
  Wallet,
  HeartPulse,
  Settings,
  Menu,
  LogOut,
  Home,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/firebase'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { useOverdueCounts } from './use-overdue-counts'
import { CommandPalette } from '@/components/search/command-palette'
import { APP_VERSION, formatVersionLabel } from '@/lib/version'

const navItems = [
  { name: 'Cyclisme', href: '/cycling', icon: Bike },
  { name: 'Nutrition', href: '/nutrition', icon: CookingPot },
  { name: 'Météo AI', href: '/weather', icon: CloudSun },
  { name: 'Maison', href: '/home-management', icon: Home },
  { name: 'Vie & Santé', href: '/lifestyle', icon: HeartPulse },
  { name: 'Finances', href: '/finance', icon: Wallet },
]

// Maison covers both tabs (Tâches / Plantes — see AUDIT.md/PLAN.md section
// 3.2 for why they were merged back into one module), so its nav badge
// combines both overdue counts rather than picking one.
function badgeForHref(href: string, overdueTasks: number, overduePlants: number): number {
  if (href === '/home-management') return overdueTasks + overduePlants
  return 0
}

export function AppNavigation() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const { overdueTasks, overduePlants } = useOverdueCounts()

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
            <div className="w-9 h-9 bg-primary rounded-[10px] flex items-center justify-center shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight">LifeCycle</span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase mt-0.5">Pro</span>
            </div>
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <button
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] bg-muted/60 text-muted-foreground hover:bg-muted transition-colors text-left"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="text-[13px] flex-1">Rechercher...</span>
            <kbd className="text-[10px] font-mono bg-background/80 border border-border/60 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-3 pb-2">
            Modules
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const badge = badgeForHref(item.href, overdueTasks, overduePlants)
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 group",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
                  <span className="text-[13.5px] font-medium flex-1">{item.name}</span>
                  {badge > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-6 pt-3 border-t border-border/60 space-y-0.5">
          <Link href="/settings">
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 group",
              pathname === '/settings'
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}>
              <Settings className="w-[18px] h-[18px] shrink-0 group-hover:rotate-45 transition-transform duration-500" />
              <span className="text-[13.5px] font-medium">Réglages</span>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-all duration-150 group"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className="text-[13.5px] font-medium">Déconnexion</span>
          </button>
          <p className="px-3 pt-2 text-[10px] font-mono text-muted-foreground/40 select-text">
            {formatVersionLabel(APP_VERSION.gitSha, APP_VERSION.buildTime)}
          </p>
        </div>
      </aside>

      {/* ── Mobile ───────────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Top bar */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-background/85 backdrop-blur-2xl border-b border-border/50 z-40 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-[8px] flex items-center justify-center shadow-sm shadow-primary/20">
              <Bike className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">LifeCycle</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-[10px] hover:bg-muted"
              onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            >
              <Search className="w-[18px] h-[18px]" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9 rounded-[10px] hover:bg-muted">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-background w-64 p-0 border-r border-border/60">
                <div className="px-6 pt-8 pb-6 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary rounded-[10px] flex items-center justify-center shadow-md shadow-primary/25">
                      <Bike className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="text-[15px] font-semibold tracking-tight block">LifeCycle</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Pro</span>
                    </div>
                  </div>
                </div>
                <nav className="px-3 pt-3 space-y-0.5">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href
                    const badge = badgeForHref(item.href, overdueTasks, overduePlants)
                    return (
                      <Link key={item.href} href={item.href}>
                        <div className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-[10px] transition-all",
                          isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                        )}>
                          <item.icon className="w-5 h-5 shrink-0" />
                          <span className="text-[14px] font-medium flex-1">{item.name}</span>
                          {badge > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                              {badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </nav>
                <p className="px-6 pt-4 text-[10px] font-mono text-muted-foreground/40 select-text">
                  {formatVersionLabel(APP_VERSION.gitSha, APP_VERSION.buildTime)}
                </p>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Bottom nav — 4 core destinations (thumb-reach budget) + Réglages.
            Cyclisme, Nutrition, Maison, Vie & Santé; Météo AI and Finances
            stay reachable via the "Menu" sheet above. */}
        <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-background/90 backdrop-blur-2xl border-t border-border/50 z-40 flex items-center justify-around px-2 pb-2 safe-area-bottom">
          {[
            navItems.find(i => i.href === '/cycling')!,
            navItems.find(i => i.href === '/nutrition')!,
            navItems.find(i => i.href === '/home-management')!,
            navItems.find(i => i.href === '/lifestyle')!,
            { name: 'Réglages', href: '/settings', icon: Settings },
          ].map((item) => {
            const isActive = pathname === item.href
            const badge = badgeForHref(item.href, overdueTasks, overduePlants)
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 min-w-[56px] py-1">
                <div className={cn(
                  "relative w-9 h-9 flex items-center justify-center rounded-[10px] transition-all duration-200",
                  isActive ? "bg-primary/12 text-primary" : "text-muted-foreground"
                )}>
                  <item.icon className="w-[20px] h-[20px]" />
                  {badge > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </div>
                <span className={cn(
                  "text-[9px] font-medium tracking-tight",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.name.split(' ')[0]}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>

      <CommandPalette />
    </>
  )
}
