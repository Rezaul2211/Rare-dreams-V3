import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Product } from '../types';
import { LazyImage } from './LazyImage';
import { useWishlistStore } from '../store/useWishlistStore';
import { calculateDiscount, formatPrice } from '../utils/productUtils';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product }) => {
  const { isWishlisted, toggleWishlist } = useWishlistStore();
  const favorited = isWishlisted(product.id);
  const discountPct = calculateDiscount(product);

  const handleWishlistClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <div className="group flex flex-col w-full select-none">
      {/* 1. Unified iOS Style Rounded Card */}
      <div className="relative w-full rounded-[22px] sm:rounded-[26px] overflow-hidden bg-[#F2F2F6] shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-black/[0.02] group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col">
        
        {/* Top Image Container with Fixed 4/5 Aspect Ratio */}
        <Link to={`/product/${product.id}`} className="block relative w-full aspect-[4/5] overflow-hidden bg-[#F2F2F6]">
          {product.images && product.images.length > 0 ? (
            <>
              <LazyImage
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover object-top mix-blend-multiply group-hover:scale-104 transition-transform duration-500 ease-out"
                containerClassName="w-full h-full"
              />
              {/* Soft Smoky White Mist / Fog Gradient melting seamlessly into card bottom */}
              <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[#F2F2F6] via-[#F2F2F6]/90 via-[#F2F2F6]/40 to-transparent pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-medium">
              No Image
            </div>
          )}

          {/* Floating Micro Capsule Badge (Over Smoky Mist at Bottom-Left of Image with Liquid Glass) */}
          {discountPct && discountPct > 0 ? (
            <div className="absolute bottom-2 left-2.5 z-10 pointer-events-none">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/45 backdrop-blur-md text-neutral-950 text-[9.5px] sm:text-[10px] font-black shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] border border-white/70 tracking-tight leading-none">
                -{discountPct}%
              </span>
            </div>
          ) : (product.isNew || product.daily_drop) ? (
            <div className="absolute bottom-2 left-2.5 z-10 pointer-events-none">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/45 backdrop-blur-md text-neutral-900 text-[9.5px] sm:text-[10px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] border border-white/70 tracking-tight leading-none">
                New in
              </span>
            </div>
          ) : (product.rating && product.rating >= 4.7) ? (
            <div className="absolute bottom-2 left-2.5 z-10 pointer-events-none">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/45 backdrop-blur-md text-neutral-900 text-[9.5px] sm:text-[10px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] border border-white/70 tracking-tight leading-none">
                Best Seller
              </span>
            </div>
          ) : null}

          {/* Top-Right Floating Circular Wishlist Heart with Liquid Glass */}
          <button 
            type="button"
            onClick={handleWishlistClick}
            aria-label={favorited ? "Remove from Wishlist" : "Add to Wishlist"}
            className={`absolute top-2.5 right-2.5 z-20 w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              favorited 
                ? 'bg-white/85 backdrop-blur-md text-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.25),inset_0_1px_2px_rgba(255,255,255,0.95)] border border-white scale-105' 
                : 'bg-white/40 hover:bg-white/70 backdrop-blur-md text-neutral-800 hover:text-red-500 shadow-[0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] border border-white/70 active:scale-90'
            }`}
          >
            <Heart 
              size={14} 
              strokeWidth={favorited ? 0 : 2} 
              className={`transition-colors ${favorited ? "text-red-500 fill-red-500" : "text-neutral-800"}`} 
            />
          </button>
        </Link>

        {/* Bottom Meta Container (Compact with zero excess empty whitespace) */}
        <div className="px-2.5 sm:px-3 pt-1.5 pb-2 sm:pb-2.5 flex flex-col justify-end min-w-0 bg-[#F2F2F6]">
          {/* Product Name (Soft Grey Text in White Mist Aesthetic, Fixed 1-Line Truncate) */}
          <Link to={`/product/${product.id}`} className="block w-full group/title">
            <h3 className="text-[12px] sm:text-[13px] font-normal text-neutral-500 group-hover/title:text-neutral-950 truncate transition-colors leading-tight">
              {product.name}
            </h3>
          </Link>

          {/* Price (Prominent Bold Dark Text, perfectly positioned) */}
          <div className="flex items-baseline gap-1.5 mt-0.5 min-w-0">
            <span className="font-bold text-[13.5px] sm:text-[15px] text-neutral-950 tracking-tight leading-tight">
              {formatPrice(product.price)}
            </span>
            {product.comparePrice && product.comparePrice > product.price ? (
              <span className="text-[10.5px] sm:text-xs text-neutral-400 line-through leading-tight">
                {formatPrice(product.comparePrice)}
              </span>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
});




