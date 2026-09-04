import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  Truck, 
  PackageCheck, 
  XCircle, 
  Calendar, 
  Printer, 
  ArrowLeft, 
  RefreshCw, 
  Filter,
  CreditCard,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface OrderItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  images?: string[];
}

interface OrderRecord {
  id: string;
  total?: number;
  totalAmount?: number;
  subtotal?: number;
  status?: string;
  createdAt?: any;
  items?: OrderItem[];
  products?: OrderItem[];
  paymentMethod?: string;
  customerName?: string;
  name?: string;
  phone?: string;
  city?: string;
}

export default function AdminReports() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week' | 'today'>('all');

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'));
      const snap = await getDocs(q);
      const fetched: OrderRecord[] = [];
      snap.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as OrderRecord);
      });
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (typeof a.createdAt === 'number' ? a.createdAt : 0);
        const timeB = b.createdAt?.toMillis?.() || (typeof b.createdAt === 'number' ? b.createdAt : 0);
        return timeB - timeA;
      });
      setOrders(fetched);
    } catch (e) {
      console.warn("Could not fetch reports data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

  // Filter orders by selected timeframe
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return orders.filter(ord => {
      if (timeFilter === 'all') return true;
      
      let orderTime = 0;
      if (ord.createdAt?.toMillis) {
        orderTime = ord.createdAt.toMillis();
      } else if (ord.createdAt?.seconds) {
        orderTime = ord.createdAt.seconds * 1000;
      } else if (typeof ord.createdAt === 'string') {
        orderTime = new Date(ord.createdAt).getTime();
      } else {
        return true; // Keep if no valid date
      }

      if (timeFilter === 'today') return orderTime >= startOfToday;
      if (timeFilter === 'week') return orderTime >= sevenDaysAgo;
      if (timeFilter === 'month') return orderTime >= thirtyDaysAgo;
      return true;
    });
  }, [orders, timeFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let grossRevenue = 0;
    let deliveredRevenue = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;

    const paymentMethods: Record<string, number> = {
      'Cash on Delivery': 0,
      'bKash': 0,
      'Nagad': 0,
      'Other': 0
    };

    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number; image?: string }> = {};

    filteredOrders.forEach(ord => {
      const amount = Number(ord.total || ord.totalAmount || ord.subtotal || 0);
      const status = (ord.status || 'Pending').toLowerCase();

      grossRevenue += amount;

      if (status === 'delivered') {
        deliveredRevenue += amount;
        deliveredCount++;
      } else if (status === 'pending') {
        pendingCount++;
      } else if (status === 'processing') {
        processingCount++;
      } else if (status === 'shipped') {
        shippedCount++;
      } else if (status === 'cancelled') {
        cancelledCount++;
      } else {
        pendingCount++;
      }

      // Payment Breakdown
      const pMethod = ord.paymentMethod || 'Cash on Delivery';
      if (pMethod.toLowerCase().includes('bkash')) paymentMethods['bKash']++;
      else if (pMethod.toLowerCase().includes('nagad')) paymentMethods['Nagad']++;
      else if (pMethod.toLowerCase().includes('cash') || pMethod.toLowerCase().includes('cod')) paymentMethods['Cash on Delivery']++;
      else paymentMethods['Other']++;

      // Product sales accumulation
      const items = ord.items || ord.products || [];
      items.forEach(item => {
        const pName = item.name || 'Product';
        const pQty = Number(item.quantity || 1);
        const pPrice = Number(item.price || 0);
        const pImg = item.image || item.images?.[0];

        if (!productSalesMap[pName]) {
          productSalesMap[pName] = { name: pName, quantity: 0, revenue: 0, image: pImg };
        }
        productSalesMap[pName].quantity += pQty;
        productSalesMap[pName].revenue += (pPrice * pQty);
      });
    });

    const totalOrdersCount = filteredOrders.length;
    const aov = totalOrdersCount > 0 ? Math.round(grossRevenue / totalOrdersCount) : 0;
    const deliveryRate = totalOrdersCount > 0 ? Math.round((deliveredCount / totalOrdersCount) * 100) : 0;

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    return {
      grossRevenue,
      deliveredRevenue,
      totalOrdersCount,
      aov,
      deliveryRate,
      pendingCount,
      processingCount,
      shippedCount,
      deliveredCount,
      cancelledCount,
      paymentMethods,
      topProducts
    };
  }, [filteredOrders]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto font-sans antialiased pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200/90 shadow-2xs">
        <div className="flex items-center space-x-3">
          <Link
            to="/admin"
            className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-colors shrink-0 cursor-pointer"
            aria-label="Back to Admin Dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
              <BarChart3 className="text-[#7C3AED]" size={24} />
              <span>Sales & Business Reports</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              দোকানের সর্বমোট আয়, বিক্রয় ট্রেন্ড এবং অর্ডার পারফরম্যান্স এনালাইসিস
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Timeframe Filter Buttons */}
          <div className="flex items-center p-1 bg-neutral-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeFilter === 'today' ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-black'
              }`}
            >
              আজকে
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeFilter === 'week' ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-black'
              }`}
            >
              ৭ দিন
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeFilter === 'month' ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-black'
              }`}
            >
              ৩০ দিন
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                timeFilter === 'all' ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-black'
              }`}
            >
              সব সময়
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Printer size={14} />
            <span>প্রিন্ট রিপোর্ট</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchReportsData}
            disabled={loading}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Reload Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 1. Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Gross Revenue */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 sm:p-5 rounded-2xl border border-purple-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-purple-700">Gross Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-purple-600/15 text-purple-700 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-purple-950 tracking-tight">
              ৳ {metrics.grossRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-purple-600 mt-0.5">সর্বমোট মোট অর্ডার মূল্য</p>
          </div>
        </div>

        {/* Delivered Sales */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700">Delivered Sales</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-600/15 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
              ৳ {metrics.deliveredRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-600 mt-0.5">{metrics.deliveredCount} টি অর্ডার সফল ডেলিভারি</p>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-700">Average Order (AOV)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-600/15 text-amber-700 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-amber-950 tracking-tight">
              ৳ {metrics.aov.toLocaleString()}
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">গড় প্রতি অর্ডারের পরিমাণ</p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/50 p-4 sm:p-5 rounded-2xl border border-sky-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-sky-700">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-sky-600/15 text-sky-700 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xl sm:text-2xl font-black text-sky-950 tracking-tight">
              {metrics.totalOrdersCount} টি
            </p>
            <p className="text-[11px] text-sky-600 mt-0.5">সফল ডেলিভারি হার {metrics.deliveryRate}%</p>
          </div>
        </div>
      </div>

      {/* 2. Order Status Breakdown Grid */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4">
        <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center justify-between">
          <span>অর্ডার স্ট্যাটাস পাইপলাইন (Order Pipeline)</span>
          <span className="text-xs font-normal text-neutral-400">সর্বমোট {metrics.totalOrdersCount} টি রেকর্ড</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Pending */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
            <div className="flex items-center space-x-1.5 text-amber-700 text-xs font-bold">
              <Clock size={15} />
              <span>Pending</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-amber-950 mt-1.5">{metrics.pendingCount}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              {metrics.totalOrdersCount > 0 ? ((metrics.pendingCount / metrics.totalOrdersCount) * 100).toFixed(1) : 0}% অফ টোটাল
            </p>
          </div>

          {/* Processing */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80">
            <div className="flex items-center space-x-1.5 text-blue-700 text-xs font-bold">
              <PackageCheck size={15} />
              <span>Processing</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-blue-950 mt-1.5">{metrics.processingCount}</p>
            <p className="text-[10px] text-blue-600 mt-0.5">
              {metrics.totalOrdersCount > 0 ? ((metrics.processingCount / metrics.totalOrdersCount) * 100).toFixed(1) : 0}% অফ টোটাল
            </p>
          </div>

          {/* Shipped */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
            <div className="flex items-center space-x-1.5 text-emerald-700 text-xs font-bold">
              <Truck size={15} />
              <span>Shipped</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-emerald-950 mt-1.5">{metrics.shippedCount}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              {metrics.totalOrdersCount > 0 ? ((metrics.shippedCount / metrics.totalOrdersCount) * 100).toFixed(1) : 0}% অফ টোটাল
            </p>
          </div>

          {/* Delivered */}
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80">
            <div className="flex items-center space-x-1.5 text-purple-700 text-xs font-bold">
              <CheckCircle2 size={15} />
              <span>Delivered</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-purple-950 mt-1.5">{metrics.deliveredCount}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">
              {metrics.totalOrdersCount > 0 ? ((metrics.deliveredCount / metrics.totalOrdersCount) * 100).toFixed(1) : 0}% অফ টোটাল
            </p>
          </div>

          {/* Cancelled */}
          <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 col-span-2 sm:col-span-1">
            <div className="flex items-center space-x-1.5 text-rose-700 text-xs font-bold">
              <XCircle size={15} />
              <span>Cancelled</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-rose-950 mt-1.5">{metrics.cancelledCount}</p>
            <p className="text-[10px] text-rose-600 mt-0.5">
              {metrics.totalOrdersCount > 0 ? ((metrics.cancelledCount / metrics.totalOrdersCount) * 100).toFixed(1) : 0}% অফ টোটাল
            </p>
          </div>
        </div>
      </div>

      {/* 3. Two Column Layout: Top Selling Products & Payment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Products (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900">সেরা বিক্রিত প্রোডাক্ট (Top Selling Products)</h3>
              <p className="text-xs text-neutral-400">অর্ডার ভলিউম ও মোট আয় অনুযায়ী তালিকা</p>
            </div>
            <Link
              to="/admin/products"
              className="text-xs font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
            >
              <span>প্রোডাক্ট ম্যানেজারে যান</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>

          {metrics.topProducts.length > 0 ? (
            <div className="divide-y divide-neutral-100">
              {metrics.topProducts.map((p, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300 text-[9px]">Img</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-neutral-900 truncate max-w-[220px] sm:max-w-xs">{p.name}</p>
                      <p className="text-[11px] text-neutral-400">{p.quantity} টি বিক্রি হয়েছে</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs sm:text-sm font-bold text-neutral-900">৳ {p.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">আয়</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-neutral-400 text-xs bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              নির্বাচিত সময়ে কোনো প্রোডাক্ট অর্ডারের ডাটা নেই।
            </div>
          )}
        </div>

        {/* Payment Methods Distribution (1 Col) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-1.5">
              <CreditCard size={18} className="text-neutral-700" />
              <span>পেমেন্ট মেথড ডিস্ট্রিবিউশন</span>
            </h3>
            <p className="text-xs text-neutral-400">গ্রাহকদের ব্যবহৃত পেমেন্ট মাধ্যম</p>
          </div>

          <div className="space-y-3 my-auto">
            {Object.entries(metrics.paymentMethods).map(([method, count]) => {
              const total = metrics.totalOrdersCount || 1;
              const numericCount = Number(count) || 0;
              const pct = Math.round((numericCount / total) * 100);

              const colorClass = 
                method === 'Cash on Delivery' ? 'bg-emerald-500' :
                method === 'bKash' ? 'bg-[#E2136E]' :
                method === 'Nagad' ? 'bg-[#ED1C24]' : 'bg-neutral-500';

              return (
                <div key={method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-800">{method}</span>
                    <span className="text-neutral-500 font-semibold">{numericCount} টি ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-neutral-100">
            <Link
              to="/admin/orders"
              className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <span>সকল অর্ডার দেখুন (All Orders)</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
