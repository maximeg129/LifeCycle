
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
  Menu
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
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-card border-r border-border z-40">
        <div className="p-6">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <Bike className="w-8 h-8 text-accent" />
            <span>LifeCycle <span className="text-foreground">Pro</span></span>
          </h1>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <item.icon className={cn("w-5 h-5", isActive ? "" : "group-hover:text-primary")} />
                  <span>{item.name}</span>
                  {isActive && <ChevronRight className="ml-auto w-4 h-4" />}
                </div>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border mt-auto">
          <Link href="/settings">
            <Button variant="ghost" className={cn(
              "w-full justify-start gap-3",
              pathname === '/settings' ? "text-primary" : "text-muted-foreground"
            )}>
              <Settings className="w-5 h-5" />
              Paramètres
            </Button>
          </Link>
        </div>
      </aside>

      {/* Mobile Header & Bottom Nav */}
      <div className="md:hidden">
        <header className="fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-lg border-b border-border z-40 px-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary flex items-center gap-2">
            <Bike className="w-6 h-6 text-accent" />
            <span>LifeCycle Pro</span>
          </h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-card w-64 border-r-border">
              <nav className="mt-8 space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  )
                })}
                <Link href="/settings">
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg",
                    pathname === '/settings' ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}>
                    <Settings className="w-5 h-5" />
                    <span>Paramètres</span>
                  </div>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-lg border-t border-border z-40 flex items-center justify-around px-2">
          {navItems.slice(0, 4).concat([{ name: 'Settings', href: '/settings', icon: Settings }]).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 min-w-[64px]">
                <div className={cn(
                  "p-1.5 rounded-full transition-colors",
                  isActive ? "bg-primary/20 text-primary" : "text-muted-foreground"
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={cn("text-[10px]", isActive ? "text-primary font-medium" : "text-muted-foreground")}>
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
