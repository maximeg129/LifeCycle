"use client"

// ── Shared CRUD-dialog submit boilerplate ────────────────────────────
//
// Every "add X" / "edit X" dialog in the app (19 of them — see AUDIT.md/
// PLAN.md section 2.2) repeats the exact same wrapper around its actual
// Firestore write: setIsSaving(true) → try the write → on failure, emit
// the errorEmitter permission-error pattern documented in CLAUDE.md →
// setIsSaving(false) in finally. Only the write itself (and what to
// report as the failing path/operation) ever differs — this hook is
// that fixed wrapper, so a dialog can't forget the errorEmitter step
// (which has quietly happened before — see command-palette/firestore.rules
// fixes earlier this project) and doesn't have to hand-roll the same
// try/catch/finally every time.
//
// Deliberately NOT responsible for: what the write does, what fields it
// touches, or the success toast — those vary too much (a single setDoc,
// several writes to different collections, derived fields not present
// in the form) to generalize without forcing an awkward shape onto the
// simpler cases. See `submit`'s single `action` callback below.

import { useState, useCallback } from 'react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export interface CrudErrorContext {
  path: string
  operation: 'create' | 'update' | 'delete'
  requestResourceData?: Record<string, unknown>
}

export function useCrudSubmit() {
  const [isSaving, setIsSaving] = useState(false)

  /**
   * Runs `action`, wrapped in the standard isSaving/error-reporting
   * lifecycle. Returns true on success, false if `action` threw (the
   * permission-error dialog has already been triggered by then) — the
   * caller decides what "success" means next (close the dialog, toast,
   * reset form fields, etc.), since that part is genuinely per-dialog.
   */
  const submit = useCallback(async (action: () => Promise<void>, errorContext: CrudErrorContext): Promise<boolean> => {
    setIsSaving(true)
    try {
      await action()
      return true
    } catch {
      errorEmitter.emit('permission-error', new FirestorePermissionError(errorContext))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { isSaving, submit }
}
