import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';

interface UsePublishedProductsReturn {
  products: Product[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// In-memory module cache to prevent repeated re-fetching when switching between pages
let cachedProducts: Product[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export function usePublishedProducts(categoryFilter?: string): UsePublishedProductsReturn {
  const [products, setProducts] = useState<Product[]>(() => cachedProducts || []);
  const [loading, setLoading] = useState<boolean>(() => !cachedProducts);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedProducts && (now - lastFetchTime < CACHE_TTL_MS)) {
      setProducts(cachedProducts);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'products'),
        where('status', '==', 'published')
      );
      const querySnapshot = await getDocs(q);
      const fetched: Product[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        } as Product;
      });

      cachedProducts = fetched;
      lastFetchTime = Date.now();
      setProducts(fetched);
    } catch (err: any) {
      console.warn('Failed to fetch published products from Firestore:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      if (!cachedProducts) {
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchProducts().then(() => {
      if (!isMounted) return;
    });

    return () => {
      isMounted = false;
    };
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    refetch: () => fetchProducts(true),
  };
}
