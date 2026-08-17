import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { trackInitiateCheckout, trackPurchase } from '../lib/pixel';
import { requestLocationAddress } from '../lib/geolocation';
import { BD_DISTRICTS, DistrictInfo } from '../lib/bdData';
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
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Search
} from 'lucide-react';

interface DeliveryOption {
  id: 'inside_dhaka' | 'outside_dhaka';
  labelBn: string;
  labelEn: string;
  subLabelBn: string;
  subLabelEn: string;
  cost: number;
}

const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'inside_dhaka',
    labelBn: 'ঢাকার ভিতরে',
    labelEn: 'Inside Dhaka City',
    subLabelBn: 'ঢাকা সিটির ভেতর দ্রুত হোম ডেলিভারি (১-২ দিন)',
    subLabelEn: 'Home Delivery (1-2 days)',
    cost: 80,
  },
  {
    id: 'outside_dhaka',
    labelBn: 'ঢাকার বাহিরে / অল বাংলাদেশ',
    labelEn: 'All Bangladesh',
    subLabelBn: 'সারাদেশের যেকোনো জেলা ও থানা পর্যায়ে হোম ডেলিভারি (২-৪ দিন)',
    subLabelEn: 'Courier Home Delivery (2-4 days)',
    cost: 120,
  },
];

// Bangladeshi Mobile Number Validation (013, 014, 015, 016, 017, 018, 019 - 11 digits)
const BD_PHONE_REGEX = /^(?:\+8801|8801|01)[3-9]\d{8}$/;

export default function Checkout() {
  const { directCheckoutItem, getCheckoutItems, getCheckoutSubtotal, clearCart, setDirectCheckoutItem, removeItem } = useCartStore();
  const { user } = useAuthStore();
  const { config } = useStoreConfigStore();
  const { language, t } = useLanguageStore();
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
  const [locationMessage, setLocationMessage] = useState<{type: 'error'|'success'|'info'|'warning', text: string} | null>(null);

  // District Search Filter in UI
  const [districtSearch, setDistrictSearch] = useState('');
  const [isDistrictDropdownOpen, setIsDistrictDropdownOpen] = useState(false);

  const checkoutItems = getCheckoutItems();

  // Form State (kept clean & empty by default)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    district: 'Dhaka',
    address: '',
    email: '',
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

  // Handle District Selection with auto-sync to delivery area
  const handleSelectDistrict = (district: DistrictInfo) => {
    const isDhaka = district.isDhaka;
    const targetArea: 'inside_dhaka' | 'outside_dhaka' = isDhaka ? 'inside_dhaka' : 'outside_dhaka';
    setFormData(prev => ({
      ...prev,
      district: district.nameEn,
      deliveryArea: targetArea
    }));
    setIsDistrictDropdownOpen(false);
    setDistrictSearch('');
    if (errorMessage) setErrorMessage(null);
  };

  // Handle Delivery Option change with intelligent district suggestion
  const handleSelectDeliveryOption = (optionId: 'inside_dhaka' | 'outside_dhaka') => {
    setFormData(prev => {
      let newDistrict = prev.district;
      if (optionId === 'inside_dhaka' && prev.district !== 'Dhaka') {
        newDistrict = 'Dhaka';
      } else if (optionId === 'outside_dhaka' && prev.district === 'Dhaka') {
        newDistrict = 'Chattogram';
      }
      return {
        ...prev,
        deliveryArea: optionId,
        district: newDistrict
      };
    });
  };

  const filteredDistricts = BD_DISTRICTS.filter(d => 
    d.nameEn.toLowerCase().includes(districtSearch.toLowerCase()) || 
    d.nameBn.includes(districtSearch)
  );

  const selectedDistrictInfo = BD_DISTRICTS.find(d => d.nameEn.toLowerCase() === (formData.district || 'dhaka').toLowerCase()) || BD_DISTRICTS[0];

  React.useEffect(() => {
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
    setLocationMessage(null);

    try {
      const result = await requestLocationAddress();

      if (result.success && result.address) {
        setFormData(prev => ({ ...prev, address: result.address! }));
        setLocationStatus('success');
        setLocationMessage({
          type: 'success',
          text: 'Location added! You can edit or refine the address if needed.'
        });
      } else {
        setLocationStatus('error');
        setLocationMessage({
          type: 'error',
          text: result.errorMessage || 'Could not obtain location. Please type your delivery address manually.'
        });
      }
    } catch (err) {
      console.warn('Geolocation execution error:', err);
      setLocationStatus('error');
      setLocationMessage({
        type: 'error',
        text: 'Could not obtain location. Please type your delivery address manually.'
      });
    } finally {
      setIsLocating(false);
    }
  };

  if (checkoutItems.length === 0 && !isOrderPlaced && !loading) {
    return <Navigate to="/cart" replace />;
  }

  if (isOrderPlaced) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4 flex-grow flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-xl md:text-2xl font-black uppercase text-neutral-900 tracking-tight">
          {'Placing your order successfully...'}
        </h2>
        <p className="text-xs text-neutral-500">
          Order placed! Redirecting to confirmation page...
        </p>
        <Loader2 className="w-6 h-6 text-neutral-800 animate-spin mx-auto mt-2" />
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (errorMessage) setErrorMessage(null);
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const copyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  // Validate Primary Checkout Details
  const validateForm = (): boolean => {
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage('Please enter your full name (minimum 2 characters).');
      return false;
    }

    const cleanPhone = formData.phone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone || !BD_PHONE_REGEX.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 11-digit Bangladeshi mobile number (e.g. 017XXXXXXXX).');
      return false;
    }

    if (!formData.district.trim()) {
      setErrorMessage('Please select your delivery district.');
      return false;
    }

    if (!formData.address.trim() || formData.address.trim().length < 5) {
      setErrorMessage('Please provide a complete delivery address (House/Road, Area, Thana/Upazila).');
      return false;
    }

    setErrorMessage(null);
    return true;
  };

  // Main Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (formData.paymentMethod === 'bKash' || formData.paymentMethod === 'nagad') {
      setIsConnectingGateway(true);
      setTimeout(() => {
        setIsConnectingGateway(false);
        setShowGatewayModal(true);
      }, 700);
      return;
    }

    // COD Direct Place Order
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

      // Step 1: Validating details
      await new Promise(r => setTimeout(r, 700));
      setOrderProgressStep(2);

      // Sanitize products array to ensure complete JSON serializability
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
        address: formData.address.trim(),
        email: formData.email.trim() || '',
        orderNotes: formData.orderNotes.trim() || '',
        deliveryArea: selectedDeliveryOption.labelEn,
        deliveryAreaBn: selectedDeliveryOption.labelBn,
        deliveryCost: shipping,
        city: formData.district || selectedDeliveryOption.labelEn,
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

      // Step 3: Success Confirmation
      setOrderProgressStep(3);
      await new Promise(r => setTimeout(r, 900));

      // Cache placed order for instantaneous zero-flash rendering on order success page
      try {
        sessionStorage.setItem('last_placed_order_' + orderId, JSON.stringify(orderData));
      } catch (e) {
        console.warn('Could not cache order in sessionStorage', e);
      }

      // Track Meta Pixel Purchase event
      trackPurchase({
        order_id: orderId,
        value: total,
        num_items: sanitizedProducts.reduce((acc, item) => acc + item.quantity, 0),
      });

      // Clear Cart State cleanly
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
      setErrorMessage("We could not place your order due to a network or server error. Please try again.");
    } finally {
      setLoading(false);
      setIsVerifyingPayment(false);
    }
  };

  // Gateway Modal Submit
  const handleGatewayModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSender = formData.senderNumber.trim().replace(/[\s-]/g, '');
    
    if (!cleanSender || !BD_PHONE_REGEX.test(cleanSender)) {
      setErrorMessage('Please enter your valid 11-digit bKash/Nagad sender mobile number.');
      return;
    }

    if (!formData.transactionId.trim() || formData.transactionId.trim().length < 6) {
      setErrorMessage('Please enter a valid Transaction ID (at least 6 characters from SMS).');
      return;
    }

    setIsVerifyingPayment(true);
    setTimeout(async () => {
      await finalizeOrder();
    }, 1000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 w-full flex-grow relative">
      
      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={20} className="shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1 text-xs sm:text-sm font-semibold">
            {errorMessage}
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-700 p-1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* FULLSCREEN ORDER PROCESSING ANIMATED MODAL */}
      {isProcessingOrder && (
        <div className="fixed inset-0 z-50 bg-neutral-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6 flex flex-col items-center border border-neutral-100 animate-in zoom-in-95">
            {/* Animated Icon Ring */}
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
                {orderProgressStep === 3 ? 'Order Secured' : 'Processing Order'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-neutral-900 mt-2 uppercase tracking-tight">
                {orderProgressStep === 1 && 'Validating Details...'}
                {orderProgressStep === 2 && 'Registering Your Order...'}
                {orderProgressStep === 3 && 'Order Confirmed!'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Please wait a moment while we secure your booking at Rare Dreams.
              </p>
            </div>

            {/* Live Progress Bar */}
            <div className="w-full space-y-2">
              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full" 
                  style={{ width: `${(orderProgressStep / 3) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-neutral-400">
                <span className={orderProgressStep >= 1 ? 'text-emerald-600' : ''}>1. Address Check</span>
                <span className={orderProgressStep >= 2 ? 'text-emerald-600' : ''}>2. Reserving Stock</span>
                <span className={orderProgressStep >= 3 ? 'text-emerald-600' : ''}>3. Confirmation</span>
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
              {formData.paymentMethod === 'bKash' ? 'bK' : 'Nagad'}
            </div>
            <div>
              <h3 className="font-black text-lg text-neutral-900 uppercase tracking-tight">Connecting to Gateway...</h3>
              <p className="text-xs text-neutral-500 mt-1">Opening secure {formData.paymentMethod === 'bKash' ? 'bKash' : 'Nagad'} payment portal</p>
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
                  {formData.paymentMethod === 'bKash' ? 'bK' : 'Nagad'}
                </div>
                <div>
                  <h3 className="font-black text-base uppercase tracking-wider leading-none">
                    {formData.paymentMethod === 'bKash' ? 'bKash Merchant Pay' : 'Nagad Payment Gateway'}
                  </h3>
                  <span className="text-[10px] text-white/80 font-medium tracking-wide">RARE DREAMS OFFICIAL PORTAL</span>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Total Payable</span>
                  <span className="text-xl font-black text-neutral-900">৳ {total.toFixed(0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Merchant Name</span>
                  <span className="text-xs font-bold text-neutral-800">Rare Dreams BD</span>
                </div>
              </div>

              {/* Number Copy Box */}
              <div className={`p-4 rounded-2xl border space-y-2.5 ${
                formData.paymentMethod === 'bKash' ? 'bg-pink-50/60 border-pink-200' : 'bg-orange-50/60 border-orange-200'
              }`}>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                  Send Money / Payment to this {formData.paymentMethod === 'bKash' ? 'bKash' : 'Nagad'} Number
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
                    <span>{copiedNumber ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-neutral-600 leading-relaxed pt-1 space-y-0.5">
                  <p>1. Open your {formData.paymentMethod === 'bKash' ? 'bKash' : 'Nagad'} app and <strong className="text-black font-bold">Send Money</strong> to the number above.</p>
                  <p>2. Enter your account number and TrxID below after sending.</p>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1">
                    Your {formData.paymentMethod === 'bKash' ? 'bKash' : 'Nagad'} Number *
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
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1">
                    Transaction ID (TrxID) *
                  </label>
                  <input
                    type="text"
                    name="transactionId"
                    placeholder="e.g. 8N7X9Y2Z"
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
                className={`w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-widest text-white transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer ${
                  formData.paymentMethod === 'bKash' ? 'bg-[#D12053] hover:bg-[#b0133f]' : 'bg-[#F7921E] hover:bg-[#d97c12]'
                } disabled:opacity-60`}
              >
                {isVerifyingPayment || loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Transaction...</span>
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Confirm & Complete Order (৳ {total.toFixed(0)})</span>
                  </>
                )}
              </button>

              <div className="text-center text-[10px] text-neutral-400 font-medium">
                🔒 256-Bit Encrypted Mobile Payment Gateway
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Back Link */}
      <div className="mb-4">
        <Link 
          to="/cart" 
          onClick={() => setDirectCheckoutItem(null)}
          className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-black transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" /> {t('checkout.back_to_cart')}
        </Link>
      </div>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        
        {/* Left Column: Streamlined Simple Checkout Form */}
        <div className="w-full lg:w-7/12 space-y-6">
          
          {/* Header Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/80 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>{'Fast & Secure Checkout'}</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              {'Complete Your Order'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1 font-medium">
              {'Please fill in your details below to complete your order'}
            </p>
          </div>

          {/* Form */}
          <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Customer Information Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/80 shadow-xs space-y-4">
              
              {/* Field: Name */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-neutral-900 mb-1.5">
                  {'Your Name'} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  name="name" 
                  placeholder={'Enter your full name'} 
                  required 
                  autoComplete="name"
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full bg-neutral-50/70 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 px-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-900/10 rounded-2xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400" 
                />
              </div>

              {/* Field: Mobile Number */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-neutral-900 mb-1.5">
                  {'Mobile Number'} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="tel" 
                  name="phone" 
                  placeholder={'11-digit mobile number (e.g. 017XXXXXXXX)'} 
                  required 
                  autoComplete="tel"
                  value={formData.phone} 
                  onChange={handleChange} 
                  className="w-full bg-neutral-50/70 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 px-4 py-3.5 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-900/10 rounded-2xl text-sm font-medium text-neutral-900 font-mono transition-all placeholder:text-neutral-400 placeholder:font-sans" 
                />
              </div>

              {/* Field: District Selection (64 Districts of Bangladesh) */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-neutral-900">
                    {'District / জেলা'} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                    {selectedDistrictInfo.isDhaka ? '৳80 ডেলিভারি চার্জ' : '৳120 ডেলিভারি চার্জ'}
                  </span>
                </div>

                {/* Selected District Trigger Button */}
                <div 
                  onClick={() => setIsDistrictDropdownOpen(!isDistrictDropdownOpen)}
                  className="w-full bg-white border border-neutral-200 hover:border-neutral-400 focus-within:border-neutral-900 px-4 py-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all shadow-2xs"
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <MapPin size={18} className="text-neutral-700 shrink-0" />
                    <div className="truncate">
                      <span className="text-sm font-bold text-neutral-900">
                        {selectedDistrictInfo.nameEn}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium ml-1.5">
                        ({selectedDistrictInfo.nameBn})
                      </span>
                      {selectedDistrictInfo.division && selectedDistrictInfo.division !== selectedDistrictInfo.nameEn && (
                        <span className="text-[11px] text-neutral-400 font-normal ml-1.5 hidden sm:inline">
                          • {selectedDistrictInfo.division} বিভাগ
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                      selectedDistrictInfo.isDhaka 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                    }`}>
                      {selectedDistrictInfo.isDhaka ? 'ঢাকা সিটি (৳80)' : `${selectedDistrictInfo.nameEn} (৳120)`}
                    </span>
                    <ChevronDown size={16} className={`text-neutral-500 transition-transform duration-200 ${isDistrictDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Dropdown Menu with Search */}
                {isDistrictDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsDistrictDropdownOpen(false)} 
                    />
                    <div className="absolute left-0 right-0 top-full mt-2 z-40 bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      {/* Search Bar inside Dropdown */}
                      <div className="p-3 border-b border-neutral-100 bg-neutral-50/80">
                        <div className="relative">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                          <input 
                            type="text"
                            placeholder="Search 64 districts (জেলা খুঁজুন)..."
                            value={districtSearch}
                            onChange={(e) => setDistrictSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:border-neutral-900"
                          />
                        </div>

                        {/* Quick filter popular districts */}
                        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                          {['Dhaka', 'Chattogram', 'Gazipur', 'Sylhet', 'Rajshahi', 'Khulna', 'Bogura', 'Cumilla'].map(popName => {
                            const d = BD_DISTRICTS.find(item => item.nameEn === popName);
                            if (!d) return null;
                            const isCurrent = formData.district.toLowerCase() === d.nameEn.toLowerCase();
                            return (
                              <button
                                key={d.nameEn}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDistrict(d);
                                }}
                                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                                  isCurrent 
                                    ? 'bg-neutral-900 text-white' 
                                    : 'bg-neutral-200/70 text-neutral-700 hover:bg-neutral-300'
                                }`}
                              >
                                {d.nameEn}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* District List */}
                      <div className="max-h-60 overflow-y-auto p-1 divide-y divide-neutral-100/60">
                        {filteredDistricts.length > 0 ? (
                          filteredDistricts.map((district) => {
                            const isSelected = formData.district.toLowerCase() === district.nameEn.toLowerCase();
                            return (
                              <button
                                key={district.nameEn}
                                type="button"
                                onClick={() => handleSelectDistrict(district)}
                                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                  isSelected 
                                    ? 'bg-neutral-900 text-white font-bold' 
                                    : 'hover:bg-neutral-100 text-neutral-800 font-medium'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold">{district.nameEn}</span>
                                  <span className={isSelected ? 'text-neutral-300' : 'text-neutral-400 text-[11px]'}>
                                    ({district.nameBn})
                                  </span>
                                  {district.division && district.division !== district.nameEn && (
                                    <span className={`text-[10px] ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>
                                      • {district.division}
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : district.isDhaka
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-neutral-100 text-neutral-700'
                                }`}>
                                  ৳{district.isDhaka ? '80' : '120'}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-neutral-500">
                            No district found matching "{districtSearch}"
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Field: Full Address */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs sm:text-sm font-bold text-neutral-900">
                    {'Full Delivery Address'} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoLocate}
                    disabled={isLocating}
                    className={`inline-flex items-center space-x-1 text-[10px] sm:text-xs font-bold py-1 px-2.5 rounded-full transition-all active:scale-95 shadow-xs border ${
                      isLocating
                        ? 'text-neutral-500 bg-neutral-100 border-neutral-200 cursor-wait'
                        : locationStatus === 'success'
                        ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 cursor-pointer'
                        : locationStatus === 'error'
                        ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200 cursor-pointer'
                        : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200/60 cursor-pointer'
                    }`}
                  >
                    {isLocating ? (
                      <>
                        <Loader2 size={12} className="animate-spin text-neutral-600" />
                        <span>Locating...</span>
                      </>
                    ) : locationStatus === 'success' ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span>Location Added</span>
                      </>
                    ) : locationStatus === 'error' ? (
                      <>
                        <RotateCcw size={12} className="text-amber-700" />
                        <span>Try Again</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={12} className="text-indigo-600" />
                        <span>Auto-fill Location</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  name="address" 
                  rows={2}
                  placeholder={'House/Flat No, Road, Area, Thana/Upazila'} 
                  required 
                  autoComplete="street-address"
                  value={formData.address} 
                  onChange={handleChange} 
                  className="w-full bg-neutral-50/70 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-900/10 rounded-2xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 resize-none" 
                />
                {locationMessage && (
                  <div className={`mt-2 p-2.5 rounded-xl flex items-start space-x-2 text-xs font-medium animate-in fade-in slide-in-from-top-1 ${
                    locationMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                    locationMessage.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                    locationMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                    'bg-blue-50 text-blue-700 border border-blue-100'
                  }`}>
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{locationMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Field: Email (Optional) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-neutral-900 mb-1.5">
                  {'Email Address (Optional)'}
                </label>
                <input 
                  type="email" 
                  name="email" 
                  placeholder={'Your email address (optional)'} 
                  autoComplete="email"
                  value={formData.email} 
                  onChange={handleChange} 
                  className="w-full bg-neutral-50/70 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-900/10 rounded-2xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400" 
                />
              </div>

              {/* Field: Order Note (Optional) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-neutral-900 mb-1.5">
                  {'Order Note (Optional)'}
                </label>
                <input 
                  type="text" 
                  name="orderNotes" 
                  placeholder={'Special instructions or delivery notes (optional)'} 
                  autoComplete="off"
                  value={formData.orderNotes} 
                  onChange={handleChange} 
                  className="w-full bg-neutral-50/70 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-neutral-900/10 rounded-2xl text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400" 
                />
              </div>

            </div>

            {/* 2. Delivery Location Selection - Simplified to 2 tiers (Inside Dhaka 80 TK, Outside Dhaka 120 TK) */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/80 shadow-xs space-y-3">
              <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-900 mb-1 flex items-center justify-between">
                <span>{'Delivery Area & Charge'}</span>
                <span className="text-xs font-semibold text-neutral-400">{'2 tiers'}</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DELIVERY_OPTIONS.map((opt) => {
                  const isSelected = formData.deliveryArea === opt.id;
                  return (
                    <div 
                      key={opt.id}
                      onClick={() => handleSelectDeliveryOption(opt.id)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                        isSelected 
                          ? 'border-neutral-900 bg-neutral-900/5 shadow-xs' 
                          : 'border-neutral-200/90 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300 bg-white'
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-neutral-950 font-black' : 'text-neutral-800'}`}>
                              {opt.labelBn}
                            </p>
                            <p className="text-[11px] text-neutral-500 font-medium">
                              {opt.labelEn}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm sm:text-base font-black ${isSelected ? 'text-neutral-900' : 'text-neutral-700'}`}>
                          ৳{opt.cost}
                        </span>
                      </div>
                      
                      <div className="mt-3 pt-2.5 border-t border-neutral-100 text-[11px] text-neutral-500">
                        {opt.subLabelBn}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Payment Method Selection */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/80 shadow-xs space-y-3">
              <label className="block text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-900 mb-1">
                {'Payment Method'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* COD Option */}
                <label 
                  onClick={() => setFormData({ ...formData, paymentMethod: 'cod' })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    formData.paymentMethod === 'cod' 
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-md' 
                      : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-xs sm:text-sm">
                      {'Cash on Delivery'}
                    </span>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="cod" 
                      checked={formData.paymentMethod === 'cod'} 
                      onChange={() => {}} 
                      className="w-4 h-4 text-black cursor-pointer" 
                    />
                  </div>
                  <span className={`text-[11px] ${formData.paymentMethod === 'cod' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    {'Pay when product arrives'}
                  </span>
                </label>

                {/* bKash Option */}
                <label 
                  onClick={() => setFormData({ ...formData, paymentMethod: 'bKash' })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    formData.paymentMethod === 'bKash' 
                      ? 'border-[#D12053] bg-[#D12053] text-white shadow-md' 
                      : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-xs sm:text-sm">bKash</span>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="bKash" 
                      checked={formData.paymentMethod === 'bKash'} 
                      onChange={() => {}} 
                      className="w-4 h-4 text-[#D12053] cursor-pointer" 
                    />
                  </div>
                  <span className={`text-[11px] ${formData.paymentMethod === 'bKash' ? 'text-pink-100' : 'text-neutral-500'}`}>
                    Send Money / Gateway
                  </span>
                </label>

                {/* Nagad Option */}
                <label 
                  onClick={() => setFormData({ ...formData, paymentMethod: 'nagad' })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    formData.paymentMethod === 'nagad' 
                      ? 'border-[#F7921E] bg-[#F7921E] text-white shadow-md' 
                      : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-xs sm:text-sm">Nagad</span>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="nagad" 
                      checked={formData.paymentMethod === 'nagad'} 
                      onChange={() => {}} 
                      className="w-4 h-4 text-[#F7921E] cursor-pointer" 
                    />
                  </div>
                  <span className={`text-[11px] ${formData.paymentMethod === 'nagad' ? 'text-orange-100' : 'text-neutral-500'}`}>
                    Send Money / Gateway
                  </span>
                </label>
              </div>

              {formData.paymentMethod !== 'cod' && (
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 flex items-center space-x-2 mt-2">
                  <Smartphone size={16} className={formData.paymentMethod === 'bKash' ? 'text-[#D12053]' : 'text-[#F7921E]'} />
                  <span>
                    {`Clicking confirm will launch the ${formData.paymentMethod === 'bKash' ? 'bKash' : 'Nagad'} payment portal.`}
                  </span>
                </div>
              )}
            </div>

            {/* Mobile / Direct Order Button for Small Screens */}
            <div className="block lg:hidden space-y-3 pt-2">
              <button 
                type="submit"
                disabled={loading || isConnectingGateway}
                className="w-full bg-[#f05a28] hover:bg-[#d94a1d] text-white py-4 px-6 rounded-2xl text-base font-black tracking-wide shadow-lg active:scale-98 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
              >
                {isConnectingGateway ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{'Connecting Gateway...'}</span>
                  </>
                ) : loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{'Confirming Order...'}</span>
                  </>
                ) : (
                  <span>
                    {`Confirm Order ${total.toFixed(0)} TK`}
                  </span>
                )}
              </button>

              <p className="text-center text-xs text-neutral-600 font-medium leading-relaxed px-2">
                {'Our customer representative will call you shortly to confirm your order.'}
              </p>
            </div>

          </form>
        </div>

        {/* Right Column: Order Summary & Confirmation CTA */}
        <div className="w-full lg:w-5/12">
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/80 shadow-md sticky top-24 space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <ShoppingBag size={18} className="text-neutral-700" />
                <span>{'Order Summary'} ({checkoutItems.length})</span>
              </h2>
            </div>
            
            {/* Items List */}
            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {checkoutItems.map((item) => (
                <div key={item.cartItemId} className="flex items-center justify-between gap-3 text-sm pb-3 border-b border-neutral-100 last:border-b-0 last:pb-0">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-14 h-16 bg-neutral-100 rounded-2xl overflow-hidden border border-neutral-200/70 shrink-0 relative">
                      {item.images && item.images.length > 0 ? (
                        <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">No img</div>
                      )}
                      <span className="absolute top-1 right-1 bg-black text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-neutral-900 truncate">{item.name}</p>
                      <p className="text-[11px] font-medium text-neutral-500 mt-0.5">
                        {item.selectedSize && <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 mr-1.5">{item.selectedSize}</span>}
                        {item.selectedColor && <span className="text-neutral-600">{item.selectedColor}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="font-black text-xs sm:text-sm text-neutral-900 shrink-0">
                    ৳ {(item.price * item.quantity).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2.5 pt-4 border-t border-neutral-100 text-xs sm:text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>{'Subtotal'}</span>
                <span className="font-bold text-neutral-900">৳ {subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-neutral-600 items-center">
                <span>
                  {'Delivery Charge'}
                  <span className="text-[11px] text-neutral-400 block sm:inline sm:ml-1">
                    ({selectedDeliveryOption.labelEn})
                  </span>
                </span>
                <span className="font-bold text-neutral-900">
                  ৳ {shipping.toFixed(0)}
                </span>
              </div>
            </div>
            
            {/* Total */}
            <div className="flex justify-between items-center pt-4 border-t border-neutral-200">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400 block">
                  {'Total Payable'}
                </span>
                <span className="text-2xl font-black text-neutral-900">
                  ৳ {total.toFixed(0)}
                </span>
              </div>
              <span className="text-xs font-black text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-xl uppercase">
                {formData.paymentMethod === 'cod' ? ('Cash on Delivery') : formData.paymentMethod.toUpperCase()}
              </span>
            </div>

            {/* Desktop Order Confirm Button */}
            <div className="hidden lg:block space-y-3 pt-2">
              <button 
                form="checkout-form"
                type="submit"
                disabled={loading || isConnectingGateway}
                className="w-full bg-[#f05a28] hover:bg-[#d94a1d] text-white py-4 px-6 rounded-2xl text-base font-black tracking-wide shadow-lg active:scale-98 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
              >
                {isConnectingGateway ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{'Connecting Gateway...'}</span>
                  </>
                ) : loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{'Confirming Order...'}</span>
                  </>
                ) : (
                  <span>
                    {`Confirm Order ${total.toFixed(0)} TK`}
                  </span>
                )}
              </button>

              <p className="text-center text-xs text-neutral-600 font-medium leading-relaxed px-2">
                {'Our customer representative will call you shortly to confirm your order.'}
              </p>
            </div>

            {/* Trust Assurances */}
            <div className="pt-3 border-t border-neutral-100 space-y-2 text-[11px] text-neutral-500 font-medium">
              <div className="flex items-center space-x-2 text-neutral-700">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>{'100% Original & Premium Quality Guarantee'}</span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-700">
                <Truck size={16} className="text-blue-600 shrink-0" />
                <span>{'Fast doorstep delivery with real-time tracking'}</span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-700">
                <RotateCcw size={16} className="text-amber-600 shrink-0" />
                <span>{'Pay after check & 7-Day Hassle-Free Exchange'}</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

