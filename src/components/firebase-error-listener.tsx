'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

/**
 * Ce composant écoute les erreurs de permission Firestore et les relance
 * pour qu'elles soient capturées par l'overlay d'erreur de Next.js en développement.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handler = (error: Error) => {
      setTimeout(() => {
        throw error;
      }, 0);
    };

    errorEmitter.on('permission-error', handler);

    return () => {
      errorEmitter.off('permission-error', handler);
    };
  }, []);

  return null;
}
