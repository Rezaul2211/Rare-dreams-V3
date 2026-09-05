import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguageStore } from '../store/useLanguageStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { 
  CheckCircle2, 
  ShoppingBag, 
  Phone, 
  MapPin, 
  CreditCard, 
  MessageCircle, 
  ArrowRight, 
  ArrowLeft,
  Loader2, 
  PackageCheck, 
  Truck, 
  Copy, 
  Check, 
  Sparkles,
  Box
} from 'lucide-react';
import SEO from '../components/SEO';

export default function OrderSuccess() {
  const { language } = useLanguageStore();
  const { config } = useStoreConfigStore();
  const { id } = useParams();
  const location = useLocation();

  // Instant initial state from location.state or sessionStorage to avoid layout shift/footer jumping
  const [order, setOrder] = useState<any>(() => {
    if (location.state?.initialOrder) {
      return location.state.initialOrder;
    }
    if (id) {
      try {
        const cached = sessionStorage.getItem('last_placed_order_' + id);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (location.state?.initialOrder) return false;
    if (id && sessionStorage.getItem('last_placed_order_' + id)) return false;
    return true;
  });
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    // Instant scroll to top on mount
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const fetchOrder = async () => {
      if (!id) return;
      try {
        // First try Zero-Quota Server API
        try {
          const srvRes = await fetch(`/api/orders/${id}`);
          if (srvRes.ok) {
            const srvData = await srvRes.json();
            if (srvData?.order) {
              setOrder(srvData.order);
              return;
            }
          }
        } catch (e) {}

        // Fallback to Firestore
        const orderRef = doc(db, 'orders', id);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          setOrder({ id: orderSnap.id, ...orderSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching order confirmation:", error);
      } finally {
        setLoading(false);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    };
    fetchOrder();
  }, [id]);

  const copyOrderId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const cleanWhatsappNumber = (config.whatsappNumber || '+8801712345678').replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent(
    `Hello Rare Dreams! I have just placed order #${id}. Please confirm my order.`
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-8 w-full flex-grow min-h-[85vh]">
      <SEO 
        title={`Order #${id} Confirmed | Rare Dreams`}
        description="Your order has been confirmed successfully at Rare Dreams."
      />

      {/* Navigation Breadcrumb / Back to Home */}
      <div className="flex items-center space-x-2 text-xs font-medium text-neutral-500 mb-4 sm:mb-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 -ml-1 text-neutral-700 hover:text-black hover:bg-neutral-200/60 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          <span className="font-semibold">Back to Home</span>
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-neutral-900 font-semibold">Order Confirmed</span>
      </div>

      {/* Top Banner with Celebration Animation */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-neutral-200/80 shadow-xs text-center space-y-4 mb-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Animated Celebration Ring */}
        <div className="relative inline-block">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={46} className="text-emerald-600 animate-bounce" />
          </div>
          <div className="absolute -top-1 -right-1 text-amber-500 animate-pulse">
            <Sparkles size={22} />
          </div>
        </div>

        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            Order Confirmed & Received
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-neutral-900 mt-3 font-display">
            Thank You For Your Order!
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto mt-2 leading-relaxed">
            Our team will call or SMS you shortly to confirm the order and dispatch your package immediately.
          </p>
        </div>

        {/* Order ID Pill with Copy Button */}
        <div className="pt-2 flex items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-2xl text-xs font-mono font-bold tracking-wider shadow-sm">
            <span>Order ID: #{id}</span>
            <button 
              onClick={copyOrderId} 
              className="p-1 hover:bg-neutral-800 rounded-md transition-colors text-neutral-300 hover:text-white cursor-pointer"
              title="Copy Order ID"
            >
              {copiedId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Live Order Stage Tracker */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-200/80 shadow-xs mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Truck size={16} className="text-neutral-800" /> Real-Time Live Status
          </h3>
          <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {order?.status || 'Pending'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 relative py-2">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-neutral-100 -translate-y-1/2 z-0" />
          <div className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 w-1/4" />

          {/* Step 1: Placed */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-neutral-800 mt-2">Placed</span>
            <span className="text-[9px] text-neutral-400 hidden sm:block">Received</span>
          </div>

          {/* Step 2: Processing */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold bg-neutral-100 text-neutral-500 border border-neutral-200">
              <Box size={16} />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-neutral-600 mt-2">Packing</span>
            <span className="text-[9px] text-neutral-400 hidden sm:block">QC Check</span>
          </div>

          {/* Step 3: Shipped */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold bg-neutral-100 text-neutral-500 border border-neutral-200">
              <Truck size={16} />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-neutral-600 mt-2">Shipped</span>
            <span className="text-[9px] text-neutral-400 hidden sm:block">Courier</span>
          </div>

          {/* Step 4: Delivered */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold bg-neutral-100 text-neutral-500 border border-neutral-200">
              <CheckCircle2 size={16} />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-neutral-600 mt-2">Delivered</span>
            <span className="text-[9px] text-neutral-400 hidden sm:block">Handover</span>
          </div>
        </div>

        {/* Live Track Button for Guest */}
        <div className="pt-2">
          <Link
            to={`/track-order?id=${id}`}
            className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-3 px-4 rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Truck size={16} />
            <span>Track Parcel Live (অর্ডার ট্র্যাক করুন)</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12 text-neutral-400 text-xs font-bold uppercase tracking-wider">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading Order Details...
        </div>
      ) : order ? (
        <div className="space-y-6">
          {/* Products Ordered */}
          <div className="bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2 border-b border-neutral-100 pb-3">
              <ShoppingBag size={16} className="text-neutral-700" />
              <span>Order Items ({order.products?.length || 0})</span>
            </h2>

            <div className="divide-y divide-neutral-100">
              {order.products?.map((item: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-14 h-16 bg-neutral-100 rounded-xl overflow-hidden border border-neutral-200 shrink-0">
                      {item.images && item.images.length > 0 && (
                        <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-neutral-900">{item.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Qty: <span className="font-bold text-black">{item.quantity}</span> {item.selectedSize && `• Size: ${item.selectedSize}`} {item.selectedColor && `• Color: ${item.selectedColor}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-black text-xs sm:text-sm text-neutral-900">
                    ৳ {((item.discountPrice || item.price) * item.quantity).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-neutral-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal</span>
                <span>৳ {order.subtotal?.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Delivery Charge</span>
                <span>{order.shipping === 0 ? 'FREE' : `৳ ${order.shipping}`}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-neutral-900 pt-2 border-t border-neutral-200">
                <span>Total Amount</span>
                <span>৳ {order.total?.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Delivery & Payment Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Delivery Info */}
            <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <MapPin size={14} className="text-neutral-700" /> Delivery Address
              </span>
              <div className="text-xs space-y-1 text-neutral-800">
                <p className="font-bold text-sm text-neutral-900">{order.customerName}</p>
                <p className="font-mono text-neutral-700">{order.phone}</p>
                <p className="text-neutral-900 font-semibold">
                  Location: <span className="font-normal text-neutral-700">{order.thana ? `${order.thana}, ` : ''}{order.district || 'N/A'}</span>
                </p>
                <p className="text-neutral-700 font-medium whitespace-pre-wrap">{order.address}</p>
                {order.deliveryArea && (
                  <p className="text-neutral-500 font-medium">Area: {order.deliveryAreaBn || order.deliveryArea}</p>
                )}
                {order.orderNotes && (
                  <p className="text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200 text-[11px] mt-1">
                    <strong>Note:</strong> {order.orderNotes}
                  </p>
                )}
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <CreditCard size={14} className="text-neutral-700" /> Payment Summary
              </span>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Payment Method</span>
                  <span className="font-black uppercase bg-neutral-100 px-2 py-0.5 rounded text-neutral-900">
                    {order.paymentMethod}
                  </span>
                </div>
                {order.senderNumber && order.senderNumber !== 'N/A' && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Sender Account</span>
                    <span className="font-mono font-bold text-neutral-900">{order.senderNumber}</span>
                  </div>
                )}
                {order.transactionId && order.transactionId !== 'N/A' && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Transaction ID</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {order.transactionId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-neutral-500">Payment Status</span>
                  <span className="font-bold uppercase text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    {order.paymentStatus || 'Pending Verification'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a 
          href={`https://wa.me/${cleanWhatsappNumber}?text=${whatsappMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer"
        >
          <MessageCircle size={18} />
          <span>{'Chat with Rare Dreams on WhatsApp'}</span>
        </a>

        <Link 
          to="/shop" 
          className="w-full sm:w-auto bg-black text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer"
        >
          <span>{'Continue Shopping'}</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}


