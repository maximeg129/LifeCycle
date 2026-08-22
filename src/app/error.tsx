"use client"

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground">
          Quelque chose s&apos;est mal passé. Vous pouvez réessayer, ou revenir à l&apos;accueil.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/60">Réf: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset} className="gap-2 rounded-full">
          <RotateCw className="w-4 h-4" /> Réessayer
        </Button>
        <Button asChild variant="outline" className="gap-2 rounded-full">
          <Link href="/"><Home className="w-4 h-4" /> Accueil</Link>
        </Button>
      </div>
    </div>
  )
}
