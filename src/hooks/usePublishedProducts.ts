import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';

export const STARTER_CATALOG_PRODUCTS: Product[] = [
  // Men's collection
  {
    id: 'men-suit-1',
    name: 'Classic Suit Jacket',
    category: 'Men',
    subcategory: 'Clothing',
    price: 4900,
    comparePrice: 6790,
    discount: 28,
    stockQuantity: 25,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=600&auto=format&fit=crop'],
    description: 'Tailored luxury suit jacket crafted with refined fabric.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['M', 'L', 'XL', 'XXL'],
    colorOptions: ['Black', 'Navy', 'Charcoal']
  },
  {
    id: 'men-shoes-2',
    name: 'Oxford Shoes',
    category: 'Men',
    subcategory: 'Shoes',
    price: 1360,
    comparePrice: 1560,
    discount: 14,
    stockQuantity: 30,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?q=80&w=600&auto=format&fit=crop'],
    description: 'Classic genuine leather handcrafted Oxford shoes.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['40', '41', '42', '43', '44'],
    colorOptions: ['Brown', 'Black', 'Tan']
  },
  {
    id: 'men-denim-3',
    name: 'Premium Denim Jacket',
    category: 'Men',
    subcategory: 'Clothing',
    price: 2240,
    comparePrice: 2800,
    discount: 20,
    stockQuantity: 20,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1516257984-b1b4d707412e?q=80&w=600&auto=format&fit=crop'],
    description: 'Timeless vintage wash premium denim jacket.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['S', 'M', 'L', 'XL'],
    colorOptions: ['Blue Denim', 'Dark Wash']
  },
  {
    id: 'men-watch-4',
    name: 'Luxury Watch',
    category: 'Men',
    subcategory: 'Watches',
    price: 3650,
    comparePrice: 4450,
    discount: 18,
    stockQuantity: 15,
    rating: 4.9,
    images: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=600&auto=format&fit=crop'],
    description: 'Precision chronograph timepiece with stainless steel band.',
    createdAt: new Date(),
    status: 'published',
    colorOptions: ['Silver', 'Gold', 'Black']
  },
  {
    id: 'men-polo-5',
    name: 'Slim-Fit Cotton Polo',
    category: 'Men',
    subcategory: 'Clothing',
    price: 1150,
    comparePrice: 1450,
    discount: 20,
    stockQuantity: 22,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=600&auto=format&fit=crop'],
    description: 'Breathable pique knit slim-fit polo with ribbed collar.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['M', 'L', 'XL'],
    colorOptions: ['Navy', 'White', 'Black']
  },
  {
    id: 'men-sunglasses-6',
    name: 'Aviator Dark Shades',
    category: 'Men',
    subcategory: 'Accessories',
    price: 950,
    comparePrice: 1200,
    discount: 21,
    stockQuantity: 28,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=600&auto=format&fit=crop'],
    description: 'UV400 polarized classic gunmetal aviator sunglasses.',
    createdAt: new Date(),
    status: 'published',
    colorOptions: ['Gunmetal', 'Black', 'Gold']
  },
  // Women's collection
  {
    id: 'women-bag-1',
    name: 'Elegant Shoulder Bag',
    category: 'Women',
    subcategory: 'Bags',
    price: 1490,
    comparePrice: 2190,
    discount: 32,
    stockQuantity: 20,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=600&auto=format&fit=crop'],
    description: 'Luxurious designer shoulder bag with golden hardware chain.',
    createdAt: new Date(),
    status: 'published',
    colorOptions: ['Beige', 'Black', 'Tan']
  },
  {
    id: 'women-dress-2',
    name: 'Premium Maxi Dress',
    category: 'Women',
    subcategory: 'Dresses',
    price: 1890,
    comparePrice: 2250,
    discount: 16,
    stockQuantity: 18,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=600&auto=format&fit=crop'],
    description: 'Flowing silky evening maxi dress for special occasions.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['S', 'M', 'L', 'XL'],
    colorOptions: ['Emerald Green', 'Wine Red', 'Midnight Blue']
  },
  {
    id: 'women-floral-3',
    name: 'Floral Summer Dress',
    category: 'Women',
    subcategory: 'Dresses',
    price: 1650,
    comparePrice: 2200,
    discount: 25,
    stockQuantity: 24,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=600&auto=format&fit=crop'],
    description: 'Lightweight breathable cotton floral printed daytime dress.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['S', 'M', 'L'],
    colorOptions: ['Floral White', 'Pastel Pink']
  },
  {
    id: 'women-pinkbag-4',
    name: 'Chic Pink Handbag',
    category: 'Women',
    subcategory: 'Bags',
    price: 1280,
    comparePrice: 1600,
    discount: 20,
    stockQuantity: 16,
    rating: 4.9,
    images: ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=600&auto=format&fit=crop'],
    description: 'Chic structured pastel pink crossbody leather handbag.',
    createdAt: new Date(),
    status: 'published',
    colorOptions: ['Blush Pink', 'Cream', 'Lilac']
  },
  {
    id: 'women-heels-5',
    name: 'Velvet Stiletto Heels',
    category: 'Women',
    subcategory: 'Shoes',
    price: 2100,
    comparePrice: 2600,
    discount: 19,
    stockQuantity: 15,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=600&auto=format&fit=crop'],
    description: 'Classic pointed-toe stiletto heels crafted with premium velvet.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['36', '37', '38', '39', '40'],
    colorOptions: ['Black Velvet', 'Burgundy', 'Nude']
  },
  // Kids collection
  {
    id: 'kids-shirt-1',
    name: 'Boys Casual Shirt',
    category: 'Kids',
    subcategory: 'Boys',
    price: 890,
    comparePrice: 1120,
    discount: 20,
    stockQuantity: 30,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1503945438517-f65904a52ce6?q=80&w=600&auto=format&fit=crop'],
    description: 'Soft 100% cotton casual button-up shirt for boys.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['2Y', '4Y', '6Y', '8Y'],
    colorOptions: ['Navy', 'Sky Blue', 'White']
  },
  {
    id: 'kids-dress-2',
    name: 'Girls Party Dress',
    category: 'Kids',
    subcategory: 'Girls',
    price: 1250,
    comparePrice: 1470,
    discount: 15,
    stockQuantity: 25,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1621452773781-0f992fd1f5cb?q=80&w=600&auto=format&fit=crop'],
    description: 'Sparkling tulle party frock with soft satin waistband.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['2Y', '4Y', '6Y', '8Y'],
    colorOptions: ['Rose Pink', 'Lavender', 'Cream']
  },
  {
    id: 'kids-sneakers-3',
    name: 'Kids Sneakers',
    category: 'Kids',
    subcategory: 'Footwear',
    price: 990,
    comparePrice: 1200,
    discount: 18,
    stockQuantity: 35,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=600&auto=format&fit=crop'],
    description: 'Lightweight cushioned athletic sneakers with easy velcro strap.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['28', '30', '32', '34'],
    colorOptions: ['White/Blue', 'Black/Red']
  },
  // Footwear & Accessories
  {
    id: 'footwear-leather-1',
    name: 'Handcrafted Leather Loafers',
    category: 'Footwear',
    subcategory: 'Shoes',
    price: 2450,
    comparePrice: 3200,
    discount: 23,
    stockQuantity: 20,
    rating: 4.9,
    images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=600&auto=format&fit=crop'],
    description: 'Classic genuine Italian leather slip-on loafers.',
    createdAt: new Date(),
    status: 'published',
    sizeOptions: ['40', '41', '42', '43', '44'],
    colorOptions: ['Tan Brown', 'Dark Brown', 'Black']
  },
  {
    id: 'acc-sunglasses-3',
    name: 'Polarized Aviator Sunglasses',
    category: 'Accessories',
    subcategory: 'Sunglasses',
    price: 890,
    comparePrice: 1190,
    discount: 25,
    stockQuantity: 40,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=600&auto=format&fit=crop'],
    description: 'Polarized UV400 classic aviator sunglasses.',
    createdAt: new Date(),
    status: 'published',
    colorOptions: ['Gunmetal', 'Gold']
  }
];

interface UsePublishedProductsReturn {
  products: Product[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'rare_dreams_published_products_v4';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes fresh cache TTL
const FETCH_TIMEOUT_MS = 5000; // 5 seconds maximum network wait time

// Shared in-memory state & subscriber bus
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
    // ignore
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

// Helper to get a single product from memory/local/starter catalog instantly
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
  const foundStarter = STARTER_CATALOG_PRODUCTS.find(p => p.id === id);
  if (foundStarter) return foundStarter;
  return null;
}

// Core network fetch with timeout race
async function executeFirestoreFetch(): Promise<Product[]> {
  const startTime = performance.now();

  const queryPromise = (async () => {
    // Fetch from products collection
    const snapshot = await getDocs(collection(db, 'products'));
    
    if (snapshot.empty) {
      return STARTER_CATALOG_PRODUCTS;
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
      .filter(p => (p.status as any) !== 'draft' && (p.status as any) !== 'archived');

    // If Firestore has custom products, return them (or merge if fewer than 4)
    if (list.length > 0) {
      return list;
    }
    return STARTER_CATALOG_PRODUCTS;
  })();

  const timeoutPromise = new Promise<Product[]>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Firestore query timed out after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);
  });

  try {
    const results = await Promise.race([queryPromise, timeoutPromise]);
    const duration = Math.round(performance.now() - startTime);

    inMemoryProducts = results;
    lastFetchTimestamp = Date.now();
    saveToLocalStorage(results);
    notifyListeners(results);
    return results;
  } catch (error) {
    // On slow network or timeout, safely fall back to existing cache or starter catalog
    if (inMemoryProducts && inMemoryProducts.length > 0) {
      return inMemoryProducts;
    }
    const local = loadFromLocalStorage();
    if (local && local.length > 0) {
      inMemoryProducts = local;
      return local;
    }
    inMemoryProducts = STARTER_CATALOG_PRODUCTS;
    return STARTER_CATALOG_PRODUCTS;
  }
}

// Public cached fetcher that coalesces simultaneous requests
export async function fetchPublishedProducts(force = false): Promise<Product[]> {
  const now = Date.now();
  
  if (!force && inMemoryProducts && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return inMemoryProducts;
  }

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
  // Always initialize with memory, localStorage, or STARTER catalog for instant 0ms first render!
  const [products, setProducts] = useState<Product[]>(() => {
    if (inMemoryProducts && inMemoryProducts.length > 0) {
      return inMemoryProducts;
    }
    const local = loadFromLocalStorage();
    if (local && local.length > 0) {
      inMemoryProducts = local;
      return local;
    }
    inMemoryProducts = STARTER_CATALOG_PRODUCTS;
    return STARTER_CATALOG_PRODUCTS;
  });

  // Since we always have starter/cached products, loading is false so UI renders instantly!
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleUpdate = (updatedProducts: Product[]) => {
      setProducts(updatedProducts);
      setError(null);
    };

    listeners.add(handleUpdate);

    const now = Date.now();
    const isStale = !lastFetchTimestamp || (now - lastFetchTimestamp >= CACHE_TTL_MS);

    if (isStale) {
      fetchPublishedProducts()
        .then((fetched) => {
          setProducts(fetched);
          setError(null);
        })
        .catch((err) => {
          // Non-blocking background sync warning
        });
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const fetched = await fetchPublishedProducts(true);
      setProducts(fetched);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  return {
    products,
    loading,
    error,
    refetch,
  };
}
