import React from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Package, 
  ShoppingCart, 
  LayoutDashboard, 
  LogOut, 
  Store, 
  ShieldCheck, 
  Users, 
  Image, 
  Bell, 
  Settings,
  BarChart3
} from 'lucide-react';
import { auth } from '../../lib/firebase';

export default function AdminLayout() {
  const { user, loading, logout } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center font-medium">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  const isAuthorized = user && (user.role === 'admin' || user.role === 'seller' || user.email?.toLowerCase().trim() === 'xmrezaul.karim998@gmail.com');

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Products', path: '/admin/products', icon: Package },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingCart },
    { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { name: 'Push Alerts', path: '/admin/notifications', icon: Bell },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Banners & Style', path: '/admin/settings', icon: Image },
    { name: 'System Setup', path: '/admin/system', icon: Settings },
  ];

  const cleanAdminName = (user?.displayName || 'Rezaul Karim')
    .replace(/\(Admin\)/gi, '')
    .trim() || 'Rezaul Karim';

  return (
    <div className="flex flex-col flex-1 w-full bg-[#F8F9FC] font-sans antialiased min-h-screen">
      <div className="flex flex-1 relative min-w-0 max-w-7xl mx-auto w-full">
        {/* Desktop Admin Left Sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 bg-white border-r border-neutral-200/80 flex-col sticky top-[100px] h-[calc(100vh-120px)] my-4 ml-4 rounded-2xl shadow-xs overflow-hidden">
          {/* Admin Profile Box */}
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Admin Control</p>
                <h3 className="text-xs font-bold text-neutral-900 truncate">{cleanAdminName}</h3>
              </div>
            </div>
          </div>

          {/* Nav items list */}
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
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-neutral-900 text-white font-bold shadow-xs' 
                      : 'text-neutral-600 hover:bg-neutral-100 font-medium'
                  }`}
                >
                  <item.icon size={17} />
                  <span className="text-xs">{item.name}</span>
                </Link>
              );
            })}

            <div className="pt-3">
              <Link
                to="/"
                className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold transition-colors border border-amber-200/80"
              >
                <Store size={16} className="text-amber-600" />
                <span>Go to Main Store</span>
              </Link>
            </div>
          </nav>

          {/* Footer with sign out */}
          <div className="p-3 border-t border-neutral-100 bg-neutral-50/50">
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-2.5 px-3 py-2 w-full text-left text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-xs font-bold cursor-pointer"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden flex flex-col p-3 sm:p-5 lg:p-6 pb-20 lg:pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
