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

  // Calculate discount percentage
  let discountPct = product.discountPercentage || product.discount;
  if (!discountPct && product.comparePrice && product.comparePrice > product.price) {
    discountPct = Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100);
  }

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

  const displayRating = product.rating || (4.6 + ((product.name.length % 4) * 0.1));
  const reviewCount = (product.name.length * 7 + (product.price % 50)) || 85;

  return (
    <div
      className="group flex flex-col bg-white rounded-lg sm:rounded-xl shadow-2xs hover:shadow-sm transition-shadow duration-200 overflow-hidden border border-neutral-200/70 relative select-none w-full"
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100 transform-gpu">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          {product.images && product.images.length > 0 ? (
            <LazyImage
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              containerClassName="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-medium">
              No Image
            </div>
          )}
        </Link>

        {/* Discount Badge on Top Left */}
        {discountPct && discountPct > 0 ? (
          <div className="absolute top-1 sm:top-2 left-1 sm:left-2 z-10 bg-red-600 text-white text-[7.5px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-sm sm:rounded-md tracking-tight shadow-2xs">
            -{discountPct}%
          </div>
        ) : null}

        {/* Heart Wishlist Overlay Button on Top Right */}
        <button 
          type="button"
          onClick={handleWishlistClick}
          aria-label={favorited ? "Remove from Wishlist" : "Add to Wishlist"}
          className={`absolute top-1 sm:top-2 right-1 sm:right-2 z-20 w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            favorited 
              ? 'bg-white text-red-500 shadow-sm' 
              : 'bg-white/95 text-neutral-700 hover:text-red-500 shadow-2xs'
          }`}
        >
          <Heart 
            size={11} 
            strokeWidth={favorited ? 0 : 2} 
            className={`sm:w-3.5 sm:h-3.5 ${favorited ? "text-red-500 fill-red-500" : "text-neutral-700"}`} 
          />
        </button>
      </div>

      {/* Product Details */}
      <div className="p-1 sm:p-2.5 flex flex-col flex-grow justify-between gap-0.5">
        <div>
          <Link to={`/product/${product.id}`} className="block">
            <h3 className="text-[9px] sm:text-xs md:text-sm font-medium text-neutral-900 line-clamp-1 mb-0.5 group-hover:text-black transition-colors leading-tight">
              {product.name}
            </h3>
          </Link>

          {/* Star Rating & Count */}
          <div className="flex items-center space-x-0.5 sm:space-x-1 mb-0.5">
            <Star size={8} className="fill-amber-400 text-amber-400 sm:w-2.5 sm:h-2.5" />
            <span className="text-[8px] sm:text-[10px] font-bold text-neutral-800 leading-none">
              {displayRating.toFixed(1)}
            </span>
            <span className="text-[7.5px] sm:text-[9px] text-neutral-400 leading-none">
              ({reviewCount})
            </span>
          </div>
        </div>

        {/* Price & Black Cart Action Button */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap min-w-0 pr-1 leading-none">
            <span className="font-extrabold text-[10px] sm:text-xs md:text-sm text-neutral-900 leading-none">
              ৳ {product.price.toLocaleString('en-BD')}
            </span>
            {product.comparePrice && product.comparePrice > product.price ? (
              <span className="text-[8px] sm:text-[9.5px] md:text-[10.5px] text-neutral-400 line-through leading-none">
                ৳ {product.comparePrice.toLocaleString('en-BD')}
              </span>
            ) : null}
          </div>

          {/* Black Square Cart Button */}
          <button
            type="button"
            onClick={handleCartClick}
            disabled={product.stockQuantity === 0}
            aria-label="Add to Cart"
            className={`w-5.5 h-5.5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              added 
                ? 'bg-emerald-600 text-white scale-105' 
                : 'bg-black text-white hover:bg-neutral-800 active:scale-95'
            }`}
          >
            {added ? <Check size={11} className="sm:w-3.5 sm:h-3.5" /> : <ShoppingBag size={10} className="sm:w-3 sm:h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
});



