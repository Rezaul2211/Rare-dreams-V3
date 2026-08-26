import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  ShoppingBag,
  RefreshCw,
  UserCheck,
  Ban,
  ArrowLeft
} from 'lucide-react';

type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
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
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });

      const targetOrder = orders.find(o => o.id === orderId);

      // Trigger automatic customer push notification log
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

        // Trigger local notification if in admin preview
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icon-192.png'
          });
        }
      } catch (e) {
        console.warn('Could not record customer status notification:', e);
      }
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error("Error updating order status", error);
      alert('Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePaymentStatusChange = async (orderId: string, newPaymentStatus: 'pending' | 'paid' | 'failed') => {
    setUpdatingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), { paymentStatus: newPaymentStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, paymentStatus: newPaymentStatus } : null);
      }
    } catch (error) {
      console.error("Error updating payment status", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter logic
  const filteredOrders = orders.filter(order => {
    const matchesTab = activeTab === 'All' || order.status === activeTab;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      order.id.toLowerCase().includes(q) ||
      (order.customerName || '').toLowerCase().includes(q) ||
      (order.phone || '').includes(q) ||
      (order.city || '').toLowerCase().includes(q) ||
      (order.address || '').toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  // Calculate metrics
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const confirmedCount = orders.filter(o => o.status === 'Confirmed').length;
  const processingCount = orders.filter(o => o.status === 'Processing').length;
  const shippedCount = orders.filter(o => o.status === 'Shipped').length;
  const deliveredCount = orders.filter(o => o.status === 'Delivered').length;
  const cancelledCount = orders.filter(o => o.status === 'Cancelled').length;

  const totalRevenue = orders
    .filter(o => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Pending':
        return <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200"><Clock size={12} className="mr-1" /> Pending</span>;
      case 'Confirmed':
        return <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200"><CheckCircle2 size={12} className="mr-1" /> Confirmed</span>;
      case 'Processing':
        return <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200"><RefreshCw size={12} className="mr-1 animate-spin" /> Processing</span>;
      case 'Shipped':
        return <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200"><Truck size={12} className="mr-1" /> Shipped</span>;
      case 'Delivered':
        return <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><PackageCheck size={12} className="mr-1" /> Delivered</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200"><XCircle size={12} className="mr-1" /> Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-800">{status}</span>;
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

  return (
    <div className="space-y-5">
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Admin Dashboard</span>
      </Link>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-900">Order Management</h1>
          <p className="text-xs text-neutral-500 font-medium">Review, confirm, ship, and update customer orders</p>
        </div>

        <button 
          onClick={fetchOrders} 
          className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-neutral-200 rounded-2xl text-xs font-bold hover:bg-neutral-50 transition-colors shadow-2xs"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Total Orders</p>
          <p className="text-2xl font-black text-neutral-900 mt-1">{orders.length}</p>
        </div>
        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60 shadow-2xs">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Review</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          </p>
          <p className="text-2xl font-black text-amber-900 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/60 shadow-2xs">
          <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Processing & Shipped</p>
          <p className="text-2xl font-black text-blue-900 mt-1">{confirmedCount + processingCount + shippedCount}</p>
        </div>
        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/60 shadow-2xs">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Sales</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">৳ {totalRevenue.toFixed(0)}</p>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search by Order ID, Name, Phone number or City..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-black transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
          {[
            { label: 'All', count: orders.length },
            { label: 'Pending', count: pendingCount, color: 'bg-amber-500' },
            { label: 'Confirmed', count: confirmedCount, color: 'bg-teal-500' },
            { label: 'Processing', count: processingCount, color: 'bg-blue-500' },
            { label: 'Shipped', count: shippedCount, color: 'bg-indigo-500' },
            { label: 'Delivered', count: deliveredCount, color: 'bg-emerald-500' },
            { label: 'Cancelled', count: cancelledCount, color: 'bg-rose-500' },
          ].map(tab => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all flex items-center space-x-2 shrink-0 ${
                activeTab === tab.label 
                  ? 'bg-neutral-900 text-white shadow-xs' 
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.label ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List / Table */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center text-neutral-400 font-medium">
          Loading orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
          <ShoppingBag size={36} className="mx-auto text-neutral-300" />
          <p className="text-base font-bold text-neutral-800">No orders found</p>
          <p className="text-xs text-neutral-500">There are no orders matching your current search or status filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md ${
                order.status === 'Pending' ? 'border-amber-300 bg-amber-50/20' : 'border-neutral-200/90'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Order Summary Line */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-lg">
                      #{order.id.slice(0, 10)}...
                    </span>
                    <button 
                      onClick={() => copyToClipboard(order.id)} 
                      className="text-neutral-400 hover:text-black transition-colors"
                      title="Copy Full Order ID"
                    >
                      {copiedId === order.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                    {getStatusBadge(order.status)}
                    <span className="text-xs text-neutral-400 font-medium ml-auto sm:ml-0">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Customer</p>
                      <p className="font-bold text-neutral-900">{order.customerName || 'Guest User'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Phone & Location</p>
                      <p className="font-medium text-neutral-800 flex items-center space-x-1">
                        <a href={`tel:${order.phone}`} className="text-neutral-900 font-bold hover:underline flex items-center space-x-1">
                          <Phone size={12} className="text-emerald-600 shrink-0" />
                          <span>{order.phone}</span>
                        </a>
                        <span className="text-neutral-400">({order.city})</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Payment & Total</p>
                      <p className="font-medium text-neutral-900">
                        <span className="font-black text-neutral-900">৳ {order.total?.toFixed(0)}</span>
                        <span className="text-neutral-500 text-[11px] uppercase font-bold ml-1">({order.paymentMethod})</span>
                      </p>
                      {order.transactionId && (
                        <p className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5 inline-block">
                          TrxID: {order.transactionId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ordered items preview */}
                  <div className="flex items-center gap-2 overflow-x-auto pt-2">
                    {order.products?.slice(0, 4).map((p, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5 bg-neutral-50 border border-neutral-200/80 rounded-xl px-2 py-1 text-[11px] shrink-0">
                        <div className="w-6 h-6 bg-neutral-200 rounded-md overflow-hidden shrink-0">
                          {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-bold truncate max-w-[120px] text-neutral-800">{p.name}</span>
                        <span className="text-neutral-400">x{p.quantity}</span>
                      </div>
                    ))}
                    {(order.products?.length || 0) > 4 && (
                      <span className="text-[11px] text-neutral-500 font-bold px-2 py-1 bg-neutral-100 rounded-xl">
                        +{order.products.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Action Controls */}
                <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 shrink-0">
                  {order.status === 'Pending' && (
                    <>
                      <button 
                        onClick={() => handleStatusChange(order.id, 'Confirmed')}
                        disabled={updatingId === order.id}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                      >
                        <UserCheck size={14} />
                        <span>Confirm Order</span>
                      </button>
                      <button 
                        onClick={() => handleStatusChange(order.id, 'Cancelled')}
                        disabled={updatingId === order.id}
                        className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Ban size={14} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {/* Manual Status Selector Dropdown */}
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                    disabled={updatingId === order.id}
                    className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>

                  <button 
                    onClick={() => setSelectedOrder(order)}
                    className="px-3.5 py-2 bg-black text-white hover:bg-neutral-800 rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer ml-auto sm:ml-0"
                  >
                    <Eye size={14} />
                    <span>View Details</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200/80 p-6 sm:p-8 space-y-6 my-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-black uppercase text-neutral-900">Order Details</h3>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-neutral-400 mt-1 font-mono">
                  Order ID: {selectedOrder.id}
                </p>
                <p className="text-xs text-neutral-500 font-medium">
                  Placed on: {formatDate(selectedOrder.createdAt)}
                </p>
              </div>

              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Status Workflow Action Bar */}
            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-2">
              <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Order Status Actions</p>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => handleStatusChange(selectedOrder.id, 'Confirmed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedOrder.status === 'Confirmed' ? 'bg-teal-600 text-white shadow-xs' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Confirm Order
                </button>

                <button 
                  onClick={() => handleStatusChange(selectedOrder.id, 'Processing')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedOrder.status === 'Processing' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Mark Processing
                </button>

                <button 
                  onClick={() => handleStatusChange(selectedOrder.id, 'Shipped')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedOrder.status === 'Shipped' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Mark Shipped
                </button>

                <button 
                  onClick={() => handleStatusChange(selectedOrder.id, 'Delivered')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedOrder.status === 'Delivered' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Mark Delivered
                </button>

                <button 
                  onClick={() => handleStatusChange(selectedOrder.id, 'Cancelled')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedOrder.status === 'Cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-rose-50 text-rose-700'
                  }`}
                >
                  Cancel / Reject Order
                </button>
              </div>
            </div>

            {/* Customer & Shipping Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-2">
                <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center space-x-1">
                  <Phone size={14} className="text-black" />
                  <span>Customer Contact</span>
                </h4>
                <p className="text-sm font-bold text-neutral-900">{selectedOrder.customerName || 'Guest User'}</p>
                <a 
                  href={`tel:${selectedOrder.phone}`} 
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <Phone size={12} />
                  <span>Call {selectedOrder.phone}</span>
                </a>
                {selectedOrder.email && (
                  <p className="text-xs text-neutral-600 font-medium">Email: {selectedOrder.email}</p>
                )}
                <p className="text-[11px] text-neutral-500 font-mono">User ID: {selectedOrder.userId}</p>
              </div>

              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-2">
                <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center space-x-1">
                  <MapPin size={14} className="text-black" />
                  <span>Delivery Address</span>
                </h4>
                {(selectedOrder.district || selectedOrder.thana) && (
                  <p className="text-xs text-neutral-900 font-semibold">
                    Location: <span className="font-bold text-black">{selectedOrder.thana ? `${selectedOrder.thana}, ` : ''}{selectedOrder.district || ''}</span>
                  </p>
                )}
                <p className="text-xs font-bold text-neutral-900 whitespace-pre-wrap">{selectedOrder.address}</p>
                {selectedOrder.deliveryArea && (
                  <p className="text-xs text-neutral-600 font-medium">
                    Area: <span className="text-neutral-900 font-bold">{selectedOrder.deliveryAreaBn || selectedOrder.deliveryArea}</span>
                  </p>
                )}
                {selectedOrder.orderNotes && (
                  <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <span className="font-bold">Note: </span>{selectedOrder.orderNotes}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Payment Method</p>
                  <p className="text-sm font-black text-neutral-900 uppercase mt-0.5">{selectedOrder.paymentMethod}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Payment Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      selectedOrder.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedOrder.paymentStatus || 'pending'}
                    </span>
                    <button 
                      onClick={() => handlePaymentStatusChange(
                        selectedOrder.id, 
                        selectedOrder.paymentStatus === 'paid' ? 'pending' : 'paid'
                      )}
                      className="text-[11px] font-bold text-neutral-600 underline hover:text-black cursor-pointer"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              </div>

              {(selectedOrder.senderNumber || selectedOrder.transactionId) && (
                <div className="pt-2 border-t border-neutral-200/60 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">Sender Account</span>
                    <span className="font-mono font-bold text-neutral-900">{selectedOrder.senderNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">Transaction ID (TrxID)</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                      {selectedOrder.transactionId || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Products Ordered */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Ordered Products ({selectedOrder.products?.length || 0})</h4>
              
              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden">
                {selectedOrder.products?.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex items-center justify-between gap-3 bg-white">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-14 bg-neutral-100 rounded-xl overflow-hidden border border-neutral-100 shrink-0">
                        {item.images?.[0] && <img src={item.images[0]} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-neutral-900 line-clamp-1">{item.name}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5 font-medium">
                          {item.selectedSize && `Size: ${item.selectedSize}`} {item.selectedColor && `• Color: ${item.selectedColor}`}
                        </p>
                        <p className="text-[11px] text-neutral-400">৳ {item.price} × {item.quantity}</p>
                      </div>
                    </div>
                    <span className="font-black text-xs text-neutral-900 shrink-0">
                      ৳ {(item.price * item.quantity).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="bg-neutral-900 text-white p-5 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs text-neutral-300">
                <span>Subtotal</span>
                <span>৳ {selectedOrder.subtotal?.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-xs text-neutral-300">
                <span>Delivery Charge</span>
                <span>৳ {selectedOrder.shipping?.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-base font-black pt-2 border-t border-neutral-800 text-white">
                <span>Grand Total</span>
                <span className="text-emerald-400">৳ {selectedOrder.total?.toFixed(0)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-900 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
