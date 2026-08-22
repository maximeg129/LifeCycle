'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

/**
 * Enables IndexedDB-backed offline persistence (data survives a reload, and
 * writes queue while offline) so the app stays usable with a flaky
 * connection. initializeFirestore() throws if a Firestore instance already
 * exists for this app — which happens on HMR / React Strict Mode's double
 * render in dev — so fall back to the already-initialized instance instead.
 */
function getPersistentFirestore(app: FirebaseApp) {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}

/**
 * Initialise Firebase de manière déterministe.
 * Utilise toujours l'objet firebaseConfig explicite pour éviter les erreurs
 * d'itérables liées à une configuration automatique incomplète.
 */
export function initializeFirebase() {
  const apps = getApps();
  let app: FirebaseApp;

  if (apps.length > 0) {
    app = apps[0];
  } else {
    // Force l'utilisation de la config manuelle pour éviter authorizedDomains error
    app = initializeApp(firebaseConfig);
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getPersistentFirestore(app)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';