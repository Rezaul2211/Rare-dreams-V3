import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { trackInitiateCheckout, trackPurchase } from '../lib/pixel';
import { requestLocationAddress } from '../lib/geolocation';
import { requestPushNotificationPermission } from '../lib/pushNotifications';
import { BD_DISTRICTS, getThanasByDistrict } from '../lib/bdData';
import { 
  ShieldCheck, 
  ChevronLeft, 
  Check, 
  Loader2, 
  X, 
  CheckCircle2, 
  Truck, 
  RotateCcw,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ArrowRight,
  CreditCard,
  Banknote,
  Trash2,
  Lock,
  Sparkles
} from 'lucide-react';

interface DeliveryOption {
  id: 'inside_dhaka' | 'outside_dhaka';
  labelBn: string;
  labelEn: string;
  subLabelBn: string;
  cost: number;
}

const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'inside_dhaka',
    labelBn: 'ঢাকার ভিতরে (Home Delivery)',
    labelEn: 'Inside Dhaka',
    subLabelBn: 'হোম ডেলিভারি (১-২ দিনের মধ্যে)',
    cost: 80,
  },
  {
    id: 'outside_dhaka',
    labelBn: 'ঢাকার বাহিরে (All Bangladesh)',
    labelEn: 'Outside Dhaka',
    subLabelBn: 'কুরিয়ারে দ্রুত হোম ডেলিভারি (২-৩ দিনের মধ্যে)',
    cost: 120,
  },
];

// Bangladeshi Mobile Number Validation
const BD_PHONE_REGEX = /^(?:\+8801|8801|01)[3-9]\d{8}$/;

export default function Checkout() {
  const { directCheckoutItem, getCheckoutItems, getCheckoutSubtotal, clearCart, setDirectCheckoutItem, removeItem, updateQuantity } = useCartStore();
  const { user } = useAuthStore();
  const { config } = useStoreConfigStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [orderProgressStep, setOrderProgressStep] = useState<number>(1);

  // Toast / Banner alert state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const checkoutItems = getCheckoutItems();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    district: 'Dhaka',
    thana: 'Dhanmondi',
    address: '',
    orderNotes: '',
    deliveryArea: 'inside_dhaka' as 'inside_dhaka' | 'outside_dhaka',
    paymentMethod: 'cod' as 'cod' | 'bKash' | 'nagad',
  });

  // Calculate Subtotal and Total
  const subtotal = useMemo(() => {
    return getCheckoutSubtotal();
  }, [checkoutItems]);

  // Selected delivery option based on district
  const selectedDeliveryOption = useMemo(() => {
    const isInsideDhaka = formData.district.toLowerCase().trim() === 'dhaka';
    return DELIVERY_OPTIONS.find(opt => opt.id === (isInsideDhaka ? 'inside_dhaka' : 'outside_dhaka')) || DELIVERY_OPTIONS[0];
  }, [formData.district]);

  const shipping = selectedDeliveryOption.cost;
  const total = subtotal + shipping;

  // Track InitiateCheckout on page entry
  useEffect(() => {
    if (checkoutItems.length > 0) {
      trackInitiateCheckout({
        num_items: checkoutItems.reduce((acc, item) => acc + item.quantity, 0),
        value: total,
      });
    }
  }, []);

  // District thana list
  const currentDistrictThanas = useMemo(() => {
    return getThanasByDistrict(formData.district);
  }, [formData.district]);

  // Handle District Change
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDistrict = e.target.value;
    const isInsideDhaka = newDistrict.toLowerCase().trim() === 'dhaka';
    const thanasList = getThanasByDistrict(newDistrict);
    const defaultThana = thanasList.length > 0 ? thanasList[0].nameEn : '';

    setFormData(prev => ({
      ...prev,
      district: newDistrict,
      thana: defaultThana,
      deliveryArea: isInsideDhaka ? 'inside_dhaka' : 'outside_dhaka',
    }));
  };

  // Handle Thana Change
  const handleThanaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      thana: e.target.value
    }));
  };

  // Handle Generic Input Change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Auto-locate GPS
  const handleAutoLocate = async () => {
    setIsLocating(true);
    setLocationStatus('loading');
    setErrorMessage(null);

    try {
      const location = await requestLocationAddress();
      if (location && location.success && location.address) {
        setFormData(prev => ({
          ...prev,
          address: location.address || prev.address,
        }));
        setLocationStatus('success');
      } else {
        setLocationStatus('error');
        setErrorMessage(location?.errorMessage || 'আপনার বর্তমান লোকেশন পাওয়া যায়নি। অনুগ্রহ করে ম্যানুয়ালি ঠিকানা লিখুন।');
      }
    } catch (err) {
      console.warn('Geolocation failed:', err);
      setLocationStatus('error');
      setErrorMessage('লোকেশন ট্র্যাক করতে ব্রাউজারের পারমিশন দিন অথবা ম্যানুয়ালি ঠিকানা লিখুন।');
    } finally {
      setIsLocating(false);
      setTimeout(() => setLocationStatus('idle'), 3000);
    }
  };

  // Validation function
  const validateForm = () => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage('অনুগ্রহ করে আপনার সম্পূর্ণ নাম লিখুন।');
      return false;
    }

    const cleanPhone = formData.phone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone || !BD_PHONE_REGEX.test(cleanPhone)) {
      setErrorMessage('সঠিক ১১ ডিজিটের মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX)।');
      return false;
    }

    if (!formData.address.trim() || formData.address.trim().length < 4) {
      setErrorMessage('অনুগ্রহ করে আপনার সম্পূর্ণ ঠিকানা লিখুন (বাসা/রোড/এলাকা)।');
      return false;
    }

    if (!formData.district.trim()) {
      setErrorMessage('অনুগ্রহ করে আপনার জেলা নির্বাচন করুন।');
      return false;
    }

    setErrorMessage(null);
    return true;
  };

  // Main Submit handler (Continue to Payment page or finalize COD)
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If online payment (bKash/Nagad), navigate to dedicated payment page
    if (formData.paymentMethod === 'bKash' || formData.paymentMethod === 'nagad') {
      navigate('/payment', {
        state: {
          formData,
          checkoutItems,
          subtotal,
          shipping,
          total,
          selectedDeliveryOption,
          directCheckoutItem,
        }
      });
      return;
    }

    // Cash on Delivery Direct Place Order
    await finalizeOrder();
  };

  // Finalize order writing to Firestore
  const finalizeOrder = async () => {
    setLoading(true);
    setErrorMessage(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setIsProcessingOrder(true);
    setOrderProgressStep(1);

    try {
      const orderRef = doc(collection(db, 'orders'));
      const orderId = orderRef.id;

      await new Promise(r => setTimeout(r, 600));
      setOrderProgressStep(2);

      const sanitizedProducts = checkoutItems.map(item => ({
        id: item.id || '',
        cartItemId: item.cartItemId || '',
        name: item.name || 'Product',
        category: item.category || '',
        price: Number(item.price) || 0,
        discount: Number(item.discount) || 0,
        quantity: Math.max(1, Number(item.quantity) || 1),
        selectedSize: item.selectedSize || '',
        selectedColor: item.selectedColor || '',
        images: Array.isArray(item.images) ? item.images.slice(0, 3) : [],
      }));

      const cleanPhone = formData.phone.trim().replace(/[\s-]/g, '');

      const orderData = {
        id: orderId,
        userId: user?.uid || 'guest',
        customerName: formData.name.trim(),
        phone: cleanPhone,
        district: formData.district,
        thana: formData.thana || '',
        address: formData.address.trim(),
        email: formData.email.trim() || '',
        orderNotes: formData.orderNotes.trim() || '',
        deliveryArea: selectedDeliveryOption.labelEn,
        deliveryAreaBn: selectedDeliveryOption.labelBn,
        deliveryCost: shipping,
        city: `${formData.thana ? formData.thana + ', ' : ''}${formData.district}`,
        products: sanitizedProducts,
        itemsCount: sanitizedProducts.reduce((acc, item) => acc + item.quantity, 0),
        subtotal,
        shipping,
        total,
        paymentMethod: formData.paymentMethod,
        senderNumber: 'N/A',
        transactionId: 'N/A',
        paymentStatus: 'pending',
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };

      setIsOrderPlaced(true);
      await setDoc(orderRef, {
        ...orderData,
        createdAt: serverTimestamp(),
      });

      setOrderProgressStep(3);
      await new Promise(r => setTimeout(r, 700));

      try {
        sessionStorage.setItem('last_placed_order_' + orderId, JSON.stringify(orderData));
      } catch (e) {
        console.warn('Could not cache order in sessionStorage', e);
      }

      trackPurchase({
        order_id: orderId,
        value: total,
        num_items: sanitizedProducts.reduce((acc, item) => acc + item.quantity, 0),
      });

      try {
        requestPushNotificationPermission(user?.uid, cleanPhone, (user as any)?.role || 'customer');
      } catch (e) {
        console.warn('Push permission after order:', e);
      }

      if (directCheckoutItem) {
        if (directCheckoutItem.cartItemId) {
          removeItem(directCheckoutItem.cartItemId);
        }
        setDirectCheckoutItem(null);
      } else {
        clearCart();
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      navigate(`/order-success/${orderId}`, { replace: true, state: { initialOrder: orderData } });
    } catch (error) {
      console.error("Error placing order:", error);
      setIsOrderPlaced(false);
      setIsProcessingOrder(false);
      setErrorMessage("অর্ডারটি সম্পন্ন করা সম্ভব হয়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  if (checkoutItems.length === 0 && !isOrderPlaced && !loading) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 md:py-10 w-full flex-grow relative pb-28 lg:pb-16 bg-neutral-50/60 min-h-screen">
      
      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} className="shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 text-xs sm:text-sm font-semibold">
            {errorMessage}
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-700 p-1 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* FULLSCREEN ORDER PROCESSING ANIMATED MODAL */}
      {isProcessingOrder && (
        <div className="fixed inset-0 z-50 bg-neutral-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6 flex flex-col items-center border border-neutral-100 animate-in zoom-in-95">
            <div className="relative">
              <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center shadow-inner">
                {orderProgressStep === 3 ? (
                  <CheckCircle2 size={42} className="text-emerald-600 animate-bounce" />
                ) : (
                  <Loader2 size={36} className="text-orange-600 animate-spin" />
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-700 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                {orderProgressStep === 3 ? 'অর্ডার সংরক্ষিত হয়েছে' : 'অর্ডার প্রসেস হচ্ছে'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-neutral-900 mt-2 tracking-tight">
                {orderProgressStep === 1 && 'তথ্য যাচাই করা হচ্ছে...'}
                {orderProgressStep === 2 && 'অর্ডার কনফার্ম হচ্ছে...'}
                {orderProgressStep === 3 && 'অর্ডার সফল হয়েছে!'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                কিছুক্ষণ অপেক্ষা করুন, আপনার অর্ডারটি সিস্টেমে যুক্ত হচ্ছে।
              </p>
            </div>

            <div className="w-full space-y-2">
              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-orange-500 h-full transition-all duration-500 rounded-full" 
                  style={{ width: `${(orderProgressStep / 3) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-neutral-400">
                <span className={orderProgressStep >= 1 ? 'text-orange-600' : ''}>১. ঠিকানা যাচাই</span>
                <span className={orderProgressStep >= 2 ? 'text-orange-600' : ''}>২. স্টক সংরক্ষণ</span>
                <span className={orderProgressStep >= 3 ? 'text-emerald-600' : ''}>৩. সম্পন্ন</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER: Clean Back Link */}
      <div className="flex items-center justify-between mb-4">
        <Link 
          to="/cart" 
          onClick={() => setDirectCheckoutItem(null)}
          className="inline-flex items-center text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft size={16} className="mr-0.5" /> ব্যাগে ফিরে যান
        </Link>
      </div>

      {/* ACCOUNT BANNER (ONLY IF NOT LOGGED IN) */}
      {!user && (
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <p className="text-xs sm:text-sm font-medium text-neutral-700">
            অ্যাকাউন্ট আছে? দ্রুত অর্ডার করতে লগইন অথবা রেজিস্টার করুন
          </p>
          <div className="flex items-center gap-2">
            <Link 
              to="/login?redirect=/checkout" 
              className="px-4 py-1.5 text-xs font-bold text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-xl transition-colors text-center"
            >
              লগইন
            </Link>
            <Link 
              to="/register?redirect=/checkout" 
              className="px-4 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors text-center shadow-2xs"
            >
              রেজিস্টার
            </Link>
          </div>
        </div>
      )}

      {/* 1. ORDER REVIEW SECTION */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-4.5 bg-orange-600 rounded-full inline-block"></span>
          <h2 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
            অর্ডার রিভিউ
          </h2>
        </div>

        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-neutral-200 shadow-2xs space-y-3.5">
          {checkoutItems.map((item) => (
            <div 
              key={item.cartItemId} 
              className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100 last:border-b-0 last:pb-0"
            >
              {/* Product Image Thumbnail */}
              <div className="w-14 h-16 sm:w-16 sm:h-18 bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200 shrink-0 relative">
                {item.images && item.images.length > 0 ? (
                  <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">ছবি নেই</div>
                )}
              </div>

              {/* Title, Variant & Quantity Pill + Price */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <h4 className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                  {item.name}
                </h4>

                {(item.selectedSize || item.selectedColor) && (
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                    {item.selectedSize && (
                      <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 font-semibold">
                        সাইজ: {item.selectedSize}
                      </span>
                    )}
                    {item.selectedColor && (
                      <span className="text-neutral-600">
                        কালার: {item.selectedColor}
                      </span>
                    )}
                  </div>
                )}

                {/* Quantity Controls and Unit/Total Price */}
                <div className="flex items-center gap-3">
                  {/* Quantity Stepper */}
                  <div className="inline-flex items-center border border-neutral-200 rounded-xl bg-neutral-50 overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.quantity > 1) {
                          updateQuantity(item.cartItemId, item.quantity - 1);
                        } else {
                          removeItem(item.cartItemId);
                        }
                      }}
                      className="px-2.5 py-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 transition-colors font-bold text-sm cursor-pointer"
                      title="কমান"
                    >
                      -
                    </button>
                    <span className="px-2.5 py-1 text-xs font-bold text-neutral-900 bg-white border-x border-neutral-200 min-w-[26px] text-center font-mono">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      className="px-2.5 py-1 text-orange-600 hover:text-orange-700 hover:bg-neutral-200 transition-colors font-bold text-sm cursor-pointer"
                      title="বাড়ান"
                    >
                      +
                    </button>
                  </div>

                  {/* Price */}
                  <span className="font-extrabold text-sm sm:text-base text-neutral-900 font-mono">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Red Delete Trash Button */}
              <button
                type="button"
                onClick={() => removeItem(item.cartItemId)}
                className="w-8 h-8 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="মুছে ফেলুন"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHECKOUT FORM: SHIPPING ADDRESS, DISTRICT & THANA SIDE BY SIDE */}
      <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
        
        {/* 2. SHIPPING ADDRESS SECTION */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-4.5 bg-orange-600 rounded-full inline-block"></span>
            <h2 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
              ডেলিভারি ঠিকানা
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-2xs space-y-3.5">
            
            {/* Field 1: Name */}
            <div>
              <input 
                type="text" 
                name="name" 
                placeholder="আপনার সম্পূর্ণ নাম *" 
                required 
                autoComplete="name"
                value={formData.name} 
                onChange={handleChange} 
                className="w-full bg-white border border-neutral-300 focus:border-orange-500 px-4 py-3.5 outline-none rounded-xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/10" 
              />
            </div>

            {/* Field 2: Phone with 88 prefix box */}
            <div className="flex rounded-xl border border-neutral-300 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/10 overflow-hidden transition-all bg-white">
              <div className="bg-neutral-100 px-4 py-3.5 text-sm font-bold text-neutral-700 border-r border-neutral-300 flex items-center shrink-0">
                88
              </div>
              <input
                type="tel"
                name="phone"
                placeholder="০১৭XXXXXXXX *"
                required
                autoComplete="tel"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3.5 outline-none text-sm font-mono font-medium text-neutral-900 placeholder:text-neutral-400 placeholder:font-sans"
              />
            </div>

            {/* Field 3: Email (Optional) */}
            <div>
              <input 
                type="email" 
                name="email" 
                placeholder="ইমেইল অ্যাড্রেস (ঐচ্ছিক)" 
                autoComplete="email"
                value={formData.email} 
                onChange={handleChange} 
                className="w-full bg-white border border-neutral-300 focus:border-orange-500 px-4 py-3.5 outline-none rounded-xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/10" 
              />
            </div>

            {/* Location Header with Auto Locate Button Placed on Top of Address Box */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-700">
                  সম্পূর্ণ ঠিকানা (বাসা/রোড/এলাকা) *
                </label>
                <button
                  type="button"
                  onClick={handleAutoLocate}
                  disabled={isLocating}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1 rounded-lg transition-colors cursor-pointer border border-orange-200/80 shadow-2xs"
                >
                  {isLocating ? (
                    <>
                      <Loader2 size={13} className="animate-spin text-orange-600" />
                      <span>লোকেশন পাওয়া হচ্ছে...</span>
                    </>
                  ) : locationStatus === 'success' ? (
                    <>
                      <Check size={13} className="text-emerald-600" />
                      <span className="text-emerald-700">লোকেশন যুক্ত হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <MapPin size={13} className="text-orange-600" />
                      <span>অটো লোকেশন</span>
                    </>
                  )}
                </button>
              </div>

              {/* Address input */}
              <input 
                type="text" 
                name="address" 
                placeholder="যেমন: বাসা নং, রোড নং, এলাকা বা গ্রামের নাম *" 
                required 
                autoComplete="street-address"
                value={formData.address} 
                onChange={handleChange} 
                className="w-full bg-white border border-neutral-300 focus:border-orange-500 px-4 py-3.5 outline-none rounded-xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/10" 
              />
            </div>

            {/* Field 5: District & Thana Side-by-Side strictly in 2 columns */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              
              {/* Select District Dropdown */}
              <div className="relative">
                <select
                  value={formData.district}
                  onChange={handleDistrictChange}
                  className="w-full bg-white border border-neutral-300 focus:border-orange-500 px-2.5 sm:px-3.5 py-3.5 pr-7 sm:pr-9 outline-none rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 appearance-none cursor-pointer focus:ring-2 focus:ring-orange-500/10 transition-all truncate"
                >
                  <option value="" disabled>জেলা নির্বাচন করুন</option>
                  {BD_DISTRICTS.map((dist) => (
                    <option key={dist.nameEn} value={dist.nameEn}>
                      {dist.nameBn} ({dist.nameEn}) {dist.isDhaka ? '— ৳৮০' : '— ৳১২০'}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 sm:px-3 text-neutral-500">
                  <ChevronDown size={15} />
                </div>
              </div>

              {/* Select Thana Dropdown */}
              <div className="relative">
                <select
                  value={formData.thana}
                  onChange={handleThanaChange}
                  className="w-full bg-white border border-neutral-300 focus:border-orange-500 px-2.5 sm:px-3.5 py-3.5 pr-7 sm:pr-9 outline-none rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 appearance-none cursor-pointer focus:ring-2 focus:ring-orange-500/10 transition-all truncate"
                >
                  <option value="" disabled>থানা / উপজেলা নির্বাচন</option>
                  {currentDistrictThanas.map((thana) => (
                    <option key={thana.nameEn} value={thana.nameEn}>
                      {thana.nameBn ? `${thana.nameBn} (${thana.nameEn})` : thana.nameEn}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 sm:px-3 text-neutral-500">
                  <ChevronDown size={15} />
                </div>
              </div>

            </div>

            {/* Field 6: Order Notes (Optional) */}
            <div>
              <textarea 
                name="orderNotes" 
                rows={2}
                placeholder="অর্ডারের বিশেষ কোনো নির্দেশনা থাকলে লিখুন (ঐচ্ছিক)..." 
                autoComplete="off"
                value={formData.orderNotes} 
                onChange={handleChange} 
                className="w-full bg-white border border-neutral-300 focus:border-orange-500 px-4 py-3 outline-none rounded-xl text-xs sm:text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/10 resize-none" 
              />
            </div>

          </div>
        </div>

        {/* 3. PAYMENT & BILLING SUMMARY SECTION */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-4.5 bg-orange-600 rounded-full inline-block"></span>
            <h2 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
              পেমেন্ট ও ডেলিভারি
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-2xs space-y-4">
            
            {/* Delivery Charge Indicator */}
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-neutral-700">
                <Truck size={16} className="text-orange-600 shrink-0" />
                <span>
                  ডেলিভারি চার্জ ({selectedDeliveryOption.labelBn}):
                </span>
              </div>
              <span className="font-black text-neutral-900 text-sm font-mono">
                ৳{shipping}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-700">
                পেমেন্ট মেথড নির্বাচন করুন
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                
                {/* Cash on Delivery */}
                <label 
                  onClick={() => setFormData({ ...formData, paymentMethod: 'cod' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    formData.paymentMethod === 'cod' 
                      ? 'border-orange-600 bg-orange-50/50 text-neutral-900 shadow-2xs' 
                      : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Banknote size={18} className={formData.paymentMethod === 'cod' ? 'text-orange-600' : 'text-neutral-600'} />
                    <div>
                      <p className="font-bold text-xs sm:text-sm">Cash on Delivery</p>
                      <p className="text-[11px] text-neutral-500">পণ্য পেয়ে মূল্য পরিশোধ</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    formData.paymentMethod === 'cod' ? 'border-orange-600 bg-orange-600' : 'border-neutral-300'
                  }`}>
                    {formData.paymentMethod === 'cod' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </label>

                {/* bKash / Nagad */}
                <label 
                  onClick={() => setFormData({ ...formData, paymentMethod: 'bKash' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    formData.paymentMethod === 'bKash' || formData.paymentMethod === 'nagad'
                      ? 'border-orange-600 bg-orange-50/50 text-neutral-900 shadow-2xs' 
                      : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard size={18} className={formData.paymentMethod === 'bKash' ? 'text-orange-600' : 'text-neutral-600'} />
                    <div>
                      <p className="font-bold text-xs sm:text-sm">bKash / Nagad</p>
                      <p className="text-[11px] text-neutral-500">বিকাশ / নগদ পেমেন্ট</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    formData.paymentMethod === 'bKash' ? 'border-orange-600 bg-orange-600' : 'border-neutral-300'
                  }`}>
                    {formData.paymentMethod === 'bKash' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </label>

              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 pt-3 border-t border-neutral-100 text-xs sm:text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>সাবটোটাল ({checkoutItems.length} টি পণ্য):</span>
                <span className="font-bold text-neutral-900 font-mono">৳ {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>ডেলিভারি চার্জ:</span>
                <span className="font-bold text-neutral-900 font-mono">৳ {shipping}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                <span className="text-sm font-extrabold text-neutral-900">সর্বমোট প্রদেয়:</span>
                <span className="text-xl font-black text-orange-600 font-mono">
                  ৳ {total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* DESKTOP-ONLY IN-CARD PLACE ORDER BUTTON */}
            <div className="pt-2 hidden lg:block">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white py-4 px-6 rounded-xl text-base font-black tracking-wide shadow-md shadow-orange-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>অর্ডার সম্পন্ন হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <span>অর্ডার নিশ্চিত করুন (৳{total.toLocaleString()})</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

            {/* Trust & Guarantee Badges */}
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium px-1">
              <div className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>১০০% অরিজিনাল</span>
              </div>
              <div className="flex items-center gap-1">
                <Truck size={14} className="text-blue-600 shrink-0" />
                <span>দ্রুত হোম ডেলিভারি</span>
              </div>
              <div className="flex items-center gap-1">
                <RotateCcw size={14} className="text-amber-600 shrink-0" />
                <span>সহজ রিটার্ন</span>
              </div>
            </div>

          </div>
        </div>

      </form>

      {/* MOBILE FLOATING LIQUID GLASS CHECKOUT BAR (Rendered in Portal to float above all page content) */}
      {typeof document !== 'undefined' && createPortal(
        <div 
          id="mobile-sticky-checkout-bar"
          className="fixed bottom-3.5 left-3.5 right-3.5 z-[999] pointer-events-auto lg:hidden"
        >
          <div className="bg-white/95 backdrop-blur-2xl border border-white/90 shadow-[0_10px_35px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)] rounded-[24px] p-2.5 px-4 flex items-center justify-between gap-3 max-w-lg mx-auto">
            
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tight block">
                সর্বমোট মূল্য
              </span>
              <span className="text-lg sm:text-xl font-black text-neutral-900 leading-none font-mono">
                ৳{total.toLocaleString()}
              </span>
            </div>

            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 max-w-[210px] h-11 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white px-4 rounded-[16px] text-xs sm:text-sm font-black shadow-[0_4px_14px_rgba(234,88,12,0.35)] transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin shrink-0" />
                  <span>অপেক্ষা করুন...</span>
                </>
              ) : (
                <>
                  <span>অর্ডার নিশ্চিত করুন</span>
                  <ArrowRight size={15} className="shrink-0 ml-0.5" />
                </>
              )}
            </button>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
