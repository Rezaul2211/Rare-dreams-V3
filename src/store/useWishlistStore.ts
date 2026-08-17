import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistState {
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlistIds: [],
      toggleWishlist: (productId: string) => set((state) => {
        const exists = state.wishlistIds.includes(productId);
        if (exists) {
          return { wishlistIds: state.wishlistIds.filter(id => id !== productId) };
        } else {
          return { wishlistIds: [...state.wishlistIds, productId] };
        }
      }),
      isWishlisted: (productId: string) => {
        return get().wishlistIds.includes(productId);
      }
    }),
    {
      name: 'rare-dreams-wishlist',
    }
  )
);
