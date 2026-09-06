import { create } from 'zustand';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StoreConfig } from '../types';
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '../lib/safeStorage';

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  logoUrl: '/brand_logos/rare_dreams_horizontal_transparent.png',
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
const LOGO_KEY = 'rare_dreams_custom_logo';

const getInitialConfig = (): StoreConfig => {
  let baseConfig = { ...DEFAULT_STORE_CONFIG };
  try {
    const cached = safeLocalStorageGetItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      baseConfig = { ...baseConfig, ...parsed };
    }
  } catch (e) {
    console.warn("Could not read cached store config from storage", e);
  }

  // Check dedicated fast logo storage
  try {
    const customLogo = safeLocalStorageGetItem(LOGO_KEY);
    if (customLogo && customLogo.trim().length > 0) {
      baseConfig.logoUrl = customLogo.trim();
    }
  } catch (e) {}

  return baseConfig;
};

export const useStoreConfigStore = create<StoreConfigState>((set, get) => ({
  config: getInitialConfig(),
  loading: false,

  fetchConfig: () => {
    // 1. Sync with zero-quota server storage first (always works, fast, reliable)
    try {
      fetch('/api/site-settings')
        .then((res) => res.json())
        .then((data) => {
          if (data?.success) {
            const currentConfig = get().config;
            const serverLogo = data.logoUrl;
            const serverSettings = data.settings;

            const merged = { ...currentConfig, ...(serverSettings || {}) };

            if (serverLogo && serverLogo.trim().length > 0) {
              merged.logoUrl = serverLogo.trim();
              safeLocalStorageSetItem(LOGO_KEY, serverLogo.trim());
            } else if (currentConfig.logoUrl && currentConfig.logoUrl.trim().length > 0) {
              // Automatically backup client's existing logo to server disk so it's never lost!
              fetch('/api/site-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: currentConfig, logoUrl: currentConfig.logoUrl.trim() }),
              }).catch(() => {});
            }

            set({ config: merged, loading: false });
            safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(merged));
          }
        })
        .catch((e) => {
          console.warn("[StoreConfig] Server settings check note:", e);
        });
    } catch {}

    // 2. Firestore real-time listener with quota exhaustion resilience
    try {
      const docRef = doc(db, 'settings', 'storeConfig');
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<StoreConfig>;
          const currentConfig = get().config;
          const merged = { ...DEFAULT_STORE_CONFIG, ...currentConfig, ...data };

          // If current has a custom logo but remote doc is empty/null, preserve the custom logo
          if (!merged.logoUrl && currentConfig.logoUrl) {
            merged.logoUrl = currentConfig.logoUrl;
          }

          if (merged.logoUrl) {
            safeLocalStorageSetItem(LOGO_KEY, merged.logoUrl);
          }

          set({
            config: merged,
            loading: false,
          });
          safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(merged));
        } else {
          const current = get().config;
          set({ config: current, loading: false });
        }
      }, (error) => {
        if (error?.message?.includes('Quota') || (error as any)?.code === 'resource-exhausted') {
          console.warn("Firestore quota limit reached for storeConfig, fallback to server/cached settings.");
        } else {
          console.warn("Firestore storeConfig listener warning:", error);
        }
        set({ loading: false });
      });
    } catch (err) {
      console.warn("Error setting storeConfig listener:", err);
      set({ loading: false });
    }
  },

  updateConfig: async (newConfig: Partial<StoreConfig>) => {
    const current = get().config;
    const updated = { ...current, ...newConfig };
    
    if (newConfig.logoUrl !== undefined) {
      if (newConfig.logoUrl && newConfig.logoUrl.trim().length > 0) {
        safeLocalStorageSetItem(LOGO_KEY, newConfig.logoUrl.trim());
      } else {
        try {
          localStorage.removeItem(LOGO_KEY);
        } catch {}
      }
    }

    set({ config: updated });
    safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(updated));

    // 1. Always save to persistent server disk (immune to Firestore quota limits)
    try {
      const serverRes = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updated, logoUrl: updated.logoUrl }),
      });
      const serverData = await serverRes.json();
      if (serverData?.logoUrl && serverData.logoUrl !== updated.logoUrl) {
        // If server optimized base64 into a static file URL /uploads/custom_logo.png
        const withStaticUrl = { ...updated, logoUrl: serverData.logoUrl };
        set({ config: withStaticUrl });
        safeLocalStorageSetItem(LOGO_KEY, serverData.logoUrl);
        safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(withStaticUrl));
      }
    } catch (serverErr) {
      console.warn("[StoreConfig] Could not save to server disk:", serverErr);
    }

    // 2. Also save to Firestore (if quota allows)
    try {
      const docRef = doc(db, 'settings', 'storeConfig');
      await setDoc(docRef, updated, { merge: true });
    } catch (error: any) {
      if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
        console.warn("Firestore quota exceeded while saving storeConfig; saved locally & on server disk.");
      } else {
        console.error("Error saving storeConfig to Firestore:", error);
      }
    }
  },
}));
