import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { useCartStore } from '../store/useCartStore';
import { useFlyToCart } from '../context/FlyToCartContext';
import { useWishlistStore } from '../store/useWishlistStore';
import { useLanguageStore, translateCategory } from '../store/useLanguageStore';
import { trackViewContent, trackAddToCart } from '../lib/pixel';
import { ChevronRight, Share2, MessageCircle, Zap, HeadphonesIcon, Heart, Sparkles, X, Loader2, Ruler, CheckCircle2, Star, Video, Play, Bell, BellRing } from 'lucide-react';
import { ShoppingBag, ShieldCheck, RotateCcw, Truck } from 'lucide-react';
import { clsx } from 'clsx';
import { LazyImage } from '../components/LazyImage';
import { ProductDetailSkeleton } from '../components/ProductDetailSkeleton';
import { ProductCard } from '../components/ProductCard';
import { ProductSkeleton } from '../components/ProductSkeleton';
import { ProductReviews } from '../components/ProductReviews';
import SEO from '../components/SEO';
import { usePriceAlertStore } from '../store/usePriceAlertStore';
import { calculateDiscount, formatPrice } from '../utils/productUtils';
import { usePublishedProducts } from '../hooks/usePublishedProducts';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguageStore();
  const { isProductSubscribed, togglePriceDropAlert } = usePriceAlertStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewSummary, setReviewSummary] = useState({ avgRating: 0, totalCount: 0 });
  const [togglingAlert, setTogglingAlert] = useState(false);
  
  const [selectedMedia, setSelectedMedia] = useState<number | 'video'>(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'contact'>('description');

  // AI Size Recommender Modal State
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [childAge, setChildAge] = useState('');
  const [childHeight, setChildHeight] = useState('');
  const [childWeight, setChildWeight] = useState('');
  const [fitPreference, setFitPreference] = useState('Comfortable Regular Fit');
  const [sizeRecommendation, setSizeRecommendation] = useState<{ size: string; explanation: string } | null>(null);
  const [sizeLoading, setSizeLoading] = useState(false);

  const handleGetAiSizeRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childAge) {
      alert("Please enter child's age");
      return;
    }
    setSizeLoading(true);
    const available = product?.sizeOptions && product.sizeOptions.length > 0 ? product.sizeOptions : ['S', 'M', 'L'];
    try {
      const res = await fetch("/api/ai-recommend-size", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: product?.name,
          category: product?.category,
          availableSizes: available,
          age: childAge,
          height: childHeight,
          weight: childWeight,
          fitPreference
        })
      });
      const data = await res.json();
      if (data.recommendedSize) {
        setSizeRecommendation({
          size: data.recommendedSize,
          explanation: data.explanation || ("Optimal fit based on age and comfort preference.")
        });
        setSelectedSize(data.recommendedSize);
      } else {
        throw new Error("No size in response");
      }
    } catch (err) {
      console.warn("Using smart client fallback for size recommendation:", err);
      const fallbackSize = available[0] || 'M';
      const explanationText = `Based on child age (${childAge}), size '${fallbackSize}' is recommended for maximum comfort and room to grow.`;
      
      setSizeRecommendation({
        size: fallbackSize,
        explanation: explanationText
      });
      setSelectedSize(fallbackSize);
    } finally {
      setSizeLoading(false);
    }
  };

  const { isWishlisted, toggleWishlist } = useWishlistStore();
  const { animateAddToCart } = useFlyToCart();
  const { addItem, setDirectCheckoutItem } = useCartStore();
  const favorited = product ? isWishlisted(product.id) : false;

  // Calculate discount percentage using centralized utility
  const discountPct = calculateDiscount(product);

  // Use cached published products for recommendations
  const { products: allPublishedProducts, loading: loadingPublished } = usePublishedProducts();

  // Compute recommended products algorithmically by category
  const recommendedProducts = useMemo(() => {
    if (!product || !allPublishedProducts.length) return [];
    const others = allPublishedProducts.filter(p => p.id !== product.id);
    const sameCat = others.filter(p => p.category?.toLowerCase() === product.category?.toLowerCase());
    const otherCat = others.filter(p => p.category?.toLowerCase() !== product.category?.toLowerCase());
    return [...sameCat, ...otherCat].slice(0, 4);
  }, [product, allPublishedProducts]);

  const loadingRecommended = loadingPublished && recommendedProducts.length === 0;

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
          setSelectedMedia(0);
          setQuantity(1);
          if (data.sizeOptions?.length) setSelectedSize(data.sizeOptions[0]);
          if (data.colorOptions?.length) setSelectedColor(data.colorOptions[0]);

          // Meta Pixel ViewContent event
          trackViewContent({
            content_name: data.name,
            content_category: data.category,
            content_ids: [data.id],
            value: data.price,
          });

          // Track recently viewed products in localStorage
          try {
            const rawRv = localStorage.getItem('rare_dreams_recently_viewed');
            const rvList = rawRv ? JSON.parse(rawRv) : [];
            const updatedRv = [data, ...rvList.filter((p: Product) => p.id !== data.id)].slice(0, 10);
            localStorage.setItem('rare_dreams_recently_viewed', JSON.stringify(updatedRv));
          } catch (e) {
            console.error("Error updating recently viewed products:", e);
          }
        }
      } catch (error) {
        console.error("Error fetching product", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = (e?: React.MouseEvent<HTMLElement>) => {
    if (!product) return;
    
    // Meta Pixel AddToCart event
    trackAddToCart({
      content_name: product.name,
      content_ids: [product.id],
      value: product.price * quantity,
    });
    
    // Validate selections if options exist
    if (product.sizeOptions?.length && !selectedSize) {
      alert("Please select a size");
      return;
    }
    if (product.colorOptions?.length && !selectedColor) {
      alert("Please select a color");
      return;
    }

    if (e) {
      animateAddToCart(product, e, {
        size: selectedSize,
        color: selectedColor,
        quantity,
      });
    } else {
      addItem({
        ...product,
        cartItemId: crypto.randomUUID(),
        selectedSize,
        selectedColor,
        quantity,
      });
    }
  };

  const handleBuyNow = (e?: React.MouseEvent) => {
    if (!product) return;
    if (product.stockQuantity === 0) return;

    if (product.sizeOptions?.length && !selectedSize) {
      alert('Please select a size');
      return;
    }
    if (product.colorOptions?.length && !selectedColor) {
      alert('Please select a color');
      return;
    }

    trackAddToCart({
      content_name: product.name,
      content_ids: [product.id],
      value: product.price * quantity,
    });

    const directItem = {
      ...product,
      cartItemId: `direct-${product.id}-${selectedSize || 'nosize'}-${selectedColor || 'nocolor'}`,
      selectedSize,
      selectedColor,
      quantity,
    };

    setDirectCheckoutItem(directItem);
    navigate('/checkout');
  };

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return <div className="text-center py-20">Product not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-20">
      <div className="max-w-7xl mx-auto px-4 py-6 w-full">
        <SEO 
          title={`${product.name} - ৳${product.price.toFixed(0)}`}
          description={product.description?.substring(0, 160) || `Buy ${product.name} online.`}
          image={product.images?.[0]}
          type="product"
          price={product.price}
          comparePrice={product.comparePrice}
          currency="BDT"
          rating={product.rating || 5.0}
          reviewCount={reviewSummary.totalCount || product.reviewsCount || 10}
          sku={product.id}
          category={product.category}
          inStock={product.stock ? product.stock > 0 : true}
          keywords={`${product.name}, ${product.category}`}
          breadcrumbs={[
            { name: 'Home', url: window.location.origin },
            { name: product.category, url: `${window.location.origin}/category/${encodeURIComponent(product.category)}` },
            { name: product.name, url: window.location.href }
          ]}
        />

        {/* Breadcrumbs */}
        <div className="flex items-center space-x-1.5 text-[13px] font-medium text-neutral-500 mb-5">
          <span className="hover:text-black cursor-pointer" onClick={() => navigate('/')}>Home</span>
          <ChevronRight size={14} />
          <span className="hover:text-black cursor-pointer" onClick={() => navigate(`/category/${product.category}`)}>{product.category}</span>
          <ChevronRight size={14} />
          <span className="text-amber-700">{product.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">
          {/* Left Column: Images */}
          <div className="w-full lg:w-1/2 flex flex-col">
            {/* Main Viewer */}
            <div className="w-full relative aspect-[4/3] sm:aspect-video lg:aspect-[4/3] rounded-3xl overflow-hidden mb-4 bg-neutral-100">
              {/* Wishlist Heart Button */}
              <button 
                type="button"
                onClick={() => product && toggleWishlist(product.id)}
                className={`absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer bg-white shadow-sm border border-black/5`}
              >
                <Heart 
                  size={20} 
                  className={favorited ? "text-black fill-black" : "text-neutral-900"} 
                />
              </button>

              {product.images && product.images.length > 0 ? (
                <LazyImage 
                  src={product.images[typeof selectedMedia === 'number' ? selectedMedia : 0] || product.images[0]} 
                  alt={product.name}
                  className="w-full h-full object-cover object-center"
                  containerClassName="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-400">No image available</div>
              )}

              {/* Image Counter */}
              {product.images && product.images.length > 0 && (
                <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  {(typeof selectedMedia === 'number' ? selectedMedia + 1 : 1)}/{product.images.length}
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            {((product.images && product.images.length > 0)) && (
              <div className="flex space-x-3 overflow-x-auto hide-scrollbar justify-center sm:justify-start">
                {product.images?.map((img, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedMedia(idx)}
                    className={clsx(
                      "w-20 h-20 shrink-0 rounded-2xl overflow-hidden transition-all border-2 cursor-pointer",
                      selectedMedia === idx ? "border-[#B48538]" : "border-transparent opacity-80 hover:opacity-100"
                    )}
                  >
                    <LazyImage src={img} alt="" className="w-full h-full object-cover" containerClassName="w-full h-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Details */}
          <div className="w-full lg:w-1/2">
            <div className="bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 shadow-sm border border-neutral-100 space-y-6">
              
              {/* Title & Status */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900 mb-2">
                  {product.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-medium text-neutral-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                    <span className="text-[#22C55E]">In Stock</span>
                  </div>
                  <span className="text-neutral-300">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-400">👁️</span>
                    <span>12 people are viewing this right now</span>
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-[#EAB308]">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={16} className={star <= Math.round(product.rating || 4.8) ? "fill-[#EAB308]" : "text-neutral-200 fill-neutral-200"} />
                  ))}
                </div>
                <div className="text-sm font-bold text-neutral-900 ml-1">
                  {product.rating || "4.8"}
                  <span className="text-[#B48538] ml-1 font-medium">({reviewSummary.totalCount || product.reviewsCount || 0} reviews)</span>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-end gap-3 pt-1">
                <span className="text-3xl font-bold text-neutral-900 tracking-tight">{formatPrice(product.price)}</span>
                {product.comparePrice && product.comparePrice > product.price && (
                  <>
                    <span className="text-lg text-neutral-400 line-through mb-1 font-medium">{formatPrice(product.comparePrice)}</span>
                    {discountPct > 0 && (
                      <span className="bg-[#FFF8ED] text-[#B48538] text-xs font-bold px-2.5 py-1 rounded-full mb-1 border border-[#F3E8D6]">
                        SAVE {discountPct}%
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Trust Badges */}
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2 pt-1">
                <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-100 rounded-full px-3 py-1.5 shrink-0">
                  <CheckCircle2 size={14} className="text-neutral-600" />
                  <span className="text-xs font-medium text-neutral-600">100% Original</span>
                </div>
                <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-100 rounded-full px-3 py-1.5 shrink-0">
                  <RotateCcw size={14} className="text-neutral-600" />
                  <span className="text-xs font-medium text-neutral-600">7 Days Return</span>
                </div>
                <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-100 rounded-full px-3 py-1.5 shrink-0">
                  <Truck size={14} className="text-neutral-600" />
                  <span className="text-xs font-medium text-neutral-600">Cash on Delivery</span>
                </div>
              </div>

              <div className="h-px bg-neutral-100 w-full my-4"></div>

              {/* Color Selection */}
              {(product.colorOptions && product.colorOptions.length > 0) ? (
                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="font-bold text-neutral-900">Color: </span>
                    <span className="text-neutral-600">{selectedColor}</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {product.colorOptions.map((color) => {
                      // Map common colors to hex for display
                      const colorMap: Record<string, string> = {
                        'black': '#000000',
                        'white': '#FFFFFF',
                        'blue': '#1E3A8A',
                        'navy': '#1E3A8A',
                        'brown': '#78350F',
                        'olive': '#4D7C0F',
                        'green': '#15803D',
                        'red': '#B91C1C',
                        'gray': '#4B5563',
                      };
                      const hex = colorMap[color.toLowerCase()] || color;
                      
                      return (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={clsx(
                            "w-8 h-8 rounded-full p-0.5 transition-all cursor-pointer flex items-center justify-center",
                            selectedColor === color ? "border-2 border-black" : "border border-transparent"
                          )}
                        >
                          <span 
                            className="w-full h-full rounded-full border border-neutral-200 block"
                            style={{ backgroundColor: hex }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Size Selection */}
              {(product.sizeOptions && product.sizeOptions.length > 0) ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-bold text-neutral-900">Size: </span>
                      <span className="text-neutral-600">{selectedSize}</span>
                    </div>
                    <button onClick={() => setIsSizeModalOpen(true)} className="flex items-center gap-1.5 text-xs font-medium text-[#B48538] hover:underline cursor-pointer">
                      <Ruler size={14} />
                      Size Guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {product.sizeOptions.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={clsx(
                          "min-w-12 h-10 px-3 flex items-center justify-center text-sm font-medium rounded-lg transition-all cursor-pointer",
                          selectedSize === size 
                            ? "border-2 border-[#B48538] text-[#B48538] bg-[#FFF8ED]" 
                            : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Quantity */}
              <div className="pt-2">
                <div className="text-sm font-bold text-neutral-900 mb-3">Quantity</div>
                <div className="flex items-center border border-neutral-200 rounded-lg h-11 w-32 bg-white">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex-1 flex justify-center items-center hover:bg-neutral-50 transition-colors text-lg font-medium text-neutral-600 cursor-pointer h-full"
                  >−</button>
                  <span className="flex-1 text-center font-medium text-sm border-x border-neutral-200 h-full flex items-center justify-center">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(Math.min(product.stockQuantity || 10, quantity + 1))}
                    className="flex-1 flex justify-center items-center hover:bg-neutral-50 transition-colors text-lg font-medium text-neutral-600 cursor-pointer h-full"
                  >+</button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button 
                  onClick={handleAddToCart}
                  disabled={product.stockQuantity === 0}
                  className="w-full bg-white border border-neutral-900 text-neutral-900 rounded-xl py-3.5 text-sm font-bold hover:bg-neutral-50 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag size={18} />
                  Add to Cart
                </button>
                <button 
                  onClick={handleBuyNow}
                  disabled={product.stockQuantity === 0}
                  className="w-full bg-[#B48538] hover:bg-[#9c722e] text-white rounded-xl py-3.5 text-sm font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap size={18} className="fill-white" />
                  Order Now
                </button>
              </div>

              {/* WhatsApp Button */}
              <a 
                href={`https://wa.me/8801700000000?text=Hi%20Rare%20Dreams!%20I'm%20interested%20in%20${encodeURIComponent(product.name)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#F0FDF4] border border-[#DCFCE7] hover:bg-[#DCFCE7] text-[#166534] rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-between px-4 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} className="fill-[#166534]" />
                  <span>Need help? Chat with us on <strong>WhatsApp</strong></span>
                </div>
                <ChevronRight size={16} />
              </a>

              {/* Tabs Section */}
              <div className="pt-6">
                <div className="flex border-b border-neutral-200">
                  <button 
                    onClick={() => setActiveTab('description')}
                    className={clsx(
                      "flex-1 py-3 text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 border-b-2",
                      activeTab === 'description' ? "border-[#B48538] text-[#B48538]" : "border-transparent text-neutral-500 hover:text-neutral-800"
                    )}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Description
                  </button>
                  <button 
                    onClick={() => setActiveTab('contact')}
                    className={clsx(
                      "flex-1 py-3 text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 border-b-2",
                      activeTab === 'contact' ? "border-[#B48538] text-[#B48538]" : "border-transparent text-neutral-500 hover:text-neutral-800"
                    )}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="6.5"></line></svg>
                    Material & Care
                  </button>
                  <button 
                    onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex-1 py-3 text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 border-b-2 border-transparent text-neutral-500 hover:text-neutral-800"
                  >
                    <Star size={16} />
                    Reviews ({reviewSummary.totalCount || product.reviewsCount || 0})
                  </button>
                </div>
                
                <div className="py-4">
                  {activeTab === 'description' ? (
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 flex items-start justify-between cursor-pointer">
                      <p className="text-sm text-neutral-600 leading-relaxed pr-4">
                        {product.description || "This is a premium product. Crafted with high quality materials for maximum comfort and durability."}
                      </p>
                      <ChevronRight size={18} className="text-neutral-400 rotate-90 shrink-0 mt-1" />
                    </div>
                  ) : (
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                      <p className="text-sm text-neutral-600 leading-relaxed">
                        {product.material || "Dry clean only. Do not bleach. Iron on low heat."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Features Section */}
      <div className="border-y border-neutral-200 bg-white py-6 my-8">
        <div className="max-w-7xl mx-auto px-4 w-full">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Truck size={24} strokeWidth={1.5} className="text-neutral-700" />
              <div>
                <div className="text-sm font-bold text-neutral-900">Free Delivery</div>
                <div className="text-xs text-neutral-500">On orders over ৳1499</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck size={24} strokeWidth={1.5} className="text-neutral-700" />
              <div>
                <div className="text-sm font-bold text-neutral-900">Secure Payment</div>
                <div className="text-xs text-neutral-500">100% secure checkout</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RotateCcw size={24} strokeWidth={1.5} className="text-neutral-700" />
              <div>
                <div className="text-sm font-bold text-neutral-900">Easy Return</div>
                <div className="text-xs text-neutral-500">7 days return & refund</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HeadphonesIcon size={24} strokeWidth={1.5} className="text-neutral-700" />
              <div>
                <div className="text-sm font-bold text-neutral-900">24/7 Support</div>
                <div className="text-xs text-neutral-500">We are here to help</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 w-full space-y-12">
        {/* Reviews Section */}
        <div id="reviews-section">
          <ProductReviews 
            productId={product.id} 
            productName={product.name} 
            onRatingUpdate={(avg, count) => setReviewSummary({ avgRating: avg, totalCount: count })}
          />
        </div>

        {/* You May Also Like */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-neutral-900">You May Also Like</h2>
            <button className="text-sm font-bold text-[#B48538] hover:underline cursor-pointer">View All</button>
          </div>
          {loadingRecommended ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <ProductSkeleton key={i} index={i} />
              ))}
            </div>
          ) : recommendedProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recommendedProducts.map((rec, index) => (
                <ProductCard key={rec.id} product={rec} index={index} />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {/* AI SIZE RECOMMENDER MODAL */}
      {isSizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setIsSizeModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="flex items-center space-x-2 text-[#B48538] mb-3">
              <Ruler size={18} />
              <span className="text-sm font-bold uppercase tracking-wider">Size Guide</span>
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Find Your Perfect Size</h3>
            <p className="text-sm text-neutral-500 mb-5">Enter your measurements and let our AI calculate the perfect fit for you.</p>
            
            <form onSubmit={handleGetAiSizeRecommendation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Age *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 25 Years"
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B48538]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Height (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 5 ft 8 in"
                    value={childHeight}
                    onChange={(e) => setChildHeight(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B48538]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1">Weight (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 70 kg"
                    value={childWeight}
                    onChange={(e) => setChildWeight(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#B48538]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={sizeLoading}
                className="w-full bg-[#B48538] hover:bg-[#9c722e] text-white py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2"
              >
                {sizeLoading ? (
                  <><Loader2 size={16} className="animate-spin" /><span>Calculating...</span></>
                ) : (
                  <span>Calculate Recommended Size</span>
                )}
              </button>
            </form>

            {sizeRecommendation && (
              <div className="mt-5 p-4 bg-[#FFF8ED] border border-[#F3E8D6] rounded-xl">
                <div className="flex items-center space-x-2 text-[#B48538] font-bold text-sm mb-1">
                  <CheckCircle2 size={18} />
                  <span>Recommended Size: {sizeRecommendation.size}</span>
                </div>
                <p className="text-sm text-neutral-700">{sizeRecommendation.explanation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
