import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem } from '../types';
import { safeZustandStorage, sanitizeCartItem } from '../lib/safeStorage';

interface CartState {
  items: CartItem[];
  directCheckoutItem: CartItem | null;
  addItem: (item: CartItem) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  setDirectCheckoutItem: (item: CartItem | null) => void;
  getCheckoutItems: () => CartItem[];
  getCheckoutSubtotal: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      directCheckoutItem: null,
      addItem: (item) => set((state) => {
        const cleanItem = sanitizeCartItem(item);
        const existingItemIndex = state.items.findIndex(
          (i) => i.id === cleanItem.id && i.selectedSize === cleanItem.selectedSize && i.selectedColor === cleanItem.selectedColor
        );
        if (existingItemIndex >= 0) {
          const newItems = [...state.items];
          newItems[existingItemIndex].quantity += cleanItem.quantity;
          return { items: newItems };
        }
        return { items: [...state.items, cleanItem] };
      }),
      removeItem: (cartItemId) => set((state) => {
        if (state.directCheckoutItem && state.directCheckoutItem.cartItemId === cartItemId) {
          return { directCheckoutItem: null, items: state.items.filter((i) => i.cartItemId !== cartItemId) };
        }
        return { items: state.items.filter((i) => i.cartItemId !== cartItemId) };
      }),
      updateQuantity: (cartItemId, quantity) => set((state) => {
        const nextQty = Math.max(1, quantity);
        if (state.directCheckoutItem && state.directCheckoutItem.cartItemId === cartItemId) {
          return {
            directCheckoutItem: { ...state.directCheckoutItem, quantity: nextQty },
            items: state.items.map((i) => 
              i.cartItemId === cartItemId ? { ...i, quantity: nextQty } : i
            )
          };
        }
        return {
          items: state.items.map((i) => 
            i.cartItemId === cartItemId ? { ...i, quantity: nextQty } : i
          )
        };
      }),
      clearCart: () => set({ items: [], directCheckoutItem: null }),
      setDirectCheckoutItem: (item) => set({ 
        directCheckoutItem: item ? sanitizeCartItem(item) : null 
      }),
      getCheckoutItems: () => {
        const state = get();
        if (state.directCheckoutItem) {
          return [state.directCheckoutItem];
        }
        return state.items;
      },
      getCheckoutSubtotal: () => {
        const checkoutItems = get().getCheckoutItems();
        return checkoutItems.reduce((total, item) => total + (item.price * item.quantity), 0);
      },
      getSubtotal: () => {
        const state = get();
        return state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
      }
    }),
    {
      name: 'rare-dreams-cart',
      storage: createJSONStorage(() => safeZustandStorage),
      partialize: (state) => ({
        items: state.items.map(sanitizeCartItem),
        directCheckoutItem: state.directCheckoutItem ? sanitizeCartItem(state.directCheckoutItem) : null,
      }),
    }
  )
);
