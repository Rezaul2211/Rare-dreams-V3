import { StateStorage } from 'zustand/middleware';

// Low-priority ephemeral cache keys that can be purged if localStorage quota is exceeded
const PURGEABLE_CACHE_KEYS = [
  'rare_dreams_products_cache_v3',
  'rare_dreams_products_cache_v2',
  'rare_dreams_products_cache_v1',
  'rare_dreams_recently_viewed',
  'rare_dreams_voted_reviews',
  'rare_dreams_guest_price_alerts'
];

// In-memory fallback if localStorage is completely blocked or full
const memoryStore = new Map<string, string>();

/**
 * Clears non-essential caches from localStorage to reclaim space for critical operations (e.g. cart/checkout).
 */
export function clearNonEssentialStorage(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  let cleared = false;
  for (const key of PURGEABLE_CACHE_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleared = true;
      }
    } catch {
      // ignore
    }
  }
  return cleared;
}

/**
 * Safely sets an item in localStorage with quota recovery and fallback to sessionStorage/memoryStore.
 */
export function safeLocalStorageSetItem(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    memoryStore.set(key, value);
    return;
  }

  try {
    localStorage.setItem(key, value);
    memoryStore.set(key, value);
  } catch (err) {
    console.warn(`[safeStorage] localStorage quota exceeded for key "${key}". Attempting cache purge...`);

    // 1. Purge non-essential caches
    const purged = clearNonEssentialStorage();
    if (purged) {
      try {
        localStorage.setItem(key, value);
        memoryStore.set(key, value);
        return;
      } catch (retryErr) {
        console.warn(`[safeStorage] Retry after cache purge failed for key "${key}":`, retryErr);
      }
    }

    // 2. Try sessionStorage fallback
    try {
      if (window.sessionStorage) {
        sessionStorage.setItem(key, value);
        memoryStore.set(key, value);
        return;
      }
    } catch {
      // ignore
    }

    // 3. Fallback to in-memory store
    memoryStore.set(key, value);
  }
}

/**
 * Safely gets an item from localStorage, sessionStorage, or in-memory fallback.
 */
export function safeLocalStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return memoryStore.get(key) ?? null;
  }

  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
  } catch {
    // ignore
  }

  try {
    if (window.sessionStorage) {
      const sessionVal = sessionStorage.getItem(key);
      if (sessionVal !== null) return sessionVal;
    }
  } catch {
    // ignore
  }

  return memoryStore.get(key) ?? null;
}

/**
 * Safely removes an item from storage.
 */
export function safeLocalStorageRemoveItem(key: string): void {
  memoryStore.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/**
 * Custom Zustand StateStorage that guarantees zero crashes on quota exceeded.
 */
export const safeZustandStorage: StateStorage = {
  getItem: (name: string): string | null => {
    return safeLocalStorageGetItem(name);
  },
  setItem: (name: string, value: string): void => {
    safeLocalStorageSetItem(name, value);
  },
  removeItem: (name: string): void => {
    safeLocalStorageRemoveItem(name);
  },
};

/**
 * Sanitizes a CartItem to only retain essential fields and prevent massive base64 arrays from consuming quota.
 */
export function sanitizeCartItem(item: any): any {
  if (!item) return item;

  // Prefer selectedColorImage, image, or the first image in array
  let primaryImage = item.selectedColorImage || item.image || (Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '') || '';

  // If primary image is an excessively large base64 string (> 150KB), we keep it but avoid storing redundant array duplicates
  return {
    id: String(item.id || ''),
    cartItemId: String(item.cartItemId || item.id || `cart-${Date.now()}`),
    name: String(item.name || ''),
    price: Number(item.price || 0),
    originalPrice: item.originalPrice !== undefined ? Number(item.originalPrice) : undefined,
    image: primaryImage,
    images: primaryImage ? [primaryImage] : [],
    selectedColorImage: item.selectedColorImage || primaryImage,
    selectedSize: item.selectedSize || undefined,
    selectedColor: item.selectedColor || undefined,
    quantity: Math.max(1, Number(item.quantity || 1)),
    stock: item.stock !== undefined ? Number(item.stock) : undefined,
    category: item.category ? String(item.category) : undefined,
    sku: item.sku ? String(item.sku) : undefined,
    brand: item.brand ? String(item.brand) : undefined,
    freeDelivery: !!item.freeDelivery
  };
}
