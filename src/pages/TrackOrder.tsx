import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { 
  Search, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MapPin, 
  Phone, 
  ShoppingBag, 
  MessageCircle, 
  Headphones, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Box
} from 'lucide-react';
import SEO from '../components/SEO';

interface TrackedOrder {
  id: string;
  customerName: string;
  phone: string;
  district?: string;
  address: string;
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | string;
  paymentMethod: string;
  paymentStatus?: string;
  total: number;
  subtotal?: number;
  shipping?: number;
  deliveryArea?: string;
  deliveryAreaBn?: string;
  courierName?: string;
  trackingNumber?: string;
  products?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    selectedSize?: string;
    selectedColor?: string;
    images?: string[];
  }>;
  createdAt?: any;
}

export default function TrackOrder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('id') || searchParams.get('order') || searchParams.get('phone') || '';
  
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchedOrders, setSearchedOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { config } = useStoreConfigStore();
  const { language } = useLanguageStore();

  const handleSearch = async (term: string) => {
    const cleanTerm = term.trim().replace(/^#/, '');
    if (!cleanTerm) {
      setErrorMessage('Please enter an Order ID or 11-digit Mobile Number.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setHasSearched(true);
    setSearchedOrders([]);

    try {
      let results: TrackedOrder[] = [];

      // 1. Try fetching directly as Firestore Document ID
      try {
        const directDoc = await getDoc(doc(db, 'orders', cleanTerm));
        if (directDoc.exists()) {
          results.push({ id: directDoc.id, ...(directDoc.data() as any) });
        }
      } catch (err) {
        // Document ID not found or syntax error, proceed to query search
      }

      // 2. If not found directly, search by phone number
      if (results.length === 0) {
        const cleanPhone = cleanTerm.replace(/[\s-]/g, '');
        const phoneQuery = query(collection(db, 'orders'), where('phone', '==', cleanPhone));
        const phoneSnap = await getDocs(phoneQuery);
        
        phoneSnap.forEach((d) => {
          results.push({ id: d.id, ...(d.data() as any) });
        });
      }

      // 3. If still not found, search by id field or partial match
      if (results.length === 0) {
        const idQuery = query(collection(db, 'orders'), where('id', '==', cleanTerm));
        const idSnap = await getDocs(idQuery);
        idSnap.forEach((d) => {
          results.push({ id: d.id, ...(d.data() as any) });
        });
      }

      // Sort results by newest first
      results.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      if (results.length === 0) {
        setErrorMessage(`No order found matching "${cleanTerm}". Please check your Order ID or phone number.`);
      } else {
        setSearchedOrders(results);
      }
    } catch (err) {
      console.error("Error tracking order:", err);
      setErrorMessage("Could not connect to tracking server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setSearchInput(initialQuery);
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const getStatusStep = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'cancelled') return -1;
    if (s === 'delivered') return 4;
    if (s === 'shipped') return 3;
    if (s === 'processing' || s === 'confirmed') return 2;
    return 1; // Pending / Received
  };

  return (
    <div className="min-h-screen bg-neutral-50/70 py-8 sm:py-12 text-neutral-900">
      <SEO 
        title="Track Your Order | Rare Dreams Bangladesh"
        description="Check live real-time status of your parcel delivery by Order ID or phone number."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs font-medium text-neutral-500 mb-6">
          <button
            onClick={() => window.history.back()}
            aria-label="Go Back"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 -ml-1 text-neutral-700 hover:text-black hover:bg-neutral-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            <span className="font-semibold">Back</span>
          </button>
          <span className="text-neutral-300">/</span>
          <Link to="/" className="hover:text-black transition-colors">Home</Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-semibold">Track Order</span>
        </div>

        {/* Header Hero Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-neutral-200/80 shadow-xs mb-8 text-center relative overflow-hidden">
          <div className="w-16 h-16 bg-neutral-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Truck size={32} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-900">
            Track Your Order
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto mt-2 leading-relaxed">
            Enter your <strong>Order ID</strong> (from SMS/Confirmation) or <strong>Mobile Number</strong> to view real-time delivery status.
          </p>

          {/* Search Box */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(searchInput);
            }} 
            className="mt-6 max-w-lg mx-auto flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g. RD-171234 or 017XXXXXXXX"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 pl-11 text-sm font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 transition-all shadow-inner"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-neutral-900 hover:bg-black text-white px-6 py-3.5 rounded-2xl text-sm font-bold tracking-wide uppercase transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Track Status</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Helper Notes */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium text-neutral-400">
            <span className="flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-600" /> 100% Genuine Tracking
            </span>
            <span>•</span>
            <span>Fast Nationwide Delivery</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-8 text-rose-800 flex items-start gap-3 shadow-xs animate-in fade-in">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="text-xs sm:text-sm">
              <p className="font-bold">No Order Found</p>
              <p className="mt-0.5 text-rose-700">{errorMessage}</p>
              <p className="mt-2 text-[11px] text-rose-600 font-medium">
                Need quick assistance? Contact helpline: <a href={`tel:${config.helplineNumber}`} className="font-bold underline">{config.helplineNumber}</a>
              </p>
            </div>
          </div>
        )}

        {/* Results List */}
        {searchedOrders.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {searchedOrders.map((order) => {
              const currentStep = getStatusStep(order.status);
              const isCancelled = order.status?.toLowerCase() === 'cancelled';

              return (
                <div key={order.id} className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-xs space-y-6">
                  
                  {/* Order Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Order ID:</span>
                        <span className="font-mono font-black text-sm sm:text-base text-neutral-900 bg-neutral-100 px-2.5 py-0.5 rounded-lg">
                          #{order.id}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Recipient: <strong className="text-neutral-800">{order.customerName}</strong> ({order.phone})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${
                        isCancelled
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : order.status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : order.status === 'Shipped'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {order.status || 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Visual Status Progress Tracker */}
                  {!isCancelled ? (
                    <div className="py-3 sm:py-4">
                      <div className="grid grid-cols-4 gap-2 relative">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-neutral-100 -translate-y-1/2 z-0" />
                        <div 
                          className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(0, ((currentStep - 1) / 3) * 100))}%` }}
                        />

                        {/* Step 1: Placed */}
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            currentStep >= 1 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-neutral-200 text-neutral-500'
                          }`}>
                            <CheckCircle2 size={18} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-neutral-800 mt-2">Placed</span>
                          <span className="text-[9px] text-neutral-400 hidden sm:block">Order Received</span>
                        </div>

                        {/* Step 2: Confirmed */}
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            currentStep >= 2 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-neutral-200 text-neutral-500'
                          }`}>
                            <Box size={18} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-neutral-800 mt-2">Processing</span>
                          <span className="text-[9px] text-neutral-400 hidden sm:block">Quality Check</span>
                        </div>

                        {/* Step 3: Shipped */}
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            currentStep >= 3 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-neutral-200 text-neutral-500'
                          }`}>
                            <Truck size={18} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-neutral-800 mt-2">Shipped</span>
                          <span className="text-[9px] text-neutral-400 hidden sm:block">On the way</span>
                        </div>

                        {/* Step 4: Delivered */}
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            currentStep >= 4 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-neutral-200 text-neutral-500'
                          }`}>
                            <CheckCircle2 size={18} />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-neutral-800 mt-2">Delivered</span>
                          <span className="text-[9px] text-neutral-400 hidden sm:block">Handed Over</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 text-xs font-semibold text-center">
                      This order has been cancelled. Please contact customer support if this was a mistake.
                    </div>
                  )}

                  {/* Delivery Info & Items Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Delivery details */}
                    <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-2 text-xs">
                      <h4 className="font-bold text-neutral-900 flex items-center gap-1.5 uppercase text-[11px] tracking-wider text-neutral-500">
                        <MapPin size={14} className="text-neutral-800" /> Delivery Address
                      </h4>
                      <p className="text-neutral-800 leading-relaxed font-medium">{order.address}</p>
                      {order.district && (
                        <p className="text-neutral-600">District: <span className="font-bold text-black">{order.district}</span></p>
                      )}
                      <p className="text-neutral-600">Payment: <span className="font-bold uppercase text-black">{order.paymentMethod}</span></p>
                    </div>

                    {/* Order summary */}
                    <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-2 text-xs">
                      <h4 className="font-bold text-neutral-900 flex items-center gap-1.5 uppercase text-[11px] tracking-wider text-neutral-500">
                        <ShoppingBag size={14} className="text-neutral-800" /> Total & Items
                      </h4>
                      <div className="flex justify-between text-neutral-600">
                        <span>Items Total ({order.products?.length || 0} items)</span>
                        <span className="font-bold text-black">৳{order.total?.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-600">
                        <span>Delivery Area</span>
                        <span>{order.deliveryAreaBn || order.deliveryArea || 'Standard Delivery'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Products list preview */}
                  {order.products && order.products.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                        Ordered Items
                      </h4>
                      <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-2xl overflow-hidden bg-neutral-50/50">
                        {order.products.map((p, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center space-x-3">
                              {p.images && p.images[0] && (
                                <img src={p.images[0]} alt={p.name} className="w-10 h-12 object-cover rounded-lg bg-neutral-100 border border-neutral-200 shrink-0" />
                              )}
                              <div>
                                <p className="font-bold text-neutral-900">{p.name}</p>
                                <p className="text-neutral-500 text-[11px]">
                                  Qty: {p.quantity} {p.selectedSize && `• Size: ${p.selectedSize}`} {p.selectedColor && `• Color: ${p.selectedColor}`}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-neutral-900">
                              ৳{(p.price * p.quantity).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Need Help Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <a
                      href={`https://wa.me/${config.whatsappNumber?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Rare Dreams, I need an update regarding my order #${order.id}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <MessageCircle size={16} />
                      <span>WhatsApp Support for Order #{order.id.slice(-6)}</span>
                    </a>

                    <a
                      href={`tel:${config.helplineNumber}`}
                      className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Headphones size={16} />
                      <span>Call Support</span>
                    </a>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
