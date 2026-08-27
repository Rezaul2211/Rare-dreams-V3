import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { Product } from '../types';
import { useCartStore } from '../store/useCartStore';
import { useFlyToCart } from '../context/FlyToCartContext';
import { useWishlistStore } from '../store/useWishlistStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
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
  Clock,
  Check,
  MessageCircle,
  Share2,
  Flame
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { ProductDetailSkeleton } from '../components/ProductDetailSkeleton';
import { ProductReviews } from '../components/ProductReviews';
import SEO from '../components/SEO';
import { calculateDiscount, formatPrice } from '../utils/productUtils';
import { getColorSwatch } from '../utils/colorUtils';
import { usePublishedProducts } from '../hooks/usePublishedProducts';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const { config: storeConfig } = useStoreConfigStore();
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

  const handleColorChange = (colorName: string, index: number) => {
    setSelectedColor(colorName);
    // Automatic image switching if image exists for this variant
    if (displayImages.length > index) {
      setSelectedImageIndex(index);
      setIs360Mode(false);
    }
  };

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

  const handleWhatsAppOrder = () => {
    if (!product) return;
    const rawPhone = storeConfig?.whatsappNumber || storeConfig?.helplineNumber || '+8801712345678';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

    const message = `হ্যালো! আমি Rare Dreams থেকে এই প্রোডাক্টটি অর্ডার করতে চাই:
🛍️ প্রোডাক্ট: ${product.name}
💰 মূল্য: ৳${product.price}
${selectedColor ? `🎨 রং: ${selectedColor}\n` : ''}${selectedSize ? `📏 সাইজ: ${selectedSize}\n` : ''}📦 পরিমাণ: ${quantity} টি
🔗 প্রোডাক্ট লিঙ্ক: ${currentUrl}`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async () => {
    if (!product) return;
    const shareData = {
      title: product.name,
      text: `${product.name} - ৳${product.price}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Ignored if user cancels share dialog
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('প্রোডাক্টের লিংক কপি করা হয়েছে!');
    }
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
    <div className="min-h-screen bg-[#F6F5FC] sm:bg-[#ECE9F8] text-neutral-900 pb-28 md:pb-12 font-sans">
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
        <div className="relative w-full overflow-hidden bg-gradient-to-b from-[#EBE6FF] via-[#F4F1FE] to-white sm:rounded-t-[32px] sm:border-x sm:border-t border-purple-100/80 pt-3 pb-4 select-none">
          
          {/* Top Floating Action Bar */}
          <div className="flex items-center justify-between px-3.5 sm:px-4 relative z-30 pointer-events-auto mb-1">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-neutral-100 flex items-center justify-center text-neutral-800 active:scale-90 transition-transform cursor-pointer"
            >
              <ChevronLeft size={19} strokeWidth={2.4} />
            </button>

            {/* Right Buttons: Share & Wishlist */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                aria-label="Share"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-neutral-100 flex items-center justify-center text-neutral-700 active:scale-90 transition-transform cursor-pointer"
              >
                <Share2 size={16} strokeWidth={2.2} />
              </button>

              <button
                onClick={() => toggleWishlist(product.id)}
                aria-label="Wishlist"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 backdrop-blur-md shadow-[0_4px_14px_rgba(0,0,0,0.06)] border border-neutral-100 flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
              >
                <Heart
                  size={18}
                  className={favorited ? "text-[#5B46E8] fill-[#5B46E8]" : "text-[#5B46E8]"}
                  strokeWidth={2.2}
                />
              </button>
            </div>
          </div>

          {/* Vertical Thumbnail Column (Left Side) - Stacked vertically */}
          {displayImages.length > 1 && (
            <div className="absolute top-14 left-3 z-20 flex flex-col gap-1.5 max-h-[210px] sm:max-h-[270px] overflow-y-auto hide-scrollbar py-1">
              {displayImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImageIndex(idx);
                    setIs360Mode(false);
                  }}
                  className={clsx(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-white shadow-2xs p-0.5 transition-all cursor-pointer shrink-0",
                    selectedImageIndex === idx && !is360Mode
                      ? "border-2 border-[#5B46E8] ring-2 ring-purple-200 scale-105"
                      : "border border-neutral-200/90 opacity-80 hover:opacity-100"
                  )}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </button>
              ))}
            </div>
          )}

          {/* 3D FLOATING PRODUCT PODIUM & STAGE */}
          <div 
            className="relative w-full h-[260px] sm:h-[340px] flex items-center justify-center px-4 touch-pan-y"
            onTouchStart={is360Mode ? handleTouchStart360 : undefined}
            onTouchMove={is360Mode ? handleTouchMove360 : undefined}
            onTouchEnd={is360Mode ? handleTouchEnd360 : undefined}
            onMouseDown={is360Mode ? handleTouchStart360 : undefined}
            onMouseMove={is360Mode ? handleTouchMove360 : undefined}
            onMouseUp={is360Mode ? handleTouchEnd360 : undefined}
          >
            {/* Ambient Studio Lighting Glow */}
            <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full bg-radial from-purple-300/35 via-blue-200/20 to-transparent blur-2xl pointer-events-none" />

            {/* Glowing 3D Podium Base */}
            <div className="absolute bottom-2.5 w-[210px] sm:w-[280px] h-[52px] sm:h-[62px] flex items-center justify-center pointer-events-none">
              {/* Soft Drop Shadow under podium */}
              <div className="absolute -bottom-2 w-[180px] sm:w-[230px] h-5 bg-purple-950/15 rounded-[100%] blur-md" />
              
              {/* Podium 3D Ellipse Body */}
              <div className="relative w-full h-full rounded-[100%] bg-gradient-to-b from-white via-[#F8F7FF] to-[#E2DEFA] shadow-[0_10px_24px_rgba(91,70,232,0.18)] border-2 border-white flex items-center justify-center">
                {/* Glowing Neon Cyan/Violet LED Ring around podium */}
                <div className="absolute inset-0 rounded-[100%] border-[2px] border-[#818CF8]/60 shadow-[0_0_15px_rgba(129,140,248,0.7)]" />
                {/* Inner Stage Platform */}
                <div className="w-[88%] h-[82%] rounded-[100%] bg-gradient-to-t from-[#ECE9FE] to-white/95 shadow-inner" />
              </div>
            </div>

            {/* Floating Product Image */}
            <motion.div
              animate={is360Mode ? {
                rotateY: rotationAngle,
              } : {
                y: [0, -5, 0],
              }}
              transition={is360Mode ? { duration: 0 } : {
                duration: 4.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative z-10 w-[200px] sm:w-[260px] h-[210px] sm:h-[270px] flex items-center justify-center"
              style={{ perspective: 1000 }}
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  className="max-w-full max-h-full object-contain filter contrast-[1.03] transition-all duration-300 drop-shadow-[0_10px_18px_rgba(30,27,75,0.16)] rounded-xl select-none pointer-events-none"
                />
              ) : (
                <div className="w-32 h-32 bg-purple-100 rounded-2xl flex items-center justify-center text-neutral-400 font-medium text-xs">
                  কোন ছবি নেই
                </div>
              )}
            </motion.div>

            {/* 360 Interactive View Pill Button (Always visible on stage) */}
            <button
              onClick={() => {
                setIs360Mode(!is360Mode);
                setRotationAngle(0);
              }}
              className={clsx(
                "absolute bottom-2.5 right-3.5 z-20 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer",
                is360Mode
                  ? "bg-[#5B46E8] text-white ring-2 ring-purple-300"
                  : "bg-white/95 text-neutral-800 border border-purple-100 hover:border-[#5B46E8]/40"
              )}
            >
              <Rotate3d size={14} className={is360Mode ? "animate-spin text-white" : "text-[#5B46E8]"} />
              <span>{is360Mode ? "3D চালু আছে" : "360° ভিউ"}</span>
            </button>

            {/* 360 Guide Overlay Tag */}
            {is360Mode && (
              <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-md text-white text-[10.5px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse whitespace-nowrap">
                <Rotate3d size={12} />
                <span>ঘুরিয়ে দেখতে ডানে বা বামে টানুন</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* WHITE CARD CONTENT SHEET (Balanced & Clean)               */}
        {/* ========================================================= */}
        <div className="bg-white px-4 py-4 sm:p-7 sm:rounded-b-[32px] sm:border-x sm:border-b border-neutral-100 shadow-xs space-y-3.5">
          
          {/* Top Discount Tag (Only if discount exists) */}
          {discountPct > 0 && (
            <div>
              <span className="inline-block bg-[#FFF0E6] text-[#FF6A1A] text-[11px] sm:text-xs font-black px-2.5 py-0.5 rounded-full tracking-wide">
                {discountPct}% ছাড়
              </span>
            </div>
          )}

          {/* Product Title & Material Subtitle */}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            {product.material && (
              <p className="text-xs sm:text-sm font-medium text-neutral-500 mt-0.5">
                {product.material}
              </p>
            )}
          </div>

          {/* Real Ratings & Reviews */}
          <div className="flex items-center gap-2">
            <div className="flex items-center text-[#F59E0B]">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  size={15} 
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
                <span className="text-xs sm:text-sm font-black text-neutral-800">
                  {reviewSummary.avgRating.toFixed(1)}
                </span>
                <span className="text-xs sm:text-sm font-medium text-neutral-500">
                  ({reviewSummary.totalCount} রিভিউ)
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-neutral-400">
                (০ রিভিউ - প্রথম রিভিউ দিন)
              </span>
            )}
          </div>

          {/* Pricing Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-black text-[#4F39F6] tracking-tight">
              {formatPrice(product.price || 0)}
            </span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span className="text-sm sm:text-base text-neutral-400 line-through font-semibold">
                {formatPrice(product.comparePrice)}
              </span>
            )}
            {discountPct > 0 && (
              <span className="bg-[#FFE6EC] text-[#FF2D55] text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full">
                {discountPct}% ছাড়
              </span>
            )}
          </div>

          {/* Product Description */}
          {product.description && (
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed font-normal whitespace-pre-line">
              {product.description}
            </p>
          )}

          {/* COLOR SELECTION - PURE CIRCULAR SWATCHES ONLY (NO TEXT BADGES) */}
          {colors.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <span>রং:</span>
                <span className="text-[#5B46E8] font-bold">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {colors.map((c, idx) => {
                  const isSelected = selectedColor === c;
                  const swatch = getColorSwatch(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      aria-label={c}
                      onClick={() => handleColorChange(c, idx)}
                      className={clsx(
                        "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer relative",
                        isSelected
                          ? "ring-2 ring-offset-2 ring-[#5B46E8] scale-110 shadow-xs"
                          : "hover:scale-105 opacity-90 hover:opacity-100 border border-black/10 shadow-2xs"
                      )}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {isSelected && (
                        <Check
                          size={15}
                          strokeWidth={3}
                          className={swatch.isLight ? "text-neutral-900" : "text-white"}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SIZE SELECTION - ONLY if real sizes are available */}
          {sizes.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <div className="text-xs sm:text-sm font-bold text-neutral-900">
                  সাইজ নির্বাচন করুন: <span className="text-[#5B46E8] font-semibold">{selectedSize}</span>
                </div>
                <button
                  onClick={() => setIsSizeGuideOpen(true)}
                  className="text-xs font-bold text-[#4F39F6] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Ruler size={12} />
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
                        "min-w-10 h-9 px-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center transition-all cursor-pointer",
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

          {/* DESKTOP ONLY INLINE ACTIONS */}
          <div className="hidden md:block space-y-2 pt-2">
            <div className="text-xs sm:text-sm font-bold text-neutral-900">
              পরিমাণ
            </div>

            <div className="grid grid-cols-[88px_1fr_1fr] gap-2.5 items-center">
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

              {/* Buy Now (High-Impact Fiery Flame Eye-Catching Button) */}
              <button
                onClick={handleBuyNow}
                className="relative overflow-hidden h-11 rounded-xl bg-gradient-to-r from-[#FF0844] via-[#FF3366] to-[#FF8008] hover:from-[#E00638] hover:to-[#E67300] active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_0_24px_rgba(255,50,0,0.8),0_4px_14px_rgba(255,100,0,0.4)] animate-[fire-pulse_1.5s_infinite_ease-in-out] transition-all cursor-pointer whitespace-nowrap px-3 group"
              >
                {/* Rising flame glare effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-yellow-400/30 to-white/40 pointer-events-none animate-pulse" />
                
                {/* Floating flame particles */}
                <span className="absolute -top-1 left-2 w-1.5 h-1.5 rounded-full bg-yellow-300 blur-[0.5px] animate-[flame-rise_1.6s_infinite_linear]" />
                <span className="absolute -top-1 right-3 w-2 h-2 rounded-full bg-orange-400 blur-[0.5px] animate-[flame-rise_1.9s_infinite_linear]" />
                
                <Flame size={16} className="relative z-10 text-yellow-300 fill-yellow-400 animate-bounce shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
                <span className="relative z-10 truncate font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] tracking-wide">এখনই কিনুন</span>
              </button>
            </div>
          </div>

          {/* COMPACT & SLEEK PREMIUM WHATSAPP ORDER BUTTON */}
          <div className="pt-0.5 flex justify-center">
            <button
              type="button"
              onClick={handleWhatsAppOrder}
              className="w-full sm:w-auto px-4 h-9 sm:h-9.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-500/30 active:scale-[0.98] text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <MessageCircle size={15} className="text-emerald-600 fill-emerald-600" />
              <span>হোয়াটসঅ্যাপে অর্ডার করুন</span>
            </button>
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

      {/* STANDARD SIZE GUIDE MODAL (PORTALIZED FOR PERFECT CENTERING ABOVE ALL BARS) */}
      {isSizeGuideOpen && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSizeGuideOpen(false);
          }}
          className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl relative max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSizeGuideOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
            <div className="flex items-center space-x-2 text-[#5B46E8] mb-2.5">
              <Ruler size={18} />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">সাইজ গাইড</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mb-1.5">সাইজ মেজারমেন্ট চার্ট</h3>
            <p className="text-xs text-neutral-500 mb-3.5">আপনার সঠিক মাপ অনুযায়ী সাইজ পছন্দ করুন (ইঞ্চি):</p>
            
            <div className="border border-neutral-200 rounded-2xl overflow-hidden mb-4">
              <table className="w-full text-xs text-center divide-y divide-neutral-200">
                <thead className="bg-neutral-50 text-neutral-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-2.5 text-left">সাইজ</th>
                    <th className="py-2.5 px-2">চেস্ট (বুক)</th>
                    <th className="py-2.5 px-2">লম্বা</th>
                    <th className="py-2.5 px-2">হাতা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800 font-medium">
                  <tr>
                    <td className="py-2 px-2.5 text-left font-bold">S (৩৮)</td>
                    <td className="py-2 px-2">৩৮"</td>
                    <td className="py-2 px-2">২৮"</td>
                    <td className="py-2 px-2">২৩"</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="py-2 px-2.5 text-left font-bold">M (৪০)</td>
                    <td className="py-2 px-2">৪০"</td>
                    <td className="py-2 px-2">২৯"</td>
                    <td className="py-2 px-2">২৪"</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2.5 text-left font-bold">L (৪২)</td>
                    <td className="py-2 px-2">৪২"</td>
                    <td className="py-2 px-2">৩০"</td>
                    <td className="py-2 px-2">২৫"</td>
                  </tr>
                  <tr className="bg-neutral-50/50">
                    <td className="py-2 px-2.5 text-left font-bold">XL (৪৪)</td>
                    <td className="py-2 px-2">৪৪"</td>
                    <td className="py-2 px-2">৩১"</td>
                    <td className="py-2 px-2">২৫.৫"</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-2.5 text-left font-bold">XXL (৪৬)</td>
                    <td className="py-2 px-2">৪৬"</td>
                    <td className="py-2 px-2">৩২"</td>
                    <td className="py-2 px-2">২৬"</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() => setIsSizeGuideOpen(false)}
              className="w-full bg-[#5B46E8] hover:bg-[#4F39F6] text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* FLOATING LIQUID GLASS MOBILE ACTION BAR (Ultra Translucent Liquid Glass) */}
      {/* ========================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <div 
          id="floating-product-action-bar"
          className="md:hidden fixed bottom-3 left-3 right-3 z-[999] pointer-events-auto"
        >
          <div className="bg-white/20 backdrop-blur-xl border border-white/65 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.02),inset_0_1.5px_2.5px_rgba(255,255,255,0.95)] rounded-[20px] p-1.5 xs:p-2 flex items-center gap-1.5 xs:gap-2 max-w-lg mx-auto will-change-[backdrop-filter,transform]">
            
            {/* Stepper with smooth crystal glass capsule styling */}
            <div className="h-10 rounded-[14px] bg-white/45 backdrop-blur-md border border-white/60 flex items-center justify-between px-1.5 shrink-0 min-w-[76px] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.9)]">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-5.5 h-5.5 rounded-lg flex items-center justify-center text-sm font-bold text-neutral-800 hover:bg-white/80 active:scale-90 transition-all cursor-pointer"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="font-black text-xs sm:text-sm text-neutral-950 px-1">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-5.5 h-5.5 rounded-lg flex items-center justify-center text-sm font-bold text-neutral-800 hover:bg-white/80 active:scale-90 transition-all cursor-pointer"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {/* Add to Cart CTA */}
            <button
              type="button"
              onClick={(e) => handleAddToCart(e)}
              className="flex-1 h-10 rounded-[14px] bg-[#6B46C1] hover:bg-[#5B3CC4] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-[0_3px_10px_rgba(107,70,193,0.22)] transition-all cursor-pointer whitespace-nowrap px-1.5"
            >
              <ShoppingBag size={14} strokeWidth={2.4} className="shrink-0" />
              <span className="truncate">কার্টে যোগ করুন</span>
            </button>

            {/* Buy Now CTA (With High-Impact Fiery Flame Animation) */}
            <button
              type="button"
              onClick={handleBuyNow}
              className="relative overflow-hidden flex-1 h-10 rounded-[14px] bg-gradient-to-r from-[#FF0844] via-[#FF3366] to-[#FF8008] hover:from-[#E00638] hover:to-[#E67300] active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 shadow-[0_0_22px_rgba(255,50,0,0.85),0_3px_12px_rgba(255,100,0,0.4)] animate-[fire-pulse_1.5s_infinite_ease-in-out] transition-all cursor-pointer whitespace-nowrap px-2"
            >
              {/* Flame overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-yellow-400/30 to-white/35 pointer-events-none animate-pulse" />
              <Flame size={14} className="relative z-10 text-yellow-300 fill-yellow-400 animate-bounce shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
              <span className="relative z-10 truncate font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">এখনই কিনুন</span>
            </button>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
