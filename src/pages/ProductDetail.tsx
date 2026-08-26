import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { Product } from '../types';
import { useCartStore } from '../store/useCartStore';
import { useFlyToCart } from '../context/FlyToCartContext';
import { useWishlistStore } from '../store/useWishlistStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { trackViewContent, trackAddToCart } from '../lib/pixel';
import { 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  ShoppingBag, 
  Star, 
  Truck, 
  ShieldCheck, 
  Rotate3d, 
  X, 
  Ruler, 
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { ProductDetailSkeleton } from '../components/ProductDetailSkeleton';
import { ProductReviews } from '../components/ProductReviews';
import SEO from '../components/SEO';
import { calculateDiscount, formatPrice } from '../utils/productUtils';
import { usePublishedProducts } from '../hooks/usePublishedProducts';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Real Authentic Reviews Summary (No fake 128 / 4.8)
  const [reviewSummary, setReviewSummary] = useState({ avgRating: 0, totalCount: 0 });
  
  // Showcase state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [is360Mode, setIs360Mode] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(0);
  const isDragging360 = useRef(false);
  const startX360 = useRef(0);

  // Standard Size Guide Modal
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);

  const { isWishlisted, toggleWishlist } = useWishlistStore();
  const { animateAddToCart } = useFlyToCart();
  const { addItem, setDirectCheckoutItem } = useCartStore();
  const favorited = product ? isWishlisted(product.id) : false;

  const discountPct = calculateDiscount(product) || 0;
  const { products: allPublishedProducts } = usePublishedProducts();

  // Related products exclusively from real published store products
  const relatedProducts = useMemo(() => {
    if (!id || !allPublishedProducts.length) return [];
    return allPublishedProducts.filter(p => p.id !== id).slice(0, 8);
  }, [id, allPublishedProducts]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(data);
          setSelectedImageIndex(0);
          setQuantity(1);

          // Authentic rating from DB if already persisted
          if (data.rating !== undefined || data.reviewsCount !== undefined) {
            setReviewSummary({
              avgRating: data.rating || 0,
              totalCount: data.reviewsCount || 0
            });
          }

          if (data.sizeOptions && data.sizeOptions.length > 0) {
            setSelectedSize(data.sizeOptions[0]);
          } else {
            setSelectedSize('');
          }
          if (data.colorOptions && data.colorOptions.length > 0) {
            setSelectedColor(data.colorOptions[0]);
          } else {
            setSelectedColor('');
          }

          trackViewContent({
            content_name: data.name,
            content_category: data.category,
            content_ids: [data.id],
            value: data.price,
          });
        }
      } catch (error) {
        console.error("Error fetching product", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  // 360 Rotation Mouse/Touch handlers
  const handleTouchStart360 = (e: React.TouchEvent | React.MouseEvent) => {
    isDragging360.current = true;
    startX360.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };

  const handleTouchMove360 = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging360.current) return;
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = currentX - startX360.current;
    startX360.current = currentX;
    setRotationAngle((prev) => (prev + delta * 0.9) % 360);
  };

  const handleTouchEnd360 = () => {
    isDragging360.current = false;
  };

  // Extract real uploaded images only (No fake shirt variants)
  const displayImages = useMemo(() => {
    if (product?.images && product.images.length > 0) {
      return product.images;
    }
    if (product?.image) {
      return [product.image];
    }
    return [];
  }, [product]);

  const activeImage = displayImages[selectedImageIndex] || displayImages[0] || '';

  // Extract all real specifications provided by admin
  const activeSpecifications = useMemo(() => {
    if (!product) return [];
    const list: { label: string; value: string }[] = [];

    if (product.material?.trim()) {
      list.push({ label: 'ফ্যাব্রিক', value: product.material.trim() });
    }
    if (product.fit?.trim()) {
      list.push({ label: 'ফিট', value: product.fit.trim() });
    }
    if (product.sleeve?.trim()) {
      list.push({ label: 'স্লিভ', value: product.sleeve.trim() });
    }
    if (product.collar?.trim()) {
      list.push({ label: 'কলার', value: product.collar.trim() });
    }
    if (product.pocket?.trim()) {
      list.push({ label: 'পকেট', value: product.pocket.trim() });
    }
    if (product.usage?.trim()) {
      list.push({ label: 'ব্যবহার', value: product.usage.trim() });
    }
    if (product.specifications && Array.isArray(product.specifications)) {
      product.specifications.forEach(spec => {
        if (spec.label?.trim() && spec.value?.trim()) {
          list.push({ label: spec.label.trim(), value: spec.value.trim() });
        }
      });
    }

    return list;
  }, [product]);

  const handleAddToCart = (e?: React.MouseEvent<HTMLElement>) => {
    if (!product) return;
    trackAddToCart({
      content_name: product.name,
      content_ids: [product.id],
      value: product.price * quantity,
    });
    
    if (e) {
      animateAddToCart(product, e, {
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        quantity,
      });
    } else {
      addItem({
        ...product,
        cartItemId: crypto.randomUUID(),
        selectedSize: selectedSize || undefined,
        selectedColor: selectedColor || undefined,
        quantity,
      });
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    trackAddToCart({
      content_name: product.name,
      content_ids: [product.id],
      value: product.price * quantity,
    });

    const directItem = {
      ...product,
      cartItemId: `direct-${product.id}-${selectedSize || 'default'}-${selectedColor || 'default'}`,
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
      quantity,
    };

    setDirectCheckoutItem(directItem);
    navigate('/checkout');
  };

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-bold text-neutral-800 mb-4">প্রোডাক্টটি খুঁজে পাওয়া যায়নি</p>
        <button
          onClick={() => navigate('/shop')}
          className="bg-neutral-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold"
        >
          দোকানে ফিরে যান
        </button>
      </div>
    );
  }

  const sizes = product.sizeOptions && product.sizeOptions.length > 0 ? product.sizeOptions : [];
  const colors = product.colorOptions && product.colorOptions.length > 0 ? product.colorOptions : [];

  return (
    <div className="min-h-screen bg-[#F6F5FC] sm:bg-[#ECE9F8] text-neutral-900 pb-20 font-sans">
      <SEO 
        title={`${product.name} - ৳${product.price.toFixed(0)}`}
        description={product.description?.substring(0, 160) || `Buy ${product.name} online.`}
        image={activeImage}
        type="product"
        price={product.price}
        comparePrice={product.comparePrice}
        currency="BDT"
        rating={reviewSummary.avgRating || undefined}
        reviewCount={reviewSummary.totalCount || undefined}
        sku={product.id}
        category={product.category}
        inStock={true}
      />

      <div className="max-w-md sm:max-w-xl md:max-w-2xl mx-auto px-0 sm:px-4 sm:py-3">
        
        {/* ========================================================= */}
        {/* TOP 3D SHOWCASE SECTION                                   */}
        {/* ========================================================= */}
        <div className="relative w-full overflow-hidden bg-gradient-to-b from-[#EBE6FF] via-[#F4F1FE] to-white sm:rounded-t-[32px] sm:border-x sm:border-t border-purple-100/80 pt-3.5 pb-5 select-none">
          
          {/* Top Floating Buttons */}
          <div className="absolute top-3.5 left-4 right-4 z-30 flex items-center justify-between pointer-events-auto">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-neutral-100 flex items-center justify-center text-neutral-800 active:scale-90 transition-transform cursor-pointer"
            >
              <ChevronLeft size={20} strokeWidth={2.4} />
            </button>

            {/* Wishlist Button */}
            <button
              onClick={() => toggleWishlist(product.id)}
              aria-label="Wishlist"
              className="w-10 h-10 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-neutral-100 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
            >
              <Heart
                size={20}
                className={favorited ? "text-[#5B46E8] fill-[#5B46E8]" : "text-[#5B46E8]"}
                strokeWidth={2.2}
              />
            </button>
          </div>

          {/* Vertical Thumbnail Column (Left Side) - ONLY shown if 2+ real images exist */}
          {displayImages.length > 1 && (
            <div className="absolute top-16 left-3.5 z-20 flex flex-col gap-2">
              {displayImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    setIs360Mode(false);
                  }}
                  className={clsx(
                    "w-11 h-11 sm:w-13 sm:h-13 rounded-xl overflow-hidden bg-white shadow-2xs p-0.5 transition-all cursor-pointer",
                    selectedImageIndex === idx && !is360Mode
                      ? "border-2 border-[#5B46E8] ring-2 ring-purple-100 scale-105"
                      : "border border-neutral-200/90 opacity-85 hover:opacity-100"
                  )}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </button>
              ))}

              {/* 360° VIEW Button */}
              <button
                onClick={() => {
                  setIs360Mode(!is360Mode);
                  setRotationAngle(0);
                }}
                className={clsx(
                  "w-11 h-11 sm:w-13 sm:h-13 rounded-xl bg-white border flex flex-col items-center justify-center text-center shadow-2xs transition-all cursor-pointer px-0.5",
                  is360Mode
                    ? "border-2 border-[#5B46E8] bg-[#F5F3FF] text-[#5B46E8] shadow-sm"
                    : "border-neutral-200 text-neutral-700 hover:border-[#5B46E8]/40"
                )}
              >
                <Rotate3d size={16} className={is360Mode ? "text-[#5B46E8] animate-spin" : "text-neutral-700"} />
                <span className="text-[8px] font-black tracking-tighter leading-tight mt-0.5 uppercase">
                  360° VIEW
                </span>
              </button>
            </div>
          )}

          {/* 3D FLOATING PRODUCT PODIUM & STAGE */}
          <div 
            className="relative w-full h-[320px] sm:h-[380px] flex items-center justify-center px-4 touch-pan-y"
            onTouchStart={is360Mode ? handleTouchStart360 : undefined}
            onTouchMove={is360Mode ? handleTouchMove360 : undefined}
            onTouchEnd={is360Mode ? handleTouchEnd360 : undefined}
            onMouseDown={is360Mode ? handleTouchStart360 : undefined}
            onMouseMove={is360Mode ? handleTouchMove360 : undefined}
            onMouseUp={is360Mode ? handleTouchEnd360 : undefined}
          >
            {/* Ambient Studio Lighting Glow */}
            <div className="absolute w-72 h-72 rounded-full bg-radial from-purple-300/35 via-blue-200/20 to-transparent blur-2xl pointer-events-none" />

            {/* Glowing 3D Podium Base */}
            <div className="absolute bottom-4 w-[250px] sm:w-[300px] h-[64px] flex items-center justify-center pointer-events-none">
              {/* Soft Drop Shadow under podium */}
              <div className="absolute -bottom-3 w-[210px] sm:w-[250px] h-7 bg-purple-950/15 rounded-[100%] blur-md" />
              
              {/* Podium 3D Ellipse Body */}
              <div className="relative w-full h-full rounded-[100%] bg-gradient-to-b from-white via-[#F8F7FF] to-[#E2DEFA] shadow-[0_10px_24px_rgba(91,70,232,0.18)] border-2 border-white flex items-center justify-center">
                {/* Glowing Neon Cyan/Violet LED Ring around podium */}
                <div className="absolute inset-0 rounded-[100%] border-[2.5px] border-[#818CF8]/60 shadow-[0_0_15px_rgba(129,140,248,0.7)]" />
                {/* Inner Stage Platform */}
                <div className="w-[88%] h-[82%] rounded-[100%] bg-gradient-to-t from-[#ECE9FE] to-white/95 shadow-inner" />
              </div>
            </div>

            {/* Floating Product Image */}
            <motion.div
              animate={is360Mode ? {
                rotateY: rotationAngle,
              } : {
                y: [0, -6, 0],
              }}
              transition={is360Mode ? { duration: 0 } : {
                duration: 4.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative z-10 w-[240px] sm:w-[280px] h-[250px] sm:h-[290px] flex items-center justify-center"
              style={{ perspective: 1000 }}
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  className="max-w-full max-h-full object-contain filter contrast-[1.03] transition-all duration-300 drop-shadow-[0_12px_20px_rgba(30,27,75,0.18)] rounded-xl"
                />
              ) : (
                <div className="w-40 h-40 bg-purple-100 rounded-2xl flex items-center justify-center text-neutral-400 font-medium text-xs">
                  কোন ছবি নেই
                </div>
              )}
            </motion.div>

            {/* 360 Guide Overlay Tag */}
            {is360Mode && (
              <div className="absolute bottom-14 z-20 bg-black/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
                <Rotate3d size={13} />
                <span>ঘুরিয়ে দেখতে ডানে বা বামে টানুন</span>
              </div>
            )}
          </div>

          {/* Carousel Slide Dots - ONLY shown if 2+ images exist */}
          {displayImages.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {displayImages.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  onClick={() => {
                    setSelectedImageIndex(dotIdx);
                    setIs360Mode(false);
                  }}
                  className={clsx(
                    "h-1.5 rounded-full transition-all duration-200",
                    selectedImageIndex === dotIdx && !is360Mode
                      ? "w-5 bg-[#5B46E8]"
                      : "w-1.5 bg-neutral-300 hover:bg-neutral-400"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* WHITE CARD CONTENT SHEET                                  */}
        {/* ========================================================= */}
        <div className="bg-white px-4 py-5 sm:p-7 sm:rounded-b-[32px] sm:border-x sm:border-b border-neutral-100 shadow-xs space-y-4">
          
          {/* Top Discount Tag (Only if discount exists) */}
          {discountPct > 0 && (
            <div>
              <span className="inline-block bg-[#FFF0E6] text-[#FF6A1A] text-xs font-black px-3 py-0.5 rounded-full tracking-wide">
                {discountPct}% ছাড়
              </span>
            </div>
          )}

          {/* Product Title & Material Subtitle */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            {product.material && (
              <p className="text-sm font-medium text-neutral-500 mt-0.5">
                {product.material}
              </p>
            )}
          </div>

          {/* Real Ratings & Reviews (NO fake 128 / 4.8) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center text-[#F59E0B]">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  size={16} 
                  className={
                    reviewSummary.avgRating >= i + 1 
                      ? "fill-[#F59E0B] text-[#F59E0B]" 
                      : (reviewSummary.avgRating > i ? "fill-[#F59E0B]/50 text-[#F59E0B]" : "text-neutral-300")
                  } 
                />
              ))}
            </div>
            {reviewSummary.totalCount > 0 ? (
              <>
                <span className="text-sm font-black text-neutral-800">
                  {reviewSummary.avgRating.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-neutral-500">
                  ({reviewSummary.totalCount} রিভিউ)
                </span>
              </>
            ) : (
              <span className="text-xs font-semibold text-neutral-500">
                (০ রিভিউ - প্রথম রিভিউ দিন)
              </span>
            )}
          </div>

          {/* Pricing Row */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-3xl sm:text-4xl font-black text-[#4F39F6] tracking-tight">
              ৳ {formatPrice(product.price || 0)}
            </span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span className="text-base sm:text-lg text-neutral-400 line-through font-semibold">
                ৳ {formatPrice(product.comparePrice)}
              </span>
            )}
            {discountPct > 0 && (
              <span className="bg-[#FFE6EC] text-[#FF2D55] text-xs font-black px-2.5 py-0.5 rounded-full">
                {discountPct}% ছাড়
              </span>
            )}
          </div>

          {/* Product Description */}
          {product.description && (
            <p className="text-sm text-neutral-600 leading-relaxed font-normal whitespace-pre-line">
              {product.description}
            </p>
          )}

          {/* COLOR SELECTION - ONLY if real colors are available */}
          {colors.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-sm font-bold text-neutral-900">
                রং নির্বাচন করুন: <span className="text-[#5B46E8] font-semibold">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((c) => {
                  const isSelected = selectedColor === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={clsx(
                        "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                        isSelected
                          ? "border-2 border-[#5B46E8] bg-[#F5F3FF] text-[#5B46E8] shadow-2xs"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SIZE SELECTION - ONLY if real sizes are available */}
          {sizes.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-neutral-900">
                  সাইজ নির্বাচন করুন: <span className="text-[#5B46E8] font-semibold">{selectedSize}</span>
                </div>
                <button
                  onClick={() => setIsSizeGuideOpen(true)}
                  className="text-xs font-bold text-[#4F39F6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Ruler size={13} />
                  <span>সাইজ গাইড</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {sizes.map((sz) => {
                  const isSelected = selectedSize === sz;
                  return (
                    <button
                      key={sz}
                      onClick={() => setSelectedSize(sz)}
                      className={clsx(
                        "min-w-11 h-10 px-3 rounded-xl text-sm font-bold flex items-center justify-center transition-all cursor-pointer",
                        isSelected
                          ? "border-2 border-[#5B46E8] bg-[#F5F3FF] text-[#5B46E8] shadow-2xs"
                          : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                      )}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* QUANTITY & PRIMARY ACTION CTA BUTTONS */}
          <div className="space-y-2 pt-1">
            <div className="text-sm font-bold text-neutral-900">
              পরিমাণ
            </div>

            <div className="grid grid-cols-[88px_1fr_1fr] gap-2 items-center">
              {/* Stepper */}
              <div className="h-11 rounded-xl border border-neutral-200 bg-white flex items-center justify-between px-2 shrink-0">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-base font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-colors cursor-pointer"
                >
                  −
                </button>
                <span className="font-black text-sm text-neutral-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-base font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                className="h-11 rounded-xl bg-[#6B46C1] hover:bg-[#5B3CC4] active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_3px_12px_rgba(107,70,193,0.25)] transition-all cursor-pointer whitespace-nowrap px-2"
              >
                <ShoppingBag size={15} strokeWidth={2.4} className="shrink-0" />
                <span className="truncate">কার্টে যোগ করুন</span>
              </button>

              {/* Buy Now */}
              <button
                onClick={handleBuyNow}
                className="h-11 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-[0_3px_12px_rgba(225,29,72,0.25)] transition-all cursor-pointer whitespace-nowrap px-2"
              >
                <span className="truncate">এখনই কিনুন</span>
              </button>
            </div>
          </div>

          {/* VALUE PROPOSITION / TRUST CARDS */}
          <div className="grid grid-cols-3 gap-1.5 bg-[#FAF9FF] border border-purple-100/70 rounded-2xl p-3 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100/80 flex items-center justify-center shrink-0">
                <Truck size={15} className="text-[#5B46E8]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-neutral-900 leading-tight truncate">ফ্রি ডেলিভারি</div>
                <div className="text-[9.5px] font-medium text-neutral-500 truncate">৳ ৯৯৯+ অর্ডারে</div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-x border-purple-100/80 px-1.5">
              <div className="w-7 h-7 rounded-full bg-purple-100/80 flex items-center justify-center shrink-0">
                <Clock size={15} className="text-[#5B46E8]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-neutral-900 leading-tight truncate">৭ দিন রিটার্ন</div>
                <div className="text-[9.5px] font-medium text-neutral-500 truncate">সহজ পলিসি</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-1">
              <div className="w-7 h-7 rounded-full bg-pink-100/80 flex items-center justify-center shrink-0">
                <ShieldCheck size={15} className="text-[#E11D48]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-neutral-900 leading-tight truncate">নিরাপদ পেমেন্ট</div>
                <div className="text-[9.5px] font-medium text-neutral-500 truncate">১০০% লেনদেন</div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* PRODUCT DETAILS TABLE - RENDERED FROM REAL ADMIN SPECS    */}
          {/* ========================================================= */}
          {activeSpecifications.length > 0 && (
            <div className="bg-[#FAF9FF] rounded-2xl border border-neutral-200/70 p-4 sm:p-5 mt-3 space-y-2.5">
              <h3 className="text-sm font-black text-neutral-900">
                প্রোডাক্ট ডিটেইলস
              </h3>

              <div className="divide-y divide-neutral-200/60 text-xs">
                {activeSpecifications.map((spec, idx) => (
                  <div key={idx} className="flex justify-between py-2 items-center">
                    <span className="text-neutral-500 font-medium">{spec.label}</span>
                    <span className="font-bold text-neutral-900 text-right max-w-[65%]">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* RELATED PRODUCTS (REAL PUBLISHED STORE PRODUCTS ONLY)     */}
          {/* ========================================================= */}
          {relatedProducts.length > 0 && (
            <div className="pt-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-black text-neutral-900">
                  সম্পর্কিত পণ্য
                </h3>
                <Link to="/shop" className="text-xs font-bold text-[#5B46E8] hover:underline flex items-center">
                  <span>সব দেখুন</span>
                  <ChevronRight size={14} />
                </Link>
              </div>

              {/* Horizontal Compact Cards Row */}
              <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                {relatedProducts.map((item) => {
                  const itemId = item.id;
                  const itemImg = item.images?.[0] || item.image || '';
                  const itemPrice = item.price || 0;
                  const itemWishlisted = isWishlisted(itemId);

                  return (
                    <div
                      key={itemId}
                      onClick={() => {
                        navigate(`/product/${itemId}`);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-[105px] sm:w-[115px] bg-white rounded-xl border border-neutral-200/80 p-1.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative group shrink-0"
                    >
                      {/* Heart on top-right */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(itemId);
                        }}
                        className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-white/90 shadow-xs flex items-center justify-center text-neutral-400 hover:text-pink-500"
                      >
                        <Heart size={10} className={itemWishlisted ? "text-pink-500 fill-pink-500" : ""} />
                      </button>

                      {/* Small Square Image */}
                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#F8F7FC] mb-1.5 flex items-center justify-center p-1">
                        {itemImg ? (
                          <img 
                            src={itemImg} 
                            alt={item.name} 
                            className="w-full h-full object-cover rounded-md group-hover:scale-105 transition-transform" 
                          />
                        ) : (
                          <div className="text-[9px] text-neutral-400 font-medium">No image</div>
                        )}
                      </div>

                      {/* Product Name (1 line truncate) */}
                      <div className="text-[10px] font-semibold text-neutral-700 truncate text-center mb-0.5 px-0.5">
                        {item.name}
                      </div>

                      {/* Compact Price */}
                      <div className="text-[11.5px] font-black text-neutral-900 tracking-tight text-center">
                        ৳ {formatPrice(itemPrice)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* REVIEWS COMPONENT (GENUINE FIRESTORE DATA)                */}
          {/* ========================================================= */}
          <div className="pt-4 border-t border-neutral-100">
            <ProductReviews 
              productId={product.id} 
              productName={product.name} 
              onRatingUpdate={(avg, count) => setReviewSummary({ avgRating: avg, totalCount: count })}
            />
          </div>
        </div>
      </div>

      {/* STANDARD SIZE GUIDE MODAL */}
      {isSizeGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setIsSizeGuideOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="flex items-center space-x-2 text-[#5B46E8] mb-3">
              <Ruler size={18} />
              <span className="text-sm font-bold uppercase tracking-wider">সাইজ গাইড</span>
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">সাইজ মেজারমেন্ট চার্ট</h3>
            <p className="text-xs text-neutral-500 mb-4">আপনার সঠিক মাপ অনুযায়ী সাইজ পছন্দ করুন (ইঞ্চি):</p>
            
            <div className="border border-neutral-200 rounded-2xl overflow-hidden mb-5">
              <table className="w-full text-xs text-center divide-y divide-neutral-200">
                <thead className="bg-neutral-50 text-neutral-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-3 text-left">সাইজ</th>
                    <th className="py-2.5 px-3">চেস্ট (বুক)</th>
                    <th className="py-2.5 px-3">লম্বা (Length)</th>
                    <th className="py-2.5 px-3">হাতা (Sleeve)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800 font-medium">
                  <tr>
                    <td className="py-2 px-3 text-left font-bold">S (৩৮)</td>
                    <td className="py-2 px-3">৩৮"</td>
                    <td className="py-2 px-3">২৮"</td>
                    <td className="py-2 px-3">২৩"</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="py-2 px-3 text-left font-bold">M (৪০)</td>
                    <td className="py-2 px-3">৪০"</td>
                    <td className="py-2 px-3">২৯"</td>
                    <td className="py-2 px-3">২৪"</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-left font-bold">L (৪২)</td>
                    <td className="py-2 px-3">৪২"</td>
                    <td className="py-2 px-3">৩০"</td>
                    <td className="py-2 px-3">২৫"</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="py-2 px-3 text-left font-bold">XL (৪৪)</td>
                    <td className="py-2 px-3">৪৪"</td>
                    <td className="py-2 px-3">৩১"</td>
                    <td className="py-2 px-3">২৫.৫"</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-left font-bold">XXL (৪৬)</td>
                    <td className="py-2 px-3">৪৬"</td>
                    <td className="py-2 px-3">৩২"</td>
                    <td className="py-2 px-3">২৬"</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() => setIsSizeGuideOpen(false)}
              className="w-full bg-[#5B46E8] hover:bg-[#4F39F6] text-white py-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
