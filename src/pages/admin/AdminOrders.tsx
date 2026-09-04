import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order } from '../../types';
import { useStoreConfigStore } from '../../store/useStoreConfigStore';
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
  FileText,
  AlertCircle,
  Building2,
  Home,
  ExternalLink
} from 'lucide-react';
import { SteadfastBookingModal } from '../../components/SteadfastBookingModal';

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
  onBookCourier
}: { 
  order: Order; 
  onStatusChange: (id: string, status: OrderStatus) => void;
  onSelectOrder: (order: Order) => void;
  onCopy: (id: string) => void;
  copiedId: string | null;
  isUpdating: boolean;
  onBookCourier: (order: Order) => void;
}) => {
  const districtName = order.district || (order.city?.includes(',') ? order.city.split(',').pop()?.trim() : order.city);
  const thanaName = order.thana || (order.city?.includes(',') ? order.city.split(',')[0]?.trim() : '');

  return (
    <div 
      className={`bg-white rounded-2xl p-3.5 sm:p-4 border transition-all hover:shadow-xs w-full min-w-0 ${
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

            {/* Location Badges for Quick Glance */}
            {districtName && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                <MapPin size={10} className="text-blue-600" />
                <span>{districtName}</span>
                {thanaName && <span className="text-blue-600 font-medium">({thanaName})</span>}
              </span>
            )}

            <span className="text-[11px] text-neutral-400 font-medium ml-auto sm:ml-0">
              {formatDate(order.createdAt)}
            </span>
          </div>

          {/* Customer & Location Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs w-full min-w-0">
            {/* 1. Customer */}
            <div className="min-w-0">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">গ্রাহক (Customer)</p>
              <p className="font-bold text-neutral-900 text-sm truncate mt-0.5">{order.customerName || 'Guest User'}</p>
              <div className="flex items-center gap-2 mt-1">
                <a href={`tel:${order.phone}`} className="text-neutral-800 font-mono font-bold hover:underline flex items-center space-x-1 text-xs">
                  <Phone size={11} className="text-emerald-600 shrink-0" />
                  <span>{order.phone}</span>
                </a>
              </div>
            </div>

            {/* 2. District, Thana & Detailed Address Separated */}
            <div className="min-w-0">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">ডেলিভারি লোকেশন ও ঠিকানা</p>
              
              {/* Distinct Badges for District & Thana */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs">
                  <span className="text-[9px] uppercase font-bold text-blue-600">জেলা:</span>
                  <span>{districtName || 'N/A'}</span>
                </span>
                {thanaName && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200 shadow-2xs">
                    <span className="text-[9px] uppercase font-bold text-purple-600">থানা:</span>
                    <span>{thanaName}</span>
                  </span>
                )}
              </div>

              {/* Local House / Road Address */}
              <p className="text-[11px] text-neutral-700 font-medium mt-1 line-clamp-2 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-200/60" title={order.address}>
                <span className="font-bold text-neutral-900">ঠিকানা: </span>
                {order.address || 'N/A'}
              </p>
            </div>

            {/* 3. Payment & Total */}
            <div className="min-w-0">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">পেমেন্ট ও সর্বমোট</p>
              <p className="font-medium text-neutral-900 mt-0.5">
                <span className="font-black text-neutral-900 text-sm font-mono">৳ {order.total?.toFixed(0)}</span>
                <span className="text-neutral-600 text-[10px] uppercase font-bold ml-1.5 bg-neutral-100 px-1.5 py-0.5 rounded">
                  {order.paymentMethod}
                </span>
              </p>
              <p className="text-[10px] text-neutral-500 font-medium mt-1">
                পণ্য: <b className="text-neutral-800">{(order.products || []).length} টি</b> | ডেলিভারি: <b className="text-neutral-800">৳{order.shipping || 0}</b>
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

          {/* Steadfast Courier 1-Click Booking or Status Badge */}
          {order.courierTrackingCode ? (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-xl px-2.5 py-1 text-xs">
              <Truck size={13} className="text-[#FF6A00]" />
              <a 
                href={`https://steadfast.com.bd/t/${order.courierTrackingCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-black text-[#FF6A00] hover:underline text-xs flex items-center gap-1"
                title="Steadfast এ লাইভ ট্র্যাকিং দেখুন"
              >
                <span>#{order.courierTrackingCode}</span>
                <ExternalLink size={10} />
              </a>
              <span className="text-[10px] bg-orange-100 text-orange-900 font-black px-1.5 py-0.2 rounded uppercase">
                {order.courierStatus || 'Booked'}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBookCourier(order); }}
              className="px-2.5 py-1.5 bg-gradient-to-r from-[#FF6A00] to-[#EE0979] hover:brightness-105 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
              title="Steadfast Courier এ ১-ক্লিকে পার্সেল বুক করুন"
            >
              <Truck size={13} />
              <span>স্টেডফাস্ট বুকিং</span>
            </button>
          )}

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
  const [copiedFullAddress, setCopiedFullAddress] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bookingOrder, setBookingOrder] = useState<Order | null>(null);
  const [refreshingTrackingId, setRefreshingTrackingId] = useState<string | null>(null);

  const handleBookingSuccess = (orderId: string, result: { consignmentId: string | number; trackingCode: string; status: string }) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          courierName: 'steadfast',
          courierConsignmentId: result.consignmentId,
          courierTrackingCode: result.trackingCode,
          courierStatus: result.status,
          status: o.status === 'Pending' || o.status === 'Confirmed' ? 'Processing' : o.status
        };
      }
      return o;
    }));
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => prev ? {
        ...prev,
        courierName: 'steadfast',
        courierConsignmentId: result.consignmentId,
        courierTrackingCode: result.trackingCode,
        courierStatus: result.status,
        status: prev.status === 'Pending' || prev.status === 'Confirmed' ? 'Processing' : prev.status
      } : null);
    }
  };

  const handleRefreshTracking = async (order: Order) => {
    const code = order.courierTrackingCode || order.courierConsignmentId;
    if (!code) return;

    setRefreshingTrackingId(order.id);
    try {
      const res = await fetch(`/api/courier/steadfast/track/${code}`, {
        headers: {
          'x-steadfast-api-key': config.steadfastApiKey || '',
          'x-steadfast-secret-key': config.steadfastSecretKey || ''
        }
      });
      const data = await res.json();
      if (res.ok && data.success && data.status) {
        await updateDoc(doc(db, 'orders', order.id), {
          courierStatus: data.status
        });
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, courierStatus: data.status } : o));
        if (selectedOrder?.id === order.id) {
          setSelectedOrder(prev => prev ? { ...prev, courierStatus: data.status } : null);
        }
      }
    } catch (err) {
      console.error("Tracking update error:", err);
    } finally {
      setRefreshingTrackingId(null);
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      // Remove orderBy from query to fetch all orders even if they lack createdAt field
      const q = query(collection(db, 'orders'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      
      // Client-side sorting to safely handle documents with or without createdAt
      ordersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (typeof a.createdAt === 'number' ? a.createdAt : 0);
        const timeB = b.createdAt?.toMillis?.() || (typeof b.createdAt === 'number' ? b.createdAt : 0);
        return timeB - timeA;
      });
      
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
          Shipped: 'ডেলিভারির জন্য পাঠানো হয়েছে',
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

  const handleCopyFullAddress = useCallback((order: Order) => {
    const dist = order.district || (order.city?.includes(',') ? order.city.split(',').pop()?.trim() : order.city) || 'N/A';
    const thana = order.thana || (order.city?.includes(',') ? order.city.split(',')[0]?.trim() : '') || 'N/A';
    const text = `গ্রাহকের নাম: ${order.customerName || 'N/A'}
মোবাইল: ${order.phone || 'N/A'}
জেলা: ${dist}
থানা/উপজেলা: ${thana}
ঠিকানা: ${order.address || 'N/A'}
সর্বমোট প্রদেয়: ৳${order.total?.toFixed(0)} (${order.paymentMethod?.toUpperCase() || 'COD'})
অর্ডার আইডি: #${order.id}`;

    navigator.clipboard.writeText(text);
    setCopiedFullAddress(true);
    setTimeout(() => setCopiedFullAddress(false), 2000);
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesTab = activeTab === 'All' || order.status === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        order.id.toLowerCase().includes(q) ||
        (order.customerName && order.customerName.toLowerCase().includes(q)) ||
        (order.phone && order.phone.includes(q)) ||
        (order.district && order.district.toLowerCase().includes(q)) ||
        (order.thana && order.thana.toLowerCase().includes(q)) ||
        (order.city && order.city.toLowerCase().includes(q)) ||
        (order.address && order.address.toLowerCase().includes(q));

      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  const { pendingCount, confirmedCount, processingCount, shippedCount, deliveredCount, cancelledCount, totalRevenue } = useMemo(() => {
    let p = 0, c = 0, pr = 0, s = 0, d = 0, can = 0, rev = 0;
    orders.forEach(o => {
      if (o.status === 'Pending') p++;
      else if (o.status === 'Confirmed') c++;
      else if (o.status === 'Processing') pr++;
      else if (o.status === 'Shipped') s++;
      else if (o.status === 'Delivered') {
        d++;
        rev += Number(o.total || 0);
      } else if (o.status === 'Cancelled') can++;
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
    const districtName = selectedOrder.district || (selectedOrder.city?.includes(',') ? selectedOrder.city.split(',').pop()?.trim() : selectedOrder.city) || 'N/A';
    const thanaName = selectedOrder.thana || (selectedOrder.city?.includes(',') ? selectedOrder.city.split(',')[0]?.trim() : '') || 'N/A';

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Customer Contact Card */}
            <div className="bg-neutral-50/80 p-4 rounded-2xl border border-neutral-200/70 space-y-3 text-xs">
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-neutral-500" />
                <span>গ্রাহকের তথ্য (Customer Contact)</span>
              </h3>
              
              <div className="bg-white p-3 rounded-xl border border-neutral-200 space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">নাম</span>
                  <span className="font-bold text-sm text-neutral-900">
                    {selectedOrder.customerName || selectedOrder.name || 'Guest Customer'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">মোবাইল নম্বর</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-black text-sm text-neutral-900">{selectedOrder.phone}</span>
                    {selectedOrder.phone && (
                      <a
                        href={`tel:${selectedOrder.phone}`}
                        className="px-2 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                        title="কল করুন"
                      >
                        <Phone size={11} />
                        <span>কল</span>
                      </a>
                    )}
                    {selectedOrder.phone && (
                      <a
                        href={`https://wa.me/88${selectedOrder.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`আসসালামু আলাইকুম ${selectedOrder.customerName || ''},\nRare Dreams থেকে আপনার অর্ডার #${selectedOrder.id} সংক্রান্ত তথ্য:\nজেলা: ${districtName}\nথানা: ${thanaName}\nঠিকানা: ${selectedOrder.address || selectedOrder.shippingAddress || 'N/A'}\nসর্বমোট মূল্য: ৳${selectedOrder.total?.toFixed(0)} (${selectedOrder.paymentMethod?.toUpperCase() || 'COD'})\n\nআমরা কি আপনার অর্ডারটি কনফার্ম করব?`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                        title="WhatsApp এ মেসেজ দিন"
                      >
                        <MessageCircle size={11} />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>

                {selectedOrder.email && (
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">ইমেইল</span>
                    <span className="font-medium text-neutral-700">{selectedOrder.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Structured Delivery Address Card - District, Thana & Street Address Separated */}
            <div className="bg-neutral-50/80 p-4 rounded-2xl border border-neutral-200/70 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={14} className="text-orange-600" />
                  <span>ডেলিভারি ঠিকানা ও লোকেশন বিবরণ</span>
                </h3>

                {/* 1-Click Copy Full Address Button */}
                <button
                  type="button"
                  onClick={() => handleCopyFullAddress(selectedOrder)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="সম্পূর্ণ ঠিকানা ও অর্ডারের বিবরণ এক ক্লিকে কপি করুন"
                >
                  {copiedFullAddress ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedFullAddress ? 'কপি হয়েছে' : 'সম্পূর্ণ ঠিকানা কপি'}</span>
                </button>
              </div>

              {/* District and Thana Highlighted Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider flex items-center gap-1">
                      <MapPin size={12} className="text-blue-600" />
                      <span>জেলা (District)</span>
                    </span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {districtName.toLowerCase().includes('dhaka') ? 'ঢাকার ভিতরে' : 'ঢাকার বাহিরে'}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-black text-blue-950 mt-1">
                    {districtName}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider flex items-center gap-1">
                      <Building2 size={12} className="text-purple-600" />
                      <span>থানা / উপজেলা (Thana / Upazila)</span>
                    </span>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      উপজেলা
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-black text-purple-950 mt-1">
                    {thanaName || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Local House / Road / Village Detailed Address */}
              <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                    <Home size={12} className="text-neutral-600" />
                    <span>বাসা / রোড / গ্রাম / পূর্ণাঙ্গ ঠিকানা (Street Address)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedOrder.address || selectedOrder.shippingAddress || '');
                      setCopiedId('address');
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-0.5 cursor-pointer"
                    title="শুধু এই ঠিকানাটুকু কপি করুন"
                  >
                    {copiedId === 'address' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{copiedId === 'address' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm font-bold text-neutral-900 whitespace-pre-wrap leading-relaxed bg-neutral-50/70 p-2.5 rounded-lg border border-neutral-200/60">
                  {selectedOrder.address || selectedOrder.shippingAddress || 'N/A'}
                </p>
              </div>

              {/* Payment & Delivery Info */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-neutral-200/60">
                <div>
                  <span className="text-neutral-500 font-bold">পেমেন্ট মেথড:</span>{' '}
                  <span className="font-bold text-neutral-900 uppercase">{selectedOrder.paymentMethod || 'COD'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-bold">পেমেন্ট স্ট্যাটাস:</span>{' '}
                  <span className="font-bold uppercase px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-800 text-[10px]">
                    {selectedOrder.paymentStatus || 'Pending'}
                  </span>
                </div>
              </div>

              {selectedOrder.orderNotes && (
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                  <span className="font-bold block">অর্ডার নোট:</span>
                  <p>{selectedOrder.orderNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Steadfast Courier Service Card */}
          <div className="bg-gradient-to-br from-orange-50/70 via-white to-pink-50/30 p-4 rounded-2xl border border-orange-200/90 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6A00] to-[#EE0979] text-white flex items-center justify-center shadow-2xs">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
                    স্টেডফাস্ট কুরিয়ার পার্সেল ডেলিভারি
                  </h3>
                  <p className="text-[10px] text-neutral-500">
                    {selectedOrder.courierTrackingCode ? 'পার্সেল বুকিং সম্পন্ন হয়েছে' : 'এখনও কুরিয়ারে বুকিং দেওয়া হয়নি'}
                  </p>
                </div>
              </div>

              {selectedOrder.courierTrackingCode ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRefreshTracking(selectedOrder)}
                    disabled={refreshingTrackingId === selectedOrder.id}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    title="রিয়েল-টাইম ডেলিভারি স্ট্যাটাস চেক করুন"
                  >
                    <RefreshCw size={12} className={refreshingTrackingId === selectedOrder.id ? "animate-spin text-[#FF6A00]" : ""} />
                    <span>স্ট্যাটাস রিফ্রেশ</span>
                  </button>

                  <a
                    href={`https://steadfast.com.bd/t/${selectedOrder.courierTrackingCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#FF6A00] hover:bg-[#E55F00] px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer"
                  >
                    <span>লাইভ ট্র্যাকিং</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setBookingOrder(selectedOrder); }}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-[#FF6A00] to-[#EE0979] hover:brightness-105 active:scale-95 px-3.5 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Truck size={14} />
                  <span>১-ক্লিকে পার্সেল বুক করুন</span>
                </button>
              )}
            </div>

            {selectedOrder.courierTrackingCode && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Tracking Code</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-black text-neutral-900 text-xs">
                      {selectedOrder.courierTrackingCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(String(selectedOrder.courierTrackingCode));
                        setCopiedId('tracking');
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="text-neutral-400 hover:text-black cursor-pointer"
                    >
                      {copiedId === 'tracking' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">Consignment ID</span>
                  <span className="font-mono font-black text-neutral-800 text-xs mt-0.5 block">
                    {selectedOrder.courierConsignmentId || 'N/A'}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-neutral-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase block">কুরিয়ার স্ট্যাটাস</span>
                  <span className="inline-block mt-0.5 font-bold text-xs uppercase px-2 py-0.5 rounded-md bg-orange-100 text-orange-900">
                    {selectedOrder.courierStatus || 'in_review'}
                  </span>
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
              <span className="font-mono font-bold text-neutral-900">৳ {((selectedOrder.total || 0) - (selectedOrder.shippingCost || selectedOrder.shipping || 0)).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-neutral-600">
              <span>ডেলিভারি চার্জ (Delivery):</span>
              <span className="font-mono font-bold text-neutral-900">৳ {Number(selectedOrder.shippingCost || selectedOrder.shipping || selectedOrder.deliveryCost || 0).toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-sm sm:text-base font-black text-neutral-900">
              <span>সর্বমোট মূল্য (Total Amount):</span>
              <span className="text-emerald-700">৳ {Number(selectedOrder.total || 0).toLocaleString()}</span>
            </div>
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
            Review, confirm, manage and track customer orders ({orders.length} total)
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
            placeholder="Search Order ID, Name, Phone, District, Thana, Address..."
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
              onBookCourier={(ord) => setBookingOrder(ord)}
            />
          ))}
        </div>
      )}

      {/* Steadfast Courier 1-Click Booking Modal */}
      <SteadfastBookingModal
        isOpen={!!bookingOrder}
        onClose={() => setBookingOrder(null)}
        order={bookingOrder}
        storeConfig={config}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  );
}
