import { AppNavigation } from '@/components/layout/sidebar'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Generic loading shell for authenticated routes — used by each route's
 * loading.tsx while its page module streams in / hydrates. Keeps the
 * sidebar/bottom-nav visible immediately instead of a blank screen.
 */
export function RouteLoading() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="mt-16 md:mt-0 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </main>
    </div>
  )
}
