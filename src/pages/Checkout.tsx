import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { trackInitiateCheckout, trackPurchase } from '../lib/pixel';
import { requestLocationAddress } from '../lib/geolocation';
import { requestPushNotificationPermission } from '../lib/pushNotifications';
import { BD_DISTRICTS, DistrictInfo, UpazilaInfo, getThanasByDistrict } from '../lib/bdData';
import { 
  ShieldCheck, 
  ChevronLeft, 
  Copy, 
  Check, 
  Smartphone, 
  Loader2, 
  X, 
  Lock, 
  CheckCircle2, 
  Truck, 
  ShoppingBag,
  RotateCcw,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ArrowRight,
  Sparkles,
  CreditCard,
  Banknote
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

// Bangladeshi Mobile Number Validation (013, 014, 015, 016, 017, 018, 019 - 11 digits)
const BD_PHONE_REGEX = /^(?:\+8801|8801|01)[3-9]\d{8}$/;

export default function Checkout() {
  const { directCheckoutItem, getCheckoutItems, getCheckoutSubtotal, clearCart, setDirectCheckoutItem, removeItem } = useCartStore();
  const { user } = useAuthStore();
  const { config } = useStoreConfigStore();
  const { t } = useLanguageStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [isConnectingGateway, setIsConnectingGateway] = useState(false);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [orderProgressStep, setOrderProgressStep] = useState<number>(1);

  // Toast / Banner alert state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const checkoutItems = getCheckoutItems();

  // Form State initialized to Dhaka / Dhanmondi by default
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    district: 'Dhaka',
    thana: 'Dhanmondi',
    address: '',
    orderNotes: '',
    deliveryArea: 'inside_dhaka' as 'inside_dhaka' | 'outside_dhaka',
    paymentMethod: 'cod' as 'cod' | 'bKash' | 'nagad',
    senderNumber: '',
    transactionId: '',
  });

  const BKASH_NUMBER = config.bkashNumber || '01954710343';
  const NAGAD_NUMBER = config.nagadNumber || '01342563522';

  const subtotal = Math.round(getCheckoutSubtotal());
  const selectedDeliveryOption = DELIVERY_OPTIONS.find(d => d.id === formData.deliveryArea) || DELIVERY_OPTIONS[0];
  const shipping = selectedDeliveryOption.cost;
  const total = subtotal + (subtotal > 0 ? shipping : 0);

  // Get Thanas dynamically for currently selected district
  const currentDistrictThanas = useMemo(() => {
    return getThanasByDistrict(formData.district);
  }, [formData.district]);

  // Handle District Change from Select Box -> Auto Set Delivery Charge & Auto populate Thana
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDistrictName = e.target.value;
    const districtObj = BD_DISTRICTS.find(
      d => d.nameEn.toLowerCase() === selectedDistrictName.toLowerCase() || d.nameBn === selectedDistrictName
    );

    const isDhaka = districtObj ? districtObj.isDhaka : selectedDistrictName.toLowerCase() === 'dhaka';
    const targetDeliveryArea: 'inside_dhaka' | 'outside_dhaka' = isDhaka ? 'inside_dhaka' : 'outside_dhaka';
    const thanasForDist = districtObj ? districtObj.thanas : getThanasByDistrict(selectedDistrictName);
    const defaultThana = thanasForDist.length > 0 ? thanasForDist[0].nameEn : '';

    setFormData(prev => ({
      ...prev,
      district: districtObj ? districtObj.nameEn : selectedDistrictName,
      thana: defaultThana,
      deliveryArea: targetDeliveryArea
    }));

    if (errorMessage) setErrorMessage(null);
  };

  // Handle Thana Change
  const handleThanaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      thana: e.target.value
    }));
    if (errorMessage) setErrorMessage(null);
  };

  // Generic input change handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errorMessage) setErrorMessage(null);
  };

  // Pixel event tracking on mount
  useEffect(() => {
    if (checkoutItems.length > 0) {
      trackInitiateCheckout({
        num_items: checkoutItems.length,
        value: total,
      });
    }
  }, []);

  const handleAutoLocate = async () => {
    if (isLocating) return;

    setIsLocating(true);
    setLocationStatus('loading');

    try {
      const result = await requestLocationAddress();

      if (result.success && result.address) {
        setFormData(prev => ({ ...prev, address: result.address! }));
        setLocationStatus('success');
      } else {
        setLocationStatus('error');
      }
    } catch (err) {
      console.warn('Geolocation execution error:', err);
      setLocationStatus('error');
    } finally {
      setIsLocating(false);
    }
  };

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  // Validation function with clear Bengali error messages
  const validateForm = () => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage('অনুগ্রহ করে আপনার সম্পূর্ণ নাম লিখুন।');
      return false;
    }

    const cleanPhone = formData.phone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone || !BD_PHONE_REGEX.test(cleanPhone)) {
      setErrorMessage('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX বা 019XXXXXXXX)।');
      return false;
    }

    if (!formData.address.trim() || formData.address.trim().length < 5) {
      setErrorMessage('অনুগ্রহ করে সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন (বাসা/ফ্ল্যাট, রোড, এলাকা)।');
      return false;
    }

    if (!formData.district.trim()) {
      setErrorMessage('অনুগ্রহ করে আপনার জেলা নির্বাচন করুন।');
      return false;
    }

    if (!formData.thana.trim() && currentDistrictThanas.length > 0) {
      setErrorMessage('অনুগ্রহ করে আপনার থানা/উপজেলা নির্বাচন করুন।');
      return false;
    }

    setErrorMessage(null);
    return true;
  };

  // Main Submit handler (Continue to Payment / Place Order)
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (formData.paymentMethod === 'bKash' || formData.paymentMethod === 'nagad') {
      setIsConnectingGateway(true);
      setTimeout(() => {
        setIsConnectingGateway(false);
        setShowGatewayModal(true);
      }, 600);
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
        email: '',
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
        senderNumber: formData.senderNumber.trim() || 'N/A',
        transactionId: formData.transactionId.trim().toUpperCase() || 'N/A',
        paymentStatus: formData.paymentMethod === 'cod' ? 'pending' : 'pending_verification',
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
        requestPushNotificationPermission(user?.uid, cleanPhone, user?.role || 'customer');
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

      setShowGatewayModal(false);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      navigate(`/order-success/${orderId}`, { replace: true, state: { initialOrder: orderData } });
    } catch (error) {
      console.error("Error placing order:", error);
      setIsOrderPlaced(false);
      setIsProcessingOrder(false);
      setErrorMessage("অর্ডারটি সম্পন্ন করা সম্ভব হয়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
      setIsVerifyingPayment(false);
    }
  };

  // Gateway Modal Submit (bKash/Nagad)
  const handleGatewayModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSender = formData.senderNumber.trim().replace(/[\s-]/g, '');
    
    if (!cleanSender || !BD_PHONE_REGEX.test(cleanSender)) {
      setErrorMessage('অনুগ্রহ করে সঠিক ১১ ডিজিটের বিকাশ/নগদ সেন্ডার নম্বর লিখুন।');
      return;
    }

    if (!formData.transactionId.trim() || formData.transactionId.trim().length < 6) {
      setErrorMessage('অনুগ্রহ করে SMS থেকে সঠিক ট্রানজেকশন আইডি (TrxID) লিখুন।');
      return;
    }

    setIsVerifyingPayment(true);
    setTimeout(async () => {
      await finalizeOrder();
    }, 1000);
  };

  if (checkoutItems.length === 0 && !isOrderPlaced && !loading) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 w-full flex-grow relative pb-28 lg:pb-12 bg-neutral-50/50">
      
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
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                {orderProgressStep === 3 ? (
                  <CheckCircle2 size={42} className="text-emerald-600 animate-bounce" />
                ) : (
                  <Loader2 size={36} className="text-emerald-600 animate-spin" />
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
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
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full" 
                  style={{ width: `${(orderProgressStep / 3) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-neutral-400">
                <span className={orderProgressStep >= 1 ? 'text-emerald-600' : ''}>১. ঠিকানা যাচাই</span>
                <span className={orderProgressStep >= 2 ? 'text-emerald-600' : ''}>২. স্টক সংরক্ষণ</span>
                <span className={orderProgressStep >= 3 ? 'text-emerald-600' : ''}>৩. সম্পন্ন</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN GATEWAY CONNECTING LOADER */}
      {isConnectingGateway && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl space-y-4 flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg animate-pulse ${
              formData.paymentMethod === 'bKash' ? 'bg-[#D12053]' : 'bg-[#F7921E]'
            }`}>
              {formData.paymentMethod === 'bKash' ? 'bK' : 'নগদ'}
            </div>
            <div>
              <h3 className="font-black text-lg text-neutral-900 tracking-tight">পেমেন্ট গেটওয়ে সংযুক্ত হচ্ছে...</h3>
              <p className="text-xs text-neutral-500 mt-1">{formData.paymentMethod === 'bKash' ? 'বিকাশ' : 'নগদ'} নিরাপদ পেমেন্ট পোর্টাল খোলা হচ্ছে</p>
            </div>
            <Loader2 className="w-8 h-8 text-neutral-800 animate-spin mt-2" />
          </div>
        </div>
      )}

      {/* bKash / Nagad GATEWAY PAYMENT MODAL */}
      {showGatewayModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-neutral-100 relative my-auto">
            
            {/* Modal Top Header */}
            <div className={`px-6 py-5 text-white flex items-center justify-between ${
              formData.paymentMethod === 'bKash' ? 'bg-[#D12053]' : 'bg-[#F7921E]'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-lg">
                  {formData.paymentMethod === 'bKash' ? 'bK' : 'নগদ'}
                </div>
                <div>
                  <h3 className="font-black text-base tracking-wider leading-none">
                    {formData.paymentMethod === 'bKash' ? 'বিকাশ পেমেন্ট' : 'নগদ পেমেন্ট'}
                  </h3>
                  <span className="text-[10px] text-white/80 font-medium tracking-wide">অফিসিয়াল নিরাপদ পেমেন্ট গেটওয়ে</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowGatewayModal(false)}
                className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleGatewayModalSubmit} className="p-6 space-y-5">
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 block">মোট প্রদেয় টাকা</span>
                  <span className="text-xl font-black text-neutral-900">৳ {total.toFixed(0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-neutral-400 block">মার্চেন্ট</span>
                  <span className="text-xs font-bold text-neutral-800">Rare Dreams BD</span>
                </div>
              </div>

              {/* Number Copy Box */}
              <div className={`p-4 rounded-2xl border space-y-2.5 ${
                formData.paymentMethod === 'bKash' ? 'bg-pink-50/60 border-pink-200' : 'bg-orange-50/60 border-orange-200'
              }`}>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                  এই নম্বরে Send Money / ক্যাশ আউট করুন
                </span>
                
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-neutral-200 shadow-2xs">
                  <div className="flex items-center space-x-2">
                    <Smartphone size={18} className={formData.paymentMethod === 'bKash' ? 'text-[#D12053]' : 'text-[#F7921E]'} />
                    <span className="text-lg font-black text-neutral-900 font-mono tracking-wider">
                      {formData.paymentMethod === 'bKash' ? BKASH_NUMBER : NAGAD_NUMBER}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyNumber(formData.paymentMethod === 'bKash' ? BKASH_NUMBER : NAGAD_NUMBER)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                      copiedNumber 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-neutral-900 text-white hover:bg-black'
                    }`}
                  >
                    {copiedNumber ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedNumber ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-neutral-600 leading-relaxed pt-1 space-y-0.5">
                  <p>১. আপনার {formData.paymentMethod === 'bKash' ? 'বিকাশ' : 'নগদ'} অ্যাপে গিয়ে ওপরের নম্বরে টাকা পাঠান।</p>
                  <p>২. নিচে আপনার মোবাইল নম্বর এবং মেসেজে পাওয়া TrxID টি দিন।</p>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    আপনার {formData.paymentMethod === 'bKash' ? 'বিকাশ' : 'নগদ'} নম্বর *
                  </label>
                  <input
                    type="tel"
                    name="senderNumber"
                    placeholder="017XXXXXXXX"
                    required
                    autoComplete="off"
                    value={formData.senderNumber}
                    onChange={handleChange}
                    className="w-full bg-neutral-50 border border-neutral-300 px-4 py-3 rounded-xl text-sm font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-black transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-800 mb-1">
                    ট্রানজেকশন আইডি (TrxID) *
                  </label>
                  <input
                    type="text"
                    name="transactionId"
                    placeholder="যেমন: 8N7X9Y2Z"
                    required
                    autoComplete="off"
                    value={formData.transactionId}
                    onChange={handleChange}
                    className="w-full bg-neutral-50 border border-neutral-300 px-4 py-3 rounded-xl text-sm font-mono font-bold uppercase outline-none focus:bg-white focus:ring-2 focus:ring-black transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isVerifyingPayment || loading}
                className={`w-full py-4 rounded-2xl text-sm font-bold text-white transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer ${
                  formData.paymentMethod === 'bKash' ? 'bg-[#D12053] hover:bg-[#b0133f]' : 'bg-[#F7921E] hover:bg-[#d97c12]'
                } disabled:opacity-60`}
              >
                {isVerifyingPayment || loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>যাচাই করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>অর্ডার নিশ্চিত করুন (৳ {total.toFixed(0)})</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Back Link */}
      <div className="mb-4">
        <Link 
          to="/cart" 
          onClick={() => setDirectCheckoutItem(null)}
          className="inline-flex items-center text-xs font-bold text-neutral-500 hover:text-black transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" /> কার্টে ফিরে যান
        </Link>
      </div>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        
        {/* Left Column: Checkout Form adhering to the exact screenshot layout */}
        <div className="w-full lg:w-7/12 space-y-5">
          
          {/* Main Shipping Information Card (EXACT REPLICA OF THE IMAGE DESIGN) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-neutral-200/90 shadow-sm space-y-5">
            
            {/* Header: Shipping Information */}
            <div className="border-b border-neutral-100 pb-3">
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                Shipping Information
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                ডেলিভারি তথ্য সঠিকভাবে পূরণ করুন
              </p>
            </div>

            <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
              
              {/* Field 1: Full Name (আপনার নাম) * */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-neutral-800 mb-1.5">
                  Full Name (আপনার নাম) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="name" 
                  placeholder="আপনার সম্পূর্ণ নাম লিখুন" 
                  required 
                  autoComplete="name"
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-4 py-3.5 outline-none rounded-xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900/10" 
                />
              </div>

              {/* Field 2: Mobile Number (মোবাইল নাম্বার) * */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-neutral-800 mb-1.5">
                  Mobile Number (মোবাইল নাম্বার) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="tel" 
                  name="phone" 
                  placeholder="01XXXXXXXXX or +8801XXXXXXX" 
                  required 
                  autoComplete="tel"
                  value={formData.phone} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-4 py-3.5 outline-none rounded-xl text-sm font-medium text-neutral-900 font-mono transition-all placeholder:text-neutral-400 placeholder:font-sans focus:ring-2 focus:ring-neutral-900/10" 
                />
              </div>

              {/* Field 3: Delivery Address (ঠিকানা) * */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-neutral-800">
                    Delivery Address (ঠিকানা) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoLocate}
                    disabled={isLocating}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-600 hover:text-black bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        <span>লোকেশন খোঁজা হচ্ছে...</span>
                      </>
                    ) : locationStatus === 'success' ? (
                      <>
                        <Check size={11} className="text-emerald-600" />
                        <span>যুক্ত হয়েছে</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={11} />
                        <span>অটো লোকেশন</span>
                      </>
                    )}
                  </button>
                </div>
                <input 
                  type="text" 
                  name="address" 
                  placeholder="বাসা/ফ্ল্যাট, রোড, এলাকা" 
                  required 
                  autoComplete="street-address"
                  value={formData.address} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-4 py-3.5 outline-none rounded-xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900/10" 
                />
              </div>

              {/* Field 4: District * and Area/Thana * (SIDE BY SIDE 2-COLUMN GRID AS IN SCREENSHOT) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                
                {/* District Dropdown Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-neutral-800">
                      District <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {formData.district.toLowerCase() === 'dhaka' ? 'চার্জ ৳৮০' : 'চার্জ ৳১২০'}
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={formData.district}
                      onChange={handleDistrictChange}
                      className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-3.5 py-3.5 pr-9 outline-none rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 appearance-none cursor-pointer focus:ring-2 focus:ring-neutral-900/10 transition-all truncate"
                    >
                      <option value="" disabled>Select District</option>
                      {BD_DISTRICTS.map((dist) => (
                        <option key={dist.nameEn} value={dist.nameEn}>
                          {dist.nameEn} ({dist.nameBn}) {dist.isDhaka ? '— ৳৮০' : '— ৳১২০'}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                {/* Area/Thana Dropdown Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-neutral-800">
                      Area/Thana <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-neutral-500">
                      {currentDistrictThanas.length} টি থানা
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={formData.thana}
                      onChange={handleThanaChange}
                      className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-3.5 py-3.5 pr-9 outline-none rounded-xl text-xs sm:text-sm font-semibold text-neutral-900 appearance-none cursor-pointer focus:ring-2 focus:ring-neutral-900/10 transition-all truncate"
                    >
                      <option value="" disabled>Select Area / Thana</option>
                      {currentDistrictThanas.map((thana) => (
                        <option key={thana.nameEn} value={thana.nameEn}>
                          {thana.nameEn} {thana.nameBn ? `(${thana.nameBn})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Field 5: Order Notes (Optional) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-neutral-800 mb-1.5">
                  Order Notes (Optional)
                </label>
                <textarea 
                  name="orderNotes" 
                  rows={2}
                  placeholder="Any special instructions for your order..." 
                  autoComplete="off"
                  value={formData.orderNotes} 
                  onChange={handleChange} 
                  className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-4 py-3 outline-none rounded-xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900/10 resize-none" 
                />
              </div>

              {/* Delivery Charge Auto-Set Banner Indicator */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-neutral-700">
                  <Truck size={16} className="text-neutral-800 shrink-0" />
                  <span>
                    ডেলিভারি চার্জ ({selectedDeliveryOption.labelBn}):
                  </span>
                </div>
                <span className="font-black text-neutral-900 text-sm">
                  ৳{shipping}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="pt-2">
                <label className="block text-xs sm:text-sm font-bold text-neutral-800 mb-2">
                  পেমেন্ট মেথড নির্বাচন করুন
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  
                  {/* Cash on Delivery */}
                  <label 
                    onClick={() => setFormData({ ...formData, paymentMethod: 'cod' })}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      formData.paymentMethod === 'cod' 
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs' 
                        : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Banknote size={18} className={formData.paymentMethod === 'cod' ? 'text-white' : 'text-neutral-700'} />
                      <div>
                        <p className="font-bold text-xs sm:text-sm">ক্যাশ অন ডেলিভারি</p>
                        <p className={`text-[11px] ${formData.paymentMethod === 'cod' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          পণ্য পেয়ে মূল্য পরিশোধ করুন
                        </p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.paymentMethod === 'cod' ? 'border-white bg-white' : 'border-neutral-300'
                    }`}>
                      {formData.paymentMethod === 'cod' && <div className="w-1.5 h-1.5 rounded-full bg-neutral-900" />}
                    </div>
                  </label>

                  {/* bKash / Nagad */}
                  <label 
                    onClick={() => setFormData({ ...formData, paymentMethod: 'bKash' })}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                      formData.paymentMethod === 'bKash' || formData.paymentMethod === 'nagad'
                        ? 'border-[#D12053] bg-[#D12053] text-white shadow-xs' 
                        : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CreditCard size={18} className={formData.paymentMethod === 'bKash' ? 'text-white' : 'text-neutral-700'} />
                      <div>
                        <p className="font-bold text-xs sm:text-sm">বিকাশ / নগদ</p>
                        <p className={`text-[11px] ${formData.paymentMethod === 'bKash' ? 'text-pink-100' : 'text-neutral-500'}`}>
                          মোবাইল ব্যাংকিং পেমেন্ট
                        </p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      formData.paymentMethod === 'bKash' ? 'border-white bg-white' : 'border-neutral-300'
                    }`}>
                      {formData.paymentMethod === 'bKash' && <div className="w-1.5 h-1.5 rounded-full bg-[#D12053]" />}
                    </div>
                  </label>

                </div>
              </div>

              {/* DESKTOP-ONLY ACTION BUTTON (HIDDEN ON MOBILE TO PREVENT DUPLICATE BUTTON WITH STICKY BAR) */}
              <div className="pt-3 hidden lg:block">
                <button 
                  type="submit"
                  disabled={loading || isConnectingGateway}
                  className="w-full bg-[#9f1239] hover:bg-[#881337] active:scale-[0.99] text-white py-4 px-6 rounded-xl text-base font-bold tracking-wide shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isConnectingGateway ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>গেটওয়ে ওপেন হচ্ছে...</span>
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>অর্ডার সম্পন্ন হচ্ছে...</span>
                    </>
                  ) : (
                    <span>Continue to Payment (অর্ডার কনফার্ম করুন)</span>
                  )}
                </button>
              </div>

            </form>

          </div>

        </div>

        {/* Right Column: Order Summary Card */}
        <div className="w-full lg:w-5/12">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-neutral-200/90 shadow-sm sticky top-24 space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <ShoppingBag size={18} className="text-neutral-700" />
                <span>অর্ডার সামারি ({checkoutItems.length} টি পণ্য)</span>
              </h3>
            </div>
            
            {/* Items List */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {checkoutItems.map((item) => (
                <div key={item.cartItemId} className="flex items-center justify-between gap-3 text-sm pb-2.5 border-b border-neutral-100 last:border-b-0 last:pb-0">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-12 h-14 bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200/70 shrink-0 relative">
                      {item.images && item.images.length > 0 ? (
                        <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">ছবি নেই</div>
                      )}
                      <span className="absolute top-1 right-1 bg-black text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-neutral-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {item.selectedSize && <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 mr-1.5">সাইজ: {item.selectedSize}</span>}
                        {item.selectedColor && <span>রং: {item.selectedColor}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="font-black text-xs sm:text-sm text-neutral-900 shrink-0">
                    ৳ {(item.price * item.quantity).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div className="space-y-2 pt-3 border-t border-neutral-100 text-xs sm:text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>পণ্যের মূল্য (Subtotal):</span>
                <span className="font-bold text-neutral-900">৳ {subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-neutral-600 items-center">
                <span>
                  ডেলিভারি চার্জ:
                  <span className="text-[11px] text-neutral-400 block sm:inline sm:ml-1">
                    ({selectedDeliveryOption.labelBn})
                  </span>
                </span>
                <span className="font-bold text-neutral-900">
                  ৳ {shipping.toFixed(0)}
                </span>
              </div>
            </div>
            
            {/* Total */}
            <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
              <div>
                <span className="text-[11px] font-bold text-neutral-500 block">
                  সর্বমোট বিল (Total)
                </span>
                <span className="text-2xl font-black text-neutral-900">
                  ৳ {total.toFixed(0)}
                </span>
              </div>
              <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-lg">
                {formData.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি' : 'বিকাশ/নগদ'}
              </span>
            </div>

            {/* Desktop Order Confirmation Button inside Summary */}
            <button 
              type="button"
              onClick={() => handleSubmit()}
              disabled={loading || isConnectingGateway}
              className="w-full hidden lg:flex bg-[#9f1239] hover:bg-[#881337] active:scale-[0.99] text-white py-3.5 px-5 rounded-xl text-sm font-bold shadow-md transition-all items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              {isConnectingGateway ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>গেটওয়ে ওপেন হচ্ছে...</span>
                </>
              ) : loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>অর্ডার সম্পন্ন হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>অর্ডার সম্পন্ন করুন (৳{total.toFixed(0)})</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Guarantees */}
            <div className="pt-3 border-t border-neutral-100 space-y-2 text-[11px] text-neutral-500 font-medium">
              <div className="flex items-center space-x-2 text-neutral-700">
                <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                <span>১০০% প্রিমিয়াম কোয়ালিটি ও অরিজিনাল পণ্য</span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-700">
                <Truck size={15} className="text-blue-600 shrink-0" />
                <span>দ্রুত হোম ডেলিভারি ও রিয়েল-টাইম ট্র্যাকিং</span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-700">
                <RotateCcw size={15} className="text-amber-600 shrink-0" />
                <span>চেক করে মূল্য পরিশোধের সুবিধা</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* MOBILE STICKY BOTTOM ACTION BAR (REMAINS VISIBLE WHILE SCROLLING) */}
      <div 
        id="mobile-sticky-checkout-bar"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-neutral-200/90 shadow-[0_-6px_30px_rgba(0,0,0,0.12)] px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] lg:hidden animate-in slide-in-from-bottom duration-300"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Price & Summary Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-tight">
                মোট বিল:
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                {formData.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি' : 'বিকাশ/নগদ'}
              </span>
            </div>

            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-neutral-900 leading-none">
                ৳{total.toFixed(0)}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">
                ({checkoutItems.length} টি পণ্য + ডেলিভারি)
              </span>
            </div>
          </div>

          {/* Sticky Action Button */}
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading || isConnectingGateway}
            className="flex-1 max-w-[240px] bg-[#9f1239] hover:bg-[#881337] active:scale-[0.98] text-white py-3.5 px-4 rounded-xl text-sm font-bold shadow-md shadow-rose-950/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {isConnectingGateway ? (
              <>
                <Loader2 size={16} className="animate-spin shrink-0" />
                <span>গেটওয়ে ওপেন হচ্ছে...</span>
              </>
            ) : loading ? (
              <>
                <Loader2 size={16} className="animate-spin shrink-0" />
                <span>অর্ডার সম্পন্ন হচ্ছে...</span>
              </>
            ) : (
              <>
                <span>অর্ডার সম্পন্ন করুন</span>
                <ArrowRight size={16} className="shrink-0 ml-0.5" />
              </>
            )}
          </button>

        </div>
      </div>

    </div>
  );
}
