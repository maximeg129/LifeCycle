// Pure logic for the account-deletion danger zone: the confirm-word gate
// guarding an irreversible action, and the Firebase Auth error-code ->
// user-facing message mapping. Kept separate from danger-zone-card.tsx so
// this safety-critical logic is unit-testable without React/Firebase glue
// (see CLAUDE.md convention: pure functions extracted + tested, React glue
// left untested).

export const DELETE_CONFIRM_WORD = 'SUPPRIMER'

/** Whether the user has typed the exact confirmation word required to enable account deletion. */
export function isDeleteConfirmed(confirmText: string): boolean {
  return confirmText === DELETE_CONFIRM_WORD
}

export interface DeleteAccountErrorMessage {
  title: string
  description: string
}

/**
 * Maps a Firebase Auth error code (from a failed deleteUser() call) to a
 * user-facing toast message. `auth/requires-recent-login` is the one case
 * worth a specific message — Firebase requires a fresh sign-in before
 * allowing account deletion, so the generic "failed, try again" message
 * would be misleading (retrying without re-authenticating fails the same way).
 */
export function getDeleteAccountErrorMessage(code: string | undefined): DeleteAccountErrorMessage {
  if (code === 'auth/requires-recent-login') {
    return {
      title: 'Reconnexion requise',
      description: 'Par sécurité, déconnectez-vous puis reconnectez-vous avant de supprimer votre compte.',
    }
  }
  return {
    title: 'Erreur',
    description: "La suppression a échoué. Réessayez.",
  }
}
