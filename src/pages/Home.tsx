import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Truck, 
  RotateCcw, 
  ShieldCheck, 
  CreditCard, 
  Sparkles, 
  Users, 
  Headphones,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { ProductSkeleton } from '../components/ProductSkeleton';
import { DEFAULT_HERO_SLIDES, BannerSlide } from './admin/AdminSettings';
import { useCategoryStore } from '../store/useCategoryStore';
import { useLanguageStore, translateCategory } from '../store/useLanguageStore';
import SEO from '../components/SEO';
import { usePublishedProducts } from '../hooks/usePublishedProducts';
import { matchesCategoryGroup } from '../utils/productUtils';

// Zero dummy showcases: Only real user-uploaded products are displayed
const MEN_SHOWCASE: Product[] = [];
const WOMEN_SHOWCASE: Product[] = [];
const KIDS_SHOWCASE: Product[] = [];
const ACCESSORIES_SHOWCASE: Product[] = [];

interface ProductSectionSliderProps {
  title: string;
  link: string;
  products: Product[];
  loading: boolean;
}

const ProductSectionSlider = React.memo(function ProductSectionSlider({ title, link, products, loading }: ProductSectionSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeDot, setActiveDot] = useState(0);

  const displayProducts = products.length > 0 ? products : [];
  const totalDots = Math.min(5, Math.max(2, Math.ceil(displayProducts.length / 2)));

  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll));
      const idx = Math.min(totalDots - 1, Math.round(progress * (totalDots - 1)));
      setActiveDot(idx);
    }
  }, [totalDots]);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    let timeoutId: any;
    
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        updateScrollState();
        timeoutId = null;
      }, 50); // Throttle to 50ms
    };

    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        el.removeEventListener('scroll', handleScroll);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [displayProducts.length, updateScrollState]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    const scrollAmount = clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }, []);

  const scrollToDot = useCallback((dotIndex: number) => {
    if (!scrollRef.current) return;
    const { scrollWidth, clientWidth } = scrollRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0 && totalDots > 1) {
      const targetScroll = (dotIndex / (totalDots - 1)) * maxScroll;
      scrollRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  }, [totalDots]);

  // If loading has finished and no real products exist for this section, do not render empty section
  if (!loading && displayProducts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-1.5 sm:space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-xl md:text-2xl font-bold font-serif text-neutral-900 tracking-tight">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Previous / Next Chevron Buttons for Desktop / Tablet */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`p-1 rounded-full border border-neutral-200 transition-all ${
                canScrollLeft 
                  ? 'text-neutral-900 hover:bg-neutral-100 active:scale-95 cursor-pointer' 
                  : 'text-neutral-300 opacity-40 cursor-not-allowed'
              }`}
              aria-label="Previous products"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`p-1 rounded-full border border-neutral-200 transition-all ${
                canScrollRight 
                  ? 'text-neutral-900 hover:bg-neutral-100 active:scale-95 cursor-pointer' 
                  : 'text-neutral-300 opacity-40 cursor-not-allowed'
              }`}
              aria-label="Next products"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <Link
            to={link}
            className="text-[11px] sm:text-sm font-bold text-neutral-900 hover:text-black flex items-center gap-1 hover:underline underline-offset-4"
          >
            <span>View All</span>
            <ArrowRight size={12} className="sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>
      </div>

      {loading && displayProducts.length === 0 ? (
        <div className="flex gap-2.5 sm:gap-4 overflow-hidden">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="w-[calc((100%-10px)/2)] sm:w-[calc((100%-42px)/4)] shrink-0">
              <ProductSkeleton index={i} />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-2.5 sm:gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-1 pt-0.5"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y'
          }}
        >
          {displayProducts.map((product, index) => (
            <div 
              key={product.id} 
              className="w-[calc((100%-10px)/2)] sm:w-[calc((100%-42px)/4)] shrink-0 flex flex-col"
            >
              <ProductCard product={product} index={index} />
            </div>
          ))}
        </div>
      )}

      {/* Slider Pagination Dots */}
      <div className="flex justify-center items-center space-x-1.5 pt-0.5">
        {Array.from({ length: totalDots }).map((_, dot) => (
          <button
            key={dot}
            onClick={() => scrollToDot(dot)}
            className={`transition-all rounded-full p-0 border-0 cursor-pointer ${
              dot === activeDot 
                ? 'w-3.5 h-1.5 bg-neutral-900' 
                : 'w-1.5 h-1.5 bg-neutral-300 hover:bg-neutral-400'
            }`}
            aria-label={`Go to slide ${dot + 1}`}
          />
        ))}
      </div>
    </section>
  );
});

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Read instantly from localStorage cache to prevent any 1-second delay / old image flash on initial load
  const [heroSlides, setHeroSlides] = useState<BannerSlide[]>(() => {
    try {
      const cached = localStorage.getItem('rare_dreams_hero_slides');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_HERO_SLIDES;
  });

  const { categories: storeCategories, setCategoriesFromHomepage } = useCategoryStore();
  const { language } = useLanguageStore();
  const { products: allProducts, loading } = usePublishedProducts();

  // Fetch Homepage Customization Settings from Firestore & Cache in localStorage
  useEffect(() => {
    let isMounted = true;

    // Zero-quota server fallback check (runs immediately and works even if Firestore quota exceeded)
    fetch('/api/site-settings')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !data?.success) return;
        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategoriesFromHomepage(data.categories);
        }
        if (data.banners && Array.isArray(data.banners) && data.banners.length > 0) {
          setHeroSlides(data.banners);
          try {
            localStorage.setItem('rare_dreams_hero_slides', JSON.stringify(data.banners));
          } catch {}
        }
      })
      .catch(() => {});

    const fetchHomepageSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'homepage');
        const docSnap = await getDoc(docRef);
        if (isMounted && docSnap.exists()) {
          const data = docSnap.data();

          // Synchronize Categories from Homepage Settings if present
          if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
            setCategoriesFromHomepage(data.categories);
          }

          if (data.banners && Array.isArray(data.banners) && data.banners.length > 0) {
            const legacyUrl1 = 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=2071&auto=format&fit=crop';
            const legacyUrl2 = 'https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2071&auto=format&fit=crop';
            
            const merged = data.banners.map((b: any, idx: number) => {
              const def = DEFAULT_HERO_SLIDES[idx] || DEFAULT_HERO_SLIDES[0];
              const isOldUnsplash = b.image === legacyUrl1 || b.image === legacyUrl2;
              const finalImage = (!b.image || isOldUnsplash) ? def.image : b.image;

              const isBadText = b.title === 'New Season Collection' || b.title === 'Winter Essentials' || b.tag === 'NEW COLLECTION 2025' || (b.title === 'Redefine Your' && b.tag === 'NEW COLLECTION 2025');

              return {
                ...def,
                ...b,
                image: finalImage,
                title: isBadText ? def.title : (b.title || def.title),
                titleAccent: isBadText ? def.titleAccent : (b.titleAccent || def.titleAccent),
                subtitle: isBadText ? def.subtitle : (b.subtitle || def.subtitle),
                tag: isBadText ? def.tag : (b.tag || def.tag),
                theme: b.theme || def.theme,
                tagColor: b.tagColor || def.tagColor,
                titleColor: b.titleColor || def.titleColor,
                accentColor: b.accentColor || def.accentColor,
                subtitleColor: b.subtitleColor || def.subtitleColor,
                buttonBg: b.buttonBg || def.buttonBg,
                buttonText: b.buttonText || def.buttonText,
              };
            });

            setHeroSlides(merged);
            try {
              localStorage.setItem('rare_dreams_hero_slides', JSON.stringify(merged));
            } catch {}
          }
        }
      } catch {
        // Use current / cached hero slides
      }
    };
    fetchHomepageSettings();
    return () => { isMounted = false; };
  }, [setCategoriesFromHomepage]);

  // Auto-slide timer for Hero Slider
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Filter products by category (strictly authentic uploaded products)
  const menProducts = React.useMemo(() => {
    return allProducts.filter(p => matchesCategoryGroup(p.category, 'men'));
  }, [allProducts]);

  const womenProducts = React.useMemo(() => {
    return allProducts.filter(p => matchesCategoryGroup(p.category, 'women'));
  }, [allProducts]);

  const kidsProducts = React.useMemo(() => {
    return allProducts.filter(p => matchesCategoryGroup(p.category, 'kids'));
  }, [allProducts]);

  const footwearProducts = React.useMemo(() => {
    return allProducts.filter(p => matchesCategoryGroup(p.category, 'footwear'));
  }, [allProducts]);

  // 4 Main Categories (Men, Women, Kids, Footwear)
  const displayCategories = React.useMemo(() => {
    if (storeCategories && storeCategories.length > 0) {
      return storeCategories.slice(0, 4);
    }
    try {
      const cached = localStorage.getItem('rare_dreams_categories');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 4);
        }
      }
    } catch {}
    return [
      { id: '1', title: 'Men', link: '/category/Men', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=400&q=60&auto=format&fit=crop' },
      { id: '2', title: 'Women', link: '/category/Women', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&q=60&auto=format&fit=crop' },
      { id: '3', title: 'Kids', link: '/category/Kids', image: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?q=80&w=400&q=60&auto=format&fit=crop' },
      { id: '4', title: 'Footwear', link: '/category/Footwear', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=400&q=60&auto=format&fit=crop' },
    ];
  }, [storeCategories]);

  return (
    <div className="w-full min-h-screen bg-[#FAFAFA] text-neutral-900 pb-16">
      <SEO 
        title="Rare Dreams | Luxury Fashion & Designer Apparel"
        description="Elevate your everyday style with timeless looks and premium quality luxury fashion."
        keywords="Rare Dreams, luxury fashion, men clothing, women dresses, kids, designer footwear"
      />

      <main className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 pt-1.5 sm:pt-3 space-y-4 sm:space-y-6">

        {/* 1. HERO SLIDER BANNER (Soft Pastel Editorial Luxury Aesthetic with 3 Slides) */}
        <section 
          aria-label="Hero Carousel"
          className="relative w-full aspect-[2/1] xs:aspect-[2.2/1] sm:aspect-[21/9] md:aspect-[24/9] rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-r from-[#FCE8E2] via-[#FCECE8] to-[#FBE8E1] shadow-2xs"
        >
          {heroSlides.map((slide, index) => {
            const isActive = index === currentSlide;
            return (
              <div
                key={slide.id || index}
                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                  isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {/* Background / Model Visual */}
                <div className="absolute right-0 top-0 bottom-0 w-[55%] sm:w-[50%] h-full overflow-hidden">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    loading={index === 0 ? "eager" : "lazy"}
                    className="w-full h-full object-cover object-center transform scale-100 hover:scale-102 transition-transform duration-1000"
                  />
                  {/* Smooth soft gradient blend on the left edge */}
                  <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#FCE8E2] to-transparent pointer-events-none" />
                </div>

                {/* Banner Editorial Content */}
                <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-10 md:px-14 z-20 max-w-[65%] xs:max-w-[60%] sm:max-w-[55%] md:max-w-[50%]">
                  {/* Top Crisp Badge */}
                  <div className="mb-1.5 sm:mb-2.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-md sm:rounded-lg bg-white/95 text-neutral-900 text-[8.5px] xs:text-[9.5px] sm:text-xs font-bold shadow-xs border border-neutral-200/80 tracking-wide uppercase">
                      {slide.tag || 'New in'}
                    </span>
                  </div>
                  
                  <h1 className="text-base xs:text-lg sm:text-3xl md:text-4xl font-extrabold text-neutral-900 leading-[1.15] mb-1 sm:mb-2.5 tracking-tight font-serif">
                    {slide.title}
                    {slide.titleAccent && (
                      <span className="block font-normal text-xs xs:text-sm sm:text-2xl text-neutral-700 mt-0.5">
                        {slide.titleAccent}
                      </span>
                    )}
                  </h1>

                  {slide.subtitle && (
                    <p className="text-[9.5px] xs:text-[11px] sm:text-sm text-neutral-600 font-normal mb-2.5 sm:mb-4 leading-relaxed line-clamp-2">
                      {slide.subtitle}
                    </p>
                  )}

                  <div className="pt-0.5">
                    <Link
                      to={slide.link || '/shop'}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 sm:px-6 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-bold bg-neutral-950 text-white hover:bg-neutral-800 active:scale-95 transition-all shadow-xs"
                    >
                      <span>Shop Now</span>
                      <ArrowRight size={11} className="sm:w-3.5 sm:h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Hero Slider Pagination Dots */}
          <div className="absolute bottom-2 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-1.5">
            {heroSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentSlide === idx
                    ? 'w-4 h-1 bg-neutral-900 shadow-xs'
                    : 'w-1 h-1 bg-neutral-400/60 hover:bg-neutral-600'
                }`}
              />
            ))}
          </div>
        </section>

        {/* 2. 4 CATEGORY CARDS (Perfect 4-Grid Balanced Sizing without Blank Space) */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm sm:text-lg font-bold text-neutral-900 tracking-tight">Category</h2>
            <Link to="/shop" className="text-xs font-semibold text-neutral-500 hover:text-black transition-colors">
              See all
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:gap-4 w-full">
            {displayCategories.map((cat) => (
              <Link
                key={cat.id || cat.title}
                to={cat.link || `/category/${cat.title}`}
                className="group flex flex-col items-center w-full text-center"
              >
                <div className="w-full aspect-square rounded-2xl bg-[#F5F5F8] border border-neutral-200/80 p-1.5 sm:p-2.5 flex items-center justify-center overflow-hidden shadow-2xs group-hover:shadow-md group-hover:scale-103 transition-all duration-300">
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=400&auto=format&fit=crop';
                      }}
                      className="w-full h-full object-cover object-top rounded-xl group-hover:scale-108 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-neutral-200/70 flex items-center justify-center text-xs font-bold text-neutral-500">
                      {cat.title}
                    </div>
                  )}
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-neutral-800 mt-1.5 group-hover:text-black truncate w-full">
                  {cat.title}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 3. PRODUCT SHOWCASE SECTIONS (2-Card Responsive Grid Slider) */}
        {/* Trending Now Slider (Strictly authentic uploaded products) */}
        {(loading || allProducts.length > 0) && (
          <ProductSectionSlider
            title="Trending Now"
            link="/shop"
            products={allProducts.slice(0, 8)}
            loading={loading}
          />
        )}

        {/* Men's Collection Slider */}
        {(loading || menProducts.length > 0) && (
          <ProductSectionSlider
            title="Men's Collection"
            link="/category/Men"
            products={menProducts}
            loading={loading}
          />
        )}

        {/* Women's Collection Slider */}
        {(loading || womenProducts.length > 0) && (
          <ProductSectionSlider
            title="Women's Collection"
            link="/category/Women"
            products={womenProducts}
            loading={loading}
          />
        )}

        {/* Kids Collection Slider */}
        {(loading || kidsProducts.length > 0) && (
          <ProductSectionSlider
            title="Kids Collection"
            link="/category/Kids"
            products={kidsProducts}
            loading={loading}
          />
        )}

        {/* Footwear Slider */}
        {(loading || footwearProducts.length > 0) && (
          <ProductSectionSlider
            title="Footwear"
            link="/category/Footwear"
            products={footwearProducts}
            loading={loading}
          />
        )}

      </main>
    </div>
  );
}
