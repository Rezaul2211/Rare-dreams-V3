import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, limit, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  Package, 
  Plus, 
  ClipboardList, 
  BarChart3, 
  Ticket, 
  MoreVertical, 
  ChevronDown, 
  ShieldCheck,
  TrendingDown
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSales: 0,
    totalCustomers: 0,
    totalProducts: 0,
  });

  const [statusCounts, setStatusCounts] = useState({ pending: 0, processing: 0, shipped: 0, delivered: 0, total: 0 });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let productCount = 0;
        let orderCount = 0;
        let customerCount = 0;
        let totalSalesVal = 0;

        try {
          const productsSnap = await getDocs(collection(db, 'products'));
          productCount = productsSnap.size;
        } catch {
          productCount = 0;
        }

        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          customerCount = usersSnap.size;
        } catch {
          customerCount = 0;
        }
        
        let pCount = 0, prCount = 0, sCount = 0, dCount = 0;
        try {
          const ordersSnap = await getDocs(collection(db, 'orders'));
          orderCount = ordersSnap.size;
          ordersSnap.forEach((doc) => {
            const data = doc.data();
            totalSalesVal += (data.totalAmount || data.total || 0);
            const status = (data.status || 'pending').toLowerCase();
            if (status === 'pending') pCount++;
            else if (status === 'processing') prCount++;
            else if (status === 'shipped') sCount++;
            else if (status === 'delivered') dCount++;
          });
          setStatusCounts({ pending: pCount, processing: prCount, shipped: sCount, delivered: dCount, total: orderCount });
        } catch {
          orderCount = 0;
        }

        // Fetch recent orders
        let ordersData: any[] = [];
        try {
          const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(4));
          const ordersSnap = await getDocs(q);
          ordersData = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch {
          // fallback
        }

        if (ordersData.length > 0) {
          setRecentOrders(ordersData);
        } else {
          setRecentOrders([]);
        }

        setStats({
          totalOrders: orderCount,
          totalSales: totalSalesVal,
          totalCustomers: customerCount,
          totalProducts: productCount
        });
      } catch (err) {
        console.error("Dashboard fetch error", err);
      }
    };

    fetchDashboardData();
  }, []);

  const cleanAdminName = (user?.displayName || 'Rezaul Karim')
    .replace(/\(Admin\)/gi, '')
    .trim() || 'Rezaul Karim';

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto pb-8 font-sans">
      {/* 1. WELCOME BANNER (Matching Reference Screenshot 2) */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#818CF8] via-[#A78BFA] to-[#C084FC] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="relative z-10 max-w-md">
          <span className="text-xs sm:text-sm font-medium text-white/95">Welcome back,</span>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5 flex items-center gap-1.5">
            <span>{cleanAdminName}</span>
            <span className="inline-block">👋</span>
          </h1>
          <div className="mt-2.5">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white/20 backdrop-blur-md text-white text-[11px] sm:text-xs font-semibold rounded-full border border-white/25 shadow-xs">
              <ShieldCheck size={13} className="text-amber-300 fill-amber-300/30" />
              <span>Store Administrator</span>
            </span>
          </div>
        </div>

        {/* 3D Shopping Bag Illustration on Right */}
        <div className="absolute right-2 sm:right-6 bottom-0 top-0 flex items-center justify-end pointer-events-none opacity-90">
          <div className="relative w-32 h-28 sm:w-44 sm:h-36">
            {/* 3D translucent shopping bag background card */}
            <div className="absolute top-1 right-2 w-20 h-20 sm:w-28 sm:h-28 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg flex flex-col items-center justify-center transform rotate-6">
              <ShoppingBag size={38} className="text-white drop-shadow-md" />
            </div>
            {/* Floating chart mini card */}
            <div className="absolute bottom-1 right-10 sm:right-16 w-16 h-16 sm:w-22 sm:h-22 bg-indigo-950/20 rounded-xl backdrop-blur-md border border-white/30 shadow-md flex items-center justify-center transform -rotate-6">
              <BarChart3 size={28} className="text-amber-300" />
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="space-y-2.5">
        <h3 className="text-xs sm:text-sm font-bold text-neutral-800">Quick Actions</h3>
        <div className="grid grid-cols-5 gap-2 sm:gap-3 text-center">
          {/* Add Product */}
          <Link
            to="/admin/products/new"
            className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-neutral-100 shadow-2xs hover:border-purple-200 transition-all flex flex-col items-center justify-center"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#F3EFFF] text-[#7C3AED] flex items-center justify-center mb-1.5">
              <Plus size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-700 truncate w-full">Add Product</span>
          </Link>

          {/* Orders */}
          <Link
            to="/admin/orders"
            className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-neutral-100 shadow-2xs hover:border-emerald-200 transition-all flex flex-col items-center justify-center"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mb-1.5">
              <ClipboardList size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-700 truncate w-full">Orders</span>
          </Link>

          {/* Customers */}
          <Link
            to="/admin/customers"
            className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-neutral-100 shadow-2xs hover:border-amber-200 transition-all flex flex-col items-center justify-center"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center mb-1.5">
              <Users size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-700 truncate w-full">Customers</span>
          </Link>

          {/* Reports */}
          <Link
            to="/admin/settings"
            className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-neutral-100 shadow-2xs hover:border-sky-200 transition-all flex flex-col items-center justify-center"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mb-1.5">
              <BarChart3 size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-700 truncate w-full">Reports</span>
          </Link>

          {/* System */}
          <Link
            to="/admin/system"
            className="bg-white p-2.5 sm:p-3.5 rounded-2xl border border-neutral-100 shadow-2xs hover:border-rose-200 transition-all flex flex-col items-center justify-center"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#FFE4E6] text-[#E11D48] flex items-center justify-center mb-1.5">
              <Ticket size={18} className="sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-700 truncate w-full">System</span>
          </Link>
        </div>
      </div>

      {/* 2. KPI 4 STATS CARDS (Matching Reference Screenshot 2 - Horizontal compact layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Orders */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-100 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#F3EFFF] text-[#7C3AED] flex items-center justify-center shrink-0">
            <ShoppingBag size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">Total Orders</p>
            <p className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug">
              {stats.totalOrders.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑ 18.2%</span>
              <span className="text-neutral-400 font-normal">vs last 7 days</span>
            </p>
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-100 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">Total Sales</p>
            <p className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug">
              ৳ {stats.totalSales.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑ 24.5%</span>
              <span className="text-neutral-400 font-normal">vs last 7 days</span>
            </p>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-100 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
            <Users size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">Total Customers</p>
            <p className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug">
              {stats.totalCustomers.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑ 12.1%</span>
              <span className="text-neutral-400 font-normal">vs last 7 days</span>
            </p>
          </div>
        </div>

        {/* Total Products */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-100 shadow-2xs flex items-center space-x-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
            <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">Total Products</p>
            <p className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug">
              {stats.totalProducts.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>↑ 7.8%</span>
              <span className="text-neutral-400 font-normal">vs last 7 days</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. CHARTS ROW (Order Status Donut & Sales Overview Line Chart - Exactly side-by-side as in Reference Screenshot 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Status Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs sm:text-sm font-bold text-neutral-900">Order Status</h3>
            <button className="text-neutral-400 hover:text-neutral-600 p-1">
              <MoreVertical size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 sm:gap-4 my-auto py-1">
            {/* SVG Donut Chart */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {statusCounts.total === 0 ? (
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#E5E7EB" strokeWidth="15" />
                ) : (
                  <>
                    {/* Pending arc (Amber) */}
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#F59E0B" strokeWidth="15" strokeDasharray={`${(statusCounts.pending / statusCounts.total) * 238.76} 238.76`} strokeDashoffset="0" />
                    {/* Processing arc (Blue) */}
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#3B82F6" strokeWidth="15" strokeDasharray={`${(statusCounts.processing / statusCounts.total) * 238.76} 238.76`} strokeDashoffset={`-${(statusCounts.pending / statusCounts.total) * 238.76}`} />
                    {/* Shipped arc (Green) */}
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#10B981" strokeWidth="15" strokeDasharray={`${(statusCounts.shipped / statusCounts.total) * 238.76} 238.76`} strokeDashoffset={`-${((statusCounts.pending + statusCounts.processing) / statusCounts.total) * 238.76}`} />
                    {/* Delivered arc (Purple) */}
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#8B5CF6" strokeWidth="15" strokeDasharray={`${(statusCounts.delivered / statusCounts.total) * 238.76} 238.76`} strokeDashoffset={`-${((statusCounts.pending + statusCounts.processing + statusCounts.shipped) / statusCounts.total) * 238.76}`} />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm sm:text-base font-bold text-neutral-900 leading-none">{statusCounts.total.toLocaleString()}</span>
                <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase font-semibold mt-0.5">Total</span>
              </div>
            </div>

            {/* Donut Legend Items */}
            <div className="flex-1 space-y-2 text-[11px] sm:text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="font-medium text-neutral-600">Pending</span>
                </div>
                <span className="font-semibold text-neutral-800">
                  {statusCounts.pending} ({statusCounts.total > 0 ? ((statusCounts.pending / statusCounts.total) * 100).toFixed(1) : '0'}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="font-medium text-neutral-600">Processing</span>
                </div>
                <span className="font-semibold text-neutral-800">
                  {statusCounts.processing} ({statusCounts.total > 0 ? ((statusCounts.processing / statusCounts.total) * 100).toFixed(1) : '0'}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-medium text-neutral-600">Shipped</span>
                </div>
                <span className="font-semibold text-neutral-800">
                  {statusCounts.shipped} ({statusCounts.total > 0 ? ((statusCounts.shipped / statusCounts.total) * 100).toFixed(1) : '0'}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  <span className="font-medium text-neutral-600">Delivered</span>
                </div>
                <span className="font-semibold text-neutral-800">
                  {statusCounts.delivered} ({statusCounts.total > 0 ? ((statusCounts.delivered / statusCounts.total) * 100).toFixed(1) : '0'}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Overview Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-bold text-neutral-900">Sales Overview</h3>
            <button className="text-[11px] font-medium text-neutral-600 bg-neutral-100/80 px-2.5 py-1 rounded-lg flex items-center space-x-1 hover:bg-neutral-200 transition-colors">
              <span>This Week</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div className="pt-2 my-auto">
            <div className="h-32 sm:h-36 w-full relative">
              {/* Y Axis Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between text-[9px] text-neutral-400 font-medium pointer-events-none pr-1">
                <div className="border-b border-neutral-100/80 pb-0.5">40K</div>
                <div className="border-b border-neutral-100/80 pb-0.5">30K</div>
                <div className="border-b border-neutral-100/80 pb-0.5">20K</div>
                <div className="border-b border-neutral-100/80 pb-0.5">10K</div>
                <div>0</div>
              </div>

              {/* Chart SVG Curve */}
              <svg className="w-full h-full relative z-10 pl-6 overflow-visible" viewBox="0 0 300 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Filled gradient */}
                <path
                  d="M 10 90 Q 50 40, 90 70 T 170 30 T 250 50 T 290 20 L 290 120 L 10 120 Z"
                  fill="url(#salesGradient)"
                />

                {/* Main curve */}
                <path
                  d="M 10 90 Q 50 40, 90 70 T 170 30 T 250 50 T 290 20"
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Data point dots */}
                <circle cx="10" cy="90" r="3.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="50" cy="40" r="3.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="90" cy="70" r="3.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="130" cy="50" r="3.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="170" cy="30" r="3.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="210" cy="55" r="3.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="250" cy="50" r="3.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="290" cy="20" r="4.5" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="2" />
              </svg>
            </div>

            {/* X Axis Labels */}
            <div className="flex justify-between pl-6 text-[10px] text-neutral-400 font-medium pt-1">
              <span>Aug 1</span>
              <span>Aug 3</span>
              <span>Aug 5</span>
              <span>Aug 7</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. RECENT ORDERS LIST (Matching Reference Screenshot 2) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-100 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-neutral-900">Recent Orders</h3>
          <Link 
            to="/admin/orders" 
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View All
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="space-y-2">
            {recentOrders.map((ord, idx) => {
              const statusClass = 
                ord.status?.toLowerCase() === 'delivered' ? 'bg-[#F3EFFF] text-[#7C3AED]' :
                ord.status?.toLowerCase() === 'shipped' ? 'bg-[#DCFCE7] text-[#16A34A]' :
                ord.status?.toLowerCase() === 'processing' ? 'bg-[#E0F2FE] text-[#0284C7]' :
                'bg-[#FEF3C7] text-[#D97706]';

              return (
                <div 
                  key={ord.id || idx} 
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-neutral-100/80 hover:bg-neutral-50/80 transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <img 
                      src={ord.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop`} 
                      alt={ord.customerName || ord.name || 'Customer'} 
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-neutral-200/60"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-900 leading-tight">
                        #{ord.id?.slice(0, 8) || 'ORDER'}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        Customer: {ord.customerName || ord.name || ord.shippingAddress?.fullName || 'User'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-neutral-900">
                      ৳ {(ord.totalAmount || ord.total || ord.subtotal || 0).toLocaleString()}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusClass}`}>
                      {ord.status || 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-neutral-400 text-xs font-medium bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
            No recent orders found in database.
          </div>
        )}
      </div>
    </div>
  );
}
