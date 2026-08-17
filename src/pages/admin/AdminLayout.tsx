import React, { useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Package, 
  ShoppingCart, 
  LayoutDashboard, 
  LogOut, 
  Store, 
  Menu, 
  X, 
  ShieldCheck, 
  Users, 
  Image, 
  Bell, 
  Crown,
  Settings
} from 'lucide-react';
import { auth } from '../../lib/firebase';

export default function AdminLayout() {
  const { user, loading } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 font-medium">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  const isAuthorized = user && (user.role === 'admin' || user.role === 'seller' || user.email?.toLowerCase().trim() === 'xmrezaul.karim998@gmail.com');

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    auth.signOut();
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Products List', path: '/admin/products', icon: Package },
    { name: 'Order History', path: '/admin/orders', icon: ShoppingCart },
    { name: 'Push Alerts', path: '/admin/notifications', icon: Bell },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Banners & Styling', path: '/admin/settings', icon: Image },
    { name: 'System Setup', path: '/admin/system', icon: Settings },
  ];

  const cleanAdminName = (user?.displayName || 'Rezaul Karim')
    .replace(/\(Admin\)/gi, '')
    .trim() || 'Rezaul Karim';

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FC] font-sans antialiased">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-neutral-200/80 px-4 py-3 flex justify-between items-center sticky top-0 z-40 shadow-xs">
        <div className="flex items-center space-x-3">
          {/* Toggle Menu button */}
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer border border-neutral-200/80"
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Logo Brand */}
          <Link to="/admin" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-xs shrink-0">
              <Crown size={20} className="text-neutral-900 fill-amber-600" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-tight text-neutral-900 font-display">
                RARE DREAMS
              </h2>
              <p className="text-[9px] sm:text-[10px] text-neutral-500 font-bold uppercase tracking-wider -mt-0.5">
                Admin Control Panel
              </p>
            </div>
          </Link>
        </div>

        {/* Header Right Tools: Bell, Avatar */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Notification Bell with Badge */}
          <button className="relative p-2 text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer border border-neutral-200/60">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center border border-white">
              3
            </span>
          </button>

          {/* User Avatar */}
          <div className="relative shrink-0 cursor-pointer" onClick={() => navigate('/account')} title="Profile / Account">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop"
              alt={cleanAdminName}
              className="w-9 h-9 rounded-full object-cover border-2 border-amber-300 shadow-xs"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 relative min-w-0">
        {/* Mobile Overlay Backdrop */}
        {isMobileOpen && (
          <div 
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          />
        )}

        {/* Sidebar Drawer */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-white border-r border-neutral-200/80 flex flex-col transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck size={18} className="text-amber-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Verified Admin Session</p>
                <h3 className="text-xs font-bold text-neutral-900">{cleanAdminName}</h3>
              </div>
            </div>
            <button className="lg:hidden p-1 text-neutral-400 hover:text-black" onClick={() => setIsMobileOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Management</p>
            {navItems.map((item) => {
              const isActive = item.path === '/admin' 
                ? location.pathname === '/admin' 
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-neutral-900 text-white font-bold shadow-xs' 
                      : 'text-neutral-600 hover:bg-neutral-100 font-medium'
                  }`}
                >
                  <item.icon size={18} />
                  <span className="text-xs">{item.name}</span>
                </Link>
              );
            })}

            <div className="pt-4">
              <Link
                to="/"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold transition-colors border border-amber-200/80"
              >
                <Store size={18} className="text-amber-600" />
                <span>Go to Main Store</span>
              </Link>
            </div>
          </nav>

          <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
            <div className="px-3 py-1.5 mb-1">
              <p className="text-xs font-bold text-neutral-900 truncate">{cleanAdminName}</p>
              <p className="text-[10px] text-neutral-500 truncate">{user.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-3 px-3.5 py-2.5 w-full text-left text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-bold cursor-pointer"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
