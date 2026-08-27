"use client"

// Shared between the Entraînement and PMC tabs — both need the same
// "connect Intervals.icu first" banner, and PMC is now a separately
// code-split chunk (see pmc-tab.tsx), so this couldn't stay a private
// helper inside cycling/page.tsx without duplicating it.

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Settings } from 'lucide-react'
import Link from 'next/link'

export function NotConfiguredBanner() {
  return (
    <Card className="bg-card/40 border-border border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 rounded-full bg-primary/10 mb-4">
          <AlertTriangle className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Intervals.icu non connecté</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Configurez votre ID Athlète et clé API dans les réglages pour synchroniser vos données de performance.
        </p>
        <Link href="/settings">
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" /> Configurer Intervals.icu
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
