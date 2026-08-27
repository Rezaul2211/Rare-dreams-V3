import React, { useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, doc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { assignUserRoleByEmail, revokeUserRoleByEmail, SUPER_ADMIN_EMAIL } from '../../lib/roles';
import { seedProductsIfEmpty } from '../../lib/seed';
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Mail, 
  Database, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  ArrowLeft, 
  Layers, 
  ShoppingBag, 
  Users, 
  Lock,
  CheckCircle2,
  UserCheck
} from 'lucide-react';

interface StaffUser {
  id?: string;
  email: string;
  displayName?: string;
  role?: string;
  isSuperAdmin?: boolean;
}

// Memoized Staff Row Component for zero-lag rendering
const StaffRow = memo(({ 
  staff, 
  onQuickChange, 
  onRevoke, 
  isUpdating 
}: { 
  staff: StaffUser; 
  onQuickChange: (email: string, role: 'admin' | 'seller') => void; 
  onRevoke: (email: string) => void;
  isUpdating: boolean;
}) => {
  const isOwner = staff.isSuperAdmin || staff.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
  const currentRole = staff.role || 'admin';

  return (
    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/70 transition-colors w-full min-w-0">
      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 uppercase ${
          isOwner 
            ? 'bg-amber-500 text-white shadow-xs' 
            : currentRole === 'admin' 
              ? 'bg-neutral-900 text-white' 
              : 'bg-blue-600 text-white'
        }`}>
          {(staff.displayName || staff.email || 'A')[0]}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
              {staff.displayName || staff.email}
            </span>
            {isOwner && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider shrink-0">
                Owner
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500 truncate block">{staff.email}</p>
        </div>
      </div>

      {/* Role Actions */}
      <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 flex-wrap">
        {isOwner ? (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 flex items-center gap-1">
            <Lock size={12} />
            <span>Permanent Super Admin</span>
          </span>
        ) : (
          <>
            {currentRole !== 'admin' && (
              <button
                onClick={() => onQuickChange(staff.email, 'admin')}
                disabled={isUpdating}
                className="px-2.5 py-1 bg-neutral-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                title="Promote to Admin"
              >
                <ShieldCheck size={12} className="text-amber-400" />
                <span>Make Admin</span>
              </button>
            )}

            {currentRole !== 'seller' && (
              <button
                onClick={() => onQuickChange(staff.email, 'seller')}
                disabled={isUpdating}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                title="Set as Seller"
              >
                <span>Make Seller</span>
              </button>
            )}

            <button
              onClick={() => onRevoke(staff.email)}
              disabled={isUpdating}
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Revoke Staff Privileges"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

StaffRow.displayName = 'StaffRow';

export default function AdminSystem() {
  const [activeTab, setActiveTab] = useState<'roles' | 'database'>('roles');

  // Role Management State
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'seller'>('admin');
  const [loadingRole, setLoadingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [searchStaff, setSearchStaff] = useState('');
  const [updatingUserEmail, setUpdatingUserEmail] = useState<string | null>(null);

  // Database Counts & Maintenance
  const [dbStats, setDbStats] = useState({
    products: 0,
    orders: 0,
    users: 0,
    admins: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // 1. Fetch live staff & admin users
  useEffect(() => {
    const qUsers = query(collection(db, 'users'), where('role', 'in', ['admin', 'seller']));
    const qAuthRoles = collection(db, 'authorized_roles');

    let userStaff: any[] = [];
    let authStaff: any[] = [];

    const updateStaffState = () => {
      const mergedMap = new Map<string, StaffUser>();
      
      // Always include Super Admin
      mergedMap.set(SUPER_ADMIN_EMAIL, {
        email: SUPER_ADMIN_EMAIL,
        displayName: 'Rezaul Karim (Owner)',
        role: 'admin',
        isSuperAdmin: true
      });

      authStaff.forEach(u => {
        if (u.email) {
          const key = u.email.toLowerCase().trim();
          mergedMap.set(key, { ...mergedMap.get(key), ...u, email: key });
        }
      });

      userStaff.forEach(u => {
        if (u.email) {
          const key = u.email.toLowerCase().trim();
          mergedMap.set(key, { ...mergedMap.get(key), ...u, email: key });
        }
      });

      setStaffUsers(Array.from(mergedMap.values()));
    };

    const unsubUsers = onSnapshot(qUsers, (snap) => {
      userStaff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateStaffState();
    });

    const unsubAuth = onSnapshot(qAuthRoles, (snap) => {
      authStaff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateStaffState();
    });

    return () => {
      unsubUsers();
      unsubAuth();
    };
  }, []);

  // 2. Load DB stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [prodsSnap, ordersSnap, usersSnap, authSnap] = await Promise.allSettled([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'authorized_roles'))
      ]);

      setDbStats({
        products: prodsSnap.status === 'fulfilled' ? prodsSnap.value.size : 0,
        orders: ordersSnap.status === 'fulfilled' ? ordersSnap.value.size : 0,
        users: usersSnap.status === 'fulfilled' ? usersSnap.value.size : 0,
        admins: authSnap.status === 'fulfilled' ? authSnap.value.size + 1 : 1
      });
    } catch (e) {
      console.warn("Error fetching DB stats:", e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 1-Click Assign Role
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;

    setLoadingRole(true);
    setRoleMessage(null);

    try {
      await assignUserRoleByEmail(cleanEmail, role);
      setRoleMessage({
        type: 'success',
        text: `Role '${role.toUpperCase()}' granted to ${cleanEmail}.`
      });
      setEmail('');
      setTimeout(() => setRoleMessage(null), 4000);
    } catch (error: any) {
      console.error(error);
      setRoleMessage({
        type: 'error',
        text: error.message || 'Failed to assign role'
      });
    } finally {
      setLoadingRole(false);
    }
  };

  // 1-Click Quick Change Role
  const handleQuickChangeRole = useCallback(async (targetEmail: string, newRole: 'admin' | 'seller') => {
    const cleanEmail = targetEmail.toLowerCase().trim();
    if (cleanEmail === SUPER_ADMIN_EMAIL) {
      alert("Super Admin role cannot be modified.");
      return;
    }

    setUpdatingUserEmail(cleanEmail);
    try {
      await assignUserRoleByEmail(cleanEmail, newRole);
      setRoleMessage({
        type: 'success',
        text: `Updated: ${cleanEmail} is now ${newRole.toUpperCase()}.`
      });
      setTimeout(() => setRoleMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setRoleMessage({ type: 'error', text: err.message || 'Failed to update user role' });
    } finally {
      setUpdatingUserEmail(null);
    }
  }, []);

  // Revoke Staff Privileges
  const handleRevokeAccess = useCallback(async (targetEmail: string) => {
    const cleanEmail = targetEmail.toLowerCase().trim();
    if (cleanEmail === SUPER_ADMIN_EMAIL) {
      alert("Super Admin cannot be removed.");
      return;
    }

    if (!window.confirm(`Revoke admin/seller access for ${cleanEmail}?`)) return;

    setUpdatingUserEmail(cleanEmail);
    try {
      await revokeUserRoleByEmail(cleanEmail);
      setRoleMessage({
        type: 'success',
        text: `Access revoked for ${cleanEmail}.`
      });
      setTimeout(() => setRoleMessage(null), 3000);
    } catch (error: any) {
      console.error(error);
      setRoleMessage({
        type: 'error',
        text: error.message || 'Failed to revoke role'
      });
    } finally {
      setUpdatingUserEmail(null);
    }
  }, []);

  // Seed sample catalog if needed
  const handleSeedCatalog = async () => {
    setSeedingLoading(true);
    setSeedMessage(null);
    try {
      await seedProductsIfEmpty();
      await fetchStats();
      setSeedMessage("Catalog checked and synchronized!");
      setTimeout(() => setSeedMessage(null), 4000);
    } catch (e: any) {
      setSeedMessage("Error syncing catalog: " + e.message);
    } finally {
      setSeedingLoading(false);
    }
  };

  // Clear Test Orders
  const handleClearHistory = async () => {
    const confirmation = window.prompt("Type 'DELETE' to confirm wiping test orders and alerts. Products & Customers are safe.");
    if (confirmation !== 'DELETE') return;

    setLoadingDelete(true);
    setDeleteMessage(null);

    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const notifsSnap = await getDocs(collection(db, 'notifications'));

      let count = 0;
      const batch = writeBatch(db);
      
      ordersSnap.forEach((d) => {
        batch.delete(d.ref);
        count++;
      });

      notifsSnap.forEach((d) => {
        batch.delete(d.ref);
        count++;
      });

      await batch.commit();
      await fetchStats();

      setDeleteMessage({
        type: 'success',
        text: `Successfully wiped ${count} test orders & alerts.`
      });
      setTimeout(() => setDeleteMessage(null), 5000);
    } catch (error: any) {
      console.error(error);
      setDeleteMessage({ type: 'error', text: error.message || 'Failed to clear history' });
    } finally {
      setLoadingDelete(false);
    }
  };

  const filteredStaff = staffUsers.filter(u => {
    const q = searchStaff.toLowerCase().trim();
    if (!q) return true;
    return (u.email || '').toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q);
  });

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 pb-12 animate-in fade-in duration-150">
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Admin Dashboard</span>
      </Link>

      {/* Header Banner - Fully Responsive */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Store System</span>
            </div>
            <h1 className="text-base sm:text-xl font-black uppercase tracking-tight text-neutral-900 truncate">
              Admin & System Management
            </h1>
            <p className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">
              1-Click admin permissions & database tools
            </p>
          </div>
        </div>

        <button
          onClick={fetchStats}
          disabled={loadingStats}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw size={12} className={loadingStats ? "animate-spin text-amber-600" : "text-neutral-500"} />
          <span>Sync Status</span>
        </button>
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full min-w-0">
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'roles'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Admin Permissions ({staffUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'database'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <Database size={14} />
          <span>Database & Maintenance</span>
        </button>
      </div>

      {/* TAB 1: 1-CLICK ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-4 w-full min-w-0">
          {/* Add Permission Box */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs space-y-3 w-full min-w-0">
            <div className="flex items-center space-x-2">
              <UserPlus size={16} className="text-neutral-900 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-neutral-900 truncate">
                Grant Admin / Staff Access
              </h3>
            </div>

            {roleMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                roleMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {roleMessage.type === 'success' ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertCircle size={15} className="text-rose-600 shrink-0" />}
                <span className="break-words">{roleMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleAssignRole} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full min-w-0">
              <div className="relative flex-1 min-w-0">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-black focus:bg-white"
                />
              </div>

              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-black shrink-0"
              >
                <option value="admin">🛡️ Full Admin</option>
                <option value="seller">💼 Seller / Staff</option>
              </select>

              <button
                type="submit"
                disabled={loadingRole || !email.trim()}
                className="bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loadingRole ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={14} />}
                <span>Grant Access</span>
              </button>
            </form>
          </div>

          {/* Active Admins & Staff List */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs overflow-hidden w-full min-w-0">
            <div className="p-3.5 sm:p-4 border-b border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-neutral-50/50">
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-neutral-900">
                  Authorized Staff ({filteredStaff.length})
                </h3>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Active administrators and staff members
                </p>
              </div>

              <div className="w-full sm:w-56">
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchStaff}
                  onChange={(e) => setSearchStaff(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-neutral-200 rounded-xl text-xs outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Staff list */}
            <div className="divide-y divide-neutral-100 w-full min-w-0">
              {filteredStaff.length === 0 ? (
                <div className="p-6 text-center text-xs font-medium text-neutral-400">
                  No staff accounts found.
                </div>
              ) : (
                filteredStaff.map((staff) => (
                  <StaffRow
                    key={staff.email || staff.id}
                    staff={staff}
                    onQuickChange={handleQuickChangeRole}
                    onRevoke={handleRevokeAccess}
                    isUpdating={updatingUserEmail === staff.email?.toLowerCase().trim()}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE & MAINTENANCE */}
      {activeTab === 'database' && (
        <div className="space-y-4 w-full min-w-0">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full min-w-0">
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Products</span>
                <ShoppingBag size={14} />
              </div>
              <p className="text-lg sm:text-xl font-black text-neutral-900">{dbStats.products}</p>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Orders</span>
                <Layers size={14} />
              </div>
              <p className="text-lg sm:text-xl font-black text-neutral-900">{dbStats.orders}</p>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Users</span>
                <Users size={14} />
              </div>
              <p className="text-lg sm:text-xl font-black text-neutral-900">{dbStats.users}</p>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Admins</span>
                <ShieldCheck size={14} />
              </div>
              <p className="text-lg sm:text-xl font-black text-amber-600">{dbStats.admins}</p>
            </div>
          </div>

          {/* Maintenance Tools Box */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-neutral-900">
                Database Maintenance
              </h3>
              <p className="text-[11px] sm:text-xs text-neutral-500 font-medium">
                Safe catalog sync and test order cleaner
              </p>
            </div>

            {seedMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                {seedMessage}
              </div>
            )}

            {deleteMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                deleteMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}>
                {deleteMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0">
              {/* Seed Catalog */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center space-x-1.5">
                  <Sparkles size={15} className="text-amber-600" />
                  <h4 className="text-xs font-bold text-neutral-900">Sync Default Catalog</h4>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Verifies categories and sample catalog items in Firestore database.
                </p>
                <button
                  onClick={handleSeedCatalog}
                  disabled={seedingLoading}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {seedingLoading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span>Sync Catalog</span>
                </button>
              </div>

              {/* Clear Test Orders */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                <div className="flex items-center space-x-1.5 text-rose-800">
                  <Trash2 size={15} />
                  <h4 className="text-xs font-bold">Wipe Test Orders & Alerts</h4>
                </div>
                <p className="text-[11px] text-rose-700/80">
                  Removes test orders and notification alerts. Customers and products are preserved.
                </p>
                <button
                  onClick={handleClearHistory}
                  disabled={loadingDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {loadingDelete ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  <span>Clean Test Orders</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
