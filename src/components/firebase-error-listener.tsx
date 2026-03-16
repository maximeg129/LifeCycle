'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

/**
 * Ce composant écoute les erreurs de permission Firestore et les relance
 * pour qu'elles soient capturées par l'overlay d'erreur de Next.js en développement.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const unsubscribe = errorEmitter.on('permission-error', (error) => {
      // On jette l'erreur de manière asynchrone pour qu'elle remonte au top-level
      // sans bloquer le thread React actuel.
      setTimeout(() => {
        throw error;
      }, 0);
    });

    return () => unsubscribe();
  }, []);

  return null;
}
