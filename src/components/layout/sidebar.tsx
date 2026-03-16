"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Bike, 
  CookingPot, 
  Leaf, 
  CloudSun, 
  Wallet, 
  HeartPulse, 
  Settings,
  ChevronRight,
  Menu,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const navItems = [
  { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { name: 'Cyclisme', href: '/cycling', icon: Bike },
  { name: 'Nutrition', href: '/nutrition', icon: CookingPot },
  { name: 'Météo AI', href: '/weather', icon: CloudSun },
  { name: 'Maison & Plantes', href: '/home-management', icon: Leaf },
  { name: 'Vie & Santé', href: '/lifestyle', icon: HeartPulse },
  { name: 'Finances', href: '/finance', icon: Wallet },
]

export function AppNavigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-background border-r border-border/40 z-40">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-6 h-6 text-background" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tighter leading-none">LifeCycle</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Pro Vault</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1.5">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] px-4 mb-4">Espaces</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                  isActive 
                    ? "bg-foreground text-background font-bold shadow-xl shadow-foreground/10" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <item.icon className={cn("w-5 h-5", isActive ? "" : "group-hover:text-primary transition-colors")} />
                  <span className="text-sm font-semibold">{item.name}</span>
                  {isActive && <ChevronRight className="ml-auto w-4 h-4 opacity-50" />}
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="p-6 mt-auto">
          <Link href="/settings">
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
              pathname === '/settings' 
                ? "bg-muted text-foreground font-bold" 
                : "text-muted-foreground hover:bg-muted"
            )}>
              <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
              <span className="text-sm font-semibold">Réglages</span>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile Header & Bottom Nav */}
      <div className="md:hidden">
        <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border/40 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-background" />
            </div>
            <span className="text-lg font-bold tracking-tighter">LifeCycle</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-background w-72 p-8 border-r-border/40">
              <nav className="mt-8 space-y-3">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={cn(
                        "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all",
                        isActive ? "bg-foreground text-background font-bold" : "text-muted-foreground"
                      )}>
                        <item.icon className="w-5 h-5" />
                        <span className="text-base">{item.name}</span>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-background/90 backdrop-blur-xl border-t border-border/40 z-40 flex items-center justify-around px-4 pb-2">
          {navItems.slice(0, 4).concat([{ name: 'Settings', href: '/settings', icon: Settings }]).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                <div className={cn(
                  "p-2.5 rounded-2xl transition-all duration-300",
                  isActive ? "bg-foreground text-background scale-110 shadow-lg shadow-foreground/10" : "text-muted-foreground"
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={cn("text-[9px] font-bold uppercase tracking-widest", isActive ? "text-foreground" : "text-muted-foreground opacity-50")}>
                  {item.name.split(' ')[0]}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}