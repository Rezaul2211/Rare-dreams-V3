import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import { useFlyToCart } from '../context/FlyToCartContext';
import { useLanguageStore } from '../store/useLanguageStore';
import { usePriceAlertStore } from '../store/usePriceAlertStore';
import { Order, AddressItem, PaymentMethodItem, Product } from '../types';
import { fetchPublishedProducts } from '../hooks/usePublishedProducts';
import { 
  User as UserIcon, 
  MapPin, 
  CreditCard, 
  Star, 
  Heart, 
  Ticket, 
  Headphones, 
  ShieldCheck, 
  Store,
  Receipt,
  Camera, 
  Pencil, 
  Truck, 
  Clock, 
  RefreshCw, 
  CheckSquare, 
  XCircle, 
  ChevronRight,
  LogOut,
  ShoppingBag,
  Plus,
  Trash2,
  Check,
  Send,
  X,
  Settings as SettingsIcon,
  HelpCircle,
  ShoppingBasket,
  Globe,
  Bell,
  BellRing
} from 'lucide-react';

interface ReviewItem {
  id: string;
  productName: string;
  rating: number;
  comment: string;
  date: string;
}

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop",
];

const INITIAL_COUPONS = [
  { code: 'RARE10', discount: '10% OFF', description: 'Applicable on all luxury items above ৳1,000', expiry: '31 Dec 2026' },
  { code: 'FREESHIP', discount: 'FREE SHIPPING', description: 'Free nationwide delivery on orders over ৳2,000', expiry: '30 Nov 2026' },
  { code: 'WELCOME20', discount: '20% OFF', description: 'First order special welcome discount voucher', expiry: '15 Oct 2026' },
];

export default function Account() {
  const { user, logout, updateUserProfile } = useAuthStore();
  const { items: cartItems } = useCartStore();
  const { wishlistIds, toggleWishlist } = useWishlistStore();
  const { animateAddToCart } = useFlyToCart();
  const { language, setLanguage } = useLanguageStore();
  const { alerts, fetchUserAlerts, unsubscribeFromPriceDrop } = usePriceAlertStore();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [totalProductCount, setTotalProductCount] = useState<number>(6);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loadingWishlist, setLoadingWishlist] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Form States
  const [profileName, setProfileName] = useState(user?.displayName || 'Rezaul karim');
  const [profilePhone, setProfilePhone] = useState(user?.phoneNumber || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.photoURL || '');

  // Address Form State
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPostal, setAddrPostal] = useState('');
  const [addrDefault, setAddrDefault] = useState(false);

  // Payment Form State
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [payType, setPayType] = useState<'bKash' | 'Nagad' | 'Card' | 'Bank'>('bKash');
  const [payNumber, setPayNumber] = useState('');
  const [payName, setPayName] = useState('');
  const [payDefault, setPayDefault] = useState(false);

  // Reviews State
  const [reviews] = useState<ReviewItem[]>([
    {
      id: 'rev-1',
      productName: 'Premium Velvet Blazer',
      rating: 5,
      comment: 'Absolutely stunning fabric quality and fitting! Delivered in just 2 days.',
      date: 'Aug 04, 2026'
    }
  ]);

  // Support Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'support'; text: string; time: string }>>([
    { sender: 'support', text: 'Hello! Welcome to Rare Dreams Support. How can we assist you today?', time: 'Just now' }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Synchronously load profile & recently viewed items (0ms Instant render)
  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || 'Rezaul karim');
      setProfilePhone(user.phoneNumber || '');
      setProfilePhoto(user.photoURL || '');
    }

    // Load recently viewed items from localStorage
    try {
      const rawRv = localStorage.getItem('rare_dreams_recently_viewed');
      if (rawRv) {
        setRecentlyViewed(JSON.parse(rawRv));
      }
    } catch (e) {
      console.error("Error reading recently viewed items", e);
    }

    // Background asynchronous fetch for live order & product counts
    const fetchBackgroundStats = async () => {
      try {
        if (user?.uid) {
          const qOrders = query(
            collection(db, 'orders'),
            where('userId', '==', user.uid)
          );
          const ordersSnapshot = await getDocs(qOrders);
          const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
          setOrders(ordersData);
        }

        // Use fast cached product list rather than unconstrained full collection scan
        try {
          const prods = await fetchPublishedProducts();
          if (prods && prods.length > 0) {
            setTotalProductCount(prods.length);
          }
        } catch {
          // Non-critical background stat
        }
      } catch (err) {
        console.error("Error fetching background stats:", err);
      }
    };

    fetchBackgroundStats();
  }, [user]);

  // Fetch Wishlist products from Firestore when wishlistIds changes
  useEffect(() => {
    let isMounted = true;
    const fetchWishlistProducts = async () => {
      if (!wishlistIds || wishlistIds.length === 0) {
        if (isMounted) setWishlistProducts([]);
        return;
      }
      if (isMounted) setLoadingWishlist(true);
      try {
        const prods = await Promise.all(
          wishlistIds.map(async (id) => {
            try {
              const docSnap = await getDoc(doc(db, 'products', id));
              if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Product;
              }
            } catch (e) {
              console.error("Error fetching wishlist product", id, e);
            }
            return null;
          })
        );
        if (isMounted) {
          setWishlistProducts(prods.filter((p): p is Product => p !== null));
        }
      } catch (err) {
        console.error("Error loading wishlist products:", err);
      } finally {
        if (isMounted) setLoadingWishlist(false);
      }
    };

    fetchWishlistProducts();
    return () => { isMounted = false; };
  }, [wishlistIds]);

  const handleClearRecentlyViewed = () => {
    localStorage.removeItem('rare_dreams_recently_viewed');
    setRecentlyViewed([]);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      displayName: profileName,
      phoneNumber: profilePhone,
      photoURL: profilePhoto
    });
    setActiveModal(null);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet || !addrCity) return;

    const newAddr: AddressItem = {
      id: 'addr-' + Date.now(),
      name: addrName || user?.displayName || 'Home',
      phone: addrPhone || user?.phoneNumber || '',
      address: addrStreet,
      city: addrCity,
      postalCode: addrPostal,
      isDefault: addrDefault || (user?.addresses?.length === 0)
    };

    const currentAddresses = user?.addresses || [];
    const updatedAddresses = addrDefault 
      ? [...currentAddresses.map(a => ({ ...a, isDefault: false })), newAddr]
      : [...currentAddresses, newAddr];

    await updateUserProfile({ addresses: updatedAddresses });
    setIsAddingAddress(false);
    setAddrStreet('');
    setAddrCity('');
    setAddrPostal('');
    setAddrPhone('');
    setAddrName('');
  };

  const handleDeleteAddress = async (id: string) => {
    const updated = (user?.addresses || []).filter(a => a.id !== id);
    await updateUserProfile({ addresses: updated });
  };

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { sender: 'user' as const, text: chatInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    setTimeout(() => {
      const replies = [
        "Thank you for contacting Rare Dreams! Our support team is attending to your query.",
        "Your orders are tracked live in Sales History & Order section.",
        "We deliver across Bangladesh with fast priority shipping!"
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      setChatMessages(prev => [...prev, {
        sender: 'support' as const,
        text: randomReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1000);
  };

  const cleanDisplayName = user?.displayName || profileName || 'Rezaul karim';
  const initialLetter = cleanDisplayName.charAt(0).toUpperCase() || 'R';
  const totalSalesCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.status?.toLowerCase() === 'pending').length;
  const isAdmin = user?.role === 'admin' || user?.role === 'seller' || user?.email?.toLowerCase().trim() === 'xmrezaul.karim998@gmail.com';

  const getFilteredOrders = (filter: string) => {
    if (filter === 'All') return orders;
    return orders.filter(o => o.status?.toLowerCase() === filter.toLowerCase());
  };

  return (
    <div className="bg-[#FAF8F5] min-h-screen pb-16 pt-4 px-3 sm:px-6 w-full flex-grow font-sans text-neutral-900">
      <div className="max-w-lg mx-auto space-y-6">

        {/* 1. PROFILE AVATAR & NAME HEADER */}
        <div className="flex flex-col items-center text-center pt-2 pb-1 space-y-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-blue-400 text-white flex items-center justify-center shadow-inner overflow-hidden border-4 border-white shadow-sm">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={cleanDisplayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold font-serif">{initialLetter}</span>
              )}
            </div>
            <button
              onClick={() => setActiveModal('profile')}
              className="absolute bottom-0 right-0 w-7 h-7 bg-black text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs hover:scale-105 transition-transform"
              title="Edit Profile"
            >
              <Pencil size={12} />
            </button>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight font-serif">
              {cleanDisplayName}
            </h1>
            <div className="pt-0.5">
              {isAdmin ? (
                <span className="bg-[#0f766e] text-white text-xs font-bold px-4 py-1 rounded-full inline-block shadow-2xs">
                  Store Owner / Admin
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-4 py-1 rounded-full inline-block shadow-2xs">
                  Verified Member
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 font-medium pt-0.5">
              {user?.email || 'Rare Dreams User'}
            </p>
          </div>
        </div>

        {/* 3. QUICK ANALYTICS 3-STAT CARDS ROW */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#EBECEF]/80 rounded-2xl p-3.5 text-center flex flex-col items-center justify-center shadow-2xs border border-neutral-200/50">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 leading-tight">
              {totalSalesCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-neutral-600 tracking-wider uppercase mt-1 leading-none">
              {isAdmin ? 'TOTAL SALES' : 'MY ORDERS'}
            </span>
          </div>

          <div className="bg-[#EBECEF]/80 rounded-2xl p-3.5 text-center flex flex-col items-center justify-center shadow-2xs border border-neutral-200/50">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 leading-tight">
              {pendingOrdersCount}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-neutral-600 tracking-wider uppercase mt-1 leading-none">
              PENDING ORDERS
            </span>
          </div>

          <div className="bg-[#EBECEF]/80 rounded-2xl p-3.5 text-center flex flex-col items-center justify-center shadow-2xs border border-neutral-200/50">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 leading-tight">
              {wishlistIds.length}
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-neutral-600 tracking-wider uppercase mt-1 leading-none">
              SAVED ITEMS
            </span>
          </div>
        </div>

        {/* 4. RECENTLY VIEWED SECTION */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-neutral-900 font-serif">
              Recently Viewed
            </h2>
            {recentlyViewed.length > 0 && (
              <button
                onClick={handleClearRecentlyViewed}
                className="bg-[#E2E8F0] hover:bg-[#CBD5E1] text-neutral-800 text-xs font-bold px-3 py-1 rounded-full transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {recentlyViewed.length > 0 ? (
            <div className="grid grid-cols-3 gap-2.5 bg-white p-3 rounded-2xl border border-neutral-200/80 shadow-2xs">
              {recentlyViewed.slice(0, 3).map((prod) => (
                <Link
                  key={prod.id}
                  to={`/product/${prod.id}`}
                  className="group block space-y-1.5"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/60">
                    <img
                      src={prod.images?.[0] || 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=300&auto=format&fit=crop'}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <p className="text-[11px] font-bold text-neutral-900 truncate leading-tight">
                    {prod.name}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-800 font-mono">
                    ৳{prod.price}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white/80 rounded-2xl p-4 text-center border border-dashed border-neutral-300">
              <p className="text-xs font-semibold text-neutral-500">
                Products you open will appear here.
              </p>
            </div>
          )}
        </div>

        {/* 5. MAIN MENU ACTION CARDS LIST */}
        <div className="space-y-2.5">
          {/* Admin Panel Button (ONLY IF ADMIN) */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-amber-300/80 bg-amber-50/20 shadow-2xs flex items-center justify-between group transition-all text-left cursor-pointer"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                  <Store size={20} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-base font-bold text-neutral-900 block leading-tight">
                    Admin Control Panel
                  </span>
                  <span className="text-xs text-amber-800 font-medium">
                    Store management, products & orders
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
            </button>
          )}

          {/* Sales History */}
          <button
            onClick={() => setActiveModal('orders_All')}
            className="w-full bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-neutral-200/90 shadow-2xs flex items-center justify-between group transition-all text-left"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-teal-800 flex items-center justify-center shrink-0">
                <Receipt size={20} strokeWidth={2} />
              </div>
              <span className="text-base font-bold text-neutral-900">
                Sales History
              </span>
            </div>
            <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
          </button>

          {/* Wishlist & Saved Items */}
          <button
            onClick={() => setActiveModal('wishlist')}
            className="w-full bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-neutral-200/90 shadow-2xs flex items-center justify-between group transition-all text-left"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-800 flex items-center justify-center shrink-0">
                <Heart size={20} strokeWidth={2} className="fill-rose-500/20 text-rose-700" />
              </div>
              <div>
                <span className="text-base font-bold text-neutral-900 block leading-tight">
                  Wishlist & Saved Items
                </span>
                <span className="text-xs text-neutral-500 font-medium">
                  {wishlistIds.length} {wishlistIds.length === 1 ? 'item' : 'items'} saved
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
          </button>

          {/* Price Drop Alerts & Subscriptions */}
          <button
            onClick={() => setActiveModal('price_alerts')}
            className="w-full bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-amber-300/80 shadow-2xs flex items-center justify-between group transition-all text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                <Bell size={20} strokeWidth={2} className="text-amber-700" />
              </div>
              <div>
                <span className="text-base font-bold text-neutral-900 block leading-tight">
                  {'Price Drop Alerts'}
                </span>
                <span className="text-xs text-neutral-500 font-medium">
                  {alerts.length} {alerts.length === 1 ? 'active alert' : 'active alerts'}
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
          </button>

          {/* Shipping Addresses */}
          <button
            onClick={() => setActiveModal('address')}
            className="w-full bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-neutral-200/90 shadow-2xs flex items-center justify-between group transition-all text-left"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-sky-100/80 text-sky-800 flex items-center justify-center shrink-0">
                <Truck size={20} strokeWidth={2} />
              </div>
              <span className="text-base font-bold text-neutral-900">
                Shipping Addresses
              </span>
            </div>
            <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveModal('profile')}
            className="w-full bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-neutral-200/90 shadow-2xs flex items-center justify-between group transition-all text-left"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-800 flex items-center justify-center shrink-0">
                <SettingsIcon size={20} strokeWidth={2} />
              </div>
              <span className="text-base font-bold text-neutral-900">
                Settings
              </span>
            </div>
            <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
          </button>

          {/* Help & Support */}
          <button
            onClick={() => setActiveModal('chat')}
            className="w-full bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-neutral-200/90 shadow-2xs flex items-center justify-between group transition-all text-left"
          >
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                <HelpCircle size={20} strokeWidth={2} />
              </div>
              <span className="text-base font-bold text-neutral-900">
                Help & Support
              </span>
            </div>
            <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
          </button>
        </div>

        {/* 6. LOG OUT BUTTON */}
        <div className="pt-2 text-center pb-6">
          <button
            onClick={handleLogout}
            className="w-full bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300 font-bold py-3.5 rounded-full text-sm uppercase tracking-widest transition-all shadow-2xs"
          >
            LOG OUT
          </button>
        </div>

      </div>

      {/* ==================== MODALS (RENDERED VIA PORTAL TO BODY TO FIX POSITIONING) ==================== */}
      {activeModal && typeof document !== 'undefined' && document.body && createPortal(
        <>
          {/* 1. EDIT PROFILE / SETTINGS MODAL */}
          {activeModal === 'profile' && (
            <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 border border-neutral-100 relative my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-6">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Profile & Settings</h3>
                    <p className="text-xs text-neutral-400 font-medium">Update account information</p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      required
                      autoComplete="off"
                      value={profileName} 
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 01700000000"
                      autoComplete="off"
                      value={profilePhone} 
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Avatar Image URL</label>
                    <input 
                      type="url" 
                      value={profilePhoto} 
                      autoComplete="off"
                      onChange={(e) => setProfilePhoto(e.target.value)}
                      placeholder="Paste image URL"
                      className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="px-4 py-2 text-xs font-bold text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold text-white bg-black rounded-xl hover:bg-neutral-800"
                    >
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 2. SHIPPING ADDRESSES MODAL */}
          {activeModal === 'address' && (
            <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 border border-neutral-100 relative my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-6">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Shipping Addresses</h3>
                    <p className="text-xs text-neutral-400 font-medium">Manage delivery destinations</p>
                  </div>
                </div>

                {/* List of Addresses */}
                <div className="space-y-3">
                  {(user?.addresses || []).length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-4 bg-neutral-50 rounded-2xl">
                      No shipping addresses saved yet.
                    </p>
                  ) : (
                    user?.addresses?.map((addr) => (
                      <div key={addr.id} className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80 flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-neutral-900">{addr.name}</span>
                            {addr.isDefault && (
                              <span className="bg-sky-100 text-sky-800 text-[9px] font-bold px-2 py-0.5 rounded-md">Default</span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-600 mt-1">{addr.address}, {addr.city}</p>
                          <p className="text-[11px] text-neutral-400 font-mono">{addr.phone}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-neutral-400 hover:text-rose-600 p-1"
                          title="Delete address"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Address Toggle / Form */}
                {!isAddingAddress ? (
                  <button
                    onClick={() => setIsAddingAddress(true)}
                    className="w-full border-2 border-dashed border-neutral-300 hover:border-black text-neutral-700 font-bold text-xs py-3 rounded-2xl flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Add New Address</span>
                  </button>
                ) : (
                  <form onSubmit={handleAddAddress} className="space-y-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
                    <h4 className="text-xs font-bold text-neutral-900">New Address Details</h4>
                    <input
                      type="text"
                      placeholder="Recipient Name"
                      autoComplete="off"
                      value={addrName}
                      onChange={(e) => setAddrName(e.target.value)}
                      className="w-full text-xs bg-white border border-neutral-200 rounded-xl px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      autoComplete="off"
                      value={addrPhone}
                      onChange={(e) => setAddrPhone(e.target.value)}
                      className="w-full text-xs bg-white border border-neutral-200 rounded-xl px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="Full Address / House, Road, Area"
                      required
                      autoComplete="off"
                      value={addrStreet}
                      onChange={(e) => setAddrStreet(e.target.value)}
                      className="w-full text-xs bg-white border border-neutral-200 rounded-xl px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="City / District"
                      required
                      autoComplete="off"
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      className="w-full text-xs bg-white border border-neutral-200 rounded-xl px-3 py-2"
                    />
                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingAddress(false)}
                        className="px-3 py-1.5 text-xs text-neutral-600 font-bold hover:bg-neutral-200 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs bg-black text-white font-bold rounded-xl hover:bg-neutral-800"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* 3. HELP & SUPPORT CHAT MODAL */}
          {activeModal === 'chat' && (
            <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 border border-neutral-100 relative my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-6">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <Headphones size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Help & Live Support</h3>
                    <p className="text-xs text-neutral-400 font-medium">Rare Dreams customer assistant</p>
                  </div>
                </div>

                {/* Chat Box */}
                <div className="h-64 overflow-y-auto space-y-3 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                        msg.sender === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-neutral-200 text-neutral-900 rounded-tl-none shadow-2xs'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-neutral-400 mt-1 px-1">{msg.time}</span>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendChatMessage} className="pt-1 flex items-center space-x-2">
                  <input 
                    type="text" 
                    placeholder="Type your message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-black"
                  />
                  <button
                    type="submit"
                    className="bg-black text-white p-2.5 rounded-xl transition-colors shrink-0 hover:bg-neutral-800 cursor-pointer"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 4. SALES HISTORY / ORDERS MODAL */}
          {activeModal && activeModal.startsWith('orders_') && (
            <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 border border-neutral-100 relative my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>

                {(() => {
                  const filterStatus = activeModal.replace('orders_', '');
                  const filteredList = getFilteredOrders(filterStatus);

                  return (
                    <>
                      <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-8">
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                          <Receipt size={20} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-neutral-900">
                            {filterStatus === 'All' ? 'Sales History & Orders' : `${filterStatus} Orders`}
                          </h3>
                          <p className="text-xs text-neutral-400 font-medium">
                            Showing {filteredList.length} record{filteredList.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {filteredList.length === 0 ? (
                          <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                            <ShoppingBasket className="mx-auto text-neutral-300 mb-2" size={36} />
                            <p className="text-xs font-bold text-neutral-600">No {filterStatus} orders found</p>
                            <p className="text-[11px] text-neutral-400 mt-1">Placing orders will record history here.</p>
                          </div>
                        ) : (
                          filteredList.map((ord) => (
                            <div key={ord.id} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-3">
                              <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
                                <div>
                                  <span className="text-[11px] font-mono font-bold text-neutral-900">#{ord.id.slice(-6).toUpperCase()}</span>
                                  <p className="text-[10px] text-neutral-400">Placed on {new Date(ord.createdAt).toLocaleDateString()}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                  ord.status?.toLowerCase() === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                  ord.status?.toLowerCase() === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                  ord.status?.toLowerCase() === 'processing' ? 'bg-indigo-100 text-indigo-700' :
                                  ord.status?.toLowerCase() === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {ord.status || 'Pending'}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {ord.products?.map((item, idx) => (
                                  <div key={idx} className="flex items-center space-x-3">
                                    {item.images?.[0] ? (
                                      <img src={item.images[0]} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-neutral-200" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-neutral-200 flex items-center justify-center text-[10px]">No img</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h5 className="text-xs font-medium text-neutral-800 truncate">{item.name}</h5>
                                      <p className="text-[10px] text-neutral-400">Qty: {item.quantity} {item.selectedSize ? `| Size: ${item.selectedSize}` : ''}</p>
                                    </div>
                                    <span className="text-xs font-bold text-neutral-900 font-mono">৳{(item.price * item.quantity).toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>

                              <div className="pt-2 border-t border-neutral-200/60 flex items-center justify-between text-xs">
                                <span className="text-neutral-500 font-medium">Total ({ord.paymentMethod?.toUpperCase()})</span>
                                <span className="font-bold text-emerald-700 font-mono text-sm">৳{ord.total?.toLocaleString()}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 5. WISHLIST / SAVED ITEMS MODAL */}
          {activeModal === 'wishlist' && (
            <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 border border-neutral-100 relative my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-8">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                    <Heart size={20} className="fill-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Wishlist & Saved Items</h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {wishlistProducts.length} saved product{wishlistProducts.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {loadingWishlist ? (
                    <div className="text-center py-8 text-neutral-400 text-xs font-medium">
                      Loading saved wishlist items...
                    </div>
                  ) : wishlistProducts.length === 0 ? (
                    <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 space-y-3 p-4">
                      <Heart className="mx-auto text-rose-300 fill-rose-100" size={40} />
                      <div>
                        <p className="text-xs font-bold text-neutral-700">Your Wishlist is empty</p>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Save items you like from the product details page to view them here later.
                        </p>
                      </div>
                      <button
                        onClick={() => { setActiveModal(null); navigate('/shop'); }}
                        className="bg-black text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-neutral-800 transition-colors inline-block cursor-pointer"
                      >
                        Explore Shop
                      </button>
                    </div>
                  ) : (
                    wishlistProducts.map((product) => (
                      <div 
                        key={product.id} 
                        className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80 flex items-center justify-between gap-3 group hover:border-neutral-300 transition-all"
                      >
                        <Link 
                          to={`/product/${product.id}`} 
                          onClick={() => setActiveModal(null)}
                          className="flex items-center space-x-3 min-w-0 flex-1"
                        >
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-200 shrink-0 border border-neutral-200/60">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">No Image</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block truncate">
                              {product.category}
                            </span>
                            <h4 className="text-xs font-bold text-neutral-900 truncate group-hover:text-amber-800 transition-colors">
                              {product.name}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs font-black text-neutral-900 font-mono">
                                ৳{product.price.toLocaleString()}
                              </span>
                              {product.comparePrice && product.comparePrice > product.price && (
                                <span className="text-[10px] text-neutral-400 line-through">
                                  ৳{product.comparePrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              if (product.stockQuantity === 0) return;
                              animateAddToCart(product, e);
                            }}
                            disabled={product.stockQuantity === 0}
                            className="bg-black text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                            title="Add to Cart"
                          >
                            <ShoppingBag size={14} />
                            <span className="hidden sm:inline">Add</span>
                          </button>
                          <button
                            onClick={() => toggleWishlist(product.id)}
                            className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-200 transition-colors cursor-pointer"
                            title="Remove from Wishlist"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 6. PRICE DROP ALERTS MODAL */}
          {activeModal === 'price_alerts' && (
            <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-neutral-100 space-y-4 my-auto max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => setActiveModal(null)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-8">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <BellRing size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Price Drop Alerts
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      {alerts.length} {alerts.length === 1 ? 'active subscription' : 'active subscriptions'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 space-y-3 p-4">
                      <Bell className="mx-auto text-amber-400 stroke-[1.5]" size={40} />
                      <div>
                        <p className="text-xs font-bold text-neutral-700">
                          No active price drop alerts
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-1 max-w-xs mx-auto leading-relaxed">
                          Click "Notify Me" on any product to track price drops and receive instant alerts.
                        </p>
                      </div>
                      <button
                        onClick={() => { setActiveModal(null); navigate('/shop'); }}
                        className="bg-black text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-neutral-800 transition-colors inline-block cursor-pointer"
                      >
                        Browse Products
                      </button>
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80 flex items-center justify-between gap-3 group hover:border-amber-300 transition-all"
                      >
                        <Link
                          to={`/product/${alert.productId}`}
                          onClick={() => setActiveModal(null)}
                          className="flex items-center space-x-3 min-w-0 flex-1"
                        >
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0 border border-neutral-200/60 shadow-2xs">
                            {alert.productImage ? (
                              <img src={alert.productImage} alt={alert.productName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">No Image</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5 mb-0.5">
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                                alert.status === 'triggered'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {alert.status === 'triggered' 
                                  ? '🔥 Price Dropped'
                                  : 'Tracking'}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-neutral-900 truncate group-hover:text-amber-800 transition-colors">
                              {alert.productName}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs font-black text-neutral-900 font-mono">
                                ৳{alert.initialPrice?.toLocaleString()}
                              </span>
                              {alert.targetPrice && alert.targetPrice < alert.initialPrice && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                  Target: ৳{alert.targetPrice}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={async () => {
                              if (window.confirm('Delete this price alert?')) {
                                await unsubscribeFromPriceDrop(alert.id);
                              }
                            }}
                            className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-200 transition-colors cursor-pointer shadow-2xs"
                            title="Delete Alert"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}


    </div>
  );
}
