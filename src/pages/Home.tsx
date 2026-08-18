import React, { useState, useEffect, useRef } from 'react';
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

// Pristine showcase items matching the reference blueprint screenshot exactly
const MEN_SHOWCASE: Product[] = [
  {
    id: 'men-suit-1',
    name: 'Classic Suit Jacket',
    category: 'Men',
    subcategory: 'Clothing',
    price: 4900,
    comparePrice: 6790,
    discount: 28,
    stockQuantity: 25,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Tailored luxury suit jacket crafted with refined fabric.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'men-shoes-2',
    name: 'Oxford Shoes',
    category: 'Men',
    subcategory: 'Shoes',
    price: 1360,
    comparePrice: 1560,
    discount: 14,
    stockQuantity: 30,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Classic genuine leather handcrafted Oxford shoes.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'men-denim-3',
    name: 'Premium Denim Jacket',
    category: 'Men',
    subcategory: 'Clothing',
    price: 2240,
    comparePrice: 2800,
    discount: 20,
    stockQuantity: 20,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1516257984-b1b4d707412e?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Timeless vintage wash premium denim jacket.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'men-watch-4',
    name: 'Luxury Watch',
    category: 'Men',
    subcategory: 'Watches',
    price: 3650,
    comparePrice: 4450,
    discount: 18,
    stockQuantity: 15,
    rating: 4.9,
    images: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Precision chronograph timepiece with stainless steel band.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'men-polo-5',
    name: 'Slim-Fit Cotton Polo',
    category: 'Men',
    subcategory: 'Clothing',
    price: 1150,
    comparePrice: 1450,
    discount: 20,
    stockQuantity: 22,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Breathable pique knit slim-fit polo with ribbed collar.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'men-sunglasses-6',
    name: 'Aviator Dark Shades',
    category: 'Men',
    subcategory: 'Accessories',
    price: 950,
    comparePrice: 1200,
    discount: 21,
    stockQuantity: 28,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'UV400 polarized classic gunmetal aviator sunglasses.',
    createdAt: new Date(),
    status: 'published'
  }
];

const WOMEN_SHOWCASE: Product[] = [
  {
    id: 'women-bag-1',
    name: 'Elegant Shoulder Bag',
    category: 'Women',
    subcategory: 'Bags',
    price: 1490,
    comparePrice: 2190,
    discount: 32,
    stockQuantity: 20,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Luxurious designer shoulder bag with golden hardware chain.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'women-dress-2',
    name: 'Premium Maxi Dress',
    category: 'Women',
    subcategory: 'Dresses',
    price: 1890,
    comparePrice: 2250,
    discount: 16,
    stockQuantity: 18,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Flowing silky evening maxi dress for special occasions.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'women-floral-3',
    name: 'Floral Summer Dress',
    category: 'Women',
    subcategory: 'Dresses',
    price: 1650,
    comparePrice: 2200,
    discount: 25,
    stockQuantity: 24,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Lightweight breathable cotton floral printed daytime dress.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'women-pinkbag-4',
    name: 'Chic Pink Handbag',
    category: 'Women',
    subcategory: 'Bags',
    price: 1280,
    comparePrice: 1600,
    discount: 20,
    stockQuantity: 16,
    rating: 4.9,
    images: ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Chic structured pastel pink crossbody leather handbag.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'women-heels-5',
    name: 'Velvet Stiletto Heels',
    category: 'Women',
    subcategory: 'Shoes',
    price: 2100,
    comparePrice: 2600,
    discount: 19,
    stockQuantity: 15,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Classic pointed-toe stiletto heels crafted with premium velvet.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'women-scarf-6',
    name: 'Silk Patterned Scarf',
    category: 'Women',
    subcategory: 'Accessories',
    price: 650,
    comparePrice: 850,
    discount: 23,
    stockQuantity: 30,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1601924994987-69e26d50dc26?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Pure Mulberry silk floral patterned lightweight neck scarf.',
    createdAt: new Date(),
    status: 'published'
  }
];

const KIDS_SHOWCASE: Product[] = [
  {
    id: 'kids-shirt-1',
    name: 'Boys Casual Shirt',
    category: 'Kids',
    subcategory: 'Boys',
    price: 890,
    comparePrice: 1120,
    discount: 20,
    stockQuantity: 30,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1503945438517-f65904a52ce6?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Soft 100% cotton casual button-up shirt for boys.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'kids-dress-2',
    name: 'Girls Party Dress',
    category: 'Kids',
    subcategory: 'Girls',
    price: 1250,
    comparePrice: 1470,
    discount: 15,
    stockQuantity: 25,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1621452773781-0f992fd1f5cb?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Sparkling tulle party frock with soft satin waistband.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'kids-sneakers-3',
    name: 'Kids Sneakers',
    category: 'Kids',
    subcategory: 'Footwear',
    price: 990,
    comparePrice: 1200,
    discount: 18,
    stockQuantity: 35,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Lightweight cushioned athletic sneakers with easy velcro strap.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'kids-backpack-4',
    name: 'Kids Backpack',
    category: 'Kids',
    subcategory: 'Accessories',
    price: 890,
    comparePrice: 990,
    discount: 10,
    stockQuantity: 28,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Playful waterproof backpack with cushioned straps.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'kids-hoodie-5',
    name: 'Cozy Fleece Hoodie',
    category: 'Kids',
    subcategory: 'Clothing',
    price: 1050,
    comparePrice: 1350,
    discount: 22,
    stockQuantity: 20,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Super-soft combed cotton fleece hoodie for everyday warmth.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'kids-sandals-6',
    name: 'Summer Strap Sandals',
    category: 'Kids',
    subcategory: 'Footwear',
    price: 750,
    comparePrice: 950,
    discount: 21,
    stockQuantity: 24,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Flexible non-slip rubber sole summer sandals.',
    createdAt: new Date(),
    status: 'published'
  }
];

const ACCESSORIES_SHOWCASE: Product[] = [
  {
    id: 'acc-bag-1',
    name: 'Premium Handbag',
    category: 'Accessories',
    subcategory: 'Bags',
    price: 1890,
    comparePrice: 2390,
    discount: 21,
    stockQuantity: 25,
    rating: 4.9,
    images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Handcrafted luxury leather handbag with polished brass accents.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'acc-watch-2',
    name: 'Classic Watch',
    category: 'Accessories',
    subcategory: 'Watches',
    price: 3650,
    comparePrice: 4450,
    discount: 18,
    stockQuantity: 20,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Rose-gold trimmed quartz timepiece with dark brown leather strap.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'acc-sunglasses-3',
    name: 'Sunglasses',
    category: 'Accessories',
    subcategory: 'Sunglasses',
    price: 890,
    comparePrice: 1190,
    discount: 25,
    stockQuantity: 40,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Polarized UV400 classic aviator sunglasses.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'acc-belt-4',
    name: 'Leather Belt',
    category: 'Accessories',
    subcategory: 'Belts',
    price: 650,
    comparePrice: 850,
    discount: 21,
    stockQuantity: 30,
    rating: 4.6,
    images: ['https://images.unsplash.com/photo-1624222247344-550fb60583dc?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Genuine full-grain cowhide leather belt with antique buckle.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'acc-wallet-5',
    name: 'Bifold Leather Wallet',
    category: 'Accessories',
    subcategory: 'Wallets',
    price: 790,
    comparePrice: 990,
    discount: 20,
    stockQuantity: 35,
    rating: 4.8,
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=400&q=60&auto=format&fit=crop'],
    description: 'Slim RFID blocking genuine leather bifold wallet.',
    createdAt: new Date(),
    status: 'published'
  },
  {
    id: 'acc-cap-6',
    name: 'Embroidered Baseball Cap',
    category: 'Accessories',
    subcategory: 'Hats',
    price: 490,
    comparePrice: 650,
    discount: 25,
    stockQuantity: 40,
    rating: 4.7,
    images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=400&q=60&auto=format&fit=crop'],
    description: '100% cotton adjustable curved brim dad cap with custom embroidery.',
    createdAt: new Date(),
    status: 'published'
  }
];

interface ProductSectionSliderProps {
  title: string;
  link: string;
  products: Product[];
  loading: boolean;
}

function ProductSectionSlider({ title, link, products, loading }: ProductSectionSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeDot, setActiveDot] = useState(0);

  const displayProducts = products.length > 0 ? products : [];
  const totalDots = Math.min(5, Math.max(2, Math.ceil(displayProducts.length / 2)));

  const updateScrollState = () => {
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
  };

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
  }, [displayProducts.length, totalDots]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    const scrollAmount = clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const scrollToDot = (dotIndex: number) => {
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
  };

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

      {loading ? (
        <div className="flex gap-1.5 sm:gap-3.5 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[calc((100%-18px)/4)] sm:w-[calc((100%-42px)/4)] shrink-0">
              <ProductSkeleton index={i} />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-1.5 sm:gap-3.5 overflow-x-auto scrollbar-none scroll-smooth pb-1 pt-0.5"
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
              className="w-[calc((100%-18px)/4)] sm:w-[calc((100%-42px)/4)] shrink-0 flex flex-col"
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
}

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

  const { categories: storeCategories } = useCategoryStore();
  const { language } = useLanguageStore();
  const { products: allProducts, loading } = usePublishedProducts();

  // Fetch Homepage Customization Settings from Firestore & Cache in localStorage
  useEffect(() => {
    let isMounted = true;
    const fetchHomepageSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'homepage');
        const docSnap = await getDoc(docRef);
        if (isMounted && docSnap.exists()) {
          const data = docSnap.data();
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
  }, []);

  // Auto-slide timer for Hero Slider
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Filter products by category or fall back to showcase items
  const menProducts = React.useMemo(() => {
    const matched = allProducts.filter(p => matchesCategoryGroup(p.category, 'men'));
    return matched.length > 0 ? matched : MEN_SHOWCASE;
  }, [allProducts]);

  const womenProducts = React.useMemo(() => {
    const matched = allProducts.filter(p => matchesCategoryGroup(p.category, 'women'));
    return matched.length > 0 ? matched : WOMEN_SHOWCASE;
  }, [allProducts]);

  const kidsProducts = React.useMemo(() => {
    const matched = allProducts.filter(p => matchesCategoryGroup(p.category, 'kids'));
    return matched.length > 0 ? matched : KIDS_SHOWCASE;
  }, [allProducts]);

  const accessoriesProducts = React.useMemo(() => {
    const matched = allProducts.filter(p => matchesCategoryGroup(p.category, 'accessories'));
    return matched.length > 0 ? matched : ACCESSORIES_SHOWCASE;
  }, [allProducts]);

  // 4 Main Categories (Men, Women, Kids, Accessories)
  const displayCategories = React.useMemo(() => {
    if (storeCategories && storeCategories.length > 0) {
      return storeCategories.slice(0, 4);
    }
    return [
      { id: '1', title: 'Men', link: '/category/Men', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=400&q=60&auto=format&fit=crop' },
      { id: '2', title: 'Women', link: '/category/Women', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&q=60&auto=format&fit=crop' },
      { id: '3', title: 'Kids', link: '/category/Kids', image: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?q=80&w=400&q=60&auto=format&fit=crop' },
      { id: '4', title: 'Accessories', link: '/category/Accessories', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=400&q=60&auto=format&fit=crop' },
    ];
  }, [storeCategories]);

  return (
    <div className="w-full min-h-screen bg-[#FAFAFA] text-neutral-900 pb-16">
      <SEO 
        title="Rare Dreams | Luxury Fashion & Designer Apparel"
        description="Elevate your everyday style with timeless looks and premium quality luxury fashion."
        keywords="Rare Dreams, luxury fashion, men clothing, women dresses, kids, designer accessories"
      />

      <main className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 pt-1.5 sm:pt-3 space-y-3.5 sm:space-y-6">

        {/* 1. HERO SLIDER BANNER (Sleek Horizontal Widescreen, Silk Smooth Crossfade) */}
        <section 
          aria-label="Hero Carousel"
          className="relative w-full aspect-[2.1/1] xs:aspect-[2.3/1] sm:aspect-[21/9] md:aspect-[24/9] rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-900 shadow-sm"
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
                {/* Background Image */}
                <img
                  src={slide.image}
                  alt={slide.title}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="w-full h-full object-cover object-center transform scale-100 hover:scale-102 transition-transform duration-1000"
                />

                {/* Ultra Crisp Transparent Gradient Overlay */}
                <div 
                  className={`absolute inset-0 ${
                    slide.theme === 'pink'
                      ? 'bg-gradient-to-r from-[#FFF5F6]/85 via-[#FFF5F6]/40 to-transparent'
                      : slide.theme === 'olive'
                      ? 'bg-gradient-to-r from-[#F7FAF6]/85 via-[#F7FAF6]/40 to-transparent'
                      : 'bg-gradient-to-r from-black/75 via-black/35 to-transparent'
                  }`}
                />

                {/* Banner Content */}
                <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-10 md:px-14 z-20 max-w-[65%] xs:max-w-[60%] sm:max-w-[55%] md:max-w-[50%]">
                  {slide.tag && (
                    <div className="flex flex-col items-start mb-1.5 sm:mb-3">
                      <span 
                        className="text-[9px] xs:text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase block leading-none"
                        style={{ color: slide.tagColor || (slide.theme === 'dark' ? '#C69A4C' : '#1C1917') }}
                      >
                        {slide.tag}
                      </span>
                      <div 
                        className="w-6 sm:w-8 h-[1.5px] mt-1 sm:mt-2 opacity-85"
                        style={{ backgroundColor: slide.tagColor || (slide.theme === 'dark' ? '#C69A4C' : '#1C1917') }}
                      />
                    </div>
                  )}
                  
                  <h1 
                    className="text-xl xs:text-2xl sm:text-4xl md:text-5xl font-bold font-serif leading-[1.1] mb-1.5 sm:mb-4 tracking-tight"
                    style={{ color: slide.titleColor || (slide.theme === 'dark' ? '#FFFFFF' : '#1C1917') }}
                  >
                    {slide.title}
                    {slide.titleAccent && (
                      <span 
                        className="block font-normal mt-0.5 sm:mt-1"
                        style={{ color: slide.accentColor || (slide.theme === 'dark' ? '#C69A4C' : '#556B4E') }}
                      >
                        {slide.titleAccent}
                      </span>
                    )}
                  </h1>

                  {slide.subtitle && (
                    <p 
                      className="text-[10px] xs:text-[11px] sm:text-sm md:text-base font-normal mb-2.5 sm:mb-5 leading-relaxed whitespace-pre-line block"
                      style={{ color: slide.subtitleColor || (slide.theme === 'dark' ? '#D4D4D8' : '#4A5545') }}
                    >
                      {slide.subtitle}
                    </p>
                  )}

                  <div className="pt-0.5 sm:pt-2">
                    <Link
                      to={slide.link || '/shop'}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 xs:px-5 xs:py-2 sm:px-8 sm:py-3 rounded-full text-[10px] xs:text-[11px] sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: slide.buttonBg || '#FFFFFF',
                        color: slide.buttonText || '#000000',
                      }}
                    >
                      <span>SHOP NOW</span>
                      <ArrowRight size={12} className="sm:w-4 sm:h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Hero Slider Pagination Dots */}
          <div className="absolute bottom-1.5 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-1.5">
            {heroSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentSlide === idx
                    ? 'w-4 h-1 bg-white shadow-xs'
                    : 'w-1 h-1 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </section>

        {/* 2. VALUE PROPOSITION STRIP (4 Items in 1 Single Horizontal Row) */}
        <section className="bg-white rounded-lg sm:rounded-xl border border-neutral-200/80 p-1.5 sm:p-2.5 shadow-2xs">
          <div className="grid grid-cols-4 gap-1 sm:gap-2.5 divide-x divide-neutral-100">
            {/* 1. Free Delivery */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 px-0.5 sm:px-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#FFF8EE] text-[#C69A4C] flex items-center justify-center shrink-0">
                <Truck size={11} className="sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 leading-none">
                <h4 className="text-[7.5px] xs:text-[9px] sm:text-xs font-bold text-neutral-900 leading-tight truncate">Free Delivery</h4>
                <p className="text-[6px] xs:text-[7.5px] sm:text-[10px] text-neutral-500 leading-tight mt-0.5 truncate">Over ৳999</p>
              </div>
            </div>

            {/* 2. Easy Returns */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 px-0.5 sm:px-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#FFF8EE] text-[#C69A4C] flex items-center justify-center shrink-0">
                <RotateCcw size={11} className="sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 leading-none">
                <h4 className="text-[7.5px] xs:text-[9px] sm:text-xs font-bold text-neutral-900 leading-tight truncate">Easy Returns</h4>
                <p className="text-[6px] xs:text-[7.5px] sm:text-[10px] text-neutral-500 leading-tight mt-0.5 truncate">14 days return</p>
              </div>
            </div>

            {/* 3. 100% Authentic */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 px-0.5 sm:px-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#FFF8EE] text-[#C69A4C] flex items-center justify-center shrink-0">
                <ShieldCheck size={11} className="sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 leading-none">
                <h4 className="text-[7.5px] xs:text-[9px] sm:text-xs font-bold text-neutral-900 leading-tight truncate">100% Authentic</h4>
                <p className="text-[6px] xs:text-[7.5px] sm:text-[10px] text-neutral-500 leading-tight mt-0.5 truncate">Premium quality</p>
              </div>
            </div>

            {/* 4. Secure Payment */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 px-0.5 sm:px-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#FFF8EE] text-[#C69A4C] flex items-center justify-center shrink-0">
                <CreditCard size={11} className="sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 leading-none">
                <h4 className="text-[7.5px] xs:text-[9px] sm:text-xs font-bold text-neutral-900 leading-tight truncate">Secure Pay</h4>
                <p className="text-[6px] xs:text-[7.5px] sm:text-[10px] text-neutral-500 leading-tight mt-0.5 truncate">100% secure</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 4 INDIVIDUAL CATEGORY CARDS (Men, Women, Kids, Accessories) */}
        <section className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
          {displayCategories.map((cat) => (
            <Link
              key={cat.id || cat.title}
              to={cat.link || `/category/${cat.title}`}
              className="group flex items-center space-x-1 sm:space-x-2 p-1 sm:p-2 bg-white rounded-lg sm:rounded-xl border border-neutral-200/80 shadow-2xs hover:border-black/30 hover:shadow-xs transition-all"
            >
              <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-9 sm:h-9 rounded-full overflow-hidden shrink-0 border border-neutral-200 shadow-2xs group-hover:border-black transition-colors">
                <img
                  src={cat.image}
                  alt={cat.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="min-w-0 leading-none">
                <h3 className="text-[8.5px] xs:text-[10px] sm:text-xs font-bold text-neutral-900 leading-tight group-hover:text-black truncate">
                  {cat.title}
                </h3>
                <span className="text-[6.5px] xs:text-[8px] sm:text-[9.5px] text-neutral-400 font-medium leading-none block mt-0.5">
                  Explore
                </span>
              </div>
            </Link>
          ))}
        </section>

        {/* 4. MEN'S COLLECTION SECTION (Slidable Left & Right Horizontal Product Carousel) */}
        <ProductSectionSlider
          title="Men's Collection"
          link="/category/Men"
          products={menProducts}
          loading={loading}
        />

        {/* 5. WOMEN'S COLLECTION SECTION (Slidable Left & Right Horizontal Product Carousel) */}
        <ProductSectionSlider
          title="Women's Collection"
          link="/category/Women"
          products={womenProducts}
          loading={loading}
        />

        {/* 6. PROMOTIONAL BENTO 3-CARD GRID (Daily Drops, Most Loved, Up to 50% Off) */}
        <section className="grid grid-cols-3 gap-1 sm:gap-2.5">
          {/* Bento Card 1: Daily Drops */}
          <Link
            to="/daily-drops"
            className="group relative rounded-md sm:rounded-lg overflow-hidden bg-neutral-950 px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between shadow-2xs min-h-[48px] xs:min-h-[54px] sm:min-h-[66px] hover:shadow-xs transition-all"
          >
            <div className="relative z-10 min-w-0 pr-1 flex flex-col justify-center">
              <span className="text-[6px] xs:text-[7px] sm:text-[8px] font-bold text-[#C69A4C] tracking-wider uppercase block leading-none">NEW ARRIVALS</span>
              <h3 className="text-[9.5px] xs:text-[10.5px] sm:text-xs font-bold font-serif text-white leading-tight mt-0.5">Daily Drops</h3>
              <span className="inline-flex items-center gap-0.5 text-[7px] xs:text-[8px] sm:text-[10px] font-semibold text-[#C69A4C] group-hover:underline underline-offset-2 mt-0.5 leading-none">
                Shop Now <ArrowRight size={8} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-9 sm:h-9 shrink-0 relative rounded overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400&auto=format&fit=crop"
                alt="Daily Drops"
                className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
              />
            </div>
          </Link>

          {/* Bento Card 2: Most Loved */}
          <Link
            to="/most-loved"
            className="group relative rounded-md sm:rounded-lg overflow-hidden bg-gradient-to-br from-[#F6E7CF] to-[#EBD2AA] px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between shadow-2xs min-h-[48px] xs:min-h-[54px] sm:min-h-[66px] hover:shadow-xs transition-all"
          >
            <div className="relative z-10 min-w-0 pr-1 flex flex-col justify-center">
              <span className="text-[6px] xs:text-[7px] sm:text-[8px] font-bold text-[#6D4C13] tracking-wider uppercase block leading-none">BEST SELLERS</span>
              <h3 className="text-[9.5px] xs:text-[10.5px] sm:text-xs font-bold font-serif text-neutral-900 leading-tight mt-0.5">Most Loved</h3>
              <span className="inline-flex items-center gap-0.5 text-[7px] xs:text-[8px] sm:text-[10px] font-semibold text-neutral-900 group-hover:underline underline-offset-2 mt-0.5 leading-none">
                Explore Now <ArrowRight size={8} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center text-sm xs:text-base sm:text-xl drop-shadow-xs">
              🏆
            </div>
          </Link>

          {/* Bento Card 3: Up to 50% Off / Best Sellers */}
          <Link
            to="/best-sellers"
            className="group relative rounded-md sm:rounded-lg overflow-hidden bg-gradient-to-br from-[#162419] to-[#1F2F23] px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between shadow-2xs min-h-[48px] xs:min-h-[54px] sm:min-h-[66px] hover:shadow-xs transition-all"
          >
            <div className="relative z-10 min-w-0 pr-1 flex flex-col justify-center">
              <span className="text-[6px] xs:text-[7px] sm:text-[8px] font-bold text-[#C69A4C] tracking-wider uppercase block leading-none">MEGA SALE</span>
              <h3 className="text-[9.5px] xs:text-[10.5px] sm:text-xs font-bold font-serif text-white leading-tight mt-0.5">Up to 50% Off</h3>
              <span className="inline-flex items-center gap-0.5 text-[7px] xs:text-[8px] sm:text-[10px] font-semibold text-[#C69A4C] group-hover:underline underline-offset-2 mt-0.5 leading-none">
                Shop Now <ArrowRight size={8} className="group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
            <div className="w-6 h-6 xs:w-7 xs:h-7 sm:w-9 sm:h-9 shrink-0 relative rounded overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&auto=format&fit=crop"
                alt="Mega Sale"
                className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
              />
              <div className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[6px] sm:text-[7.5px] font-extrabold px-0.5 py-0.1 rounded-full shadow-xs">
                %
              </div>
            </div>
          </Link>
        </section>

        {/* 7. KIDS COLLECTION SECTION (Slidable Left & Right Horizontal Product Carousel) */}
        <ProductSectionSlider
          title="Kids Collection"
          link="/category/Kids"
          products={kidsProducts}
          loading={loading}
        />

        {/* 8. ACCESSORIES COLLECTION SECTION (Slidable Left & Right Horizontal Product Carousel) */}
        <ProductSectionSlider
          title="Accessories"
          link="/category/Accessories"
          products={accessoriesProducts}
          loading={loading}
        />

      </main>
    </div>
  );
}
