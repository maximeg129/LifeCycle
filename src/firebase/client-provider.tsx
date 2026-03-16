'use client';

import React, { ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';

export const FirebaseClientProvider = ({ children }: { children: ReactNode }) => {
  const firebaseApp = useMemo(() => {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }, []);

  const firestore = useMemo(() => getFirestore(firebaseApp), [firebaseApp]);
  const auth = useMemo(() => getAuth(firebaseApp), [firebaseApp]);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
      {children}
    </FirebaseProvider>
  );
};
