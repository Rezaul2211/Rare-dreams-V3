import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { assignUserRoleByEmail, revokeUserRoleByEmail, SUPER_ADMIN_EMAIL } from '../../lib/roles';
import { 
  Users, 
  Search, 
  Trash2, 
  Mail, 
  Phone, 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  RefreshCw, 
  UserPlus, 
  Lock 
} from 'lucide-react';

interface CustomerData {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  role?: string;
  createdAt?: any;
}

// Memoized Mobile Card
const CustomerMobileCard = memo(({ 
  customer, 
  onRoleChange, 
  onDelete, 
  isUpdating 
}: { 
  customer: CustomerData; 
  onRoleChange: (customer: CustomerData, role: 'admin' | 'seller' | 'customer') => void;
  onDelete: (id: string, email?: string) => void;
  isUpdating: boolean;
}) => {
  const customerName = customer.displayName || customer.name || 'Registered User';
  const customerPhone = customer.phoneNumber || customer.phone;
  const customerEmail = customer.email || '';
  const isOwner = customerEmail.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
  const role = customer.role || 'customer';

  return (
    <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-2xs space-y-2.5 w-full min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 uppercase text-white ${
            isOwner ? 'bg-amber-500' : role === 'admin' ? 'bg-neutral-900' : role === 'seller' ? 'bg-blue-600' : 'bg-neutral-400'
          }`}>
            {(customerName || customerEmail || 'U')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-neutral-900 truncate">{customerName}</h4>
            <p className="text-[11px] text-neutral-500 truncate block">{customerEmail || 'No email'}</p>
          </div>
        </div>

        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
          isOwner ? 'bg-amber-100 text-amber-800' : role === 'admin' ? 'bg-neutral-900 text-white' : role === 'seller' ? 'bg-blue-100 text-blue-800' : 'bg-neutral-100 text-neutral-600'
        }`}>
          {isOwner ? 'Owner' : role}
        </span>
      </div>

      {customerPhone && (
        <div className="text-[11px] text-neutral-600 flex items-center gap-1">
          <Phone size={11} className="text-neutral-400" />
          <span>{customerPhone}</span>
        </div>
      )}

      {/* 1-Click Permissions Controls */}
      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {!isOwner && role !== 'admin' && (
            <button
              onClick={() => onRoleChange(customer, 'admin')}
              disabled={isUpdating}
              className="px-2.5 py-1 bg-neutral-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <ShieldCheck size={11} className="text-amber-400" />
              <span>Make Admin</span>
            </button>
          )}

          {!isOwner && role !== 'seller' && (
            <button
              onClick={() => onRoleChange(customer, 'seller')}
              disabled={isUpdating}
              className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              <span>Make Seller</span>
            </button>
          )}

          {!isOwner && role !== 'customer' && (
            <button
              onClick={() => onRoleChange(customer, 'customer')}
              disabled={isUpdating}
              className="px-2 py-1 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              <span>Demote</span>
            </button>
          )}
        </div>

        {!isOwner && (
          <button
            onClick={() => onDelete(customer.id, customer.email)}
            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete User Record"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
});

CustomerMobileCard.displayName = 'CustomerMobileCard';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'admin' | 'seller'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Quick Add Admin
  const [quickEmail, setQuickEmail] = useState('');
  const [quickRole, setQuickRole] = useState<'admin' | 'seller'>('admin');
  const [quickLoading, setQuickLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersSnap, authSnap] = await Promise.allSettled([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'authorized_roles'))
      ]);

      const authRolesMap = new Map<string, string>();
      if (authSnap.status === 'fulfilled') {
        authSnap.value.docs.forEach(d => {
          const data = d.data();
          if (data.email) {
            authRolesMap.set(data.email.toLowerCase().trim(), data.role);
          }
        });
      }

      let usersList: CustomerData[] = [];
      if (usersSnap.status === 'fulfilled') {
        usersList = usersSnap.value.docs.map(d => {
          const data = d.data();
          const email = (data.email || '').toLowerCase().trim();
          const role = email === SUPER_ADMIN_EMAIL ? 'admin' : (authRolesMap.get(email) || data.role || 'customer');
          return {
            id: d.id,
            ...data,
            role
          } as CustomerData;
        });
      }

      setCustomers(usersList);
    } catch (error) {
      console.error("Error fetching customers", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // 1-Click Role Change
  const handleRoleChange = useCallback(async (customer: CustomerData, newRole: 'admin' | 'seller' | 'customer') => {
    const cleanEmail = (customer.email || '').toLowerCase().trim();
    if (!cleanEmail) {
      alert("Cannot change role: No email registered for this user.");
      return;
    }

    if (cleanEmail === SUPER_ADMIN_EMAIL) {
      alert("Super Admin permissions cannot be modified.");
      return;
    }

    setUpdatingId(customer.id);
    try {
      if (newRole === 'customer') {
        await revokeUserRoleByEmail(cleanEmail);
      } else {
        await assignUserRoleByEmail(cleanEmail, newRole);
      }

      setCustomers(prev => prev.map(c => {
        if (c.id === customer.id || (c.email && c.email.toLowerCase().trim() === cleanEmail)) {
          return { ...c, role: newRole };
        }
        return c;
      }));

      setActionSuccess(`Updated ${cleanEmail} to ${newRole.toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error updating role:", error);
      alert("Failed to update role: " + (error.message || "Unknown error"));
    } finally {
      setUpdatingId(null);
    }
  }, []);

  // Quick Add Admin by Email
  const handleQuickAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickEmail.toLowerCase().trim();
    if (!clean) return;

    setQuickLoading(true);
    try {
      await assignUserRoleByEmail(clean, quickRole);
      setActionSuccess(`Granted ${quickRole.toUpperCase()} access to ${clean}`);
      setQuickEmail('');
      await fetchCustomers();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert("Failed to assign role: " + err.message);
    } finally {
      setQuickLoading(false);
    }
  };

  const handleDelete = useCallback(async (id: string, email?: string) => {
    if (email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL) {
      alert("Super Admin account cannot be deleted.");
      return;
    }

    if (window.confirm(`Delete customer record ${email || id}?`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        setCustomers(prev => prev.filter(c => c.id !== id));
      } catch (error) {
        console.error("Error deleting customer", error);
        alert("Failed to delete customer");
      }
    }
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return customers.filter(c => {
      const nameStr = (c.displayName || c.name || '').toLowerCase();
      const emailStr = (c.email || '').toLowerCase();
      const phoneStr = (c.phoneNumber || c.phone || '');
      
      const matchesSearch = !q || nameStr.includes(q) || emailStr.includes(q) || phoneStr.includes(q);
      const userRole = c.role || 'customer';
      const matchesRole = roleFilter === 'all' || userRole === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [customers, searchTerm, roleFilter]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 pb-12 animate-in fade-in duration-150">
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Admin Dashboard</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0">
        <div>
          <h1 className="text-base sm:text-xl font-black uppercase tracking-tight text-neutral-900">
            Customer & Admin Permissions
          </h1>
          <p className="text-neutral-500 text-[11px] sm:text-xs mt-0.5">
            Manage users and grant 1-Click Admin permissions
          </p>
        </div>

        <button
          onClick={fetchCustomers}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Refresh Users</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <span className="break-words">{actionSuccess}</span>
        </div>
      )}

      {/* Quick 1-Click Grant Admin Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-neutral-200 shadow-xs space-y-2.5 w-full min-w-0">
        <div className="flex items-center space-x-1.5">
          <ShieldCheck size={15} className="text-amber-600 shrink-0" />
          <h3 className="text-xs font-black uppercase tracking-wide text-neutral-900">
            Grant Admin / Staff Access
          </h3>
        </div>
        <form onSubmit={handleQuickAddAdmin} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full min-w-0">
          <div className="relative flex-1 min-w-0">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="email"
              required
              placeholder="user@example.com"
              value={quickEmail}
              onChange={(e) => setQuickEmail(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm outline-none focus:border-black transition-all"
            />
          </div>
          <select
            value={quickRole}
            onChange={(e: any) => setQuickRole(e.target.value)}
            className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm font-bold outline-none shrink-0"
          >
            <option value="admin">🛡️ Admin</option>
            <option value="seller">💼 Seller</option>
          </select>
          <button
            type="submit"
            disabled={quickLoading || !quickEmail.trim()}
            className="bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            {quickLoading ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
            <span>Grant Role</span>
          </button>
        </form>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row gap-2.5 items-center justify-between w-full min-w-0">
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:border-black"
          />
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto pb-0.5">
          {(['all', 'admin', 'seller', 'customer'] as const).map((r) => {
            const count = customers.filter(c => r === 'all' ? true : (c.role || 'customer') === r).length;
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer shrink-0 ${
                  roleFilter === r 
                    ? 'bg-neutral-900 text-white shadow-xs' 
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {r === 'all' ? 'All' : r} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Card List (< md screens) */}
      <div className="md:hidden space-y-2.5 w-full min-w-0">
        {loading ? (
          <div className="p-8 text-center text-xs font-bold text-neutral-400">
            <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-neutral-900" />
            Loading users...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-6 text-center text-xs font-medium text-neutral-400 bg-white rounded-2xl border border-neutral-200">
            No matching users found.
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <CustomerMobileCard
              key={customer.id}
              customer={customer}
              onRoleChange={handleRoleChange}
              onDelete={handleDelete}
              isUpdating={updatingId === customer.id}
            />
          ))
        )}
      </div>

      {/* Desktop Table View (md+ screens) */}
      <div className="hidden md:block bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-neutral-200 overflow-hidden w-full min-w-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500 font-bold">
              <th className="p-3.5">Customer</th>
              <th className="p-3.5">Contact Info</th>
              <th className="p-3.5">Current Role</th>
              <th className="p-3.5 text-right">Role Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-neutral-400 text-xs font-bold">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-neutral-900" />
                  Loading customers...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-neutral-500 text-xs">
                  No customers found matching filter.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => {
                const customerName = customer.displayName || customer.name || 'Registered User';
                const customerPhone = customer.phoneNumber || customer.phone;
                const customerEmail = customer.email || '';
                const isOwner = customerEmail.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
                const role = customer.role || 'customer';
                const isUpdating = updatingId === customer.id;

                return (
                  <tr key={customer.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 uppercase text-white ${
                          isOwner ? 'bg-amber-500' : role === 'admin' ? 'bg-neutral-900' : role === 'seller' ? 'bg-blue-600' : 'bg-neutral-400'
                        }`}>
                          {(customerName || customerEmail || 'U')[0]}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-neutral-900 text-xs block truncate">{customerName}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">#{customer.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 text-xs">
                      <div className="flex items-center space-x-1 text-neutral-800 font-medium mb-0.5">
                        <Mail size={12} className="text-neutral-400 shrink-0" />
                        <span className="truncate">{customerEmail || 'No email'}</span>
                      </div>
                      {customerPhone && (
                        <div className="flex items-center space-x-1 text-neutral-500 text-[11px]">
                          <Phone size={12} className="text-neutral-400 shrink-0" />
                          <span>{customerPhone}</span>
                        </div>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isOwner 
                          ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                          : role === 'admin' 
                            ? 'bg-neutral-900 text-white' 
                            : role === 'seller' 
                              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                              : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {isOwner ? 'Owner' : role}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {isOwner ? (
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                            <Lock size={11} />
                            <span>Owner</span>
                          </span>
                        ) : (
                          <>
                            {role !== 'admin' && (
                              <button
                                onClick={() => handleRoleChange(customer, 'admin')}
                                disabled={isUpdating}
                                className="px-2.5 py-1 bg-neutral-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Promote to Admin"
                              >
                                <ShieldCheck size={11} className="text-amber-400" />
                                <span>Make Admin</span>
                              </button>
                            )}

                            {role !== 'seller' && (
                              <button
                                onClick={() => handleRoleChange(customer, 'seller')}
                                disabled={isUpdating}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                title="Make Seller"
                              >
                                <span>Seller</span>
                              </button>
                            )}

                            {role !== 'customer' && (
                              <button
                                onClick={() => handleRoleChange(customer, 'customer')}
                                disabled={isUpdating}
                                className="px-2 py-1 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                title="Demote to Customer"
                              >
                                <span>Demote</span>
                              </button>
                            )}

                            <button 
                              onClick={() => handleDelete(customer.id, customer.email)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
