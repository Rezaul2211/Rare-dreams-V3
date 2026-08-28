import React, { useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, doc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { assignUserRoleByEmail, revokeUserRoleByEmail, SUPER_ADMIN_EMAIL } from '../../lib/roles';
import { seedProductsIfEmpty } from '../../lib/seed';
import { useStoreConfigStore } from '../../store/useStoreConfigStore';
import { checkSteadfastBalance } from '../../services/steadfastService';
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
  Truck,
  Wallet,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Check,
  Package,
  HelpCircle,
  Clock,
  FlaskConical,
  Info,
  Sliders,
  CheckCircle,
  BadgeAlert
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
  const [activeTab, setActiveTab] = useState<'courier' | 'roles' | 'database'>('courier');

  // Store Config & Courier State
  const { config, updateConfig } = useStoreConfigStore();
  const [steadfastApiKey, setSteadfastApiKey] = useState(config.steadfastApiKey || '');
  const [steadfastSecretKey, setSteadfastSecretKey] = useState(config.steadfastSecretKey || '');
  const [steadfastTestMode, setSteadfastTestMode] = useState(Boolean(config.steadfastTestMode));
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [savingCourier, setSavingCourier] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [merchantBalance, setMerchantBalance] = useState<number | null>(null);
  const [courierStatusMsg, setCourierStatusMsg] = useState<{ type: 'success' | 'error'; text: string; details?: string } | null>(null);

  // Sync state when config updates
  useEffect(() => {
    if (config.steadfastApiKey) setSteadfastApiKey(config.steadfastApiKey);
    if (config.steadfastSecretKey) setSteadfastSecretKey(config.steadfastSecretKey);
    setSteadfastTestMode(Boolean(config.steadfastTestMode));
  }, [config.steadfastApiKey, config.steadfastSecretKey, config.steadfastTestMode]);

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

  // Check Steadfast Balance & Connection
  const handleCheckSteadfastBalance = useCallback(async (customApiKey?: string, customSecretKey?: string, customTestMode?: boolean) => {
    const keyToUse = (customApiKey !== undefined ? customApiKey : steadfastApiKey).trim();
    const secretToUse = (customSecretKey !== undefined ? customSecretKey : steadfastSecretKey).trim();
    const testModeToUse = customTestMode !== undefined ? customTestMode : steadfastTestMode;

    if (!keyToUse || !secretToUse) {
      setCourierStatusMsg({
        type: 'error',
        text: 'অনুগ্রহ করে Steadfast API Key এবং Secret Key দুটি লিখুন।'
      });
      return;
    }

    setCheckingBalance(true);
    setCourierStatusMsg(null);

    try {
      const res = await checkSteadfastBalance({ 
        apiKey: keyToUse, 
        secretKey: secretToUse,
        testMode: testModeToUse
      });
      if (res.success && res.data) {
        setMerchantBalance(Number(res.data.current_balance || 0));
        setCourierStatusMsg({
          type: 'success',
          text: res.message || `কানেকশন ১০০% সক্রিয়! আপনার বর্তমান স্টেটফাস্ট একাউন্ট ব্যালেন্স: ৳${Number(res.data.current_balance || 0).toLocaleString()}`,
          details: res.details || (testModeToUse ? '⚠️ বর্তমানে টেস্ট/স্যান্ডবক্স মোড সক্রিয় রয়েছে। কোনো আসল পার্সেল বুক হবে না।' : 'এখন আপনার সকল অর্ডার থেকে ১-ক্লিকে সরাসরি আসল পার্সেল বুকিং হবে।')
        });
      } else {
        setCourierStatusMsg({
          type: 'error',
          text: res.message || 'Steadfast এপিআই ক্রেডেনশিয়াল সঠিক নয়।',
          details: res.details || 'অনুগ্রহ করে Steadfast Merchant Dashboard এর Settings > API Settings থেকে সঠিক কি চেক করে বসান।'
        });
      }
    } catch (err: any) {
      setCourierStatusMsg({
        type: 'error',
        text: err?.message || 'সার্ভার সংযোগে ত্রুটি হয়েছে।'
      });
    } finally {
      setCheckingBalance(false);
    }
  }, [steadfastApiKey, steadfastSecretKey, steadfastTestMode]);

  // Quick Toggle Test Mode
  const handleToggleTestMode = async () => {
    const newMode = !steadfastTestMode;
    setSteadfastTestMode(newMode);
    try {
      await updateConfig({
        steadfastTestMode: newMode
      });
      setCourierStatusMsg({
        type: 'success',
        text: newMode ? '🧪 টেস্ট / স্যান্ডবক্স মোড সক্রিয় করা হয়েছে!' : '🚀 লাইভ প্রোডাকশন মোড সক্রিয় করা হয়েছে!',
        details: newMode ? 'এখন ডেমো অর্ডারে ১-ক্লিকে টেস্ট ট্র্যাকিং কোড দিয়ে টেস্ট করতে পারবেন, কোনো আসল পার্সেল বুকিং হবে না।' : 'এখন সব অর্ডার থেকে সরাসরি আপনার আসল Steadfast Merchant একাউন্টে পার্সেল বুকিং হবে।'
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Save Steadfast Keys
  const handleSaveCourierSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingCourier(true);
    setCourierStatusMsg(null);

    try {
      await updateConfig({
        steadfastApiKey: steadfastApiKey.trim(),
        steadfastSecretKey: steadfastSecretKey.trim(),
        steadfastTestMode: steadfastTestMode,
      });

      setCourierStatusMsg({
        type: 'success',
        text: 'স্টেডফাস্ট এপিআই ক্রেডেনশিয়াল সফলভাবে সেভ হয়েছে!'
      });

      // Immediately test connection and fetch live balance
      if (steadfastApiKey.trim() && steadfastSecretKey.trim()) {
        await handleCheckSteadfastBalance(steadfastApiKey.trim(), steadfastSecretKey.trim(), steadfastTestMode);
      }
    } catch (err: any) {
      console.error(err);
      setCourierStatusMsg({
        type: 'error',
        text: err?.message || 'সেটিংস সেভ করতে সমস্যা হয়েছে।'
      });
    } finally {
      setSavingCourier(false);
    }
  };

  // Initial balance check on mount if keys exist
  useEffect(() => {
    if (config.steadfastApiKey && config.steadfastSecretKey) {
      handleCheckSteadfastBalance(config.steadfastApiKey, config.steadfastSecretKey, config.steadfastTestMode);
    }
  }, [config.steadfastApiKey, config.steadfastSecretKey, config.steadfastTestMode, handleCheckSteadfastBalance]);

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
          onClick={() => setActiveTab('courier')}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'courier'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
          }`}
        >
          <Truck size={14} />
          <span>Courier & Merchant (কুরিয়ার ও মার্চেন্ট)</span>
          {merchantBalance !== null && (
            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-black">
              ৳{merchantBalance.toLocaleString()}
            </span>
          )}
        </button>

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

      {/* TAB 1: STEADFAST COURIER & MERCHANT DASHBOARD */}
      {activeTab === 'courier' && (
        <div className="space-y-5 w-full min-w-0">
          {/* Top Live Merchant Balance & Mode Banner */}
          <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm space-y-4 border border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {steadfastTestMode ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <FlaskConical size={11} className="text-amber-400" />
                      Sandbox / Test Mode Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Live Production API Active
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-400">• Official Steadfast Logistics</span>
                </div>

                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>Steadfast Courier & Merchant Control</span>
                </h2>
                <p className="text-xs text-neutral-300">
                  {steadfastTestMode 
                    ? '🧪 টেস্ট মোডে আসল পার্সেল বুকিং হবে না। আপনি নিরাপদে ডেমো বুকিং এবং ট্র্যাকিং সিস্টেম যাচাই করতে পারেন।'
                    : '🚀 লাইভ প্রোডাকশন মোডে প্রতিটি বুকিং সরাসরি আপনার আসল Steadfast মার্চেন্ট পোর্টালে যুক্ত হবে।'
                  }
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => handleCheckSteadfastBalance()}
                  disabled={checkingBalance || !steadfastApiKey}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {checkingBalance ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>ব্যালেন্স চেক হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>চেক ব্যালেন্স ও কানেকশন</span>
                    </>
                  )}
                </button>

                <a
                  href="https://portal.steadfast.com.bd"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>মার্চেন্ট পোর্টাল</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Metric 1: Balance */}
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Merchant Balance</span>
                  <Wallet size={15} className="text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {merchantBalance !== null ? `৳${merchantBalance.toLocaleString()}` : '—'}
                  </span>
                  {merchantBalance !== null && (
                    <span className="text-[11px] text-emerald-400 font-bold">BDT</span>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  {merchantBalance === 0 
                    ? '৳০ ব্যালেন্স স্বাভাবিক (ডেলিভারি পর টাকা জমা হয়)' 
                    : merchantBalance !== null 
                      ? 'লাইভ মার্চেন্ট একাউন্ট ব্যালেন্স' 
                      : 'ব্যালেন্স দেখতে কি সেভ করুন'}
                </p>
              </div>

              {/* Metric 2: Operating Mode */}
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Operating Mode</span>
                  <Sliders size={15} className={steadfastTestMode ? "text-amber-400" : "text-emerald-400"} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                    steadfastTestMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                  }`}></span>
                  <span className="text-sm font-bold text-white">
                    {steadfastTestMode ? 'Sandbox / Test Mode' : 'Live Production'}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  {steadfastTestMode ? 'নিরাপদ ডেমো বুকিং চালু' : 'আসল পার্সেল বুকিং চালু'}
                </p>
              </div>

              {/* Metric 3: Orders Dispatch */}
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Orders Dispatch</span>
                  <Truck size={15} className="text-blue-400" />
                </div>
                <Link
                  to="/admin/orders"
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-300 hover:text-white transition-colors mt-0.5"
                >
                  <span>Go to Orders Dispatch</span>
                  <ExternalLink size={12} />
                </Link>
                <p className="text-[10px] text-neutral-400 mt-1">
                  অর্ডার পেজ থেকে ১-ক্লিকে পার্সেল বুক করুন
                </p>
              </div>
            </div>
          </div>

          {/* Status / Alert Message */}
          {courierStatusMsg && (
            <div
              className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs transition-all ${
                courierStatusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold'
                  : 'bg-rose-50 border-rose-200 text-rose-900 font-medium'
              }`}
            >
              {courierStatusMsg.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5 flex-1">
                <p className="font-bold">{courierStatusMsg.text}</p>
                {courierStatusMsg.details && (
                  <p className="text-[11px] font-normal opacity-90">{courierStatusMsg.details}</p>
                )}
              </div>
            </div>
          )}

          {/* Test Mode Switch Card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FlaskConical size={18} className={steadfastTestMode ? "text-amber-600" : "text-neutral-500"} />
                  <h3 className="text-sm font-black uppercase text-neutral-900">
                    Steadfast Test Mode / স্যান্ডবক্স টেস্ট মোড
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    steadfastTestMode 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}>
                    {steadfastTestMode ? 'Test Mode Enabled' : 'Disabled (Live Mode)'}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 max-w-2xl">
                  {steadfastTestMode
                    ? 'স্যান্ডবক্স টেস্ট মোড চালু রয়েছে। আপনি যেকোনো অর্ডারে বুকিং টেস্ট করতে পারবেন, কোনো আসল পার্সেল পিকআপ হবে না বা খরচ কাটবে না।'
                    : 'টেস্ট মোড বন্ধ রয়েছে। এখন অর্ডারে বুকিং দিলে সরাসরি আপনার Steadfast একাউন্টে আসল বুকিং যাবে এবং রাইডার পার্সেল সংগ্রহ করবে।'}
                </p>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-neutral-700">
                  {steadfastTestMode ? 'টেস্ট মোড চালু' : 'লাইভ মোড চালু'}
                </span>
                <button
                  type="button"
                  onClick={handleToggleTestMode}
                  className={`w-14 h-8 rounded-full transition-colors relative cursor-pointer p-1 ${
                    steadfastTestMode ? 'bg-amber-500' : 'bg-neutral-300'
                  }`}
                  title={steadfastTestMode ? 'টেস্ট মোড বন্ধ করে লাইভ করুন' : 'টেস্ট মোড চালু করুন'}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${
                      steadfastTestMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Test vs Live Comparison Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-neutral-100 text-xs">
              <div className={`p-3 rounded-xl border ${
                steadfastTestMode ? 'bg-amber-50/60 border-amber-200' : 'bg-neutral-50 border-neutral-200 opacity-60'
              }`}>
                <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                  <FlaskConical size={14} className="text-amber-600" />
                  <span>Test Mode (পরীক্ষামূলক)</span>
                </div>
                <p className="text-[11px] text-neutral-600">
                  সিস্টেমে <span className="font-mono font-bold text-amber-800">SF-TEST-XXXX</span> ডেমো ট্র্যাকিং কোড তৈরি হয়। আসল মার্চেন্ট পোর্টালে কোনো বুকিং হয় না।
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                !steadfastTestMode ? 'bg-emerald-50/60 border-emerald-200' : 'bg-neutral-50 border-neutral-200 opacity-60'
              }`}>
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span>Live Mode (অরিজিনাল প্রোডাকশন)</span>
                </div>
                <p className="text-[11px] text-neutral-600">
                  সরাসরি অফিসিয়াল <span className="font-bold text-emerald-800">portal.steadfast.com.bd</span> এ আসল Consignment তৈরি হয় এবং রিয়েল ট্র্যাকিং কোড জেনারেট হয়।
                </p>
              </div>
            </div>
          </div>

          {/* API Keys Configuration Box */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-neutral-900 flex items-center gap-2">
                  <Key size={16} className="text-neutral-900" />
                  <span>Steadfast API Credentials (এপিআই কি সেটিংস)</span>
                </h3>
                <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                  আপনার Steadfast Merchant Account এর API Key ও Secret Key নিরাপদে সেভ করুন
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCourierSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* API Key */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1 flex items-center justify-between">
                    <span>Steadfast API Key</span>
                    <span className="text-[10px] font-normal text-neutral-400">Required</span>
                  </label>
                  <input
                    type="text"
                    value={steadfastApiKey}
                    onChange={(e) => setSteadfastApiKey(e.target.value)}
                    placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                    className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-black"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Steadfast Merchant Dashboard &gt; Settings &gt; API Settings থেকে কপি করুন।
                  </p>
                </div>

                {/* Secret Key */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1 flex items-center justify-between">
                    <span>Steadfast Secret Key</span>
                    <span className="text-[10px] font-normal text-neutral-400">Required</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      value={steadfastSecretKey}
                      onChange={(e) => setSteadfastSecretKey(e.target.value)}
                      placeholder="••••••••••••••••••••"
                      className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 pr-10 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                    >
                      {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    গোপন সিক্রেট কি নিরাপদে ডাটাবেজে সংরক্ষিত থাকবে।
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-100">
                <div className="text-[11px] text-neutral-500">
                  💡 সেভ করার সাথে সাথে সিস্টেম স্বয়ংক্রিয়ভাবে ব্যালেন্স যাচাই করে লাইভ এক্টিভ করে নিবে।
                </div>

                <button
                  type="submit"
                  disabled={savingCourier}
                  className="w-full sm:w-auto px-6 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingCourier ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>সেভ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>সেভ ও কানেকশন টেস্ট করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Educational Q&A & Verification Guides for the User */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Q1: Why Balance is 0 & Deposit clarification */}
            <div className="bg-emerald-50/70 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-emerald-200/80 space-y-2.5 text-xs text-neutral-800">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                <Wallet size={16} className="text-emerald-700" />
                <h4>ব্যালেন্স ৳০ কেন? টাকা কি ডিপোজিট করতে হয়?</h4>
              </div>
              <div className="space-y-2 text-[12px] text-neutral-700 leading-relaxed">
                <p>
                  <b className="text-neutral-900">না, কোনো টাকা ডিপোজিট করতে হয় না!</b> স্টেডফাস্ট কুরিয়ার ক্যাশ অন ডেলিভারি (Cash on Delivery / COD) মডেলে কাজ করে।
                </p>
                <p>
                  যখন আপনি কোনো কাস্টমারের কাছে পার্সেল পাঠান, ডেলিভারি ম্যান কাস্টমারের কাছ থেকে পণ্যের পুরো টাকা নগদ সংগ্রহ করে। সেখান থেকে ডেলিভারি ফি কেটে বাকি টাকা আপনার Steadfast মার্চেন্ট একাউন্ট ব্যালেন্সে জমা হয়।
                </p>
                <p className="text-[11px] text-emerald-900 font-bold bg-emerald-100/70 p-2 rounded-lg">
                  💰 নতুন একাউন্টে এখনো কোনো ডেলিভারির টাকা জমা না হওয়ায় ব্যালেন্স ৳০.০০ দেখাচ্ছে। ডেলিভারি সম্পন্ন হলে প্রতি সপ্তাহে এই টাকা আপনার ব্যাংক বা বিকাশ একাউন্টে স্বয়ংক্রিয়ভাবে পেয়ে যাবেন।
                </p>
              </div>
            </div>

            {/* Q2: How to verify genuine connection */}
            <div className="bg-blue-50/70 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-blue-200/80 space-y-2.5 text-xs text-neutral-800">
              <div className="flex items-center gap-2 text-blue-900 font-black text-sm">
                <CheckCircle2 size={16} className="text-blue-700" />
                <h4>কানেকশন অরিজিনাল কিনা কিভাবে যাচাই করবেন?</h4>
              </div>
              <div className="space-y-2 text-[12px] text-neutral-700 leading-relaxed">
                <p>
                  আপনার সংযোগটি যে সরাসরি আসল Steadfast সিস্টেমের সাথে যুক্ত, তা মাত্র ২টি ক্লিকে যাচাই করতে পারেন:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-800 font-medium">
                  <li>উপরে <b className="text-blue-900">Test Mode বন্ধ</b> রাখুন (Live Mode)।</li>
                  <li><Link to="/admin/orders" className="text-blue-700 font-bold underline">Orders পেজে</Link> গিয়ে যেকোনো অর্ডারে <b>"১-ক্লিকে স্টেটফাস্টে বুকিং করুন"</b> চাপুন।</li>
                  <li>একটি আসল Consignment ID তৈরি হবে।</li>
                  <li>এরপর আপনার অফিসিয়াল <a href="https://portal.steadfast.com.bd" target="_blank" rel="noreferrer" className="text-blue-700 font-bold underline inline-flex items-center gap-0.5">portal.steadfast.com.bd <ExternalLink size={10} /></a> এ লগইন করে <b>Consignments</b> মেন্যুতে দেখুন—পার্সেলটি সরাসরি সেখানে উপস্থিত পাবেন!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step-by-Step API Guide */}
          <div className="bg-amber-50/60 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-amber-200/70 space-y-3">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs sm:text-sm">
              <HelpCircle size={16} className="text-amber-600" />
              <span>সহজ নির্দেশিকা: কিভাবে Steadfast API Key ও Secret Key পাবেন?</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-neutral-700">
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50 space-y-1">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-black text-[10px] flex items-center justify-center">1</span>
                <p className="font-bold text-neutral-900">লগইন করুন</p>
                <p className="text-[11px] text-neutral-600">Steadfast Merchant Portal (<span className="font-mono">portal.steadfast.com.bd</span>) এ আপনার একাউন্টে লগইন করুন।</p>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50 space-y-1">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-black text-[10px] flex items-center justify-center">2</span>
                <p className="font-bold text-neutral-900">API Settings মেন্যু</p>
                <p className="text-[11px] text-neutral-600">বাম পাশের মেন্যু থেকে <span className="font-bold">Settings &gt; API Settings</span> এ যান।</p>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50 space-y-1">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-black text-[10px] flex items-center justify-center">3</span>
                <p className="font-bold text-neutral-900">কি দুটি কপি করুন</p>
                <p className="text-[11px] text-neutral-600">সেখানে থাকা <span className="font-bold">Api-Key</span> ও <span className="font-bold">Secret-Key</span> কপি করে উপরের বক্সে বসান।</p>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50 space-y-1">
                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-black text-[10px] flex items-center justify-center">4</span>
                <p className="font-bold text-neutral-900">১-ক্লিক বুকিং উপভোগ করুন</p>
                <p className="text-[11px] text-neutral-600">"সেভ" বাটনে চাপুন। এখন Orders পেজে যেকোনো অর্ডারের পাশে "Book Courier" বাটন দিয়ে ১-ক্লিকে পার্সেল বুকিং হবে।</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
