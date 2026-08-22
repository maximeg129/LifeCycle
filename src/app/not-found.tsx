import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Compass, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Compass className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-bold">Page introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou plus. Vérifiez l&apos;adresse ou revenez à l&apos;accueil.
        </p>
      </div>
      <Button asChild className="gap-2 rounded-full">
        <Link href="/"><Home className="w-4 h-4" /> Retour à l&apos;accueil</Link>
      </Button>
    </div>
  )
}
