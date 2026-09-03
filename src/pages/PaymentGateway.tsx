import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { trackPurchase } from '../lib/pixel';
import { requestPushNotificationPermission, notifyAdminsOfNewOrder } from '../lib/pushNotifications';
import { 
  ChevronLeft, 
  Copy, 
  Check, 
  Smartphone, 
  Loader2, 
  AlertTriangle, 
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';

const BD_PHONE_REGEX = /^(?:\+8801|8801|01)[3-9]\d{8}$/;

export default function PaymentGateway() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart, setDirectCheckoutItem, removeItem } = useCartStore();
  const { user } = useAuthStore();
  const { config } = useStoreConfigStore();

  const checkoutState = location.state as {
    formData?: {
      name: string;
      phone: string;
      email: string;
      district: string;
      thana: string;
      address: string;
      orderNotes: string;
      deliveryArea: string;
      paymentMethod: 'bKash' | 'nagad';
    };
    checkoutItems?: any[];
    subtotal?: number;
    shipping?: number;
    total?: number;
    selectedDeliveryOption?: any;
    directCheckoutItem?: any;
  } | null;

  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderProgressStep, setOrderProgressStep] = useState<number>(1);

  // Redirect to checkout if state is missing
  useEffect(() => {
    if (!checkoutState || !checkoutState.formData || !checkoutState.checkoutItems?.length) {
      navigate('/checkout', { replace: true });
    }
  }, [checkoutState, navigate]);

  if (!checkoutState || !checkoutState.formData || !checkoutState.checkoutItems?.length) {
    return null;
  }

  const { formData, checkoutItems, subtotal = 0, shipping = 0, total = 0, selectedDeliveryOption, directCheckoutItem } = checkoutState;
  const paymentMethod = formData.paymentMethod || 'bKash';
  const isBkash = paymentMethod === 'bKash';

  const BKASH_NUMBER = config.bkashNumber || '01954710343';
  const NAGAD_NUMBER = config.nagadNumber || '01342563522';
  const activeNumber = isBkash ? BKASH_NUMBER : NAGAD_NUMBER;

  const handleCopyNumber = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(activeNumber);
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2000);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanSender = senderNumber.trim().replace(/[\s-]/g, '');
    if (!cleanSender || !BD_PHONE_REGEX.test(cleanSender)) {
      setErrorMessage(`অনুগ্রহ করে সঠিক ১১ ডিজিটের ${isBkash ? 'বিকাশ' : 'নগদ'} সেন্ডার নম্বর লিখুন।`);
      return;
    }

    if (!transactionId.trim() || transactionId.trim().length < 6) {
      setErrorMessage('অনুগ্রহ করে SMS থেকে সঠিক ট্রানজেকশন আইডি (TrxID) লিখুন।');
      return;
    }

    setIsProcessing(true);
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
        deliveryArea: selectedDeliveryOption?.labelEn || 'Standard Delivery',
        deliveryAreaBn: selectedDeliveryOption?.labelBn || 'ডেলিভারি',
        deliveryCost: shipping,
        city: `${formData.thana ? formData.thana + ', ' : ''}${formData.district}`,
        products: sanitizedProducts,
        itemsCount: sanitizedProducts.reduce((acc, item) => acc + item.quantity, 0),
        subtotal,
        shipping,
        total,
        paymentMethod: paymentMethod,
        senderNumber: cleanSender,
        transactionId: transactionId.trim().toUpperCase(),
        paymentStatus: 'pending_verification',
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };

      await setDoc(orderRef, {
        ...orderData,
        createdAt: serverTimestamp(),
      });

      // Dispatch instant push notification alert to admins
      notifyAdminsOfNewOrder({
        id: orderId,
        customerName: formData.name.trim(),
        phone: cleanPhone,
        total: total,
        district: formData.district,
        itemsCount: sanitizedProducts.reduce((acc, item) => acc + item.quantity, 0),
      }).catch((e) => console.warn('Admin notification dispatch error in PaymentGateway:', e));

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
    } catch (err) {
      console.error("Error saving payment order:", err);
      setIsProcessing(false);
      setErrorMessage("অর্ডারটি সম্পন্ন করা সম্ভব হয়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।");
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 md:py-10 w-full flex-grow min-h-screen bg-neutral-50/60">
      
      {/* Back to Checkout */}
      <div className="flex items-center justify-between mb-4">
        <Link 
          to="/checkout" 
          className="inline-flex items-center text-xs font-bold text-neutral-600 hover:text-orange-600 transition-colors"
        >
          <ChevronLeft size={16} className="mr-0.5" /> চেকআউটে ফিরে যান
        </Link>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 shadow-xs animate-in fade-in">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600" />
          <p className="flex-1 text-xs sm:text-sm font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* FULLSCREEN ORDER PROCESSING ANIMATED MODAL */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-neutral-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6 flex flex-col items-center border border-neutral-100 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center shadow-inner">
              {orderProgressStep === 3 ? (
                <CheckCircle2 size={42} className="text-emerald-600 animate-bounce" />
              ) : (
                <Loader2 size={36} className="text-orange-600 animate-spin" />
              )}
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-700 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                {orderProgressStep === 3 ? 'অর্ডার সংরক্ষিত হয়েছে' : 'পেমেন্ট ও অর্ডার প্রসেস হচ্ছে'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-neutral-900 mt-2 tracking-tight">
                {orderProgressStep === 1 && 'পেমেন্ট তথ্য যাচাই করা হচ্ছে...'}
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
                <span className={orderProgressStep >= 1 ? 'text-orange-600' : ''}>১. TrxID যাচাই</span>
                <span className={orderProgressStep >= 2 ? 'text-orange-600' : ''}>২. অর্ডার তৈরি</span>
                <span className={orderProgressStep >= 3 ? 'text-emerald-600' : ''}>৩. সম্পন্ন</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN PAYMENT CARD */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-md border border-neutral-200/90">
        
        {/* Header with Consistent Orange Theme */}
        <div className="bg-orange-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-lg">
              {isBkash ? 'bK' : 'নগদ'}
            </div>
            <div>
              <h1 className="font-black text-base sm:text-lg tracking-wider leading-none">
                {isBkash ? 'বিকাশ পেমেন্ট' : 'নগদ পেমেন্ট'}
              </h1>
              <span className="text-[11px] text-white/90 font-medium tracking-wide">
                নিরাপদ পেমেন্ট গেটওয়ে
              </span>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handlePaymentSubmit} className="p-5 sm:p-7 space-y-5">
          
          {/* Payable summary */}
          <div className="bg-orange-50/60 rounded-2xl p-4 border border-orange-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-neutral-500 block">মোট প্রদেয় টাকা</span>
              <span className="text-2xl font-black text-orange-600 font-mono">৳ {total.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-neutral-500 block">মার্চেন্ট</span>
              <span className="text-xs font-black text-neutral-900">Rare Dreams BD</span>
            </div>
          </div>

          {/* Number Copy Box */}
          <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 bg-neutral-50/80 space-y-3">
            <span className="text-xs font-black text-neutral-800 block">
              এই নম্বরে SEND MONEY করুন
            </span>
            
            <div className="flex items-center justify-between bg-white px-4 py-3.5 rounded-xl border border-neutral-300 shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <Smartphone size={20} className="text-orange-600" />
                <span className="text-lg sm:text-xl font-black text-neutral-900 font-mono tracking-wider">
                  {activeNumber}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyNumber}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  copiedNumber 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-neutral-900 text-white hover:bg-black'
                }`}
              >
                {copiedNumber ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedNumber ? 'কপি হয়েছে' : 'কপি করুন'}</span>
              </button>
            </div>

            <div className="text-xs text-neutral-600 leading-relaxed pt-1 space-y-1 bg-white/60 p-3 rounded-xl border border-neutral-200/60">
              <p className="font-semibold text-neutral-800">
                ১. আপনার {isBkash ? 'বিকাশ অথবা নগদ' : 'নগদ অথবা বিকাশ'} অ্যাপে ঢুকে ওপরের নম্বরে Send Money করুন।
              </p>
              <p className="font-semibold text-neutral-800">
                ২. নিচে আপনার প্রেরক মোবাইল নম্বর এবং মেসেজে পাওয়া TrxID লিখে অর্ডার নিশ্চিত করুন।
              </p>
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                আপনার {isBkash ? 'বিকাশ' : 'নগদ'} নম্বর *
              </label>
              <input
                type="tel"
                placeholder="017XXXXXXXX"
                required
                autoComplete="off"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                className="w-full bg-white border border-neutral-300 px-4 py-3.5 rounded-xl text-sm font-mono font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all text-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                ট্রানজেকশন আইডি (TrxID) *
              </label>
              <input
                type="text"
                placeholder="যেমন: 8N7X9Y2Z"
                required
                autoComplete="off"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full bg-white border border-neutral-300 px-4 py-3.5 rounded-xl text-sm font-mono font-bold uppercase outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all text-neutral-900"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 rounded-xl text-base font-black text-white bg-orange-600 hover:bg-orange-700 active:scale-[0.99] transition-all shadow-md shadow-orange-600/25 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>যাচাই করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>অর্ডার নিশ্চিত করুন (৳ {total.toLocaleString()})</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* Guarantee */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 font-medium pt-1">
            <ShieldCheck size={15} className="text-emerald-600" />
            <span>১০০% নিরাপদ ও সুরক্ষিত লেনদেন</span>
          </div>

        </form>

      </div>

    </div>
  );
}
