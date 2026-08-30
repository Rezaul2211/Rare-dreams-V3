import { create } from 'zustand';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SubcategoryState {
  subcategoriesByCategory: Record<string, string[]>;
  loading: boolean;
  fetchSubcategories: () => void;
  addSubcategory: (category: string, subcategory: string) => Promise<void>;
  removeSubcategory: (category: string, subcategory: string) => Promise<void>;
  setSubcategoriesForCategory: (category: string, list: string[]) => Promise<void>;
  getSubcategories: (category: string) => string[];
}

const STORAGE_KEY = 'rare_dreams_dynamic_subcategories';

const getInitialSubcategories = (): Record<string, string[]> => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn("Could not read cached subcategories", e);
  }
  return {
    Men: [],
    Women: [],
    Kids: [],
    Footwear: [],
  };
};

export const useSubcategoryStore = create<SubcategoryState>((set, get) => ({
  subcategoriesByCategory: getInitialSubcategories(),
  loading: false,

  fetchSubcategories: () => {
    try {
      const docRef = doc(db, 'settings', 'subcategories');
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Record<string, string[]>;
          set({ subcategoriesByCategory: data, loading: false });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch (e) {}
        } else {
          set({ loading: false });
        }
      }, (err) => {
        console.warn("Firestore subcategories listener error:", err);
        set({ loading: false });
      });
    } catch (err) {
      console.warn("Error setting subcategories listener:", err);
      set({ loading: false });
    }
  },

  addSubcategory: async (category: string, subcategory: string) => {
    const cleanSub = subcategory.trim();
    if (!cleanSub) return;
    const catKey = category.trim();
    const currentMap = { ...get().subcategoriesByCategory };
    const currentList = currentMap[catKey] || [];

    if (!currentList.includes(cleanSub)) {
      const updatedList = [...currentList, cleanSub];
      currentMap[catKey] = updatedList;
      set({ subcategoriesByCategory: currentMap });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentMap));
      } catch (e) {}
      try {
        const docRef = doc(db, 'settings', 'subcategories');
        await setDoc(docRef, currentMap, { merge: true });
      } catch (e) {
        console.error("Failed to persist subcategory to Firestore:", e);
      }
    }
  },

  removeSubcategory: async (category: string, subcategory: string) => {
    const catKey = category.trim();
    const currentMap = { ...get().subcategoriesByCategory };
    const currentList = currentMap[catKey] || [];
    const updatedList = currentList.filter(s => s !== subcategory);
    currentMap[catKey] = updatedList;
    set({ subcategoriesByCategory: currentMap });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentMap));
    } catch (e) {}
    try {
      const docRef = doc(db, 'settings', 'subcategories');
      await setDoc(docRef, currentMap, { merge: true });
    } catch (e) {
      console.error("Failed to remove subcategory from Firestore:", e);
    }
  },

  setSubcategoriesForCategory: async (category: string, list: string[]) => {
    const catKey = category.trim();
    const currentMap = { ...get().subcategoriesByCategory, [catKey]: list };
    set({ subcategoriesByCategory: currentMap });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentMap));
    } catch (e) {}
    try {
      const docRef = doc(db, 'settings', 'subcategories');
      await setDoc(docRef, currentMap, { merge: true });
    } catch (e) {
      console.error("Failed to update subcategories in Firestore:", e);
    }
  },

  getSubcategories: (category: string) => {
    const catKey = category.trim();
    return get().subcategoriesByCategory[catKey] || [];
  }
}));
