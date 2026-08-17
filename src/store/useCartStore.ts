import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from '../types';

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
        const existingItemIndex = state.items.findIndex(
          (i) => i.id === item.id && i.selectedSize === item.selectedSize && i.selectedColor === item.selectedColor
        );
        if (existingItemIndex >= 0) {
          const newItems = [...state.items];
          newItems[existingItemIndex].quantity += item.quantity;
          return { items: newItems };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (cartItemId) => set((state) => ({
        items: state.items.filter((i) => i.cartItemId !== cartItemId)
      })),
      updateQuantity: (cartItemId, quantity) => set((state) => ({
        items: state.items.map((i) => 
          i.cartItemId === cartItemId ? { ...i, quantity: Math.max(1, quantity) } : i
        )
      })),
      clearCart: () => set({ items: [], directCheckoutItem: null }),
      setDirectCheckoutItem: (item) => set({ directCheckoutItem: item }),
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
    }
  )
);
