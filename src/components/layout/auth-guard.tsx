"use client"

// ── Route protection for the authenticated app shell ────────────────────
//
// Every page under src/app/<route>/page.tsx (per CLAUDE.md's "Patron de
// Page") wraps its return in <AuthGuard>. Without this, navigating
// straight to a protected URL while logged out used to render the full
// page shell (nav chrome + empty widgets, since every Firestore query is
// already `user ? ... : null`-guarded rather than actually redirecting)
// instead of sending the visitor to /login — confusing, and not what
// "protected page" should mean even though Firestore security rules
// already block the underlying reads/writes either way.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/firebase'
import { Loader2 } from 'lucide-react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    // replace (not push) — a signed-out visitor shouldn't be able to hit
    // "back" from /login and land in the shell they were just bounced from.
    if (!isUserLoading && !user) router.replace('/login')
  }, [isUserLoading, user, router])

  // Covers both the initial auth check and the moment between deciding to
  // redirect and the navigation actually landing — never render the
  // protected shell for a visitor we know (or don't yet know) isn't signed in.
  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
