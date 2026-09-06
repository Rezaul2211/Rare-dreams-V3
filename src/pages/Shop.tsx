import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { 
  ArrowLeft, 
  Search, 
  Heart, 
  ShoppingBag, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Check,
  Star,
  Sparkles,
  Percent,
  Flame,
  Award
} from 'lucide-react';
import { ProductSkeleton } from '../components/ProductSkeleton';
import { ProductCard } from '../components/ProductCard';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import SEO from '../components/SEO';
import { usePublishedProducts } from '../hooks/usePublishedProducts';
import { calculateDiscount, matchesCategoryGroup } from '../utils/productUtils';
import { useSubcategoryStore } from '../store/useSubcategoryStore';

// Category & Dynamic Collection Definitions matching user blueprint screenshot exactly
interface CollectionMeta {
  title: string;
  badge?: string;
  subtitle: string;
  bannerBg: string;
  textColor: string;
  badgeColor?: string;
  bannerImage?: string;
  hasDiscountTag?: boolean;
  subcategories: string[];
  defaultItemsCount: number;
  sampleProducts?: Product[];
  defaultSort?: 'popular' | 'newest' | 'price-low' | 'price-high' | 'rating' | 'best-selling' | 'discount-high';
}

const COLLECTIONS_CONFIG: Record<string, CollectionMeta> = {
  'daily-drops': {
    title: 'Daily Drops',
    badge: 'NEW ARRIVALS',
    subtitle: "Fresh styles, added every day.\nDon't miss out!",
    bannerBg: 'bg-[#111113] border border-neutral-800 text-white',
    textColor: 'text-white',
    badgeColor: 'bg-white/10 text-neutral-300 border border-white/15',
    bannerImage: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop',
    subcategories: ['All', 'Clothing', 'Jeans', 'Tees', 'Footwear', 'Streetwear'],
    defaultItemsCount: 24,
    defaultSort: 'newest',
  },
  'most-loved': {
    title: 'Most Loved',
    badge: 'BEST OF OUR COLLECTION',
    subtitle: "Our most loved pieces,\nchosen by you.",
    bannerBg: 'bg-gradient-to-r from-[#ECDAB0] via-[#F8EED7] to-[#E2C78E] border border-[#D1B36C]/40 text-neutral-900',
    textColor: 'text-neutral-950',
    badgeColor: 'bg-neutral-900 text-amber-300',
    bannerImage: 'https://images.unsplash.com/photo-1578269174936-2709b6aeb913?q=80&w=600&auto=format&fit=crop',
    subcategories: ['All', 'Suits', 'Watches', 'Bags', 'Shoes', 'Dresses'],
    defaultItemsCount: 36,
    defaultSort: 'rating',
  },
  'best-sellers': {
    title: 'Best Sellers',
    badge: 'MEGA SAVINGS',
    subtitle: "Top picks loved by thousands.\nGrab yours now!",
    bannerBg: 'bg-gradient-to-r from-[#0A3423] via-[#0F4932] to-[#1B6347] border border-emerald-700/60 text-white',
    textColor: 'text-white',
    badgeColor: 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30',
    bannerImage: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=600&auto=format&fit=crop',
    hasDiscountTag: true,
    subcategories: ['All', 'Bags', 'Dresses', 'Watches', 'Footwear', 'Sale'],
    defaultItemsCount: 36,
    defaultSort: 'popular',
  },
  men: {
    title: "Men's Collection",
    badge: 'EXCLUSIVE FOR MEN',
    subtitle: "Explore our latest collection for men.\nPremium quality, timeless style.",
    bannerBg: 'bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 border border-neutral-700 text-white',
    textColor: 'text-white',
    badgeColor: 'bg-white/10 text-neutral-300 border border-white/20',
    bannerImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=400&q=60&auto=format&fit=crop',
    subcategories: ['All', 'Clothing', 'Shoes', 'Accessories', 'Watches'],
    defaultItemsCount: 50,
  },
  women: {
    title: "Women's Collection",
    subtitle: "Trendy, elegant & comfortable styles\nfor every occasion.",
    bannerBg: 'bg-gradient-to-r from-rose-950 via-neutral-900 to-stone-900',
    textColor: 'text-white',
    badge: "WOMEN'S EDIT",
    badgeColor: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    bannerImage: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&auto=format&fit=crop",
    subcategories: ['All', 'Dresses', 'Tops', 'Bags', 'Shoes', 'Jewelry'],
    defaultItemsCount: 36,
  },
  kids: {
    title: "Kids Collection",
    subtitle: "Stylish, comfortable & playful\nlooks for your little ones.",
    bannerBg: 'bg-gradient-to-r from-sky-950 via-neutral-900 to-indigo-950',
    textColor: 'text-white',
    badge: "KIDS PLAY & PARTY",
    badgeColor: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
    bannerImage: "https://images.unsplash.com/photo-1503945438517-f65904a52ce6?q=80&w=400&auto=format&fit=crop",
    subcategories: ['All', 'Boys', 'Girls', 'Footwear', 'Accessories'],
    defaultItemsCount: 32,
  },
  accessories: {
    title: "Accessories",
    subtitle: "Complete your look with our\npremium accessories.",
    bannerBg: 'bg-gradient-to-r from-emerald-950 via-neutral-900 to-stone-900',
    textColor: 'text-white',
    badge: "PREMIUM FINISHES",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    bannerImage: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&auto=format&fit=crop",
    subcategories: ['All', 'Bags', 'Watches', 'Belts', 'Sunglasses', 'Jewelry'],
    defaultItemsCount: 36,
  },
  all: {
    title: "All Collections",
    badge: "EXCLUSIVE CATALOG",
    subtitle: "Discover our full range of luxury apparel,\nfootwear, and timeless accessories.",
    bannerBg: "bg-gradient-to-r from-neutral-950 via-neutral-900 to-stone-900 border border-neutral-800 text-white",
    textColor: "text-white",
    badgeColor: "bg-white/10 text-neutral-300 border border-white/15",
    bannerImage: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=400&auto=format&fit=crop",
    subcategories: ['All', 'Men', 'Women', 'Kids', 'Accessories'],
    defaultItemsCount: 50,
  }
};

export default function Shop() {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const searchQuery = searchParams.get('search') || searchParams.get('q') || '';
  const wishlistIds = useWishlistStore((state) => state.wishlistIds);
  const cartItems = useCartStore((state) => state.items);

  const wishlistCount = wishlistIds.length;
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  // Active subcategory filter (e.g., 'All', 'Clothing', 'Shoes')
  const [activeSubcat, setActiveSubcat] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'price-low' | 'price-high' | 'rating' | 'newest' | 'discount-high' | 'best-selling'>('popular');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [minRating, setMinRating] = useState<number | null>(null);
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // DB Products and loading state from centralized hook
  const { products: dbProducts, loading } = usePublishedProducts();

  // Resolve collection key based on pathname or route params or query parameters
  const collectionKey = useMemo(() => {
    const path = location.pathname.toLowerCase();
    const filterParam = searchParams.get('filter')?.toLowerCase() || '';
    const collectionParam = searchParams.get('collection')?.toLowerCase() || '';

    if (path.includes('daily-drops') || filterParam === 'new' || collectionParam === 'daily-drops') return 'daily-drops';
    if (path.includes('most-loved') || collectionParam === 'most-loved') return 'most-loved';
    if (path.includes('best-sellers') || filterParam === 'sale' || collectionParam === 'best-sellers') return 'best-sellers';

    if (!category) return 'all';
    const c = category.toLowerCase().trim();
    if (c.includes('daily') || c.includes('drop')) return 'daily-drops';
    if (c.includes('most') || c.includes('loved')) return 'most-loved';
    if (c.includes('best') || c.includes('seller')) return 'best-sellers';
    if (matchesCategoryGroup(c, 'men')) return 'men';
    if (matchesCategoryGroup(c, 'women')) return 'women';
    if (matchesCategoryGroup(c, 'kids')) return 'kids';
    if (matchesCategoryGroup(c, 'accessories')) return 'accessories';
    return 'all';
  }, [category, location.pathname, searchParams]);

  const currentMeta = useMemo(() => {
    if (COLLECTIONS_CONFIG[collectionKey]) {
      return COLLECTIONS_CONFIG[collectionKey];
    }
    return COLLECTIONS_CONFIG.all;
  }, [collectionKey]);

  // Set default sort and reset pagination when collection or category changes
  useEffect(() => {
    setActiveSubcat('All');
    setSelectedCategory('All');
    setCurrentPage(1);
    if (currentMeta.defaultSort) {
      setSortBy(currentMeta.defaultSort);
    }
  }, [collectionKey, category, currentMeta]);

  // Strictly real uploaded products (zero dummy items injected)
  const allCategoryProducts = useMemo(() => {
    let list: Product[] = [];

    // Filter DB products for current category or dynamic collection
    if (dbProducts.length > 0) {
      if (collectionKey === 'all') {
        list = [...dbProducts];
      } else if (collectionKey === 'daily-drops') {
        const filtered = dbProducts.filter(p => p.daily_drop || p.isNew || p.subcategory === 'Streetwear' || matchesCategoryGroup(p.category, 'men') || matchesCategoryGroup(p.category, 'women'));
        list = filtered.length > 0 ? filtered : [...dbProducts];
      } else if (collectionKey === 'most-loved') {
        const filtered = dbProducts.filter(p => p.isMostLoved || (p.rating && p.rating >= 4.7) || (p.stockQuantity && p.stockQuantity > 20));
        list = filtered.length > 0 ? filtered : [...dbProducts];
      } else if (collectionKey === 'best-sellers') {
        const filtered = dbProducts.filter(p => p.isBestSeller || calculateDiscount(p) > 0 || p.isFlashSale || p.mega_sale);
        list = filtered.length > 0 ? filtered : [...dbProducts];
      } else {
        list = dbProducts.filter(p => matchesCategoryGroup(p.category, collectionKey as any));
      }
    }

    return list;
  }, [dbProducts, collectionKey]);

  const { getSubcategories } = useSubcategoryStore();

  const visibleSubcategories = useMemo(() => {
    const subSet = new Set<string>();
    subSet.add('All');

    // Add dynamic subcategories from store if this is a known category
    const catName = collectionKey === 'men' ? 'Men' : collectionKey === 'women' ? 'Women' : collectionKey === 'kids' ? 'Kids' : collectionKey === 'accessories' || collectionKey === 'footwear' ? 'Footwear' : '';
    if (catName) {
      getSubcategories(catName).forEach(s => subSet.add(s));
    }

    // Add subcategories from actual products in catalog
    allCategoryProducts.forEach(p => {
      if (p.subcategory?.trim()) {
        subSet.add(p.subcategory.trim());
      }
    });

    // Fallback to meta subcategories if still just 'All'
    if (subSet.size <= 1 && currentMeta.subcategories) {
      currentMeta.subcategories.forEach(s => subSet.add(s));
    }

    return Array.from(subSet);
  }, [collectionKey, getSubcategories, allCategoryProducts, currentMeta]);

  // Extract all available brands dynamically
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    allCategoryProducts.forEach(p => {
      if (p.brand?.trim()) {
        brandsSet.add(p.brand.trim());
      }
    });
    ['Rare Dreams', 'Zara', 'Gucci', 'Nike', "Levi's", 'H&M'].forEach(b => brandsSet.add(b));
    return Array.from(brandsSet);
  }, [allCategoryProducts]);

  // Extract standard size options
  const availableSizes = useMemo(() => {
    return ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44'];
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (minPrice !== '' || maxPrice !== '') count++;
    if (selectedBrands.length > 0) count += selectedBrands.length;
    if (selectedSizes.length > 0) count += selectedSizes.length;
    if (selectedCategory !== 'All') count++;
    if (minRating !== null) count++;
    if (onlyInStock) count++;
    return count;
  }, [minPrice, maxPrice, selectedBrands, selectedSizes, selectedCategory, minRating, onlyInStock]);

  // Apply Subcategory, Search, Price, Brand, Size, Rating, Stock & Sort filters
  const filteredProducts = useMemo(() => {
    let result = [...allCategoryProducts];

    // 1. Subcategory filter
    if (activeSubcat !== 'All') {
      const subLower = activeSubcat.toLowerCase().trim();
      result = result.filter(p => {
        const pSub = (p.subcategory || '').toLowerCase().trim();
        const pName = (p.name || '').toLowerCase().trim();
        const pCat = (p.category || '').toLowerCase().trim();
        return pSub.includes(subLower) || pName.includes(subLower) || pCat.includes(subLower);
      });
    }

    // 2. Category filter inside drawer
    if (selectedCategory !== 'All') {
      const catLower = selectedCategory.toLowerCase().trim();
      result = result.filter(p => (p.category || '').toLowerCase().includes(catLower));
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(term);
        const catMatch = p.category?.toLowerCase().includes(term);
        const subcatMatch = p.subcategory?.toLowerCase().includes(term);
        const descMatch = p.description?.toLowerCase().includes(term);
        return nameMatch || catMatch || subcatMatch || descMatch;
      });
    }

    // 4. Price Filters
    if (typeof minPrice === 'number' && minPrice > 0) {
      result = result.filter(p => p.price >= minPrice);
    }
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      result = result.filter(p => p.price <= maxPrice);
    }

    // 5. Brand Filter
    if (selectedBrands.length > 0) {
      result = result.filter(p => {
        const pBrand = (p.brand || 'Rare Dreams').toLowerCase().trim();
        const pName = (p.name || '').toLowerCase().trim();
        const pDesc = (p.description || '').toLowerCase().trim();
        return selectedBrands.some(b => {
          const bLower = b.toLowerCase().trim();
          return pBrand === bLower || pName.includes(bLower) || pDesc.includes(bLower);
        });
      });
    }

    // 6. Size Filter
    if (selectedSizes.length > 0) {
      result = result.filter(p => {
        if (p.sizeOptions && Array.isArray(p.sizeOptions) && p.sizeOptions.length > 0) {
          const pSizes = p.sizeOptions.map(s => s.toUpperCase().trim());
          return selectedSizes.some(s => pSizes.includes(s.toUpperCase().trim()));
        }
        // Fallback for sample/lifestyle products
        const text = `${p.name} ${p.description || ''}`.toUpperCase();
        return selectedSizes.some(s => text.includes(s) || ['M', 'L', 'XL'].includes(s));
      });
    }

    // 7. Rating Filter
    if (minRating !== null) {
      result = result.filter(p => (p.rating || 4.5) >= minRating);
    }

    // 8. In stock only
    if (onlyInStock) {
      result = result.filter(p => (p.stockQuantity === undefined || p.stockQuantity > 0));
    }

    // 9. Sorting
    result.sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'rating') return (b.rating || 4.5) - (a.rating || 4.5);
      if (sortBy === 'newest') return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
      if (sortBy === 'discount-high') return calculateDiscount(b) - calculateDiscount(a);
      if (sortBy === 'best-selling') return (b.stockQuantity || 0) - (a.stockQuantity || 0);
      return 0; // Popular / Default
    });

    return result;
  }, [allCategoryProducts, activeSubcat, selectedCategory, searchQuery, minPrice, maxPrice, selectedBrands, selectedSizes, minRating, onlyInStock, sortBy]);

  // Total items display count
  const totalCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  // Current page sliced products
  const displayedProducts = useMemo(() => {
    if (filteredProducts.length <= itemsPerPage) {
      return filteredProducts;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  return (
    <div className="w-full min-h-screen bg-white text-neutral-900 pb-16">
      <SEO 
        title={`${currentMeta.title} | Rare Dreams Luxury Fashion`}
        description={currentMeta.subtitle.replace('\n', ' ')}
        keywords={`${currentMeta.title}, luxury fashion, apparel, collection, Rare Dreams`}
      />

      {/* Main Category Content Container */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 md:px-8 pt-3 sm:pt-4 space-y-3 sm:space-y-4">
        
        {/* 1. SEARCH & FILTER BAR (Embedded iOS Pill Container) */}
        <section className="w-full">
          <div className="relative flex items-center w-full bg-[#F2F2F6] rounded-[22px] p-1.5 pl-3.5 pr-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-black/[0.02]">
            <Search size={17} className="text-neutral-400 shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Search for brands, styles..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setSearchParams({ search: val });
                } else {
                  searchParams.delete('search');
                  searchParams.delete('q');
                  setSearchParams(searchParams);
                }
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs sm:text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  searchParams.delete('search');
                  searchParams.delete('q');
                  setSearchParams(searchParams);
                }}
                className="text-neutral-400 hover:text-neutral-700 p-1 mr-1 cursor-pointer"
                aria-label="Clear Search"
              >
                <X size={14} />
              </button>
            )}

            {/* Embedded iOS Filter Button */}
            <button
              onClick={() => setIsFilterOpen(prev => !prev)}
              aria-label="Filter"
              className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] flex items-center justify-center transition-transform active:scale-95 cursor-pointer shrink-0 shadow-xs ${
                isFilterOpen || activeFilterCount > 0
                  ? 'bg-black text-white'
                  : 'bg-[#18181A] text-white hover:bg-black'
              }`}
            >
              <SlidersHorizontal size={15} strokeWidth={2.2} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-neutral-950 font-black text-[10px] flex items-center justify-center shadow-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </section>

        {/* 3. SUB-CATEGORY FILTER PILLS ROW (Compact & Clean initial screen fit) */}
        {visibleSubcategories && visibleSubcategories.length > 1 && (
          <section className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            {visibleSubcategories.map((subcat) => {
              const isActive = activeSubcat === subcat;
              return (
                <button
                  key={subcat}
                  onClick={() => {
                    setActiveSubcat(subcat);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-2xs ${
                    isActive
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'bg-[#F2F2F6] text-neutral-600 hover:bg-[#EAEAEF] hover:text-neutral-950'
                  }`}
                >
                  {subcat}
                </button>
              );
            })}
          </section>
        )}

        {/* Filter Drawer / Panel (Expandable when Filter button is tapped) */}
        {isFilterOpen && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 sm:p-5 space-y-4 transition-all animate-fadeIn">
            <div className="flex items-center justify-between pb-2.5 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-900">Filter Products</span>
                {activeFilterCount > 0 && (
                  <span className="text-[11px] font-bold text-neutral-500">({activeFilterCount} active)</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setMinPrice('');
                      setMaxPrice('');
                      setSelectedBrands([]);
                      setSelectedSizes([]);
                      setSelectedCategory('All');
                      setMinRating(null);
                      setOnlyInStock(false);
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                  aria-label="Close Filter"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* 1. Price Range Filter */}
              <div className="space-y-2.5">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-neutral-600">Price Range (৳)</label>
                
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Under ৳1,000', min: 0, max: 1000 },
                    { label: '৳1k - ৳2.5k', min: 1000, max: 2500 },
                    { label: '৳2.5k - ৳5k', min: 2500, max: 5000 },
                    { label: '৳5,000+', min: 5000, max: '' },
                  ].map((preset, idx) => {
                    const isSelected = minPrice === preset.min && maxPrice === preset.max;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setMinPrice('');
                            setMaxPrice('');
                          } else {
                            setMinPrice(preset.min);
                            setMaxPrice(preset.max);
                          }
                          setCurrentPage(1);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer border ${
                          isSelected 
                            ? 'bg-neutral-900 text-white border-neutral-900' 
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Min - Max Inputs */}
                <div className="flex items-center space-x-2 pt-1">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-medium">৳</span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => {
                        setMinPrice(e.target.value ? Number(e.target.value) : '');
                        setCurrentPage(1);
                      }}
                      className="w-full bg-white border border-neutral-300 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-neutral-800 outline-none focus:border-neutral-900"
                    />
                  </div>
                  <span className="text-neutral-400 text-xs font-bold">-</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-medium">৳</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => {
                        setMaxPrice(e.target.value ? Number(e.target.value) : '');
                        setCurrentPage(1);
                      }}
                      className="w-full bg-white border border-neutral-300 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-neutral-800 outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Category Filter */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-neutral-600">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {['All', 'Men', 'Women', 'Kids', 'Accessories', 'Streetwear'].map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCurrentPage(1);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Brand Filter */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wide text-neutral-600">Brand</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {availableBrands.map((b) => {
                    const isChecked = selectedBrands.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setSelectedBrands(prev => prev.filter(item => item !== b));
                          } else {
                            setSelectedBrands(prev => [...prev, b]);
                          }
                          setCurrentPage(1);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {isChecked && <Check size={11} strokeWidth={3} />}
                        <span>{b}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Size & Rating Filter & In-stock */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-neutral-600 mb-1.5">Size</label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSizes.map((s) => {
                      const isSelected = selectedSizes.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedSizes(prev => prev.filter(item => item !== s));
                            } else {
                              setSelectedSizes(prev => [...prev, s]);
                            }
                            setCurrentPage(1);
                          }}
                          className={`w-8 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center justify-center ${
                            isSelected
                              ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rating Filter */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-neutral-600 mb-1">Customer Rating</label>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'All', val: null },
                      { label: '4★ & up', val: 4.0 },
                      { label: '4.5★ & up', val: 4.5 },
                    ].map((rate, i) => {
                      const isSelected = minRating === rate.val;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setMinRating(rate.val);
                            setCurrentPage(1);
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded-md font-medium border cursor-pointer ${
                            isSelected 
                              ? 'bg-neutral-900 text-white border-neutral-900' 
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {rate.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* In-Stock Toggle */}
                <div className="flex items-center space-x-2 pt-1 border-t border-neutral-200/80">
                  <input
                    type="checkbox"
                    id="inStockCheck"
                    checked={onlyInStock}
                    onChange={(e) => {
                      setOnlyInStock(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="w-4 h-4 rounded text-black focus:ring-black cursor-pointer accent-neutral-900"
                  />
                  <label htmlFor="inStockCheck" className="text-xs font-semibold text-neutral-800 cursor-pointer">
                    In Stock Only (উপলব্ধ স্টক)
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Pill Bar */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap py-1">
            <span className="text-xs font-medium text-neutral-400 mr-1">Active:</span>
            
            {/* Price Filter Tag */}
            {(minPrice !== '' || maxPrice !== '') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                <span>
                  ৳{minPrice || 0} - ৳{maxPrice || '∞'}
                </span>
                <button
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                  }}
                  className="hover:text-black p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Category Tag */}
            {selectedCategory !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                <span>Category: {selectedCategory}</span>
                <button
                  onClick={() => setSelectedCategory('All')}
                  className="hover:text-black p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Brand Tags */}
            {selectedBrands.map(b => (
              <span key={b} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                <span>Brand: {b}</span>
                <button
                  onClick={() => setSelectedBrands(prev => prev.filter(item => item !== b))}
                  className="hover:text-black p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Size Tags */}
            {selectedSizes.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                <span>Size: {s}</span>
                <button
                  onClick={() => setSelectedSizes(prev => prev.filter(item => item !== s))}
                  className="hover:text-black p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Rating Tag */}
            {minRating !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                <span>Rating: {minRating}★+</span>
                <button
                  onClick={() => setMinRating(null)}
                  className="hover:text-black p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* In Stock Tag */}
            {onlyInStock && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                <span>In Stock Only</span>
                <button
                  onClick={() => setOnlyInStock(false)}
                  className="hover:text-black p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              onClick={() => {
                setMinPrice('');
                setMaxPrice('');
                setSelectedBrands([]);
                setSelectedSizes([]);
                setSelectedCategory('All');
                setMinRating(null);
                setOnlyInStock(false);
              }}
              className="text-xs font-bold text-red-600 hover:underline ml-1 cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}

        {/* 5. 2-COLUMN PRODUCT GRID (Mobile / Responsive) matching screenshot */}
        {loading && displayedProducts.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
            {[...Array(6)].map((_, i) => (
              <ProductSkeleton key={i} index={i} />
            ))}
          </div>
        ) : displayedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
            {displayedProducts.map((product, index) => (
              <div key={product.id || index}>
                <ProductCard product={product} index={index} />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-2xl p-10 text-center border border-neutral-200/80 my-6">
            <h3 className="text-base font-bold uppercase tracking-tight text-neutral-900 mb-1">
              No products found
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Try adjusting your subcategory or filter settings.
            </p>
            <button 
              onClick={() => {
                setActiveSubcat('All');
                setSelectedCategory('All');
                setMinPrice('');
                setMaxPrice('');
                setMinRating(null);
              }}
              className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full hover:bg-neutral-800"
            >
              Show All Products
            </button>
          </div>
        )}

        {/* 6. BOTTOM PAGINATION (Showing 1-8 of X items | < 1 2 3 ... 7 >) */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-8 border-t border-neutral-100 text-xs text-neutral-600">
          {/* Left: Showing count */}
          <div>
            <span>
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} items
            </span>
          </div>

          {/* Right: Page Buttons */}
          <div className="flex items-center space-x-1">
            {/* Prev Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous Page"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                currentPage === 1 
                  ? 'border-neutral-200 text-neutral-300 pointer-events-none' 
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Dynamic Page Numbers */}
            {(() => {
              const maxVisible = 5;
              const pages: (number | string)[] = [];

              if (totalPages <= maxVisible) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push('...');
                
                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);
                
                for (let i = start; i <= end; i++) {
                  if (!pages.includes(i)) pages.push(i);
                }

                if (currentPage < totalPages - 2) pages.push('...');
                if (!pages.includes(totalPages)) pages.push(totalPages);
              }

              return pages.map((page, i) => {
                if (page === '...') {
                  return (
                    <span key={`dots-${i}`} className="px-1 text-neutral-400">
                      ...
                    </span>
                  );
                }

                const isCurrent = page === currentPage;
                return (
                  <button
                    key={`page-${page}`}
                    onClick={() => handlePageChange(page as number)}
                    className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-black text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              });
            })()}

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next Page"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                currentPage === totalPages 
                  ? 'border-neutral-200 text-neutral-300 pointer-events-none' 
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
