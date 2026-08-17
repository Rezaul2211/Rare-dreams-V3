import React, { createContext, useContext, useState } from 'react';
import { motion } from 'motion/react';
import { useCartStore } from '../store/useCartStore';
import { Product } from '../types';

interface FlyingItem {
  id: string;
  image: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

interface FlyToCartContextType {
  animateAddToCart: (product: Product, event: React.MouseEvent<HTMLElement> | HTMLElement, options?: { size?: string; color?: string; quantity?: number }) => void;
  isCartBouncing: boolean;
}

const FlyToCartContext = createContext<FlyToCartContextType | undefined>(undefined);

export const FlyToCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [isCartBouncing, setIsCartBouncing] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  const animateAddToCart = (
    product: Product,
    eventOrElement: React.MouseEvent<HTMLElement> | HTMLElement,
    options?: { size?: string; color?: string; quantity?: number }
  ) => {
    // 1. Add to cart store
    addItem({
      ...product,
      cartItemId: crypto.randomUUID(),
      selectedSize: options?.size || (product.sizeOptions?.[0] || ''),
      selectedColor: options?.color || (product.colorOptions?.[0] || ''),
      quantity: options?.quantity || 1,
    });

    // 2. Calculate source rect (start position from product card image)
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;

    let targetElementOrCard: HTMLElement | null = null;
    if ('currentTarget' in eventOrElement && eventOrElement.currentTarget) {
      targetElementOrCard = eventOrElement.currentTarget as HTMLElement;
    } else if (eventOrElement instanceof HTMLElement) {
      targetElementOrCard = eventOrElement;
    }

    if (targetElementOrCard) {
      const cardContainer = targetElementOrCard.closest('.group') || targetElementOrCard.closest('[data-product-card]') || targetElementOrCard;
      const imgElement = cardContainer.querySelector('img');

      if (imgElement) {
        const imgRect = imgElement.getBoundingClientRect();
        startX = imgRect.left + imgRect.width / 2;
        startY = imgRect.top + imgRect.height / 2;
      } else {
        const rect = targetElementOrCard.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      }
    }

    // 3. Find target cart icon - ALWAYS target the top header cart bag icon
    let targetX = window.innerWidth - 32;
    let targetY = 28;

    const headerIcon = document.getElementById('header-cart-icon');

    if (headerIcon) {
      const targetRect = headerIcon.getBoundingClientRect();
      if (targetRect.width > 0 && targetRect.height > 0) {
        targetX = targetRect.left + targetRect.width / 2;
        targetY = Math.max(16, targetRect.top + targetRect.height / 2);
      }
    }

    const flyId = 'fly_' + Date.now() + '_' + Math.random();
    const productImage = product.images?.[0] || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=200';

    setFlyingItems((prev) => [
      ...prev,
      {
        id: flyId,
        image: productImage,
        startX,
        startY,
        targetX,
        targetY,
      },
    ]);
  };

  const handleAnimationComplete = (id: string) => {
    setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    
    // Trigger bounce effect on cart icon
    setIsCartBouncing(true);
    setTimeout(() => {
      setIsCartBouncing(false);
    }, 500);
  };

  return (
    <FlyToCartContext.Provider value={{ animateAddToCart, isCartBouncing }}>
      {children}

      {/* Floating Animated Product Image flying smoothly directly into bag icon */}
      <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
        {flyingItems.map((item) => (
          <motion.div
            key={item.id}
            initial={{
              left: item.startX,
              top: item.startY,
              x: '-50%',
              y: '-50%',
              scale: 1,
              opacity: 1,
            }}
            animate={{
              left: item.targetX,
              top: item.targetY,
              x: '-50%',
              y: '-50%',
              scale: 0.15,
              opacity: 0.2,
            }}
            transition={{
              duration: 1.05, // Slower, smooth and visible speed as requested
              ease: [0.16, 1, 0.3, 1], // Natural arc easing into the bag icon
            }}
            onAnimationComplete={() => handleAnimationComplete(item.id)}
            className="fixed w-20 h-20 rounded-2xl overflow-hidden shadow-2xl border-2 border-white bg-white shrink-0"
          >
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          </motion.div>
        ))}
      </div>
    </FlyToCartContext.Provider>
  );
};

export const useFlyToCart = () => {
  const context = useContext(FlyToCartContext);
  if (!context) {
    throw new Error('useFlyToCart must be used within a FlyToCartProvider');
  }
  return context;
};
