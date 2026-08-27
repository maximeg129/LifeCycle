"use client"

// ── Shared CRUD-dialog chrome ────────────────────────────────────────
//
// The Dialog/Header/Footer wrapper + Cancel/Submit-with-spinner pair
// that every "add X" / "edit X" dialog re-implements identically (see
// AUDIT.md/PLAN.md section 2.2, and useCrudSubmit for the matching
// submit-boilerplate half of this). Field composition and the actual
// Firestore write stay in each dialog — those are exactly the parts
// that turned out too different across dialogs to generalize safely
// (a single setDoc vs. multi-document writes with recomputed
// aggregates, computed fields absent from the form, external reference
// data driving a Select's options...). Only the chrome around them,
// which never differs, lives here.
//
// The caller always owns `open` state (one `useState` line — cheap, and
// needed anyway to close the dialog on a successful submit from JS, not
// just a click). `trigger` is optional: pass it when the dialog owns its
// own launch button (the common case); omit it when a parent renders its
// own trigger and controls `open` directly (e.g. an edit dialog opened
// from a list-item's own "Modifier" button).

import type { ReactNode, FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CrudDialogShellProps {
  title: ReactNode
  description?: ReactNode
  /** Renders as the dialog's own trigger button. Omit if a parent controls `open` instead. */
  trigger?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  isSaving: boolean
  submitLabel?: string
  /** Disables the submit button without affecting Annuler — e.g. a required external list (bikes...) is empty. */
  disableSubmit?: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  contentClassName?: string
}

export function CrudDialogShell({
  title,
  description,
  trigger,
  open,
  onOpenChange,
  isSaving,
  submitLabel = 'Enregistrer',
  disableSubmit,
  onSubmit,
  children,
  contentClassName,
}: CrudDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn('max-w-md', contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isSaving || disableSubmit}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
