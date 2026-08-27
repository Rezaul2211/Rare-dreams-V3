import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order } from '../../types';
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
  ArrowLeft 
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
  isUpdating 
}: { 
  order: Order; 
  onStatusChange: (id: string, status: OrderStatus) => void;
  onSelectOrder: (order: Order) => void;
  onCopy: (id: string) => void;
  copiedId: string | null;
  isUpdating: boolean;
}) => {
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
        (order.address || '').toLowerCase().includes(q);

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
            Review, confirm, and update customer orders ({orders.length} total)
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
            placeholder="Search Order ID, Name, Phone, City..."
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
            />
          ))}
        </div>
      )}

      {/* Detailed Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base sm:text-lg font-black uppercase text-neutral-900">Order Details</h3>
                  {getStatusBadge(selectedOrder.status as OrderStatus)}
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                  #{selectedOrder.id}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="p-1.5 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer Details */}
            <div className="p-3 bg-neutral-50 rounded-2xl space-y-1 text-xs">
              <p><span className="font-bold">Customer:</span> {selectedOrder.customerName || 'Guest'}</p>
              <p><span className="font-bold">Phone:</span> {selectedOrder.phone}</p>
              <p><span className="font-bold">Address:</span> {selectedOrder.address}, {selectedOrder.city}</p>
              <p><span className="font-bold">Payment:</span> {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus || 'pending'})</p>
            </div>

            {/* Products List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-900 uppercase">Items</h4>
              <div className="divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                {selectedOrder.products?.map((p, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-8 h-8 bg-neutral-100 rounded overflow-hidden shrink-0">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <span className="font-medium text-neutral-900 truncate max-w-[180px]">{p.name}</span>
                    </div>
                    <span className="font-bold text-neutral-900 shrink-0">
                      {p.quantity} x ৳{p.price} = ৳{(p.quantity * p.price).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-sm font-black text-neutral-900">
              <span>Total Amount</span>
              <span>৳ {selectedOrder.total?.toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
