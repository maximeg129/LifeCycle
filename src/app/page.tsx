
"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Bell, 
  ShieldCheck,
  Menu,
  X
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
    <div className="min-h-screen bg-white text-[#1A1A1A] font-body selection:bg-[#4F6EF7]/20">
      {/* Navbar */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4 flex items-center justify-between",
        isScrolled ? "bg-white/80 backdrop-blur-md border-b border-gray-100 py-3" : "bg-transparent"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Homly</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="#features" className="hover:text-[#1A1A1A] transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-[#1A1A1A] transition-colors">Pricing</Link>
          <Link href="/login" className="hover:text-[#1A1A1A] transition-colors">Login</Link>
          <Button asChild className="bg-[#1A1A1A] text-white hover:bg-gray-800 rounded-lg px-6">
            <Link href="/register">Get started free</Link>
          </Button>
        </div>

        <button className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <Badge variant="secondary" className="bg-[#4F6EF7]/10 text-[#4F6EF7] border-none mb-6 px-4 py-1 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <Sparkles className="w-3 h-3 mr-2" /> All-in-one home management
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto mb-6 leading-[1.1] animate-in fade-in slide-in-from-bottom-4 duration-1000">
          Your home, always under control.
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000">
          Homly helps you manage household chores with smart recurrence and visual urgency, so you can spend less time thinking about housework.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Button asChild size="lg" className="bg-[#4F6EF7] text-white hover:bg-[#4F6EF7]/90 rounded-xl px-8 py-6 text-lg">
            <Link href="/register">Start for free</Link>
          </Button>
          <Button variant="ghost" size="lg" className="text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-50 px-8 py-6 text-lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            See how it works <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>

        {/* Hero Visual Mockup */}
        <div className="mt-20 relative max-w-5xl mx-auto animate-in fade-in zoom-in duration-1000">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/80 z-10" />
          <div className="bg-white rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="p-8 text-left">
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">Today's Tasks</h3>
                  <p className="text-sm text-gray-400">3 tasks requiring attention</p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-red-500/10 text-red-600 border-none">1 Overdue</Badge>
                  <Badge className="bg-amber-500/10 text-amber-600 border-none">2 Due soon</Badge>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { name: "Clean the oven", room: "Kitchen", color: "bg-red-500", time: "45m" },
                  { name: "Vacuum living room", room: "General", color: "bg-amber-500", time: "20m" },
                  { name: "Water the Monstera", room: "Plants", color: "bg-green-500", time: "5m" }
                ].map((task, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-50 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-1 h-10 rounded-full", task.color)} />
                      <div>
                        <div className="font-semibold">{task.name}</div>
                        <div className="text-xs text-gray-400 uppercase tracking-widest">{task.room}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="text-xs font-medium text-gray-400">{task.time}</span>
                       <div className="w-6 h-6 rounded-full border border-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Smart features for a tidy home.</h2>
            <p className="text-gray-500">Everything you need to keep your household on track without the mental load.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#4F6EF7]/10 text-[#4F6EF7] rounded-2xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Smart recurrence</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Tasks automatically reschedule based on how often you actually do them, not just fixed dates.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#4F6EF7]/10 text-[#4F6EF7] rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Time estimates</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Know exactly how long your chores will take so you can fit them into your busy schedule.</p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#4F6EF7]/10 text-[#4F6EF7] rounded-2xl flex items-center justify-center mb-6">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Push reminders</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Get notified before things pile up. Stay ahead of the mess with gentle, timely nudges.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 text-center border-y border-gray-50">
        <p className="text-gray-400 font-medium uppercase tracking-[0.2em] text-xs">Join 2,000+ households keeping their home on track</p>
      </section>

      {/* Pricing Teaser */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Simple, transparent pricing.</h2>
        <p className="text-xl text-gray-500 mb-10">Start for free, upgrade when your home management needs more power.</p>
        <Button asChild variant="outline" size="lg" className="rounded-xl px-10 py-6 border-gray-200">
          <Link href="/pricing">View pricing plans</Link>
        </Button>
        <p className="mt-6 text-sm text-gray-400">No credit card required for free plan. Cancel anytime.</p>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
             <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#1A1A1A] rounded flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">Homly</span>
            </div>
            <p className="text-sm text-gray-400">Your home, always under control.</p>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <Link href="#" className="hover:text-[#1A1A1A]">Privacy</Link>
            <Link href="#" className="hover:text-[#1A1A1A]">Terms</Link>
            <Link href="#" className="hover:text-[#1A1A1A]">Contact</Link>
          </div>
          <p className="text-sm text-gray-400">© 2024 Homly Inc.</p>
        </div>
      </footer>
    </div>
  )
}
