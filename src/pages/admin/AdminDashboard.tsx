import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  ShieldCheck,
  ChevronDown,
  Bell,
  Image as ImageIcon,
  Settings,
  X,
  Printer,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  PackagePlus,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSales: 0,
    totalCustomers: 0,
    totalProducts: 0,
  });

  const [statusCounts, setStatusCounts] = useState({ 
    pending: 0, 
    processing: 0, 
    shipped: 0, 
    delivered: 0, 
    cancelled: 0,
    total: 0 
  });

  const [allOrdersList, setAllOrdersList] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [allProductsList, setAllProductsList] = useState<any[]>([]);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [reportTimeframe, setReportTimeframe] = useState<'all' | '7days' | '30days'>('all');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let productCount = 0;
        let customerCount = 0;
        let orderCount = 0;
        let totalSalesVal = 0;
        let pCount = 0, prCount = 0, sCount = 0, dCount = 0, cCount = 0;
        let ordersData: any[] = [];

        // Parallel fetch for lightning-fast dashboard load
        const [productsRes, usersRes, ordersRes] = await Promise.allSettled([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(150)))
        ]);

        if (productsRes.status === 'fulfilled') {
          productCount = productsRes.value.size;
          const prods = productsRes.value.docs.map(d => ({ id: d.id, ...d.data() }));
          setAllProductsList(prods);
        }

        if (usersRes.status === 'fulfilled') {
          customerCount = usersRes.value.size;
        }

        if (ordersRes.status === 'fulfilled') {
          orderCount = ordersRes.value.size;
          ordersRes.value.forEach((doc) => {
            const data = doc.data();
            const fullOrder = { id: doc.id, ...data };
            ordersData.push(fullOrder);

            const amt = Number(data.totalAmount || data.total || data.subtotal || 0);
            totalSalesVal += amt;
            
            const status = (data.status || 'pending').toLowerCase();
            if (status === 'pending') pCount++;
            else if (status === 'processing') prCount++;
            else if (status === 'shipped') sCount++;
            else if (status === 'delivered') dCount++;
            else if (status === 'cancelled') cCount++;
          });

          setStatusCounts({ 
            pending: pCount, 
            processing: prCount, 
            shipped: sCount, 
            delivered: dCount, 
            cancelled: cCount,
            total: orderCount 
          });
          setAllOrdersList(ordersData);
          setRecentOrders(ordersData.slice(0, 5));
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

  // Calculate Reports Data
  const averageOrderValue = stats.totalOrders > 0 
    ? Math.round(stats.totalSales / stats.totalOrders) 
    : 0;

  const deliveredRevenue = allOrdersList
    .filter(o => (o.status || '').toLowerCase() === 'delivered')
    .reduce((sum, o) => sum + Number(o.totalAmount || o.total || 0), 0);

  const pendingRevenue = allOrdersList
    .filter(o => (o.status || '').toLowerCase() === 'pending')
    .reduce((sum, o) => sum + Number(o.totalAmount || o.total || 0), 0);

  // Quick Action Buttons - Fully Organized Admin Hub
  const quickActions = [
    {
      id: 'add-product',
      title: 'Add Product',
      subtitle: 'নতুন প্রোডাক্ট যুক্ত করুন',
      icon: Plus,
      link: '/admin/products/new',
      color: 'bg-[#F3EFFF] text-[#7C3AED] hover:border-purple-300',
      badge: '+ New'
    },
    {
      id: 'products',
      title: 'Products',
      subtitle: 'প্রোডাক্ট ও স্টক তালিকা',
      icon: Package,
      link: '/admin/products',
      color: 'bg-[#E0F2FE] text-[#0284C7] hover:border-sky-300',
      badge: `${stats.totalProducts} টি`
    },
    {
      id: 'orders',
      title: 'Orders',
      subtitle: 'অর্ডার ও ডেলিভারি ট্র্যাকিং',
      icon: ClipboardList,
      link: '/admin/orders',
      color: 'bg-[#DCFCE7] text-[#16A34A] hover:border-emerald-300',
      badge: statusCounts.pending > 0 ? `${statusCounts.pending} Pending` : `${stats.totalOrders} Orders`
    },
    {
      id: 'customers',
      title: 'Customers',
      subtitle: 'গ্রাহকদের তালিকা ও হিস্ট্রি',
      icon: Users,
      link: '/admin/customers',
      color: 'bg-[#FEF3C7] text-[#D97706] hover:border-amber-300',
      badge: `${stats.totalCustomers} Users`
    },
    {
      id: 'reports',
      title: 'Reports',
      subtitle: 'সেলস ও রেভিনিউ রিপোর্ট',
      icon: BarChart3,
      onClick: () => setShowReportsModal(true),
      color: 'bg-[#EDE9FE] text-[#6D28D9] hover:border-indigo-300',
      badge: 'Analytics'
    },
    {
      id: 'notifications',
      title: 'Push Alerts',
      subtitle: 'পুশ নোটিফিকেশন ও অফার',
      icon: Bell,
      link: '/admin/notifications',
      color: 'bg-[#FFE4E6] text-[#E11D48] hover:border-rose-300',
      badge: 'Live'
    },
    {
      id: 'banners',
      title: 'Banners & Style',
      subtitle: 'ব্যানার ও থিম ডিজাইন',
      icon: ImageIcon,
      link: '/admin/settings',
      color: 'bg-[#F5F3FF] text-[#8B5CF6] hover:border-violet-300',
      badge: 'Design'
    },
    {
      id: 'system',
      title: 'System Hub',
      subtitle: 'AI Key, রোল ও ডেটাবেস',
      icon: Settings,
      link: '/admin/system',
      color: 'bg-[#F1F5F9] text-[#475569] hover:border-slate-300',
      badge: 'Setup'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto pb-12 font-sans antialiased overflow-x-hidden">
      {/* 1. WELCOME BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#818CF8] via-[#A78BFA] to-[#C084FC] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="relative z-10 max-w-md">
          <span className="text-xs sm:text-sm font-medium text-white/95">Welcome back,</span>
          <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight mt-0.5 flex items-center gap-1.5 truncate">
            <span className="truncate">{cleanAdminName}</span>
            <span className="inline-block shrink-0">👋</span>
          </h1>
          <div className="mt-2 sm:mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white/20 backdrop-blur-md text-white text-[10px] sm:text-xs font-semibold rounded-full border border-white/25 shadow-xs">
              <ShieldCheck size={12} className="text-amber-300 fill-amber-300/30" />
              <span>Store Administrator</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-black/20 backdrop-blur-md text-white/90 text-[10px] sm:text-[11px] font-medium rounded-full">
              <span>{new Date().toLocaleDateString('bn-BD', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </span>
          </div>
        </div>

        {/* 3D Shopping Bag Illustration on Right (Hidden on mobile to ensure zero overflow) */}
        <div className="hidden sm:flex absolute right-2 sm:right-6 bottom-0 top-0 items-center justify-end pointer-events-none opacity-90 overflow-hidden">
          <div className="relative w-36 h-32 sm:w-44 sm:h-36">
            <div className="absolute top-1 right-2 w-24 h-24 sm:w-28 sm:h-28 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg flex flex-col items-center justify-center transform rotate-6">
              <ShoppingBag size={36} className="text-white drop-shadow-md" />
            </div>
            <div className="absolute bottom-1 right-12 sm:right-16 w-18 h-18 sm:w-22 sm:h-22 bg-indigo-950/20 rounded-xl backdrop-blur-md border border-white/30 shadow-md flex items-center justify-center transform -rotate-6">
              <BarChart3 size={24} className="text-amber-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. ADMIN QUICK ACTIONS HUB (All Core Management Functions Cleanly Integrated) */}
      <div className="space-y-2.5 sm:space-y-3 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-1.5">
              <span>এডমিন কন্ট্রোল ফাংশন (Quick Actions)</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-neutral-500">আপনার শপের প্রয়োজনীয় সব ম্যানেজমেন্ট অপশন নিচে সাজানো রয়েছে</p>
          </div>
          <button
            type="button"
            onClick={() => setShowReportsModal(true)}
            className="self-start sm:self-auto shrink-0 text-xs font-bold text-[#7C3AED] hover:text-[#6D28D9] flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer border border-purple-200/60"
          >
            <BarChart3 size={13} />
            <span>ভিউ রিপোর্ট</span>
          </button>
        </div>

        {/* 8-Card Responsive Grid for Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3.5 w-full">
          {quickActions.map((action) => {
            const Icon = action.icon;
            
            if (action.onClick) {
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.onClick}
                  className="w-full min-w-0 bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200/80 shadow-2xs hover:shadow-md transition-all text-left group cursor-pointer flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="flex items-start justify-between w-full mb-2 sm:mb-3 gap-1">
                    <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${action.color} flex items-center justify-center transition-transform group-hover:scale-105 shrink-0`}>
                      <Icon size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    {action.badge && (
                      <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200/60 shrink-0 max-w-[75px] truncate">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-black transition-colors truncate">
                      {action.title}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-neutral-500 truncate mt-0.5">
                      {action.subtitle}
                    </p>
                  </div>
                </button>
              );
            }

            return (
              <Link
                key={action.id}
                to={action.link || '/admin'}
                className="w-full min-w-0 bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200/80 shadow-2xs hover:shadow-md transition-all text-left group cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                <div className="flex items-start justify-between w-full mb-2 sm:mb-3 gap-1">
                  <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${action.color} flex items-center justify-center transition-transform group-hover:scale-105 shrink-0`}>
                    <Icon size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  {action.badge && (
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200/60 shrink-0 max-w-[75px] truncate">
                      {action.badge}
                    </span>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-black transition-colors truncate">
                    {action.title}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 truncate mt-0.5">
                    {action.subtitle}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 3. KPI 4 STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 w-full">
        {/* Total Orders */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#F3EFFF] text-[#7C3AED] flex items-center justify-center shrink-0">
            <ShoppingBag size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-neutral-500 font-medium truncate">Total Orders</p>
            <p className="text-sm sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug truncate">
              {stats.totalOrders.toLocaleString()}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5 truncate">
              <span>↑ 18.2%</span>
              <span className="text-neutral-400 font-normal hidden xs:inline">vs 7d</span>
            </p>
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-neutral-500 font-medium truncate">Total Sales</p>
            <p className="text-sm sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug truncate">
              ৳ {stats.totalSales.toLocaleString()}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5 truncate">
              <span>↑ 24.5%</span>
              <span className="text-neutral-400 font-normal hidden xs:inline">vs 7d</span>
            </p>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0">
            <Users size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-neutral-500 font-medium truncate">Customers</p>
            <p className="text-sm sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug truncate">
              {stats.totalCustomers.toLocaleString()}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5 truncate">
              <span>↑ 12.1%</span>
              <span className="text-neutral-400 font-normal hidden xs:inline">vs 7d</span>
            </p>
          </div>
        </div>

        {/* Total Products */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
            <Package size={18} className="sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-neutral-500 font-medium truncate">Products</p>
            <p className="text-sm sm:text-lg font-bold text-neutral-900 tracking-tight leading-snug truncate">
              {stats.totalProducts.toLocaleString()}
            </p>
            <p className="text-[9px] sm:text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5 truncate">
              <span>↑ 7.8%</span>
              <span className="text-neutral-400 font-normal hidden xs:inline">vs 7d</span>
            </p>
          </div>
        </div>
      </div>

      {/* 4. CHARTS ROW (Order Status Donut & Sales Overview Line Chart) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Status Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-neutral-900">Order Status Breakdown</h3>
              <p className="text-[11px] text-neutral-400">রিয়েলটাইম অর্ডার স্ট্যাটাস বিতরণ</p>
            </div>
            <Link to="/admin/orders" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Manage
            </Link>
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
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-neutral-900">Sales Overview</h3>
              <p className="text-[11px] text-neutral-400">চলতি সপ্তাহের বিক্রয় গ্রাফ</p>
            </div>
            <button 
              type="button"
              onClick={() => setShowReportsModal(true)}
              className="text-[11px] font-medium text-neutral-600 bg-neutral-100/80 px-2.5 py-1 rounded-lg flex items-center space-x-1 hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              <span>Full Analytics</span>
              <ArrowRight size={12} />
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
              <span>Day 1</span>
              <span>Day 3</span>
              <span>Day 5</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. RECENT ORDERS LIST */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-neutral-900">Recent Orders</h3>
            <p className="text-[11px] text-neutral-400">সর্বশেষ আসা অর্ডার তালিকা</p>
          </div>
          <Link 
            to="/admin/orders" 
            className="text-xs font-semibold text-[#7C3AED] hover:text-[#6D28D9] transition-colors flex items-center gap-1"
          >
            <span>সবগুলো দেখুন (View All)</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="space-y-2">
            {recentOrders.map((ord, idx) => {
              const status = (ord.status || 'Pending').toLowerCase();
              const statusClass = 
                status === 'delivered' ? 'bg-[#F3EFFF] text-[#7C3AED]' :
                status === 'shipped' ? 'bg-[#DCFCE7] text-[#16A34A]' :
                status === 'processing' ? 'bg-[#E0F2FE] text-[#0284C7]' :
                status === 'cancelled' ? 'bg-red-50 text-red-600' :
                'bg-[#FEF3C7] text-[#D97706]';

              return (
                <div 
                  key={ord.id || idx} 
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-neutral-100 hover:bg-neutral-50/80 transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <img 
                      src={ord.avatar || ord.items?.[0]?.image || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop`} 
                      alt={ord.customerName || ord.name || 'Customer'} 
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-neutral-200/60"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-900 leading-tight">
                        #{ord.id?.slice(0, 8) || 'ORDER'}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">
                        {ord.customerName || ord.name || ord.shippingAddress?.fullName || 'Customer'} • {ord.phone || 'No Phone'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-neutral-900">
                      ৳ {(ord.totalAmount || ord.total || ord.subtotal || 0).toLocaleString()}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${statusClass}`}>
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

      {/* 6. COMPREHENSIVE SALES & FINANCIAL REPORTS MODAL */}
      {showReportsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 font-sans p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">Sales & Business Reports</h3>
                  <p className="text-xs text-neutral-500">দোকানের সর্বমোট আয় ও পারফরম্যান্স এনালাইসিস</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportsModal(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Metrics Overview Cards in Reports */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100">
                <p className="text-[11px] font-bold text-purple-700 uppercase">Gross Revenue</p>
                <p className="text-lg font-black text-purple-950 mt-0.5">৳ {stats.totalSales.toLocaleString()}</p>
                <p className="text-[10px] text-purple-600 mt-0.5">সর্বমোট বিক্রয় মূল্য</p>
              </div>

              <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                <p className="text-[11px] font-bold text-emerald-700 uppercase">Delivered Sales</p>
                <p className="text-lg font-black text-emerald-950 mt-0.5">৳ {deliveredRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">{statusCounts.delivered} টি সফল ডেলিভারি</p>
              </div>

              <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100 col-span-2 sm:col-span-1">
                <p className="text-[11px] font-bold text-amber-700 uppercase">Average Order (AOV)</p>
                <p className="text-lg font-black text-amber-950 mt-0.5">৳ {averageOrderValue.toLocaleString()}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">গড় অর্ডার সাইজ</p>
              </div>
            </div>

            {/* Order Status Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">অর্ডার স্ট্যাটাস রিপোর্ট</h4>
              <div className="bg-neutral-50 rounded-2xl p-3 space-y-2 border border-neutral-200/80 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-neutral-200/60">
                  <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                    <Clock size={14} /> Pending Review
                  </span>
                  <span className="font-bold text-neutral-900">{statusCounts.pending} টি ({stats.totalOrders > 0 ? Math.round((statusCounts.pending/stats.totalOrders)*100) : 0}%)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-200/60">
                  <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                    <PackageCheck size={14} /> Processing
                  </span>
                  <span className="font-bold text-neutral-900">{statusCounts.processing} টি ({stats.totalOrders > 0 ? Math.round((statusCounts.processing/stats.totalOrders)*100) : 0}%)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-200/60">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <Truck size={14} /> Shipped
                  </span>
                  <span className="font-bold text-neutral-900">{statusCounts.shipped} টি ({stats.totalOrders > 0 ? Math.round((statusCounts.shipped/stats.totalOrders)*100) : 0}%)</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-purple-700 font-semibold">
                    <CheckCircle2 size={14} /> Delivered
                  </span>
                  <span className="font-bold text-neutral-900">{statusCounts.delivered} টি ({stats.totalOrders > 0 ? Math.round((statusCounts.delivered/stats.totalOrders)*100) : 0}%)</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>রিপোর্ট প্রিন্ট করুন</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReportsModal(false);
                  navigate('/admin/orders');
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>অর্ডার ম্যানেজারে যান</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
