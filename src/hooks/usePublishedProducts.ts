import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';

interface UsePublishedProductsReturn {
  products: Product[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'rare_dreams_published_products_v3';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh cache TTL
const FETCH_TIMEOUT_MS = 6000; // 6 seconds maximum network wait time

// Shared in-memory state & subscriber bus to ensure all components share a single source of truth
let inMemoryProducts: Product[] | null = null;
let lastFetchTimestamp = 0;
let isFetchingInProgress = false;
let pendingFetchPromise: Promise<Product[]> | null = null;
const listeners = new Set<(products: Product[]) => void>();

function notifyListeners(products: Product[]) {
  listeners.forEach(fn => fn(products));
}

// Load cached products from localStorage safely
function loadFromLocalStorage(): Product[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p: any) => ({
        ...p,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      }));
    }
  } catch (err) {
    console.warn('[RareDreams Products] Error reading localStorage cache:', err);
  }
  return null;
}

// Save products to localStorage safely
function saveToLocalStorage(products: Product[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
  } catch (err) {
    // Ignore storage quota errors
  }
}

// Helper to get a single product from cache instantly
export function getCachedProductById(id: string): Product | null {
  if (inMemoryProducts) {
    const found = inMemoryProducts.find(p => p.id === id);
    if (found) return found;
  }
  const fromLocal = loadFromLocalStorage();
  if (fromLocal) {
    const found = fromLocal.find(p => p.id === id);
    if (found) return found;
  }
  return null;
}

// Core network fetch with timeout race
async function executeFirestoreFetch(): Promise<Product[]> {
  const startTime = performance.now();
  console.log('[RareDreams Products] Initiating Firestore product query...');

  const queryPromise = (async () => {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'published')
    );
    const snapshot = await getDocs(q);
    const list: Product[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
      } as Product;
    });
    return list;
  })();

  const timeoutPromise = new Promise<Product[]>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`[RareDreams Products] Firestore query timed out after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);
  });

  try {
    const results = await Promise.race([queryPromise, timeoutPromise]);
    const duration = Math.round(performance.now() - startTime);
    console.log(`[RareDreams Products] Successfully loaded ${results.length} published products in ${duration}ms`);

    inMemoryProducts = results;
    lastFetchTimestamp = Date.now();
    saveToLocalStorage(results);
    notifyListeners(results);
    return results;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.warn(`[RareDreams Products] Network fetch warning (${duration}ms):`, error);
    
    // If we have cached products, return them instead of failing
    if (inMemoryProducts && inMemoryProducts.length > 0) {
      return inMemoryProducts;
    }
    const local = loadFromLocalStorage();
    if (local && local.length > 0) {
      inMemoryProducts = local;
      return local;
    }
    throw error;
  }
}

// Public cached fetcher that coalesces simultaneous requests
export async function fetchPublishedProducts(force = false): Promise<Product[]> {
  const now = Date.now();
  
  // Return memory cache if fresh and not forced
  if (!force && inMemoryProducts && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return inMemoryProducts;
  }

  // Reuse existing promise if already in flight
  if (isFetchingInProgress && pendingFetchPromise) {
    return pendingFetchPromise;
  }

  isFetchingInProgress = true;
  pendingFetchPromise = executeFirestoreFetch()
    .finally(() => {
      isFetchingInProgress = false;
      pendingFetchPromise = null;
    });

  return pendingFetchPromise;
}

export function usePublishedProducts(): UsePublishedProductsReturn {
  // Initialize with inMemory or localStorage cache for instant 0ms render
  const [products, setProducts] = useState<Product[]>(() => {
    if (inMemoryProducts && inMemoryProducts.length > 0) {
      return inMemoryProducts;
    }
    const local = loadFromLocalStorage();
    if (local && local.length > 0) {
      inMemoryProducts = local;
      return local;
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    // If we already have products (from memory or localStorage), no initial blocking load!
    return !(inMemoryProducts && inMemoryProducts.length > 0);
  });

  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Subscribe to updates from other fetches or background sync
    const handleUpdate = (updatedProducts: Product[]) => {
      setProducts(updatedProducts);
      setLoading(false);
      setError(null);
    };

    listeners.add(handleUpdate);

    // If cache is stale or missing, trigger fetch/revalidation
    const now = Date.now();
    const isStale = !inMemoryProducts || (now - lastFetchTimestamp >= CACHE_TTL_MS);

    if (isStale) {
      if (!inMemoryProducts || inMemoryProducts.length === 0) {
        setLoading(true);
      }
      fetchPublishedProducts()
        .then((fetched) => {
          setProducts(fetched);
          setError(null);
        })
        .catch((err) => {
          console.warn('[RareDreams Products] Hook revalidation error:', err);
          if (products.length === 0) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchPublishedProducts(true);
      setProducts(fetched);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    products,
    loading,
    error,
    refetch,
  };
}
