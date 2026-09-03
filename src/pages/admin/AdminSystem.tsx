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
  UserCheck,
  Package,
  Clock,
  Loader2,
  Sliders,
  CheckCircle
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
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const notifsSnapshot = await getDocs(collection(db, 'notifications'));

      const batch = writeBatch(db);
      ordersSnapshot.docs.forEach((d) => batch.delete(d.ref));
      notifsSnapshot.docs.forEach((d) => batch.delete(d.ref));

      await batch.commit();
      await fetchStats();

      setDeleteMessage({
        type: 'success',
        text: `Successfully deleted ${ordersSnapshot.size} test orders and ${notifsSnapshot.size} notifications.`
      });
      setTimeout(() => setDeleteMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      setDeleteMessage({
        type: 'error',
        text: `Failed to wipe test records: ${err.message}`
      });
    } finally {
      setLoadingDelete(false);
    }
  };

  const filteredStaff = staffUsers.filter(u => 
    !searchStaff || 
    u.email.toLowerCase().includes(searchStaff.toLowerCase()) || 
    (u.displayName && u.displayName.toLowerCase().includes(searchStaff.toLowerCase()))
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-16 min-w-0 animate-in fade-in duration-150">
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
              Admin permissions, roles & database maintenance
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
          <span>Admin & Staff Permissions ({staffUsers.length})</span>
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

      {/* TAB 1: ADMIN & STAFF PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-5 w-full min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Col: Add New Staff Member */}
            <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black uppercase text-neutral-900 tracking-tight flex items-center gap-2">
                  <UserPlus size={18} className="text-amber-600" />
                  <span>Add Admin / Seller</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Grant instant dashboard access by entering their Google email address.
                </p>
              </div>

              {roleMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-start space-x-2 animate-in fade-in duration-150 ${
                  roleMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{roleMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleAssignRole} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                    Google Account Email *
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. yourpartner@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-black focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1">
                    Role Privilege Level *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('admin')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                        role === 'admin'
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="block font-black">ADMIN</span>
                      <span className="text-[10px] opacity-75 block mt-0.5">Full store management</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('seller')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                        role === 'seller'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="block font-black">SELLER</span>
                      <span className="text-[10px] opacity-75 block mt-0.5">Products & Order View</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingRole || !email}
                  className="w-full bg-black hover:bg-neutral-800 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingRole ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving Access...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={14} />
                      <span>Grant {role.toUpperCase()} Role</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Col: Active Staff List */}
            <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase text-neutral-900 tracking-tight flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    <span>Authorized Team Members</span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {staffUsers.length} staff member(s) currently have dashboard access
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Search staff..."
                  value={searchStaff}
                  onChange={(e) => setSearchStaff(e.target.value)}
                  className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-black max-w-[180px]"
                />
              </div>

              {/* Staff list */}
              <div className="border border-neutral-200/80 rounded-2xl overflow-hidden divide-y divide-neutral-100 max-h-[360px] overflow-y-auto">
                {filteredStaff.map((staff, idx) => (
                  <StaffRow
                    key={staff.email || idx}
                    staff={staff}
                    onQuickChange={handleQuickChangeRole}
                    onRevoke={handleRevokeAccess}
                    isUpdating={updatingUserEmail === staff.email}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE & MAINTENANCE */}
      {activeTab === 'database' && (
        <div className="space-y-5 w-full min-w-0">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs">
                <span className="font-bold">Products</span>
                <Package size={16} />
              </div>
              <p className="text-xl font-black text-neutral-900 mt-2">{dbStats.products}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs">
                <span className="font-bold">Orders</span>
                <ShoppingBag size={16} />
              </div>
              <p className="text-xl font-black text-neutral-900 mt-2">{dbStats.orders}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs">
                <span className="font-bold">Users</span>
                <Users size={16} />
              </div>
              <p className="text-xl font-black text-neutral-900 mt-2">{dbStats.users}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
              <div className="flex items-center justify-between text-neutral-500 text-xs">
                <span className="font-bold">Staff / Admins</span>
                <ShieldCheck size={16} />
              </div>
              <p className="text-xl font-black text-neutral-900 mt-2">{dbStats.admins}</p>
            </div>
          </div>

          {/* Maintenance Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Catalog Seed */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-3">
              <h3 className="text-sm font-black uppercase text-neutral-900 tracking-tight flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <span>Synchronize Sample Catalog</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Ensure all default luxury clothing items, sizes, and colors are properly initialized.
              </p>

              {seedMessage && (
                <div className="p-3 bg-neutral-100 rounded-xl text-xs font-bold text-neutral-800">
                  {seedMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleSeedCatalog}
                disabled={seedingLoading}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {seedingLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Sync Catalog Items</span>
              </button>
            </div>

            {/* Clear Test History */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-rose-200 shadow-xs space-y-3">
              <h3 className="text-sm font-black uppercase text-rose-900 tracking-tight flex items-center gap-2">
                <Trash2 size={16} className="text-rose-600" />
                <span>Clear Test Orders</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Wipe all test orders and notification records before going live. Products and accounts remain completely safe.
              </p>

              {deleteMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  deleteMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {deleteMessage.text}
                </div>
              )}

              <button
                type="button"
                onClick={handleClearHistory}
                disabled={loadingDelete}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loadingDelete ? <Loader2 size={14} className="animate-spin text-rose-600" /> : <Trash2 size={14} />}
                <span>Clear Test Orders</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
