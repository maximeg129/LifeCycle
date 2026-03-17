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
  CheckCircle2,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useAuth } from '@/firebase'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'

const navItems = [
  { name: 'Cyclisme', href: '/cycling', icon: Bike },
  { name: 'Nutrition', href: '/nutrition', icon: CookingPot },
  { name: 'Météo AI', href: '/weather', icon: CloudSun },
  { name: 'Maison & Plantes', href: '/home-management', icon: Leaf },
  { name: 'Vie & Santé', href: '/lifestyle', icon: HeartPulse },
  { name: 'Finances', href: '/finance', icon: Wallet },
]

export function AppNavigation() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/login')
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white dark:bg-black border-r border-border/40 z-40">
        <div className="p-10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center group-hover:scale-105 transition-all shadow-xl shadow-primary/20">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tighter leading-none">LifeCycle</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mt-1">Vault Pro</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 px-5 py-4 space-y-2">
          <div className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] px-4 mb-6">Plateforme</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group",
                  isActive 
                    ? "bg-primary text-white font-bold shadow-2xl shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}>
                  <item.icon className={cn("w-5 h-5", isActive ? "" : "group-hover:text-primary transition-colors")} />
                  <span className="text-sm font-semibold tracking-tight">{item.name}</span>
                  {isActive && <ChevronRight className="ml-auto w-4 h-4 opacity-50" />}
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="p-6 mt-auto border-t border-border/40 space-y-2">
          <Link href="/settings">
            <div className={cn(
              "flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all group",
              pathname === '/settings' 
                ? "bg-secondary text-foreground font-bold" 
                : "text-muted-foreground hover:bg-secondary"
            )}>
              <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-700" />
              <span className="text-sm font-semibold">Réglages</span>
            </div>
          </Link>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all group"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-semibold">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Bottom Nav */}
      <div className="md:hidden">
        <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-b border-border/40 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/10">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tighter leading-none">LifeCycle</span>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-secondary">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-white dark:bg-black w-72 p-10 border-r-border/40">
               <div className="mb-12 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tighter">LifeCycle</span>
              </div>
              <nav className="space-y-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={cn(
                        "flex items-center gap-5 px-6 py-4 rounded-2xl transition-all",
                        isActive ? "bg-primary text-white font-bold shadow-xl shadow-primary/20" : "text-muted-foreground"
                      )}>
                        <item.icon className="w-6 h-6" />
                        <span className="text-lg">{item.name}</span>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 dark:bg-black/90 backdrop-blur-2xl border-t border-border/40 z-40 flex items-center justify-around px-4 pb-2">
          {navItems.slice(0, 4).concat([{ name: 'Réglages', href: '/settings', icon: Settings }]).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                <div className={cn(
                  "p-3 rounded-2xl transition-all duration-300",
                  isActive ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "text-muted-foreground/60"
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}