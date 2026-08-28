import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order } from '../../types';
import { useStoreConfigStore } from '../../store/useStoreConfigStore';
import { 
  createSteadfastOrder, 
  getSteadfastStatus, 
  getSteadfastTrackingUrl, 
  formatSteadfastStatus 
} from '../../services/steadfastService';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Truck, 
  PackageCheck, 
  Search, 
  Eye, 
  Phone, 
  MapPin, 
  CreditCard, 
  X, 
  Copy, 
  Check, 
  ShoppingBag, 
  RefreshCw, 
  UserCheck, 
  Ban, 
  ArrowLeft,
  Printer,
  MessageCircle,
  ExternalLink,
  Send,
  Loader2,
  AlertCircle,
  FlaskConical
} from 'lucide-react';

type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case 'Pending':
      return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200"><Clock size={11} className="mr-1" /> Pending</span>;
    case 'Confirmed':
      return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200"><CheckCircle2 size={11} className="mr-1" /> Confirmed</span>;
    case 'Processing':
      return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200"><RefreshCw size={11} className="mr-1 animate-spin" /> Processing</span>;
    case 'Shipped':
      return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"><Truck size={11} className="mr-1" /> Shipped</span>;
    case 'Delivered':
      return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><PackageCheck size={11} className="mr-1" /> Delivered</span>;
    case 'Cancelled':
      return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200"><XCircle size={11} className="mr-1" /> Cancelled</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-800">{status}</span>;
  }
};

const formatDate = (dateVal: any) => {
  if (!dateVal) return 'N/A';
  if (dateVal?.toDate) {
    return dateVal.toDate().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return new Date(dateVal).toLocaleDateString();
};

// Memoized Order Card Component
const OrderCard = memo(({ 
  order, 
  onStatusChange, 
  onSelectOrder, 
  onCopy, 
  copiedId, 
  isUpdating,
  onOpenSteadfastModal,
  onSyncSteadfast,
  isSyncingCourier
}: { 
  order: Order; 
  onStatusChange: (id: string, status: OrderStatus) => void;
  onSelectOrder: (order: Order) => void;
  onCopy: (id: string) => void;
  copiedId: string | null;
  isUpdating: boolean;
  onOpenSteadfastModal: (order: Order) => void;
  onSyncSteadfast: (order: Order) => void;
  isSyncingCourier?: boolean;
}) => {
  const isCourierBooked = Boolean(order.courierTrackingCode);

  return (
    <div 
      className={`bg-white rounded-2xl p-3.5 sm:p-4 border transition-all hover:shadow-sm w-full min-w-0 ${
        order.status === 'Pending' ? 'border-amber-300 bg-amber-50/20' : 'border-neutral-200'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full min-w-0">
        {/* Order Summary */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-mono text-[11px] font-black text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-lg">
              #{order.id.slice(0, 8)}
            </span>
            <button 
              onClick={() => onCopy(order.id)} 
              className="text-neutral-400 hover:text-black transition-colors cursor-pointer"
              title="Copy ID"
            >
              {copiedId === order.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </button>
            {getStatusBadge(order.status as OrderStatus)}

            {/* Courier Tracking Badge */}
            {isCourierBooked ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
                <Truck size={10} className="text-emerald-600" />
                <span className="font-mono font-bold">{order.courierTrackingCode}</span>
                {order.courierStatus && (
                  <span className="text-[9px] bg-emerald-200/80 px-1 rounded text-emerald-900 ml-1">
                    {formatSteadfastStatus(order.courierStatus).labelBn}
                  </span>
                )}
              </span>
            ) : null}

            <span className="text-[11px] text-neutral-400 font-medium ml-auto sm:ml-0">
              {formatDate(order.createdAt)}
            </span>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs w-full min-w-0">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Customer</p>
              <p className="font-bold text-neutral-900 truncate">{order.customerName || 'Guest User'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Phone & Location</p>
              <p className="font-medium text-neutral-800 flex items-center space-x-1 truncate">
                <a href={`tel:${order.phone}`} className="text-neutral-900 font-bold hover:underline flex items-center space-x-1 truncate">
                  <Phone size={11} className="text-emerald-600 shrink-0" />
                  <span className="truncate">{order.phone}</span>
                </a>
                <span className="text-neutral-400 truncate">({order.city})</span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-neutral-400 uppercase">Payment & Total</p>
              <p className="font-medium text-neutral-900 truncate">
                <span className="font-black text-neutral-900">৳ {order.total?.toFixed(0)}</span>
                <span className="text-neutral-500 text-[10px] uppercase font-bold ml-1">({order.paymentMethod})</span>
              </p>
            </div>
          </div>

          {/* Ordered items */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar w-full min-w-0">
            {order.products?.slice(0, 3).map((p, idx) => (
              <div key={idx} className="flex items-center space-x-1.5 bg-neutral-50 border border-neutral-200/80 rounded-xl px-2 py-0.5 text-[11px] shrink-0">
                <div className="w-5 h-5 bg-neutral-200 rounded overflow-hidden shrink-0">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <span className="font-bold truncate max-w-[100px] text-neutral-800">{p.name}</span>
                <span className="text-neutral-400">x{p.quantity}</span>
              </div>
            ))}
            {(order.products?.length || 0) > 3 && (
              <span className="text-[10px] text-neutral-500 font-bold px-1.5 py-0.5 bg-neutral-100 rounded-lg shrink-0">
                +{order.products.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 border-t lg:border-t-0 pt-2 lg:pt-0 shrink-0">
          {order.status === 'Pending' && (
            <>
              <button 
                onClick={() => onStatusChange(order.id, 'Confirmed')}
                disabled={isUpdating}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
              >
                <UserCheck size={13} />
                <span>Confirm</span>
              </button>
              <button 
                onClick={() => onStatusChange(order.id, 'Cancelled')}
                disabled={isUpdating}
                className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Ban size={13} />
                <span>Reject</span>
              </button>
            </>
          )}

          {/* Steadfast 1-Click Action Button */}
          {isCourierBooked ? (
            <a
              href={getSteadfastTrackingUrl(order.courierTrackingCode!)}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
              title="Steadfast Live Track"
            >
              <Truck size={12} className="text-emerald-700" />
              <span>ট্র্যাকিং</span>
              <ExternalLink size={10} />
            </a>
          ) : order.status !== 'Cancelled' ? (
            <button
              onClick={() => onOpenSteadfastModal(order)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
              title="Send to Steadfast Courier"
            >
              <Truck size={12} />
              <span>স্টেডফাস্ট বুকিং</span>
            </button>
          ) : null}

          {/* Status Dropdown */}
          <select
            value={order.status}
            onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
            disabled={isUpdating}
            className="bg-neutral-50 border border-neutral-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-neutral-800 outline-none focus:ring-2 focus:ring-black cursor-pointer"
          >
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button 
            onClick={() => onSelectOrder(order)}
            className="px-3 py-1.5 bg-black text-white hover:bg-neutral-800 rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center space-x-1 cursor-pointer"
          >
            <Eye size={13} />
            <span>Details</span>
          </button>
        </div>
      </div>
    </div>
  );
});

OrderCard.displayName = 'OrderCard';

export default function AdminOrders() {
  const { config } = useStoreConfigStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Steadfast Courier Booking State
  const [bookingModalOrder, setBookingModalOrder] = useState<Order | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [syncingTrackingCode, setSyncingTrackingCode] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({
    invoice: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    codAmount: 0,
    note: ''
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
    } catch (error) {
      console.error("Error fetching orders", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });

      const targetOrder = orders.find(o => o.id === orderId);

      // Notification log
      try {
        const statusBengali: Record<string, string> = {
          Confirmed: 'কনফার্ম করা হয়েছে',
          Processing: 'প্যাকিং ও প্রসেসিং চলছে',
          Shipped: 'কুরিয়ারে পাঠানো হয়েছে',
          Delivered: 'সফলভাবে ডেলিভারি সম্পন্ন হয়েছে',
          Cancelled: 'বাতিল করা হয়েছে'
        };

        const title = `📦 অর্ডার আপডেট (#${orderId.slice(-6).toUpperCase()})`;
        const body = `আপনার অর্ডারটি ${statusBengali[newStatus] || newStatus}। বিস্তারিত জানতে ক্লিক করুন।`;

        await addDoc(collection(db, 'notifications'), {
          orderId,
          userId: targetOrder?.userId || 'guest',
          userPhone: targetOrder?.phone || '',
          title,
          message: body,
          type: 'order_status',
          status: newStatus,
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Could not record customer status notification:', e);
      }
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);
    } catch (error) {
      console.error("Error updating order status", error);
      alert('Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  }, [orders]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // Open Steadfast Booking Modal
  const handleOpenBookingModal = useCallback((order: Order) => {
    setBookingModalOrder(order);
    setBookingError(null);
    setBookingSuccess(null);

    // Calculate default COD Amount
    // If paid via online or status is paid, codAmount is 0; otherwise total amount
    const isPaid = order.paymentStatus === 'paid';
    const defaultCod = isPaid ? 0 : Math.round(Number(order.total || 0));

    setBookingForm({
      invoice: order.id,
      recipientName: order.customerName || 'Customer',
      recipientPhone: (order.phone || '').trim(),
      recipientAddress: `${order.address || ''}${order.city ? ', ' + order.city : ''}`.trim(),
      codAmount: defaultCod,
      note: `Rare Dreams Luxury Order #${order.id.slice(0, 8)}`
    });
  }, []);

  // Submit Steadfast Courier Booking
  const handleConfirmSteadfastBooking = async (forceTestMode?: boolean) => {
    if (!bookingModalOrder) return;

    if (!config.steadfastApiKey || !config.steadfastSecretKey) {
      setBookingError("স্টেডফাস্ট এপিআই কি কনফিগার করা হয়নি! দয়া করে প্রথমে Admin Settings থেকে Steadfast API Key এবং Secret Key দিন।");
      return;
    }

    if (!bookingForm.recipientName.trim()) {
      setBookingError("গ্রাহকের নাম আবশ্যক।");
      return;
    }

    if (!bookingForm.recipientPhone.trim() || bookingForm.recipientPhone.replace(/[^0-9]/g, '').length < 11) {
      setBookingError("সঠিক ১১ ডিজিটের গ্রাহকের ফোন নম্বর দিন।");
      return;
    }

    if (!bookingForm.recipientAddress.trim() || bookingForm.recipientAddress.length < 5) {
      setBookingError("বিস্তারিত ডেলিভারি ঠিকানা দিন (কমপক্ষে ৫ অক্ষর)।");
      return;
    }

    setBookingLoading(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const isTest = false; // Forced false as per user request to remove test mode
      const payload = {
        invoice: bookingForm.invoice,
        recipient_name: bookingForm.recipientName.trim(),
        recipient_phone: bookingForm.recipientPhone.trim(),
        recipient_address: bookingForm.recipientAddress.trim(),
        cod_amount: Number(bookingForm.codAmount || 0),
        note: bookingForm.note.trim() || undefined,
      };

      const res = await createSteadfastOrder(payload, {
        apiKey: config.steadfastApiKey,
        secretKey: config.steadfastSecretKey,
        testMode: isTest,
      });

      if (!res.success || !res.data) {
        throw new Error(res.message || 'কুরিয়ার বুকিং ব্যর্থ হয়েছে।');
      }

      const consignment = res.data;

      // Update Firestore Order
      const updatedFields: Partial<Order> = {
        courierProvider: 'steadfast',
        courierConsignmentId: String(consignment.consignment_id),
        courierTrackingCode: consignment.tracking_code,
        courierStatus: consignment.status || 'in_review',
        courierBookedAt: new Date().toISOString(),
        courierCodAmount: Number(bookingForm.codAmount || 0),
        status: 'Shipped' // Automatically advance to Shipped
      };

      await updateDoc(doc(db, 'orders', bookingModalOrder.id), updatedFields as any);

      // Add Notification
      try {
        await addDoc(collection(db, 'notifications'), {
          orderId: bookingModalOrder.id,
          userId: bookingModalOrder.userId || 'guest',
          userPhone: bookingModalOrder.phone || '',
          title: `🚚 অর্ডার ডেলিভারির জন্য পাঠানো হয়েছে (#${bookingModalOrder.id.slice(-6).toUpperCase()})`,
          message: `আপনার পার্সেলটি Steadfast কুরিয়ারে বুকিং হয়েছে। ট্র্যাকিং কোড: ${consignment.tracking_code}`,
          type: 'order_status',
          status: 'Shipped',
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (ne) {
        console.warn('Notification log error:', ne);
      }

      // Update state
      setOrders(prev => prev.map(o => o.id === bookingModalOrder.id ? { ...o, ...updatedFields } : o));
      setSelectedOrder(prev => prev && prev.id === bookingModalOrder.id ? { ...prev, ...updatedFields } : prev);

      setBookingSuccess(`পার্সেল সফলভাবে বুকিং সম্পন্ন হয়েছে! ট্র্যাকিং কোড: ${consignment.tracking_code}`);
      
      setTimeout(() => {
        setBookingModalOrder(null);
        setBookingSuccess(null);
      }, 2200);

    } catch (err: any) {
      console.error("Steadfast booking error:", err);
      setBookingError(err?.message || "স্টেডফাস্ট সার্ভারের সাথে যোগাযোগে সমস্যা হয়েছে।");
    } finally {
      setBookingLoading(false);
    }
  };

  // Sync Steadfast Live Status
  const handleSyncSteadfastStatus = async (order: Order) => {
    if (!order.courierTrackingCode) return;
    setSyncingTrackingCode(order.courierTrackingCode);

    try {
      const res = await getSteadfastStatus(order.courierTrackingCode, {
        apiKey: config.steadfastApiKey,
        secretKey: config.steadfastSecretKey,
        testMode: config.steadfastTestMode,
      });

      if (res.success && res.data?.delivery_status) {
        const newCourierStatus = res.data.delivery_status;
        const updates: Partial<Order> = {
          courierStatus: newCourierStatus
        };

        if (newCourierStatus === 'delivered') {
          updates.status = 'Delivered';
        } else if (newCourierStatus === 'cancelled') {
          updates.status = 'Cancelled';
        }

        await updateDoc(doc(db, 'orders', order.id), updates as any);

        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updates } : o));
        setSelectedOrder(prev => prev && prev.id === order.id ? { ...prev, ...updates } : prev);

        const statusMeta = formatSteadfastStatus(newCourierStatus);
        alert(`স্টেটাস আপডেট সফল: ${statusMeta.labelBn} (${statusMeta.labelEn})`);
      } else {
        alert(res.message || 'স্টেটাস পাওয়া যায়নি।');
      }
    } catch (err: any) {
      alert(`স্টেটাস সিঙ্ক ব্যর্থ: ${err?.message || 'Error'}`);
    } finally {
      setSyncingTrackingCode(null);
    }
  };

  // Filter logic
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(order => {
      const matchesTab = activeTab === 'All' || order.status === activeTab;
      const matchesSearch = !q || 
        order.id.toLowerCase().includes(q) ||
        (order.customerName || '').toLowerCase().includes(q) ||
        (order.phone || '').includes(q) ||
        (order.city || '').toLowerCase().includes(q) ||
        (order.address || '').toLowerCase().includes(q) ||
        (order.courierTrackingCode || '').toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  // Metrics
  const { pendingCount, confirmedCount, processingCount, shippedCount, deliveredCount, cancelledCount, totalRevenue } = useMemo(() => {
    let p = 0, c = 0, pr = 0, s = 0, d = 0, can = 0, rev = 0;
    orders.forEach(o => {
      if (o.status === 'Pending') p++;
      else if (o.status === 'Confirmed') c++;
      else if (o.status === 'Processing') pr++;
      else if (o.status === 'Shipped') s++;
      else if (o.status === 'Delivered') d++;
      else if (o.status === 'Cancelled') can++;

      if (o.status !== 'Cancelled') {
        rev += (o.total || 0);
      }
    });
    return {
      pendingCount: p,
      confirmedCount: c,
      processingCount: pr,
      shippedCount: s,
      deliveredCount: d,
      cancelledCount: can,
      totalRevenue: rev
    };
  }, [orders]);

  if (selectedOrder) {
    const isBooked = Boolean(selectedOrder.courierTrackingCode);
    const courierStatusMeta = selectedOrder.courierStatus ? formatSteadfastStatus(selectedOrder.courierStatus) : null;

    return (
      <div className="w-full max-w-4xl mx-auto space-y-4 pb-16 animate-in fade-in duration-150">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedOrder(null)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-700 hover:text-neutral-950 bg-white border border-neutral-200 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs hover:bg-neutral-50"
          >
            <ArrowLeft size={16} />
            <span>অর্ডারের তালিকায় ফিরুন (Back to All Orders)</span>
          </button>
          
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-100 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            <Printer size={15} />
            <span>চালান প্রিন্ট (Print Invoice)</span>
          </button>
        </div>

        {/* Order Details Main Card */}
        <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-xs p-5 sm:p-7 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-neutral-100">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black uppercase text-neutral-900">
                  Order Details
                </h2>
                {getStatusBadge(selectedOrder.status as OrderStatus)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-neutral-500 font-mono font-bold">
                  ID: #{selectedOrder.id}
                </span>
                <span className="text-neutral-300">•</span>
                <span className="text-xs text-neutral-500">
                  {formatDate(selectedOrder.createdAt)}
                </span>
              </div>
            </div>

            {/* Quick Status Updater */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-neutral-600">স্ট্যাটাস পরিবর্তন:</label>
              <select
                value={selectedOrder.status}
                disabled={updatingId === selectedOrder.id}
                onChange={(e) => {
                  const newStatus = e.target.value as OrderStatus;
                  handleStatusChange(selectedOrder.id, newStatus);
                  setSelectedOrder((prev: any) => prev ? { ...prev, status: newStatus } : null);
                }}
                className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-black"
              >
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Customer & Delivery Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Contact */}
            <div className="bg-neutral-50/80 p-4 rounded-2xl border border-neutral-200/70 space-y-2.5 text-xs">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-neutral-500" />
                <span>গ্রাহকের তথ্য (Customer Info)</span>
              </h3>
              <p><span className="font-bold text-neutral-600">নাম:</span> <span className="font-bold text-neutral-900">{selectedOrder.customerName || selectedOrder.name || 'Guest Customer'}</span></p>
              <p className="flex items-center gap-2">
                <span className="font-bold text-neutral-600">ফোন:</span> 
                <span className="font-mono font-bold text-neutral-900">{selectedOrder.phone}</span>
                {selectedOrder.phone && (
                  <a
                    href={`tel:${selectedOrder.phone}`}
                    className="p-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center"
                    title="Call Customer"
                  >
                    <Phone size={12} />
                  </a>
                )}
                {selectedOrder.phone && (
                  <a
                    href={`https://wa.me/88${selectedOrder.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${selectedOrder.customerName || ''}, regarding your order #${selectedOrder.id} at out shop:`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors inline-flex items-center"
                    title="WhatsApp Customer"
                  >
                    <MessageCircle size={12} />
                  </a>
                )}
              </p>
              {selectedOrder.email && (
                <p><span className="font-bold text-neutral-600">ইমেইল:</span> {selectedOrder.email}</p>
              )}
            </div>

            {/* Delivery & Payment */}
            <div className="bg-neutral-50/80 p-4 rounded-2xl border border-neutral-200/70 space-y-2.5 text-xs">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-neutral-500" />
                <span>ডেলিভারি ও পেমেন্ট (Shipping & Payment)</span>
              </h3>
              <p><span className="font-bold text-neutral-600">ঠিকানা:</span> <span className="text-neutral-900">{selectedOrder.address || selectedOrder.shippingAddress || 'N/A'}, {selectedOrder.city || ''}</span></p>
              <p><span className="font-bold text-neutral-600">পেমেন্ট মেথড:</span> <span className="font-bold text-neutral-900">{selectedOrder.paymentMethod || 'Cash On Delivery'}</span></p>
              <p><span className="font-bold text-neutral-600">পেমেন্ট স্ট্যাটাস:</span> <span className="font-semibold text-neutral-800 uppercase">{selectedOrder.paymentStatus || 'Pending'}</span></p>
            </div>
          </div>

          {/* Steadfast Courier Integration Section */}
          <div className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                    Steadfast Courier Delivery (স্টেডফাস্ট কুরিয়ার)
                  </h3>
                  <p className="text-[11px] text-neutral-600">
                    {isBooked ? 'পার্সেলটি স্টেটফাস্ট কুরিয়ারে বুকিং করা আছে' : 'অর্ডারটি সরাসরি স্টেটফাস্টে বুকিং করুন'}
                  </p>
                </div>
              </div>

              {isBooked ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSyncSteadfastStatus(selectedOrder)}
                    disabled={syncingTrackingCode === selectedOrder.courierTrackingCode}
                    className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw size={12} className={syncingTrackingCode === selectedOrder.courierTrackingCode ? "animate-spin" : ""} />
                    <span>স্ট্যাটাস রিফ্রেশ</span>
                  </button>

                  <a
                    href={getSteadfastTrackingUrl(selectedOrder.courierTrackingCode!)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <span>লাইভ ট্র্যাক দেখুন</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenBookingModal(selectedOrder)}
                  disabled={selectedOrder.status === 'Cancelled'}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <Truck size={15} />
                  <span>১-ক্লিকে স্টেটফাস্টে বুকিং করুন</span>
                </button>
              )}
            </div>

            {/* Booked Info Display */}
            {isBooked && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-emerald-200/70 text-xs">
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Tracking Code</p>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <p className="font-mono font-bold text-emerald-900">{selectedOrder.courierTrackingCode}</p>
                    <button onClick={() => copyToClipboard(selectedOrder.courierTrackingCode!)} className="text-neutral-400 hover:text-black">
                      {copiedId === selectedOrder.courierTrackingCode ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Consignment ID</p>
                  <p className="font-mono font-bold text-neutral-900 mt-0.5">#{selectedOrder.courierConsignmentId || 'N/A'}</p>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Courier Status</p>
                  <p className="font-bold text-emerald-800 mt-0.5">
                    {courierStatusMeta?.labelBn || selectedOrder.courierStatus}
                  </p>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">COD Collection</p>
                  <p className="font-mono font-black text-neutral-900 mt-0.5">৳ {Number(selectedOrder.courierCodAmount ?? selectedOrder.total ?? 0).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Products List Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-neutral-500" />
              <span>অর্ডারের পণ্য তালিকা (Items in Order)</span>
            </h3>
            <div className="border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-neutral-100">
              {(selectedOrder.products || selectedOrder.items || []).map((p: any, idx: number) => {
                const img = p.images?.[0] || p.image || '';
                return (
                  <div key={idx} className="p-3 sm:p-4 flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-12 h-12 bg-neutral-100 rounded-xl overflow-hidden shrink-0 border border-neutral-200">
                        {img ? (
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-300">
                            <ShoppingBag size={18} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-900 truncate max-w-[220px] sm:max-w-md">{p.name || p.title}</p>
                        <p className="text-[11px] text-neutral-500">
                          {p.selectedSize && <span className="mr-2">সাইজ: <b>{p.selectedSize}</b></span>}
                          {p.selectedColor && <span>রং: <b>{p.selectedColor}</b></span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-neutral-900">
                        {p.quantity} × ৳{Number(p.price || 0).toLocaleString()}
                      </p>
                      <p className="font-bold text-neutral-800 text-xs mt-0.5">
                        = ৳{(Number(p.quantity || 1) * Number(p.price || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1.5 text-xs sm:text-sm font-medium">
            <div className="flex items-center justify-between text-neutral-600">
              <span>সাবটোটাল (Subtotal):</span>
              <span className="font-mono font-bold text-neutral-900">৳ {((selectedOrder.total || 0) - (selectedOrder.shippingCost || 0)).toLocaleString()}</span>
            </div>
            {selectedOrder.shippingCost !== undefined && (
              <div className="flex items-center justify-between text-neutral-600">
                <span>ডেলিভারি চার্জ (Delivery):</span>
                <span className="font-mono font-bold text-neutral-900">৳ {Number(selectedOrder.shippingCost || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-sm sm:text-base font-black text-neutral-900">
              <span>সর্বমোট মূল্য (Total Amount):</span>
              <span className="text-emerald-700">৳ {Number(selectedOrder.total || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Steadfast Booking Modal (when opened from details view) */}
        {bookingModalOrder && renderSteadfastModal()}
      </div>
    );
  }

  function renderSteadfastModal() {
    if (!bookingModalOrder) return null;

    const isKeysConfigured = Boolean(config.steadfastApiKey && config.steadfastSecretKey);

    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-emerald-600 text-white">
                <Truck size={18} />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide">
                  Steadfast Courier পার্সেল বুকিং
                </h3>
                <p className="text-[11px] text-neutral-300">
                  অর্ডার #{bookingModalOrder.id.slice(0, 8)} • সরাসরি আসল মার্চেন্ট বুকিং
                </p>
              </div>
            </div>
            <button
              onClick={() => setBookingModalOrder(null)}
              disabled={bookingLoading}
              className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {!isKeysConfigured && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-2 text-xs text-amber-900">
                <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Steadfast API Key সেট করা নেই!</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    বুকিং করার আগে <Link to="/admin/settings" className="underline font-bold text-amber-950">Admin Settings</Link> এ গিয়ে আপনার Steadfast API Key ও Secret Key সেভ করুন।
                  </p>
                </div>
              </div>
            )}

            {bookingError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-900">
                <div className="flex items-start space-x-2 font-bold text-rose-800">
                  <XCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                  <span>{bookingError}</span>
                </div>
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <a
                    href="https://portal.steadfast.com.bd"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-black text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>🌐 Steadfast পোর্টালে যান</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            )}

            {bookingSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 uppercase text-[11px] mb-1">
                  Invoice / Order ID
                </label>
                <input
                  type="text"
                  value={bookingForm.invoice}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, invoice: e.target.value }))}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2 font-mono font-bold text-neutral-800 outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 uppercase text-[11px] mb-1">
                    গ্রাহকের নাম (Recipient Name)
                  </label>
                  <input
                    type="text"
                    value={bookingForm.recipientName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, recipientName: e.target.value }))}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2 font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 uppercase text-[11px] mb-1">
                    ফোন নম্বর (Recipient Phone)
                  </label>
                  <input
                    type="text"
                    value={bookingForm.recipientPhone}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, recipientPhone: e.target.value }))}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2 font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 uppercase text-[11px] mb-1">
                  ডেলিভারির পূর্ণ ঠিকানা (Recipient Address)
                </label>
                <textarea
                  rows={2}
                  value={bookingForm.recipientAddress}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, recipientAddress: e.target.value }))}
                  className="w-full bg-white border border-neutral-300 rounded-xl p-3 font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 uppercase text-[11px] mb-1 flex items-center justify-between">
                    <span>COD কালেকশন টাকা</span>
                    <span className="text-[10px] text-neutral-400 font-normal">টাকা কুরিয়ার তুলবে</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-neutral-400">৳</span>
                    <input
                      type="number"
                      value={bookingForm.codAmount}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, codAmount: Number(e.target.value) }))}
                      className="w-full bg-white border border-neutral-300 rounded-xl pl-7 pr-3 py-2 font-mono font-black text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    কাস্টমার যদি আগে বিকাশ/কার্ডে পেমেন্ট করে থাকে তবে 0 রাখুন।
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 uppercase text-[11px] mb-1">
                    কুরিয়ার রাইডারের জন্য নোট (Note)
                  </label>
                  <input
                    type="text"
                    value={bookingForm.note}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Fragile / Handle with care"
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2 font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={() => setBookingModalOrder(null)}
              disabled={bookingLoading}
              className="px-4 py-2.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              বাতিল
            </button>

            <button
              type="button"
              onClick={() => handleConfirmSteadfastBooking()}
              disabled={bookingLoading || !isKeysConfigured}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {bookingLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>বুকিং হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>কনফার্ম ও স্টেটফাস্ট বুক করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 pb-12 animate-in fade-in duration-150">
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Admin Dashboard</span>
      </Link>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full min-w-0">
        <div>
          <h1 className="text-base sm:text-xl font-black uppercase tracking-tight text-neutral-900">
            Order Management
          </h1>
          <p className="text-[11px] sm:text-xs text-neutral-500 font-medium">
            Review, confirm, Steadfast courier dispatch, and track orders ({orders.length} total)
          </p>
        </div>

        <button 
          onClick={fetchOrders} 
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold hover:bg-neutral-50 transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full min-w-0">
        <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-neutral-200 shadow-2xs">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Orders</p>
          <p className="text-lg sm:text-xl font-black text-neutral-900 mt-0.5">{orders.length}</p>
        </div>
        <div className="bg-amber-50/60 p-3 sm:p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
            <span>Pending</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          </p>
          <p className="text-lg sm:text-xl font-black text-amber-900 mt-0.5">{pendingCount}</p>
        </div>
        <div className="bg-blue-50/60 p-3 sm:p-3.5 rounded-2xl border border-blue-200 shadow-2xs">
          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Processing/Ship</p>
          <p className="text-lg sm:text-xl font-black text-blue-900 mt-0.5">{confirmedCount + processingCount + shippedCount}</p>
        </div>
        <div className="bg-emerald-50/60 p-3 sm:p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Sales</p>
          <p className="text-lg sm:text-xl font-black text-emerald-900 mt-0.5">৳ {totalRevenue.toFixed(0)}</p>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-2xs space-y-2.5 w-full min-w-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search Order ID, Name, Phone, City, Tracking Code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-7 py-1.5 text-xs sm:text-sm outline-none focus:bg-white focus:border-black transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs font-bold w-full min-w-0">
          {[
            { label: 'All', count: orders.length },
            { label: 'Pending', count: pendingCount },
            { label: 'Confirmed', count: confirmedCount },
            { label: 'Processing', count: processingCount },
            { label: 'Shipped', count: shippedCount },
            { label: 'Delivered', count: deliveredCount },
            { label: 'Cancelled', count: cancelledCount },
          ].map(tab => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={`px-3 py-1 rounded-xl whitespace-nowrap transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer ${
                activeTab === tab.label 
                  ? 'bg-neutral-900 text-white shadow-xs' 
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab.label ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 text-center text-neutral-400 text-xs font-bold">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-neutral-900" />
          Loading orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 text-center space-y-2">
          <ShoppingBag size={28} className="mx-auto text-neutral-300" />
          <p className="text-sm font-bold text-neutral-800">No orders found</p>
          <p className="text-xs text-neutral-500">No orders match your filter.</p>
        </div>
      ) : (
        <div className="space-y-2.5 w-full min-w-0">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusChange={handleStatusChange}
              onSelectOrder={setSelectedOrder}
              onCopy={copyToClipboard}
              copiedId={copiedId}
              isUpdating={updatingId === order.id}
              onOpenSteadfastModal={handleOpenBookingModal}
              onSyncSteadfast={handleSyncSteadfastStatus}
              isSyncingCourier={syncingTrackingCode === order.courierTrackingCode}
            />
          ))}
        </div>
      )}

      {/* Steadfast Courier Booking Modal */}
      {renderSteadfastModal()}
    </div>
  );
}
