import { create } from 'zustand';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StoreConfig } from '../types';
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '../lib/safeStorage';

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  logoUrl: '',
  facebookUrl: 'https://facebook.com/raredreamsbd',
  instagramUrl: 'https://instagram.com/raredreamsbd',
  whatsappNumber: '+8801712345678',
  youtubeUrl: 'https://youtube.com/@raredreamsbd',
  tiktokUrl: 'https://tiktok.com/@raredreamsbd',
  helplineNumber: '+880 1712-345678',
  supportEmail: 'support@raredreams.com.bd',
  tradeLicenseNo: 'TRAD/DNCC/012984/2026',
  tinNo: '849201948123',
  dbidNo: 'DBID-2026-884129',
  address: 'Level 4, Block B, Jamuna Future Park, Dhaka, Bangladesh',
  bkashNumber: '01712345678',
  nagadNumber: '01812345678',
  rocketNumber: '01912345678',
  steadfastApiKey: '',
  steadfastSecretKey: '',
  steadfastBaseUrl: 'https://portal.steadfast.com.bd/api/v1',
  steadfastEnabled: true,
  metaTitle: 'Rare Dreams | Exclusive Luxury Kids & Family Fashion Bangladesh',
  metaDescription: 'Shop premium, designer kids wear, boys panjabi, girls lehenga, baby essentials & footwear at Rare Dreams Bangladesh. 100% genuine fabrics, fast cash on delivery nationwide.',
  metaKeywords: 'Rare Dreams, kids apparel, boys panjabi, girls lehenga, baby clothes Bangladesh, footwear Dhaka, luxury kids fashion, online shopping BD, cash on delivery',
  googleSiteVerification: '',
  canonicalDomain: 'https://raredreams.com.bd',
  ogImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop',
  facebookPixelId: '1502286171625978',
  facebookPageId: '',
  googleAnalyticsId: '',
};

interface StoreConfigState {
  config: StoreConfig;
  loading: boolean;
  fetchConfig: () => void;
  updateConfig: (newConfig: Partial<StoreConfig>) => Promise<void>;
}

const STORAGE_KEY = 'rare_dreams_cached_store_config';

const getInitialConfig = (): StoreConfig => {
  try {
    const cached = safeLocalStorageGetItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...DEFAULT_STORE_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn("Could not read cached store config from storage", e);
  }
  return DEFAULT_STORE_CONFIG;
};

export const useStoreConfigStore = create<StoreConfigState>((set, get) => ({
  config: getInitialConfig(),
  loading: false,

  fetchConfig: () => {
    try {
      const docRef = doc(db, 'settings', 'storeConfig');
      // Set real-time listener so any update by Admin reflects instantly for all users
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<StoreConfig>;
          const merged = { ...DEFAULT_STORE_CONFIG, ...data };
          set({
            config: merged,
            loading: false,
          });
          safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(merged));
        } else {
          set({ config: DEFAULT_STORE_CONFIG, loading: false });
        }
      }, (error) => {
        if (error?.message?.includes('Quota') || (error as any)?.code === 'resource-exhausted') {
          console.warn("Firestore quota limit reached for storeConfig, fallback to cached settings.");
        } else {
          console.warn("Firestore storeConfig listener warning:", error);
        }
        set({ loading: false });
      });
    } catch (err) {
      console.error("Error setting storeConfig listener:", err);
      set({ loading: false });
    }
  },

  updateConfig: async (newConfig: Partial<StoreConfig>) => {
    const updated = { ...get().config, ...newConfig };
    set({ config: updated });
    safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(updated));
    try {
      const docRef = doc(db, 'settings', 'storeConfig');
      await setDoc(docRef, updated, { merge: true });
    } catch (error) {
      console.error("Error saving storeConfig to Firestore:", error);
      throw error;
    }
  },
}));
