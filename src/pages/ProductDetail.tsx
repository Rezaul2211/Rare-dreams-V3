import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { usePublishedProducts, getCachedProductById } from '../hooks/usePublishedProducts';
import { safeRandomUUID } from '../lib/uuid';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const { config: storeConfig } = useStoreConfigStore();
  
  // Instant cache lookup for immediate 0ms product rendering
  const initialCachedProduct = useMemo(() => id ? getCachedProductById(id) : null, [id]);
  const [product, setProduct] = useState<Product | null>(() => initialCachedProduct);
  const [loading, setLoading] = useState<boolean>(() => !initialCachedProduct);
  
  // Real Authentic Reviews Summary (No fake 128 / 4.8)
  const [reviewSummary, setReviewSummary] = useState(() => ({
    avgRating: initialCachedProduct?.rating || 0,
    totalCount: initialCachedProduct?.reviewsCount || 0
  }));
  
  // Showcase state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>(() => {
    if (!initialCachedProduct) return '';
    const availSizes = (initialCachedProduct.sizeOptions && initialCachedProduct.sizeOptions.length > 0) 
      ? initialCachedProduct.sizeOptions 
      : ((initialCachedProduct as any).sizes && Array.isArray((initialCachedProduct as any).sizes) && (initialCachedProduct as any).sizes.length > 0 ? (initialCachedProduct as any).sizes : []);
    return availSizes[0] || '';
  });
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    if (!initialCachedProduct) return '';
    const availColors = (initialCachedProduct.colorOptions && initialCachedProduct.colorOptions.length > 0) 
      ? initialCachedProduct.colorOptions 
      : ((initialCachedProduct as any).colors && Array.isArray((initialCachedProduct as any).colors) && (initialCachedProduct as any).colors.length > 0 ? (initialCachedProduct as any).colors : []);
    return availColors[0] || '';
  });
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
    let isMounted = true;
    const fetchProduct = async () => {
      if (!id) return;
      
      // If we don't have product cached, show skeleton
      const cached = getCachedProductById(id);
      if (cached) {
        setProduct(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const docRef = doc(db, 'products', id);
        
        // Fetch with a 6-second timeout race
        const getDocPromise = getDoc(docRef);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Product fetch timeout')), 6000);
        });

        const docSnap: any = await Promise.race([getDocPromise, timeoutPromise]);
        
        if (!isMounted) return;

        if (docSnap && docSnap.exists()) {
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

          const availSizes = (data.sizeOptions && data.sizeOptions.length > 0) 
            ? data.sizeOptions 
            : ((data as any).sizes && Array.isArray((data as any).sizes) && (data as any).sizes.length > 0 ? (data as any).sizes : []);
          if (availSizes.length > 0) {
            setSelectedSize(availSizes[0]);
          } else {
            setSelectedSize('');
          }

          const availColors = (data.colorOptions && data.colorOptions.length > 0) 
            ? data.colorOptions 
            : ((data as any).colors && Array.isArray((data as any).colors) && (data as any).colors.length > 0 ? (data as any).colors : []);
          if (availColors.length > 0) {
            setSelectedColor(availColors[0]);
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
        console.warn("[RareDreams ProductDetail] Error/Timeout fetching product:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // 360 Rotation Mouse/Touch handlers
  const handleTouchStart360 = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isDragging360.current = true;
    startX360.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
  }, []);

  const handleTouchMove360 = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging360.current) return;
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = currentX - startX360.current;
    startX360.current = currentX;
    setRotationAngle((prev) => (prev + delta * 0.9) % 360);
  }, []);

  const handleTouchEnd360 = useCallback(() => {
    isDragging360.current = false;
  }, []);

  // Extract real uploaded images only (Combining main image, images array, and colorImageMap)
  const displayImages = useMemo(() => {
    const list: string[] = [];

    if (product?.image && typeof product.image === 'string' && product.image.trim()) {
      list.push(product.image.trim());
    }

    if (product?.images && Array.isArray(product.images)) {
      product.images.forEach(img => {
        if (img && typeof img === 'string' && img.trim() && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      });
    }

    if (product?.colorImageMap && typeof product.colorImageMap === 'object') {
      Object.values(product.colorImageMap).forEach(imgUrl => {
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim() && !list.includes(imgUrl.trim())) {
          list.push(imgUrl.trim());
        }
      });
    }

    return list;
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

  const handleColorChange = useCallback((colorName: string, index: number) => {
    setSelectedColor(colorName);
    setIs360Mode(false);

    // 1. Check if an explicit image URL is mapped for this color
    if (product?.colorImageMap && product.colorImageMap[colorName]) {
      const targetUrl = product.colorImageMap[colorName];
      const foundIdx = displayImages.findIndex(img => img === targetUrl);
      if (foundIdx !== -1) {
        setSelectedImageIndex(foundIdx);
        return;
      }
    }

    // 2. Automatic fallback image switching if image index exists
    if (displayImages.length > index) {
      setSelectedImageIndex(index);
    }
  }, [displayImages, product]);

  const handleSelectImage = useCallback((idx: number) => {
    setSelectedImageIndex(idx);
    setIs360Mode(false);
    const selectedImgUrl = displayImages[idx];
    if (!selectedImgUrl || !product) return;

    // Check if any color is mapped to this exact image
    if (product.colorImageMap) {
      const match = Object.entries(product.colorImageMap).find(([_, url]) => url === selectedImgUrl);
      if (match && match[0]) {
        setSelectedColor(match[0]);
        return;
      }
    }

    // Fallback: If colors list matches image index
    if (product.colorOptions && product.colorOptions[idx]) {
      setSelectedColor(product.colorOptions[idx]);
    }
  }, [displayImages, product]);

  const handleNextImage = useCallback(() => {
    if (displayImages.length <= 1) return;
    const nextIdx = (selectedImageIndex + 1) % displayImages.length;
    handleSelectImage(nextIdx);
  }, [displayImages.length, selectedImageIndex, handleSelectImage]);

  const handlePrevImage = useCallback(() => {
    if (displayImages.length <= 1) return;
    const prevIdx = (selectedImageIndex - 1 + displayImages.length) % displayImages.length;
    handleSelectImage(prevIdx);
  }, [displayImages.length, selectedImageIndex, handleSelectImage]);

  const galleryTouchStartX = useRef(0);
  const handleTouchStartGallery = (e: React.TouchEvent) => {
    if (is360Mode) {
      handleTouchStart360(e);
      return;
    }
    galleryTouchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEndGallery = (e: React.TouchEvent) => {
    if (is360Mode) {
      handleTouchEnd360();
      return;
    }
    const touchEndX = e.changedTouches[0].clientX;
    const diff = galleryTouchStartX.current - touchEndX;
    if (diff > 45) {
      handleNextImage();
    } else if (diff < -45) {
      handlePrevImage();
    }
  };

  const handleAddToCart = useCallback((e?: React.MouseEvent<HTMLElement>) => {
    if (!product) return;
    try {
      trackAddToCart({
        content_name: product.name,
        content_ids: [product.id],
        value: (product.price || 0) * (quantity || 1),
      });
    } catch (err) {
      console.warn("Pixel tracking error:", err);
    }

    const chosenImage = activeImage || displayImages[selectedImageIndex] || product.image;
    
    try {
      if (e) {
        animateAddToCart(product, e, {
          size: selectedSize || undefined,
          color: selectedColor || undefined,
          quantity: quantity || 1,
        });
      } else {
        addItem({
          ...product,
          cartItemId: safeRandomUUID(),
          selectedSize: selectedSize || undefined,
          selectedColor: selectedColor || undefined,
          selectedColorImage: chosenImage,
          quantity: quantity || 1,
        });
      }
    } catch (err) {
      console.warn("Fallback addItem in handleAddToCart:", err);
      addItem({
        ...product,
        cartItemId: safeRandomUUID(),
        selectedSize: selectedSize || undefined,
        selectedColor: selectedColor || undefined,
        selectedColorImage: chosenImage,
        quantity: quantity || 1,
      });
    }
  }, [product, quantity, selectedSize, selectedColor, activeImage, displayImages, selectedImageIndex, animateAddToCart, addItem]);

  const handleBuyNow = useCallback(() => {
    if (!product) return;
    try {
      trackAddToCart({
        content_name: product.name,
        content_ids: [product.id],
        value: (product.price || 0) * (quantity || 1),
      });
    } catch (err) {
      console.warn("Pixel tracking error:", err);
    }

    const chosenImage = activeImage || displayImages[selectedImageIndex] || product.image;

    try {
      const directItem = {
        ...product,
        cartItemId: `direct-${product.id}-${selectedSize || 'default'}-${selectedColor || 'default'}-${Date.now()}`,
        selectedSize: selectedSize || undefined,
        selectedColor: selectedColor || undefined,
        selectedColorImage: chosenImage,
        quantity: quantity || 1,
      };

      setDirectCheckoutItem(directItem);
    } catch (err) {
      console.error("Error setting direct checkout item:", err);
    } finally {
      navigate('/checkout');
    }
  }, [product, quantity, selectedSize, selectedColor, activeImage, displayImages, selectedImageIndex, setDirectCheckoutItem, navigate]);

  const handleWhatsAppOrder = useCallback(() => {
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
  }, [product, storeConfig, selectedColor, selectedSize, quantity]);

  const handleShare = useCallback(async () => {
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
  }, [product]);

  const sizes = useMemo(() => {
    if (product?.sizeOptions && product.sizeOptions.length > 0) return product.sizeOptions;
    if ((product as any)?.sizes && Array.isArray((product as any).sizes) && (product as any).sizes.length > 0) return (product as any).sizes;
    return [];
  }, [product]);

  const colors = useMemo(() => {
    if (product?.colorOptions && product.colorOptions.length > 0) return product.colorOptions;
    if ((product as any)?.colors && Array.isArray((product as any).colors) && (product as any).colors.length > 0) return (product as any).colors;
    return [];
  }, [product]);

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
              className="w-9 h-9 rounded-full bg-white shadow-xs border border-neutral-200 flex items-center justify-center text-neutral-700 hover:text-black active:scale-90 transition-all cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2">
              {/* Share */}
              <button
                onClick={handleShare}
                aria-label="Share"
                className="w-9 h-9 rounded-full bg-white shadow-xs border border-neutral-200 flex items-center justify-center text-neutral-700 hover:text-black active:scale-90 transition-all cursor-pointer"
              >
                <Share2 size={17} />
              </button>
              {/* Favorite */}
              <button
                onClick={() => product && toggleWishlist(product.id)}
                aria-label="Wishlist"
                className={clsx(
                  "w-9 h-9 rounded-full shadow-xs border flex items-center justify-center active:scale-90 transition-all cursor-pointer",
                  favorited
                    ? "bg-rose-50 border-rose-200 text-rose-500"
                    : "bg-white border-neutral-200 text-neutral-700 hover:text-black"
                )}
              >
                <Heart size={17} className={favorited ? "fill-rose-500" : ""} />
              </button>
            </div>
          </div>

          {/* Vertical Thumbnail Column (Left Side) - Multi-Image Album Gallery */}
          {displayImages.length > 1 && (
            <div className="absolute top-12 left-2.5 sm:left-3.5 z-30 flex flex-col gap-1.5 max-h-[230px] sm:max-h-[290px] overflow-y-auto no-scrollbar p-1 bg-white/80 backdrop-blur-md rounded-2xl border border-white/90 shadow-md">
              {displayImages.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectImage(idx)}
                  className={clsx(
                    "w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-white shadow-2xs p-0.5 transition-all cursor-pointer shrink-0 relative",
                    selectedImageIndex === idx && !is360Mode
                      ? "border-2 border-[#5B46E8] ring-2 ring-purple-300 scale-105 z-10"
                      : "border border-neutral-200/90 opacity-75 hover:opacity-100"
                  )}
                  title={`ছবি ${idx + 1}`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                    loading="lazy"
                  />
                  {selectedImageIndex === idx && !is360Mode && (
                    <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-[#5B46E8] rounded-full ring-1 ring-white" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 3D FLOATING PRODUCT PODIUM & STAGE */}
          <div 
            className="relative w-full h-[280px] sm:h-[350px] flex items-center justify-center px-4 touch-pan-y"
            onTouchStart={is360Mode ? handleTouchStart360 : undefined}
            onTouchMove={is360Mode ? handleTouchMove360 : undefined}
            onTouchEnd={is360Mode ? handleTouchEnd360 : undefined}
            onMouseDown={is360Mode ? handleTouchStart360 : undefined}
            onMouseMove={is360Mode ? handleTouchMove360 : undefined}
            onMouseUp={is360Mode ? handleTouchEnd360 : undefined}
          >
            {/* Prev/Next Album Navigation Arrows */}
            {displayImages.length > 1 && !is360Mode && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIdx = (selectedImageIndex - 1 + displayImages.length) % displayImages.length;
                    handleSelectImage(newIdx);
                  }}
                  className="absolute left-16 sm:left-20 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-md hover:bg-white text-neutral-800 rounded-full shadow-md border border-white flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                  title="পূর্ববর্তী ছবি"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIdx = (selectedImageIndex + 1) % displayImages.length;
                    handleSelectImage(newIdx);
                  }}
                  className="absolute right-3.5 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 bg-white/80 backdrop-blur-md hover:bg-white text-neutral-800 rounded-full shadow-md border border-white flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                  title="পরবর্তী ছবি"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
            {/* Ambient Studio Lighting Glow */}
            <div className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-radial from-purple-300/35 via-blue-200/20 to-transparent blur-2xl pointer-events-none" />

            {/* Glowing 3D Podium Base */}
            <div className="absolute bottom-2 w-[230px] sm:w-[300px] h-[54px] sm:h-[66px] flex items-center justify-center pointer-events-none">
              {/* Soft Drop Shadow under podium */}
              <div className="absolute -bottom-2 w-[200px] sm:w-[250px] h-5 bg-purple-950/15 rounded-[100%] blur-md" />
              
              {/* Podium 3D Ellipse Body */}
              <div className="relative w-full h-full rounded-[100%] bg-gradient-to-b from-white via-[#F8F7FF] to-[#E2DEFA] shadow-[0_10px_24px_rgba(91,70,232,0.18)] border-2 border-white flex items-center justify-center">
                {/* Glowing Neon Cyan/Violet LED Ring around podium */}
                <div className="absolute inset-0 rounded-[100%] border-[2px] border-[#818CF8]/60 shadow-[0_0_15px_rgba(129,140,248,0.7)]" />
                {/* Inner Stage Platform */}
                <div className="w-[88%] h-[82%] rounded-[100%] bg-gradient-to-t from-[#ECE9FE] to-white/95 shadow-inner" />
              </div>
            </div>

            {/* Floating Product Image - Sized & Centered over Podium */}
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
              className="relative z-10 w-[230px] sm:w-[290px] h-[230px] sm:h-[280px] flex items-center justify-center p-1"
              style={{ perspective: 1000 }}
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  className="max-w-full max-h-full object-contain filter contrast-[1.03] transition-all duration-300 drop-shadow-[0_12px_22px_rgba(30,27,75,0.16)] rounded-xl select-none pointer-events-none"
                  loading="eager"
                />
              ) : (
                <div className="w-32 h-32 bg-purple-100 rounded-2xl flex items-center justify-center text-neutral-400 font-medium text-xs">
                  কোন ছবি নেই
                </div>
              )}
            </motion.div>

            {/* 360 Interactive View Pill Button */}
            <button
              type="button"
              onClick={() => {
                setIs360Mode(!is360Mode);
                setRotationAngle(0);
              }}
              className={clsx(
                "absolute bottom-2.5 right-3.5 z-20 rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer",
                is360Mode
                  ? "bg-[#5B46E8] text-white ring-2 ring-purple-300 shadow-purple-500/20"
                  : "bg-white text-neutral-800 border border-neutral-200 hover:border-[#5B46E8]/40"
              )}
            >
              <Rotate3d size={14} className={is360Mode ? "animate-spin text-white" : "text-[#5B46E8]"} />
              <span>{is360Mode ? "3D চালু আছে" : "360° ভিউ"}</span>
            </button>

            {/* 360 Guide Overlay Tag */}
            {is360Mode && (
              <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-20 bg-black/90 text-white text-[10.5px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse whitespace-nowrap">
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

          {/* INLINE PRODUCT ACTIONS */}
          <div className="hidden md:block space-y-2 pt-2">
            <div className="text-xs sm:text-sm font-bold text-neutral-900">
              পরিমাণ
            </div>

            <div className="grid grid-cols-[88px_1fr_1fr] gap-2.5 items-center">
              {/* Stepper */}
              <div className="h-11 rounded-xl border border-neutral-200 bg-white flex items-center justify-between px-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuantity((prev) => Math.max(1, prev - 1));
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-colors cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="font-black text-sm text-neutral-900">{quantity}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuantity((prev) => Math.min(99, prev + 1));
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold text-neutral-600 hover:bg-neutral-100 active:scale-95 transition-colors cursor-pointer"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Add to Cart */}
              <button
                type="button"
                onClick={handleAddToCart}
                className="h-11 rounded-xl bg-[#6B46C1] hover:bg-[#5B3CC4] active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap px-2"
              >
                <ShoppingBag size={15} strokeWidth={2.4} className="shrink-0" />
                <span className="truncate">কার্টে যোগ করুন</span>
              </button>

              {/* Buy Now (High Conversion Fast Solid Button) */}
              <button
                type="button"
                onClick={handleBuyNow}
                className="h-11 rounded-xl bg-gradient-to-r from-[#FF0844] to-[#FF6A00] hover:brightness-105 active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition-all cursor-pointer whitespace-nowrap px-3"
              >
                <Flame size={16} className="text-yellow-300 fill-yellow-400 shrink-0" />
                <span className="truncate font-black tracking-wide">এখনই কিনুন</span>
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
      {isSizeGuideOpen && typeof document !== 'undefined' && document.body && createPortal(
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
      {/* FLOATING HIGH-CONVERSION MOBILE ACTION BAR (ALWAYS IN VIEW) */}
      {/* ========================================================= */}
      {typeof document !== 'undefined' && document.body && createPortal(
        <div 
          id="product-mobile-action-bar"
          className="md:hidden fixed bottom-4 left-4 right-4 z-[9999] bg-white border border-neutral-200/80 rounded-2xl shadow-2xl p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        >
          <div className="max-w-md mx-auto flex items-center gap-2">
            
            {/* Stepper with clean, solid, high-contrast styling */}
            <div className="h-11 rounded-xl bg-neutral-100 border border-neutral-300/90 flex items-center justify-between px-2 shrink-0 min-w-[86px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuantity((prev) => Math.max(1, prev - 1));
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-black text-neutral-700 hover:bg-white active:scale-90 transition-all cursor-pointer"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="font-black text-sm text-neutral-950 px-1">{quantity}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuantity((prev) => Math.min(99, prev + 1));
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-black text-neutral-700 hover:bg-white active:scale-90 transition-all cursor-pointer"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            {/* Add to Cart CTA */}
            <button
              type="button"
              onClick={(e) => handleAddToCart(e)}
              className="flex-1 h-11 rounded-xl bg-[#6B46C1] hover:bg-[#5B3CC4] active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap px-2"
            >
              <ShoppingBag size={16} strokeWidth={2.4} className="shrink-0" />
              <span className="truncate">কার্টে যোগ করুন</span>
            </button>

            {/* Buy Now CTA */}
            <button
              type="button"
              onClick={handleBuyNow}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#FF0844] to-[#FF6A00] hover:brightness-105 active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition-all cursor-pointer whitespace-nowrap px-2"
            >
              <Flame size={16} className="text-yellow-300 fill-yellow-400 shrink-0" />
              <span className="truncate">এখনই কিনুন</span>
            </button>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
