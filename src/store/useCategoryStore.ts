import { create } from 'zustand';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
    id: 'accessories',
    title: 'Accessories',
    link: '/category/Accessories',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=800&auto=format&fit=crop'
  }
];

export function normalizeCategoryTitle(title: string): string {
  const lower = title.toLowerCase().trim();
  if (lower.includes('women')) return 'Women';
  if (lower.includes('men')) return 'Men';
  if (lower.includes('baby') || lower.includes('kid')) return 'Kids';
  if (lower.includes('access') || lower.includes('foot') || lower.includes('shoe')) return 'Accessories';
  return title;
}

export function sortCategoriesByStandardOrder(list: CategoryItem[]): CategoryItem[] {
  const getOrderIndex = (title: string) => {
    const norm = normalizeCategoryTitle(title);
    if (norm === 'Men') return 0;
    if (norm === 'Women') return 1;
    if (norm === 'Kids') return 2;
    if (norm === 'Accessories') return 3;
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
}

export const useCategoryStore = create<CategoryState>((set, get) => {
  const getInitialCategories = () => {
    try {
      const cached = localStorage.getItem('rare_dreams_categories');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return sortCategoriesByStandardOrder(DEFAULT_CATEGORIES);
  };

  return {
    categories: getInitialCategories(),
    loading: true,
    fetchCategories: () => {
      try {
        const docRef = doc(db, 'settings', 'categories');
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.list && Array.isArray(data.list) && data.list.length > 0) {
              const sorted = sortCategoriesByStandardOrder(data.list);
              set({ categories: sorted, loading: false });
              localStorage.setItem('rare_dreams_categories', JSON.stringify(sorted));
            } else {
              set({ categories: sortCategoriesByStandardOrder(DEFAULT_CATEGORIES), loading: false });
              localStorage.removeItem('rare_dreams_categories');
            }
          } else {
            set({ categories: sortCategoriesByStandardOrder(DEFAULT_CATEGORIES), loading: false });
            localStorage.removeItem('rare_dreams_categories');
          }
        }, (error) => {
          console.error("Firestore categories listener error:", error);
          set({ loading: false });
        });
      } catch (err) {
        console.error("Error setting categories listener:", err);
        set({ loading: false });
      }
    },
    saveCategories: async (newCategories: CategoryItem[]) => {
      set({ categories: newCategories });
      localStorage.setItem('rare_dreams_categories', JSON.stringify(newCategories));
      try {
        const docRef = doc(db, 'settings', 'categories');
        await setDoc(docRef, { list: newCategories }, { merge: true });
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
