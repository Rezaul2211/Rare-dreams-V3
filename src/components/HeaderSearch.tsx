import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight, ShoppingBag, Sparkles, Loader2, Tag } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { useCategoryStore } from '../store/useCategoryStore';
import { useLanguageStore, translateCategory } from '../store/useLanguageStore';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderSearchProps {
  variant?: 'desktop' | 'mobile';
  className?: string;
  autoFocus?: boolean;
  onCloseMobileModal?: () => void;
  onSelect?: () => void;
}

export function HeaderSearch({ 
  variant = 'desktop', 
  className = '', 
  autoFocus = false,
  onCloseMobileModal, 
  onSelect 
}: HeaderSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { language, t } = useLanguageStore();

  const handleClose = () => {
    setIsOpen(false);
    if (onCloseMobileModal) onCloseMobileModal();
    if (onSelect) onSelect();
  };

  const fetchProductsForSearch = async () => {
    if (hasFetched) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'products'), where('status', '==', 'published'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Product));
      setProducts(data);
      setHasFetched(true);
    } catch (err) {
      console.error("Error fetching products for search autocomplete", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim().length > 0) {
      setIsOpen(true);
      fetchProductsForSearch();
    } else {
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    fetchProductsForSearch();
    if (searchQuery.trim().length > 0) {
      setIsOpen(true);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    handleClose();
    navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleProductClick = (productId: string) => {
    handleClose();
    setSearchQuery('');
    navigate(`/product/${productId}`);
  };

  const handleCategoryClick = (categoryName: string) => {
    handleClose();
    setSearchQuery('');
    navigate(`/category/${encodeURIComponent(categoryName)}`);
  };

  const term = searchQuery.toLowerCase().trim();
  const filteredProducts = term ? products.filter(p => {
    const nameMatch = p.name?.toLowerCase().includes(term);
    const catMatch = p.category?.toLowerCase().includes(term);
    const subcatMatch = p.subcategory?.toLowerCase().includes(term);
    const descMatch = p.description?.toLowerCase().includes(term);
    return nameMatch || catMatch || subcatMatch || descMatch;
  }) : [];

  const { categories } = useCategoryStore();
  const categoriesList = categories.map(c => c.title);
  const matchedCategories = term ? categoriesList.filter(c => c.toLowerCase().includes(term)) : [];

  return (
    <div ref={searchRef} className={`relative w-full ${className}`}>
      {/* Search Input Container */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
        {variant === 'desktop' ? (
          // DESKTOP: Wide Pill with Search icon left and Blue Round Button right
          <div className="relative flex items-center w-full bg-white hover:bg-neutral-50/80 focus-within:bg-white rounded-full border border-neutral-200/90 focus-within:border-neutral-400 focus-within:shadow-[0_4px_16px_rgba(0,102,255,0.08)] transition-all p-1 pl-4 shadow-2xs">
            <Search size={18} className="text-neutral-400 shrink-0 mr-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleFocus}
              placeholder="Search for products, categories or brands..."
              className="w-full bg-transparent text-neutral-800 placeholder-neutral-400 text-sm font-medium focus:outline-none pr-3"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsOpen(false);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors mr-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}

            {/* Circular Solid Dark Submit Button */}
            <button
              type="submit"
              aria-label="Submit search"
              className="w-10 h-10 rounded-full bg-neutral-900 hover:bg-black active:scale-95 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Search size={18} strokeWidth={2.2} />
            </button>
          </div>
        ) : (
          // MOBILE: Clean Expandable Pill Search Input
          <div className="relative flex items-center w-full bg-white hover:bg-neutral-50/80 focus-within:bg-white rounded-full border border-neutral-300 focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/10 transition-all px-3.5 py-2 shadow-2xs">
            <Search size={17} className="text-neutral-400 shrink-0 mr-2.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              autoFocus={autoFocus}
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleFocus}
              placeholder={language === 'bn' ? 'পণ্য, ক্যাটাগরি বা ব্র্যান্ড খুঁজুন...' : 'Search for products, categories or brands...'}
              className="w-full bg-transparent text-neutral-900 placeholder-neutral-400 text-xs sm:text-sm font-medium focus:outline-none pr-1"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsOpen(false);
                  if (inputRef.current) inputRef.current.focus();
                }}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
                aria-label="Clear Search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </form>

      {/* Auto-Complete Live Search Dropdown Popup */}
      <AnimatePresence>
        {isOpen && term.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl border border-neutral-200/90 overflow-hidden z-50 text-left"
          >
            {loading ? (
              <div className="p-6 text-center text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-center space-x-2">
                <Loader2 size={16} className="animate-spin text-[#0066FF]" />
                <span>{t('common.loading')}</span>
              </div>
            ) : (
              <div className="max-h-[75vh] overflow-y-auto divide-y divide-neutral-100 no-scrollbar">
                {/* Category Pills Header if matched */}
                {matchedCategories.length > 0 && (
                  <div className="p-3 bg-neutral-50/80">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-2 px-1">
                      {t('home.explore_categories')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleCategoryClick(cat)}
                          className="bg-white border border-neutral-200 hover:border-[#0066FF] hover:text-[#0066FF] text-neutral-800 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-1 shadow-2xs"
                        >
                          <Tag size={12} className="text-[#0066FF]" />
                          <span>{translateCategory(cat, language)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Search Results List */}
                <div className="p-2">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      {t('nav.search_results')} ({filteredProducts.length})
                    </span>
                    {filteredProducts.length > 0 && (
                      <span className="text-[10px] font-bold text-[#0066FF] flex items-center gap-1">
                        <Sparkles size={10} /> Instant Results
                      </span>
                    )}
                  </div>

                  {filteredProducts.length > 0 ? (
                    <div className="space-y-1">
                      {filteredProducts.slice(0, 5).map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleProductClick(product.id)}
                          className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-neutral-100/80 cursor-pointer transition-colors group"
                        >
                          {/* Image */}
                          <div className="w-12 h-14 bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200/80 shrink-0">
                            {product.images && product.images.length > 0 ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-300">
                                <ShoppingBag size={18} />
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-neutral-900 truncate group-hover:text-[#0066FF]">
                              {product.name}
                            </h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="text-[10px] font-bold uppercase text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {translateCategory(product.category || '', language)}
                              </span>
                              {product.discount ? (
                                <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  {product.discount}% {t('product.discount')}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Price */}
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-neutral-900">
                              ৳ {product.price}
                            </span>
                            {product.comparePrice && (
                              <span className="block text-[10px] text-neutral-400 line-through">
                                ৳ {product.comparePrice}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center px-4">
                      <p className="text-xs font-bold text-neutral-700">{t('nav.no_results')}</p>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Try searching for shirts, panjabi, dress, footwear or accessories
                      </p>
                    </div>
                  )}
                </div>

                {/* View All Search Results Action */}
                <div className="p-2 bg-neutral-50/90 border-t border-neutral-100 text-center">
                  <button
                    onClick={() => handleSearchSubmit()}
                    className="w-full bg-[#0066FF] hover:bg-[#0052cc] text-white py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    <span>{t('nav.view_all_results')} &ldquo;{searchQuery}&rdquo;</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default HeaderSearch;
