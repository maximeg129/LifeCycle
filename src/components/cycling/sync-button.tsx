"use client"

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIntervalsSync } from '@/hooks/use-intervals'

interface Props {
  variant?: 'outline' | 'default' | 'ghost'
  size?: 'sm' | 'default'
  className?: string
}

/**
 * The one "Sync" action for the whole app — same button, same behaviour,
 * wherever it's rendered (cycling dashboard, Matériel tab, Vie & Santé…).
 * Refreshes every Intervals.icu read (athlete/activities/wellness/fitness)
 * AND pushes km deltas into bikes/components/chains, via the shared
 * IntervalsProvider — never a partial sync.
 */
export function SyncButton({ variant = 'outline', size = 'sm', className }: Props) {
  const { syncAll, isSyncing, isConfigured } = useIntervalsSync()

  if (!isConfigured) return null

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
      onClick={syncAll}
      disabled={isSyncing}
    >
      <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
      {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
    </Button>
  )
}
