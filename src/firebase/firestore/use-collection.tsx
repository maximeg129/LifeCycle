'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, DocumentData, Query } from 'firebase/firestore';
import { useFirestore } from '../provider';

export function useCollection(path: string | Query | null) {
  const db = useFirestore();
  const [data, setData] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path || !db) {
      setLoading(false);
      return;
    }

    const collectionRef = typeof path === 'string' ? collection(db, path) : path;
    const unsubscribe = onSnapshot(
      collectionRef,
      (snapshot) => {
        setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching collection:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [path, db]);

  return { data, loading, error };
}
