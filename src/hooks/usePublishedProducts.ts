import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '../lib/safeStorage';

// Zero virtual products: Empty starter catalog strictly ensures ONLY user-uploaded products are used
export const STARTER_CATALOG_PRODUCTS: Product[] = [];

// Strict filter function that eliminates all dummy / virtual sample products
export function isRealUploadedProduct(p: any): boolean {
  if (!p || !p.id) return false;
  const id = String(p.id).trim();
  const lowerId = id.toLowerCase();
  
  // Reject all predefined dummy prefixes
  if (
    lowerId.startsWith('men-') ||
    lowerId.startsWith('women-') ||
    lowerId.startsWith('kids-') ||
    lowerId.startsWith('footwear-') ||
    lowerId.startsWith('acc-') ||
    lowerId.startsWith('loved-') ||
    lowerId.startsWith('seller-') ||
    lowerId.startsWith('daily-') ||
    lowerId.startsWith('all-')
  ) {
    return false;
  }
  return true;
}

interface UsePublishedProductsReturn {
  products: Product[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'rare_dreams_real_products_v5';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh cache TTL
const FETCH_TIMEOUT_MS = 6000; // 6 seconds maximum network wait time

// Shared in-memory state & subscriber bus
let inMemoryProducts: Product[] | null = null;
let lastFetchTimestamp = 0;
let isFetchingInProgress = false;
let pendingFetchPromise: Promise<Product[]> | null = null;
const listeners = new Set<(products: Product[]) => void>();

function notifyListeners(products: Product[]) {
  listeners.forEach(fn => fn(products));
}

// Load cached products from localStorage safely (strictly real products only)
function loadFromLocalStorage(): Product[] | null {
  try {
    const raw = safeLocalStorageGetItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = parsed
        .filter(isRealUploadedProduct)
        .map((p: any) => ({
          ...p,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        }));
      return sanitized.length > 0 ? sanitized : null;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

// Save products to localStorage safely
function saveToLocalStorage(products: Product[]) {
  try {
    const realProducts = products.filter(isRealUploadedProduct);
    const leanProducts = realProducts.slice(0, 50).map(p => {
      const sanitizedImages = (p.images || []).map(img => {
        if (typeof img === 'string' && img.startsWith('data:') && img.length > 50000) {
          return '';
        }
        return img;
      }).filter(Boolean);

      return {
        ...p,
        images: sanitizedImages.length > 0 ? sanitizedImages : (p.image ? [p.image] : []),
        description: typeof p.description === 'string' && p.description.length > 500 
          ? p.description.substring(0, 500) 
          : p.description
      };
    });

    safeLocalStorageSetItem(LOCAL_STORAGE_KEY, JSON.stringify(leanProducts));
  } catch (err) {
    // Ignore storage quota errors
  }
}

// Helper to get a single product from memory or local cache
export function getCachedProductById(id: string): Product | null {
  if (inMemoryProducts) {
    const found = inMemoryProducts.find(p => p.id === id);
    if (found && isRealUploadedProduct(found)) return found;
  }
  const fromLocal = loadFromLocalStorage();
  if (fromLocal) {
    const found = fromLocal.find(p => p.id === id);
    if (found && isRealUploadedProduct(found)) return found;
  }
  return null;
}

// Core network fetch: Queries server disk & Firestore for authentic uploaded products
async function executeFetch(): Promise<Product[]> {
  const startTime = performance.now();

  // 1. Primary Zero-Quota Server API Fetch (Ultra-fast local disk cache)
  try {
    const srvRes = await fetch('/api/products');
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (Array.isArray(srvData?.products) && srvData.products.length > 0) {
        const srvList: Product[] = srvData.products
          .filter(isRealUploadedProduct)
          .map((p: any) => ({
            ...p,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          }))
          .filter((p: any) => p.status !== 'draft' && p.status !== 'archived');

        if (srvList.length > 0) {
          inMemoryProducts = srvList;
          lastFetchTimestamp = Date.now();
          saveToLocalStorage(srvList);
          notifyListeners(srvList);
          return srvList;
        }
      }
    }
  } catch (srvErr) {
    console.warn("Server products API notice:", srvErr);
  }

  // 2. Secondary Firestore Collection Fetch
  const queryPromise = (async () => {
    const snapshot = await getDocs(collection(db, 'products'));
    if (snapshot.empty) {
      return [];
    }

    const list: Product[] = snapshot.docs
      .map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        } as Product;
      })
      .filter(isRealUploadedProduct)
      .filter(p => (p.status as any) !== 'draft' && (p.status as any) !== 'archived');

    return list;
  })();

  const timeoutPromise = new Promise<Product[]>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Firestore query timed out after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);
  });

  try {
    const results = await Promise.race([queryPromise, timeoutPromise]);
    const cleanResults = results.filter(isRealUploadedProduct);

    if (cleanResults.length > 0) {
      inMemoryProducts = cleanResults;
      lastFetchTimestamp = Date.now();
      saveToLocalStorage(cleanResults);
      notifyListeners(cleanResults);
      return cleanResults;
    }

    // If Firestore returned 0 products, return inMemory or local cache if exists
    if (inMemoryProducts && inMemoryProducts.length > 0) {
      return inMemoryProducts;
    }
    const local = loadFromLocalStorage();
    if (local && local.length > 0) {
      inMemoryProducts = local;
      return local;
    }
    return [];
  } catch (error) {
    if (inMemoryProducts && inMemoryProducts.length > 0) {
      return inMemoryProducts;
    }
    const local = loadFromLocalStorage();
    if (local && local.length > 0) {
      inMemoryProducts = local;
      return local;
    }
    return [];
  }
}

// Public cached fetcher that coalesces simultaneous requests
export async function fetchPublishedProducts(force = false): Promise<Product[]> {
  const now = Date.now();
  
  if (!force && inMemoryProducts && inMemoryProducts.length > 0 && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return inMemoryProducts;
  }

  if (isFetchingInProgress && pendingFetchPromise) {
    return pendingFetchPromise;
  }

  isFetchingInProgress = true;
  pendingFetchPromise = executeFetch()
    .finally(() => {
      isFetchingInProgress = false;
      pendingFetchPromise = null;
    });

  return pendingFetchPromise;
}

export function usePublishedProducts(): UsePublishedProductsReturn {
  const [products, setProducts] = useState<Product[]>(() => {
    if (inMemoryProducts && inMemoryProducts.length > 0) {
      return inMemoryProducts.filter(isRealUploadedProduct);
    }
    const local = loadFromLocalStorage();
    if (local && local.length > 0) {
      const clean = local.filter(isRealUploadedProduct);
      inMemoryProducts = clean;
      return clean;
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => products.length === 0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleUpdate = (updatedProducts: Product[]) => {
      const clean = updatedProducts.filter(isRealUploadedProduct);
      setProducts(clean);
      setLoading(false);
      setError(null);
    };

    listeners.add(handleUpdate);

    const now = Date.now();
    const isStale = !lastFetchTimestamp || (now - lastFetchTimestamp >= CACHE_TTL_MS) || products.length === 0;

    if (isStale) {
      if (products.length === 0) setLoading(true);
      fetchPublishedProducts()
        .then((fetched) => {
          const clean = fetched.filter(isRealUploadedProduct);
          setProducts(clean);
          setLoading(false);
          setError(null);
        })
        .catch((err) => {
          setLoading(false);
          setError(err instanceof Error ? err : new Error(String(err)));
        });
    } else {
      setLoading(false);
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
      const clean = fetched.filter(isRealUploadedProduct);
      setProducts(clean);
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
