import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, ShoppingBag, Check, Star } from 'lucide-react';
import { Product } from '../types';
import { LazyImage } from './LazyImage';
import { useFlyToCart } from '../context/FlyToCartContext';
import { useWishlistStore } from '../store/useWishlistStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { trackAddToCart } from '../lib/pixel';
import { calculateDiscount, formatPrice, getProductRatingInfo } from '../utils/productUtils';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, index = 0 }) => {
  const { animateAddToCart } = useFlyToCart();
  const { isWishlisted, toggleWishlist } = useWishlistStore();
  const { t } = useLanguageStore();
  const [added, setAdded] = React.useState(false);

  const favorited = isWishlisted(product.id);
  const discountPct = calculateDiscount(product);
  const { rating: displayRating, count: reviewCount } = getProductRatingInfo(product);

  const handleWishlistClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleCartClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stockQuantity === 0) return;

    trackAddToCart({
      content_name: product.name,
      content_ids: [product.id],
      value: product.price,
    });

    animateAddToCart(product, e);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      className="group flex flex-col bg-transparent rounded-2xl transition-all duration-300 relative select-none w-full"
    >
      {/* 1. Image Container with Soft Studio Backdrop & Smoky White Mist Fade */}
      <div className="relative aspect-[3/4] xs:aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#F3F3F6] shadow-2xs group-hover:shadow-md transition-all duration-300">
        <Link to={`/product/${product.id}`} className="block w-full h-full relative">
          {product.images && product.images.length > 0 ? (
            <>
              <LazyImage
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover object-top mix-blend-multiply group-hover:scale-104 transition-transform duration-500 ease-out"
                containerClassName="w-full h-full"
              />
              {/* Soft Smoky White Mist / Fog Gradient at bottom of image (Like in Reference Image) */}
              <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-white via-white/80 via-white/35 to-transparent pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-medium">
              No Image
            </div>
          )}
        </Link>

        {/* 2. Micro Capsule Badge at Bottom-Left over the Mist */}
        <div className="absolute bottom-2.5 left-2.5 z-10 pointer-events-none">
          {discountPct && discountPct > 0 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-neutral-900 text-[9.5px] sm:text-[10.5px] font-bold shadow-xs border border-white/80 tracking-tight">
              -{discountPct}%
            </span>
          ) : (product.isNew || product.daily_drop) ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-neutral-900 text-[9.5px] sm:text-[10.5px] font-semibold shadow-xs border border-white/80 tracking-tight">
              New in
            </span>
          ) : (product.rating && product.rating >= 4.7) ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-neutral-900 text-[9.5px] sm:text-[10.5px] font-semibold shadow-xs border border-white/80 tracking-tight">
              Best Seller
            </span>
          ) : null}
        </div>

        {/* 3. Top-Right Floating Circular Wishlist Heart */}
        <button 
          type="button"
          onClick={handleWishlistClick}
          aria-label={favorited ? "Remove from Wishlist" : "Add to Wishlist"}
          className={`absolute top-2.5 right-2.5 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
            favorited 
              ? 'bg-white text-red-500 shadow-sm scale-105' 
              : 'bg-white/90 hover:bg-white text-neutral-800 hover:text-red-500 shadow-xs active:scale-90 backdrop-blur-xs'
          }`}
        >
          <Heart 
            size={15} 
            strokeWidth={favorited ? 0 : 1.75} 
            className={`transition-colors ${favorited ? "text-red-500 fill-red-500" : "text-neutral-800"}`} 
          />
        </button>
      </div>

      {/* 4. Product Meta & Details (Clean Luxury Aesthetic matching reference) */}
      <div className="pt-2 sm:pt-2.5 pb-0.5 px-0.5 flex flex-col">
        <Link to={`/product/${product.id}`} className="block group/title">
          <h3 className="text-xs sm:text-[13.5px] font-normal text-neutral-800 group-hover/title:text-black line-clamp-1 transition-colors leading-snug">
            {product.name}
          </h3>
        </Link>

        {/* Price Row */}
        <div className="flex items-baseline gap-1.5 mt-0.5 min-w-0">
          <span className="font-bold text-xs sm:text-[14px] text-neutral-950 leading-none">
            {formatPrice(product.price)}
          </span>
          {product.comparePrice && product.comparePrice > product.price ? (
            <span className="text-[10px] sm:text-xs text-neutral-400 line-through leading-none">
              {formatPrice(product.comparePrice)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});



