import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  User, 
  ChevronDown, 
  ChevronLeft,
  Search,
  Home, 
  Grid, 
  Heart,
  ShieldCheck, 
  X,
  ArrowRight,
  Menu,
  Truck
} from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCategoryStore } from '../store/useCategoryStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { FlyToCartProvider, useFlyToCart } from '../context/FlyToCartContext';
import { HeaderSearch } from './HeaderSearch';
import Footer from './Footer';
import WhatsAppSupportWidget from './WhatsAppSupportWidget';
import PushNotificationPrompt from './PushNotificationPrompt';
import Logo from './Logo';
import PullToRefresh from './PullToRefresh';

// Navigation Subcategory Structure
interface NavCategoryConfig {
  name: string;
  path: string;
  isSale?: boolean;
  subcategories?: { title: string; link: string; isHot?: boolean }[];
}

const DESKTOP_NAV_ITEMS: NavCategoryConfig[] = [
  {
    name: 'New In',
    path: '/shop?filter=new',
  },
  {
    name: 'Women',
    path: '/category/Women',
    subcategories: [
      { title: 'All Women Collection', link: '/category/Women' },
      { title: 'Dresses & Gowns', link: '/shop?category=Women&sub=dresses', isHot: true },
      { title: 'Sarees & Traditional', link: '/shop?category=Women&sub=sarees' },
      { title: 'Kurtis & Salwar Sets', link: '/shop?category=Women&sub=kurtis' },
      { title: 'Abayas & Hijabs', link: '/shop?category=Women&sub=abayas' },
      { title: 'Tops & T-Shirts', link: '/shop?category=Women&sub=tops' },
      { title: 'Footwear & Heels', link: '/shop?category=Women&sub=footwear' },
      { title: 'Handbags & Clutches', link: '/shop?category=Women&sub=bags' },
    ]
  },
  {
    name: 'Men',
    path: '/category/Men',
    subcategories: [
      { title: 'All Men Collection', link: '/category/Men' },
      { title: 'Premium Panjabi & Kurta', link: '/shop?category=Men&sub=panjabi', isHot: true },
      { title: 'Casual & Formal Shirts', link: '/shop?category=Men&sub=shirts' },
      { title: 'Polo & Graphic T-Shirts', link: '/shop?category=Men&sub=tshirts' },
      { title: 'Trousers & Chinos', link: '/shop?category=Men&sub=pants' },
      { title: 'Blazers & Outerwear', link: '/shop?category=Men&sub=blazers' },
      { title: 'Footwear & Loafers', link: '/shop?category=Men&sub=shoes' },
    ]
  },
  {
    name: 'Kids',
    path: '/category/Kids',
    subcategories: [
      { title: 'All Kids Collection', link: '/category/Kids' },
      { title: 'Boys Clothing', link: '/shop?category=Kids&sub=boys', isHot: true },
      { title: 'Girls Frocks & Dresses', link: '/shop?category=Kids&sub=girls' },
      { title: 'Baby & Toddler Wear', link: '/shop?category=Kids&sub=baby' },
      { title: 'Traditional Festive Wear', link: '/shop?category=Kids&sub=traditional' },
      { title: 'Kids Footwear', link: '/shop?category=Kids&sub=shoes' },
    ]
  },
  {
    name: 'Footwear',
    path: '/category/Footwear',
    subcategories: [
      { title: 'All Footwear', link: '/category/Footwear' },
      { title: 'Sneakers & Sports', link: '/shop?category=Footwear&sub=sneakers', isHot: true },
      { title: 'Formal Shoes & Loafers', link: '/shop?category=Footwear&sub=formal' },
      { title: 'Casual & Sandal', link: '/shop?category=Footwear&sub=sandals' },
      { title: 'Boots & Slippers', link: '/shop?category=Footwear&sub=boots' },
    ]
  },
  {
    name: 'Brands',
    path: '/shop',
  },
  {
    name: 'Sale',
    path: '/shop?filter=sale',
    isSale: true,
  }
];

function LayoutInner() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const items = useCartStore((state) => state.items);
  const user = useAuthStore((state) => state.user);
  const { wishlistIds } = useWishlistStore();
  const { fetchCategories } = useCategoryStore();
  const { config, fetchConfig } = useStoreConfigStore();
  const { t } = useLanguageStore();

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const location = useLocation();
  const { isCartBouncing } = useFlyToCart();
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  // Smart Auto-Hide Scroll Header
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Automatically collapse search & close menu when navigating to a new page
  useEffect(() => {
    setIsMobileSearchExpanded(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Smart Scroll Header: Throttled with RAF, only triggers state update on actual change
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        // Keep header visible if mobile search is open or mobile drawer is open
        if (isMobileMenuOpen || isMobileSearchExpanded) {
          setIsHeaderVisible(true);
          lastScrollY.current = currentScrollY;
          ticking = false;
          return;
        }

        // Always show when near the very top of page
        if (currentScrollY <= 30) {
          setIsHeaderVisible((prev) => (prev ? prev : true));
        } else if (currentScrollY > lastScrollY.current + 12) {
          // Scrolling down -> smoothly hide header
          setIsHeaderVisible((prev) => (!prev ? prev : false));
        } else if (currentScrollY < lastScrollY.current - 12) {
          // Scrolling up -> smoothly reveal header
          setIsHeaderVisible((prev) => (prev ? prev : true));
        }

        lastScrollY.current = currentScrollY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileMenuOpen, isMobileSearchExpanded]);

  // Smart Search Visibility Logic:
  // Hide full-width search bar on focused transactional and utility pages (Checkout, Cart, Account, Login, Admin, etc.)
  const hideSearchBar = 
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/cart') ||
    location.pathname.startsWith('/account') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/order-success') ||
    location.pathname.startsWith('/terms') ||
    location.pathname.startsWith('/privacy') ||
    location.pathname.startsWith('/contact') ||
    location.pathname.startsWith('/returns');

  const isCheckoutPage = location.pathname.startsWith('/checkout');
  const isCategoryOrShopPage = location.pathname.startsWith('/category') || location.pathname.startsWith('/shop');

  useEffect(() => {
    fetchCategories();
    fetchConfig();
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  const handleMouseEnter = useCallback((name: string) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setActiveDropdown(name);
  }, []);

  const handleMouseLeave = useCallback(() => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] font-sans text-neutral-900 pb-16 md:pb-0">
      {/* ========================================================= */}
      {/* HEADER: SMART STICKY WITH HIGH PERFORMANCE LIGHTWEIGHT STYLING */}
      {/* ========================================================= */}
      <header className={`sticky top-0 z-40 bg-white/95 border-b border-neutral-200/80 shadow-2xs transition-transform duration-300 ease-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          
          {/* ----------------- MOBILE HEADER ----------------- */}
          <div className="md:hidden py-2.5">
            <AnimatePresence mode="wait" initial={false}>
              {isMobileSearchExpanded ? (
                /* 2 & 3. EXPANDED / TYPING STATE (Search Bar Full Width with Back button) */
                <motion.div 
                  key="mobile-search-expanded"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="flex items-center gap-2 h-11 w-full"
                >
                  {/* Left: Back Button (<) to Collapse Search */}
                  <button 
                    onClick={() => setIsMobileSearchExpanded(false)}
                    className="p-1.5 -ml-1 text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer shrink-0"
                    aria-label="Back to normal header"
                  >
                    <ChevronLeft size={26} strokeWidth={2.4} className="text-neutral-900" />
                  </button>

                  {/* Center: Full Width Search Input */}
                  <div className="flex-1 min-w-0">
                    <HeaderSearch 
                      variant="mobile" 
                      autoFocus={true}
                      onCloseMobileModal={() => setIsMobileSearchExpanded(false)} 
                    />
                  </div>

                  {/* Right: Shopping Bag in website color with item count badge */}
                  <Link 
                    id="header-cart-icon-mobile"
                    to="/cart" 
                    onClick={scrollToTop}
                    className={`p-1.5 -mr-1 relative text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all shrink-0 ${
                      isCartBouncing ? 'scale-125' : ''
                    }`}
                    aria-label="Cart"
                  >
                    <div className="relative inline-flex items-center justify-center">
                      <ShoppingBag size={24} strokeWidth={2} className="text-neutral-900" />
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-neutral-900 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                        {itemCount}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ) : (
                /* 1 & 4. NORMAL / COLLAPSED STATE (Menu | Centered Logo | Search + Bag) */
                <motion.div 
                  key="mobile-header-normal"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="flex items-center justify-between h-11 w-full"
                >
                  {/* Left: 3-Line Dark Menu Icon */}
                  <button 
                    className="p-2 -ml-1 text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                    onClick={() => setIsMobileMenuOpen(prev => !prev)}
                    aria-label="Toggle Navigation Menu"
                  >
                    {isMobileMenuOpen ? (
                      <X size={26} strokeWidth={2.4} className="text-neutral-900" />
                    ) : (
                      <Menu size={26} strokeWidth={2.4} className="text-neutral-900" />
                    )}
                  </button>

                  {/* Center: Brand Logo centered perfectly */}
                  <Link 
                    to="/" 
                    onClick={scrollToTop}
                    className="flex items-center justify-center hover:opacity-95 transition-opacity px-2"
                    aria-label="Rare Dreams Home"
                  >
                    <Logo size="md" />
                  </Link>

                  {/* Right: Search Icon + Shopping Bag Icon */}
                  <div className="flex items-center space-x-3 -mr-1">
                    {/* Search Trigger Button */}
                    <button 
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsMobileSearchExpanded(true);
                      }}
                      className="p-1.5 text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                      aria-label="Search"
                    >
                      <Search size={24} strokeWidth={2.2} className="text-neutral-900" />
                    </button>

                    {/* Shopping Bag in website color with item count badge */}
                    <Link 
                      id="header-cart-icon-mobile"
                      to="/cart" 
                      onClick={scrollToTop}
                      className={`p-1.5 relative text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all ${
                        isCartBouncing ? 'scale-125' : ''
                      }`}
                      aria-label="Cart"
                    >
                      <div className="relative inline-flex items-center justify-center">
                        <ShoppingBag size={24} strokeWidth={2} className="text-neutral-900" />
                        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-neutral-900 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                          {itemCount}
                        </span>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {/* ---------------- DESKTOP HEADER ---------------- */}
          <div className="hidden md:block">
            {/* Top Main Row: Logo | Separator | Wide Search | User & Cart */}
            <div className="flex items-center justify-between py-3.5 gap-6">
              {/* Left: Dynamic Brand Logo & Vertical Divider */}
              <div className="flex items-center shrink-0">
                <Link 
                  to="/" 
                  onClick={scrollToTop}
                  className="hover:opacity-95 transition-opacity py-0.5"
                  aria-label="Rare Dreams"
                >
                  <Logo size="lg" />
                </Link>

                {/* Vertical Divider */}
                <div className="h-8 w-[1px] bg-neutral-200/90 ml-6 mr-1" />
              </div>

              {/* Center: Wide Search Pill Bar or Checkout Banner */}
              <div className="flex-1 max-w-2xl px-2">
                {isCheckoutPage ? (
                  <div className="flex items-center justify-center space-x-2 py-2 px-4 rounded-full bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                    <span>🔒 Fast & 100% Secure Checkout</span>
                  </div>
                ) : (
                  <HeaderSearch variant="desktop" />
                )}
              </div>

              {/* Right Action Icons: User Profile & Shopping Bag */}
              <div className="flex items-center space-x-6 shrink-0">
                {/* User / Account Icon */}
                <Link 
                  to={user ? '/account' : '/login'} 
                  className="text-neutral-800 hover:text-black p-1.5 rounded-full hover:bg-neutral-100 transition-colors flex items-center justify-center"
                  aria-label="Account"
                >
                  <User size={25} strokeWidth={2} />
                </Link>

                {/* Shopping Bag with Dark Badge */}
                <Link 
                  id="header-cart-icon"
                  to="/cart" 
                  onClick={scrollToTop}
                  className={`relative text-neutral-800 hover:text-black p-1.5 rounded-full hover:bg-neutral-100 transition-all ${
                    isCartBouncing ? 'scale-125 ring-2 ring-neutral-900' : ''
                  }`}
                  aria-label="Cart"
                >
                  <div className="relative inline-flex items-center justify-center">
                    <ShoppingBag size={25} strokeWidth={2} />
                    <span className="absolute -top-1.5 -right-2.5 min-w-[19px] h-[19px] px-1 bg-neutral-900 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                      {itemCount}
                    </span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Bottom Sub-Navigation Bar */}
            <div className="border-t border-[#F0F3F8] py-2.5 flex justify-center items-center space-x-8 lg:space-x-10 text-sm font-semibold text-neutral-800 relative">
              {DESKTOP_NAV_ITEMS.map((item) => {
                const hasSub = item.subcategories && item.subcategories.length > 0;
                const isSale = item.isSale;
                const isHovered = activeDropdown === item.name;

                return (
                  <div
                    key={item.name}
                    className="relative py-1"
                    onMouseEnter={() => hasSub && handleMouseEnter(item.name)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <Link
                      to={item.path}
                      onClick={scrollToTop}
                      className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isSale 
                          ? 'text-[#E53E3E] font-bold hover:text-red-700' 
                          : isHovered 
                          ? 'text-black font-bold' 
                          : 'text-neutral-700 hover:text-black'
                      }`}
                    >
                      <span>{item.name}</span>
                      {hasSub && (
                        <ChevronDown 
                          size={14} 
                          className={`transition-transform duration-200 ${isHovered ? 'rotate-180 text-black' : 'text-neutral-400'}`} 
                        />
                      )}
                    </Link>

                    {/* Subcategories Dropdown Card */}
                    {hasSub && isHovered && (
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                        onMouseEnter={() => handleMouseEnter(item.name)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="py-1">
                          {item.subcategories?.map((sub) => (
                            <Link
                              key={sub.title}
                              to={sub.link}
                              onClick={() => {
                                setActiveDropdown(null);
                                scrollToTop();
                              }}
                              className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-700 hover:text-black hover:bg-neutral-50 transition-colors"
                            >
                              <span>{sub.title}</span>
                              {sub.isHot && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">
                                  HOT
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </header>

      {/* ----------------- MOBILE NAVIGATION SLIDE-OVER DRAWER (RENDERED VIA PORTAL FOR ZERO CLIPPING) ----------------- */}
      {typeof document !== 'undefined' && document.body && createPortal(
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-[995] md:hidden">
              {/* Semi-transparent Backdrop: Clicking anywhere outside on the page closes the drawer */}
              <motion.div
                key="mobile-drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
                aria-hidden="true"
              />

              {/* Slide-over Drawer from the Left */}
              <motion.div
                key="mobile-drawer-content"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white shadow-2xl flex flex-col overflow-hidden z-10"
              >
                {/* Drawer Top Header: Logo & Close Button */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-white">
                  <Link 
                    to="/" 
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      scrollToTop();
                    }}
                    className="flex items-center"
                  >
                    <Logo size="sm" />
                  </Link>

                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Close menu"
                  >
                    <X size={20} strokeWidth={2.2} />
                  </button>
                </div>

                {/* Drawer Quick Search */}
                <div className="px-4 pt-3 pb-1">
                  <HeaderSearch variant="mobile" onSelect={() => setIsMobileMenuOpen(false)} />
                </div>

                {/* Drawer Nav Items - Scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 divide-y divide-neutral-100">
                  <div className="space-y-1 pb-2">
                    {/* 1. Explicit HOME Link (Requested by User) */}
                    <Link
                      to="/"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        scrollToTop();
                      }}
                      className={`flex items-center space-x-3 py-3 px-3.5 text-sm font-black rounded-xl transition-all ${
                        location.pathname === '/' 
                          ? 'bg-neutral-900 text-white shadow-xs' 
                          : 'text-neutral-900 hover:bg-neutral-100'
                      }`}
                    >
                      <Home size={18} strokeWidth={2.4} />
                      <span>Home (হোম)</span>
                    </Link>

                    {/* 2. All Categories & Navigation Items */}
                    {DESKTOP_NAV_ITEMS.map((navItem) => {
                      const hasSub = navItem.subcategories && navItem.subcategories.length > 0;
                      const isExpanded = activeDropdown === navItem.name;

                      return (
                        <div key={navItem.name} className="space-y-1">
                          <div className="flex items-center justify-between rounded-xl hover:bg-neutral-50 transition-colors">
                            <Link
                              to={navItem.path}
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                scrollToTop();
                              }}
                              className={`flex-1 py-3 px-3 text-sm font-bold flex items-center justify-between ${
                                navItem.isSale ? 'text-[#E53E3E]' : 'text-neutral-900'
                              }`}
                            >
                              <span>{navItem.name}</span>
                              {navItem.isSale && (
                                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black uppercase">
                                  HOT
                                </span>
                              )}
                            </Link>

                            {hasSub && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(isExpanded ? null : navItem.name);
                                }}
                                className="p-3 text-neutral-400 hover:text-neutral-900 cursor-pointer"
                                aria-label="Toggle subcategories"
                              >
                                <ChevronDown
                                  size={18}
                                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-black' : ''}`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Subcategories Accordion in Mobile */}
                          {hasSub && isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pl-4 pr-2 py-1 space-y-1 bg-neutral-50 rounded-xl"
                            >
                              {navItem.subcategories?.map((sub) => (
                                <Link
                                  key={sub.title}
                                  to={sub.link}
                                  onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    scrollToTop();
                                  }}
                                  className="flex items-center justify-between py-2 px-3 text-xs font-semibold text-neutral-700 hover:text-black rounded-lg transition-colors"
                                >
                                  <span>{sub.title}</span>
                                  {sub.isHot && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-600">
                                      HOT
                                    </span>
                                  )}
                                </Link>
                              ))}
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Account, Wishlist, Order Tracking & Admin Section */}
                  <div className="pt-3 space-y-1.5">
                    <Link 
                      to="/track-order" 
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-neutral-800 bg-neutral-100/70 hover:bg-neutral-100 rounded-xl transition-colors" 
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        scrollToTop();
                      }}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Truck size={16} className="text-neutral-700" />
                        <span>Track Order (অর্ডার ট্র্যাক)</span>
                      </div>
                      <ArrowRight size={14} className="text-neutral-400" />
                    </Link>

                    <Link 
                      to="/cart" 
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-neutral-800 hover:bg-neutral-50 rounded-xl transition-colors" 
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        scrollToTop();
                      }}
                    >
                      <div className="flex items-center space-x-2.5">
                        <ShoppingBag size={16} className="text-neutral-600" />
                        <span>Shopping Bag ({itemCount})</span>
                      </div>
                      <ArrowRight size={14} className="text-neutral-400" />
                    </Link>

                    {user?.role === 'admin' && (
                      <Link 
                        to="/admin" 
                        className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors" 
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div className="flex items-center space-x-2.5">
                          <ShieldCheck size={16} className="text-amber-600" />
                          <span>{t('nav.admin')}</span>
                        </div>
                        <span className="text-[9px] bg-amber-600 text-white px-2 py-0.5 rounded-md font-black">ADMIN</span>
                      </Link>
                    )}

                    <Link 
                      to={user ? '/account' : '/login'} 
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-neutral-800 hover:bg-neutral-50 rounded-xl transition-colors" 
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <div className="flex items-center space-x-2.5">
                        <User size={16} className="text-neutral-600" />
                        <span>{user ? t('nav.account') : t('nav.login')}</span>
                      </div>
                      <ArrowRight size={14} className="text-neutral-400" />
                    </Link>
                  </div>
                </div>

                {/* Drawer Footer Info */}
                <div className="p-4 bg-neutral-50 border-t border-neutral-100 text-xs text-neutral-500 space-y-1">
                  <p className="font-semibold text-neutral-700">Need Help?</p>
                  <p className="text-[11px]">Call: {config.helplineNumber || '01954710343'}</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Main Content with Smooth Page Transitions & Pull-to-Refresh */}
      <main className="flex-grow flex flex-col min-h-[85vh] relative">
        <PullToRefresh>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
              transition={{ 
                duration: 0.36, 
                ease: [0.16, 1, 0.3, 1] 
              }}
              className="flex-grow flex flex-col w-full min-h-[85vh]"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </PullToRefresh>
      </main>

      {/* Footer (hidden on Admin pages for clean workspace) */}
      {!location.pathname.startsWith('/admin') && <Footer />}

      {/* Floating WhatsApp Support Widget (hidden on Admin pages) */}
      {!location.pathname.startsWith('/admin') && <WhatsAppSupportWidget />}

      {/* Background Push Notification Opt-in Prompt */}
      {!location.pathname.startsWith('/admin') && <PushNotificationPrompt />}

      {/* Floating Lightweight Mobile Bottom Navigation (Hidden on Checkout, Product Detail, and Admin pages) */}
      {!location.pathname.startsWith('/checkout') && !location.pathname.startsWith('/product') && !location.pathname.startsWith('/admin') && typeof document !== 'undefined' && document.body && createPortal(
        <nav 
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[990] pointer-events-auto"
        >
          <div className="bg-white/95 border border-neutral-200/90 shadow-lg rounded-[26px] p-1.5 flex items-center gap-2 xs:gap-3 justify-around min-w-[260px]">
            {/* 1. Home */}
            {(() => {
              const isActive = location.pathname === '/';
              return (
                <Link
                  to="/"
                  onClick={scrollToTop}
                  aria-label="Home"
                  className="relative w-11 h-11 flex items-center justify-center rounded-[16px] transition-transform active:scale-90"
                >
                  {isActive && (
                    <motion.div 
                      layoutId="mobileNavActivePill" 
                      className="absolute inset-0 bg-[#18181A] rounded-[16px] shadow-sm z-0"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <Home 
                    size={20} 
                    className={`relative z-10 transition-colors duration-200 ${
                      isActive ? 'text-white stroke-[2.2]' : 'text-neutral-800 hover:text-black stroke-[2]'
                    }`} 
                  />
                </Link>
              );
            })()}

            {/* 2. Shop / Explore */}
            {(() => {
              const isActive = location.pathname.startsWith('/shop') || location.pathname.startsWith('/category') || location.pathname.startsWith('/collection') || location.pathname.startsWith('/daily-drops') || location.pathname.startsWith('/most-loved') || location.pathname.startsWith('/best-sellers');
              return (
                <Link
                  to="/shop"
                  onClick={scrollToTop}
                  aria-label="Explore Shop"
                  className="relative w-11 h-11 flex items-center justify-center rounded-[16px] transition-transform active:scale-90"
                >
                  {isActive && (
                    <motion.div 
                      layoutId="mobileNavActivePill" 
                      className="absolute inset-0 bg-[#18181A] rounded-[16px] shadow-sm z-0"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <Grid 
                    size={20} 
                    className={`relative z-10 transition-colors duration-200 ${
                      isActive ? 'text-white stroke-[2.2]' : 'text-neutral-800 hover:text-black stroke-[2]'
                    }`} 
                  />
                </Link>
              );
            })()}

            {/* 3. Cart */}
            {(() => {
              const isActive = location.pathname === '/cart';
              return (
                <Link
                  id="mobile-cart-icon"
                  to="/cart"
                  onClick={scrollToTop}
                  aria-label="Cart"
                  className={`relative w-11 h-11 flex items-center justify-center rounded-[16px] transition-transform active:scale-90 ${isCartBouncing ? 'scale-115' : ''}`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="mobileNavActivePill" 
                      className="absolute inset-0 bg-[#18181A] rounded-[16px] shadow-sm z-0"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <ShoppingBag 
                    size={20} 
                    className={`relative z-10 transition-colors duration-200 ${
                      isActive ? 'text-white stroke-[2.2]' : 'text-neutral-800 hover:text-black stroke-[2]'
                    }`} 
                  />
                  {itemCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 z-20 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 text-[9px] font-black rounded-full shadow-xs ${
                      isActive ? 'bg-white text-neutral-950 ring-1 ring-neutral-200' : 'bg-neutral-900 text-white'
                    }`}>
                      {itemCount}
                    </span>
                  )}
                </Link>
              );
            })()}

            {/* 4. Account */}
            {(() => {
              const isActive = location.pathname.startsWith('/account') || location.pathname.startsWith('/login');
              return (
                <Link
                  to={user ? '/account' : '/login'}
                  onClick={scrollToTop}
                  aria-label="Account"
                  className="relative w-11 h-11 flex items-center justify-center rounded-[16px] transition-transform active:scale-90"
                >
                  {isActive && (
                    <motion.div 
                      layoutId="mobileNavActivePill" 
                      className="absolute inset-0 bg-[#18181A] rounded-[16px] shadow-sm z-0"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <User 
                    size={20} 
                    className={`relative z-10 transition-colors duration-200 ${
                      isActive ? 'text-white stroke-[2.2]' : 'text-neutral-800 hover:text-black stroke-[2]'
                    }`} 
                  />
                </Link>
              );
            })()}
          </div>
        </nav>,
        document.body
      )}
    </div>
  );
}

export default function Layout() {
  return (
    <FlyToCartProvider>
      <LayoutInner />
    </FlyToCartProvider>
  );
}
