import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import { Product } from '../types';
import { LazyImage } from './LazyImage';
import { useWishlistStore } from '../store/useWishlistStore';
import { useLanguageStore, translateCategory } from '../store/useLanguageStore';
import { calculateDiscount, formatPrice } from '../utils/productUtils';

interface CompactProductCardProps {
  product: Product;
}

export const CompactProductCard: React.FC<CompactProductCardProps> = React.memo(({ product }) => {
  const { isWishlisted, toggleWishlist } = useWishlistStore();
  const { language, t } = useLanguageStore();

  const favorited = isWishlisted(product.id);
  const discountPct = calculateDiscount(product);

  const handleWishlistClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  return (
    <div className="w-[95px] min-[400px]:w-[105px] sm:w-[125px] md:w-[145px] lg:w-[165px] xl:w-[185px] shrink-0 flex flex-col bg-white rounded-xl shadow-2xs hover:shadow-md transition-all duration-300 border border-neutral-200/80 overflow-hidden relative group">
      {/* Image Thumbnail Link - reduced height */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          {product.images && product.images.length > 0 ? (
            <LazyImage
              src={product.images[0]}
              alt={product.name}
              className="group-hover:scale-105 transition-transform duration-500"
              containerClassName="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-[8px] font-medium">
              No Image
            </div>
          )}
        </Link>

        {/* Discount Badge with Liquid Glass */}
        {product.stockQuantity === 0 ? (
          <div className="absolute top-1 left-1 z-10 bg-neutral-900/80 backdrop-blur-md text-white text-[7px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-xs border border-white/20">
            {t('product.out_of_stock')}
          </div>
        ) : discountPct && discountPct > 0 ? (
          <div className="absolute top-1 left-1 z-10 bg-white/10 backdrop-blur-md text-neutral-950 text-[7.5px] sm:text-[8.5px] font-black px-1.5 py-0.5 rounded-md shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-white/20 tracking-tight">
            -{discountPct}%
          </div>
        ) : product.isFlashSale ? (
          <div className="absolute top-1 left-1 z-10 bg-white/10 backdrop-blur-md text-neutral-950 text-[7.5px] sm:text-[8.5px] font-black px-1.5 py-0.5 rounded-md shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-white/20">
            ⚡ Sale
          </div>
        ) : null}

        {/* Heart Wishlist Overlay Button with Liquid Glass */}
        <button 
          type="button"
          onClick={handleWishlistClick}
          aria-label={favorited ? "Remove from Wishlist" : "Add to Wishlist"}
          className={`absolute top-1 right-1 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            favorited 
              ? 'bg-white/80 backdrop-blur-md text-red-500 shadow-xs scale-105 border border-white/40' 
              : 'bg-white/10 hover:bg-white/20 backdrop-blur-md text-neutral-800 hover:text-red-500 shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-white/20'
          }`}
        >
          <Heart 
            size={11} 
            strokeWidth={favorited ? 0 : 2} 
            className={favorited ? "text-red-500 fill-red-500" : "text-neutral-800 hover:text-red-500"} 
          />
        </button>
      </div>

      {/* Product Details - comfortable compact height */}
      <div className="p-1.5 sm:p-2.5 flex flex-col flex-grow">
        <Link to={`/product/${product.id}`} className="block">
          <h3 className="text-[11px] sm:text-xs font-bold text-neutral-900 line-clamp-1 group-hover:text-amber-800 transition-colors leading-tight mb-0.5">
            {product.name}
          </h3>
        </Link>

        {/* Stock & Rating/Category inline */}
        <div className="flex items-center justify-between my-0.5">
          <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${product.stockQuantity && product.stockQuantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {product.stockQuantity && product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock'}
          </span>
          {product.rating && product.rating > 0 ? (
            <div className="flex items-center space-x-0.5">
              <Star size={9} className="fill-amber-400 text-amber-400 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-bold text-neutral-800">{product.rating.toFixed(1)}</span>
            </div>
          ) : product.category ? (
            <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-wider line-clamp-1">
              {translateCategory(product.category)}
            </span>
          ) : null}
        </div>

        {/* Price */}
        <div className="mt-auto flex items-baseline space-x-1 pt-1 border-t border-neutral-100">
          <span className="font-black text-[11px] sm:text-xs text-neutral-900 truncate leading-none">
            {formatPrice(product.price)}
          </span>
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="text-[9px] sm:text-[10px] text-neutral-400 line-through truncate leading-none">
              {formatPrice(product.comparePrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
