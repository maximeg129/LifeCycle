
"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true)

  const plans = [
    {
      name: "Free",
      price: 0,
      description: "Ideal for individuals or small apartments.",
      features: [
        "Up to 10 tasks",
        "Basic recurrence (weekly / monthly)",
        "Email reminders only",
        "1 household member",
      ],
      cta: "Get started free",
      href: "/register",
      popular: false
    },
    {
      name: "Premium",
      price: isAnnual ? 3.25 : 4.99,
      description: "Perfect for busy families and large homes.",
      features: [
        "Unlimited tasks",
        "Smart recurrence (custom intervals)",
        "Push notifications + daily digest",
        "Up to 5 household members",
        "Priority support",
        "No ads"
      ],
      cta: "Start 14-day free trial",
      href: "/register?plan=premium",
      popular: true
    }
  ]

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A] font-body flex flex-col items-center py-20 px-6">
      <Link href="/" className="mb-12 flex items-center gap-2">
        <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">Homly</span>
      </Link>

      <header className="text-center max-w-2xl mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, fair pricing.</h1>
        <p className="text-gray-500 text-lg">Choose the plan that fits your household's rhythm.</p>
      </header>

      {/* Toggle */}
      <div className="flex items-center gap-4 mb-16">
        <span className={cn("text-sm font-medium transition-colors", !isAnnual ? "text-[#1A1A1A]" : "text-gray-400")}>Monthly</span>
        <button 
          onClick={() => setIsAnnual(!isAnnual)}
          className="w-12 h-6 bg-gray-100 rounded-full relative p-1 transition-all"
        >
          <div className={cn(
            "w-4 h-4 bg-white shadow-sm rounded-full transition-transform",
            isAnnual ? "translate-x-6" : "translate-x-0"
          )} />
        </button>
        <span className={cn("text-sm font-medium transition-colors", isAnnual ? "text-[#1A1A1A]" : "text-gray-400")}>
          Annually <Badge className="ml-2 bg-[#4F6EF7]/10 text-[#4F6EF7] border-none text-[10px]">Save 35%</Badge>
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={cn(
              "relative p-8 rounded-[32px] border transition-all",
              plan.popular 
                ? "border-[#4F6EF7] shadow-[0_32px_64px_-16px_rgba(79,110,247,0.15)] ring-1 ring-[#4F6EF7]" 
                : "border-gray-100 shadow-sm"
            )}
          >
            {plan.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#4F6EF7] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                Most popular
              </div>
            )}
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-sm text-gray-400 mb-6">{plan.description}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">€{plan.price}</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              {plan.price > 0 && isAnnual && (
                <p className="text-xs text-[#4F6EF7] mt-1 font-medium">Billed annually (€39/year)</p>
              )}
            </div>

            <Button asChild className={cn(
              "w-full rounded-xl py-6 mb-8",
              plan.popular ? "bg-[#4F6EF7] hover:bg-[#4F6EF7]/90 text-white" : "bg-white border border-gray-200 text-[#1A1A1A] hover:bg-gray-50"
            )}>
              <Link href={plan.href}>{plan.cta}</Link>
            </Button>

            <ul className="space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-gray-600">
                  <div className="mt-1 p-0.5 bg-gray-100 rounded-full">
                    <Check className="w-3 h-3 text-gray-600" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-16 text-gray-400 text-sm">No credit card required for free plan. Cancel anytime.</p>
    </div>
  )
}
