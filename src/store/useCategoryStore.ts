import { create } from 'zustand';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { safeLocalStorageGetItem, safeLocalStorageSetItem, safeLocalStorageRemoveItem } from '../lib/safeStorage';

export interface CategoryItem {
  id?: string;
  title: string;
  link: string;
  image?: string;
  description?: string;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: 'men',
    title: "Men",
    link: "/category/Men",
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'women',
    title: "Women",
    link: "/category/Women",
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'kids',
    title: 'Kids',
    link: '/category/Kids',
    image: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'footwear',
    title: 'Footwear',
    link: '/category/Footwear',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=800&auto=format&fit=crop'
  }
];

export function normalizeCategoryTitle(title: string): string {
  const lower = title.toLowerCase().trim();
  if (lower.includes('women')) return 'Women';
  if (lower.includes('men')) return 'Men';
  if (lower.includes('baby') || lower.includes('kid')) return 'Kids';
  if (lower.includes('foot') || lower.includes('shoe') || lower.includes('access')) return 'Footwear';
  return title;
}

export function sortCategoriesByStandardOrder(list: CategoryItem[]): CategoryItem[] {
  const getOrderIndex = (title: string) => {
    const norm = normalizeCategoryTitle(title);
    if (norm === 'Men') return 0;
    if (norm === 'Women') return 1;
    if (norm === 'Kids') return 2;
    if (norm === 'Footwear') return 3;
    return 4;
  };

  return [...list]
    .map(item => ({ ...item, title: normalizeCategoryTitle(item.title) }))
    .sort((a, b) => getOrderIndex(a.title) - getOrderIndex(b.title));
}

interface CategoryState {
  categories: CategoryItem[];
  loading: boolean;
  fetchCategories: () => void;
  saveCategories: (categories: CategoryItem[]) => Promise<void>;
  addCategory: (category: Omit<CategoryItem, 'id'>) => Promise<void>;
  updateCategory: (index: number, category: Partial<CategoryItem>) => Promise<void>;
  deleteCategory: (index: number) => Promise<void>;
  setCategoriesFromHomepage: (categories: CategoryItem[]) => void;
}

export const useCategoryStore = create<CategoryState>((set, get) => {
  const getInitialCategories = () => {
    try {
      const cached = safeLocalStorageGetItem('rare_dreams_categories');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sortCategoriesByStandardOrder(parsed);
        }
      }
    } catch {}
    return sortCategoriesByStandardOrder(DEFAULT_CATEGORIES);
  };

  return {
    categories: getInitialCategories(),
    loading: false,
    fetchCategories: () => {
      try {
        const docRef = doc(db, 'settings', 'categories');
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.list && Array.isArray(data.list) && data.list.length > 0) {
              const sorted = sortCategoriesByStandardOrder(data.list);
              set({ categories: sorted, loading: false });
              safeLocalStorageSetItem('rare_dreams_categories', JSON.stringify(sorted));
            } else {
              // Remote list empty, keep existing categories if we have any
              const current = get().categories;
              if (!current || current.length === 0) {
                set({ categories: sortCategoriesByStandardOrder(DEFAULT_CATEGORIES), loading: false });
              } else {
                set({ loading: false });
              }
            }
          } else {
            // If remote doesn't exist, keep current categories
            const current = get().categories;
            if (!current || current.length === 0) {
              set({ categories: sortCategoriesByStandardOrder(DEFAULT_CATEGORIES), loading: false });
            } else {
              set({ loading: false });
            }
          }
        }, (error) => {
          if (error?.message?.includes('Quota') || (error as any)?.code === 'resource-exhausted') {
            console.warn("Firestore quota limit reached for categories, fallback to cached categories.");
          } else {
            console.warn("Firestore categories listener warning:", error);
          }
          set({ loading: false });
        });
      } catch (err) {
        console.error("Error setting categories listener:", err);
        set({ loading: false });
      }
    },
    setCategoriesFromHomepage: (cats: CategoryItem[]) => {
      if (Array.isArray(cats) && cats.length > 0) {
        const sorted = sortCategoriesByStandardOrder(cats);
        set({ categories: sorted, loading: false });
        safeLocalStorageSetItem('rare_dreams_categories', JSON.stringify(sorted));
      }
    },
    saveCategories: async (newCategories: CategoryItem[]) => {
      const sorted = sortCategoriesByStandardOrder(newCategories);
      set({ categories: sorted });
      safeLocalStorageSetItem('rare_dreams_categories', JSON.stringify(sorted));
      try {
        const docRef = doc(db, 'settings', 'categories');
        await setDoc(docRef, { list: sorted }, { merge: true });
      } catch (error) {
        console.error("Error saving categories to Firestore:", error);
        throw error;
      }
    },
    addCategory: async (newCat: Omit<CategoryItem, 'id'>) => {
      const current = get().categories;
      const catItem: CategoryItem = {
        id: crypto.randomUUID(),
        title: newCat.title,
        link: newCat.link || `/category/\${encodeURIComponent(newCat.title)}`,
        image: newCat.image || 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
        description: newCat.description || ''
      };
      const updated = [...current, catItem];
      await get().saveCategories(updated);
    },
    updateCategory: async (index: number, updatedFields: Partial<CategoryItem>) => {
      const current = [...get().categories];
      if (index >= 0 && index < current.length) {
        current[index] = { ...current[index], ...updatedFields };
        if (updatedFields.title && !updatedFields.link) {
          current[index].link = `/category/\${updatedFields.title}`;
        }
        await get().saveCategories(current);
      }
    },
    deleteCategory: async (index: number) => {
      const current = [...get().categories];
      if (index >= 0 && index < current.length) {
        current.splice(index, 1);
        await get().saveCategories(current);
      }
    }
  };
});
