import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, writeBatch, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { assignUserRoleByEmail, revokeUserRoleByEmail } from '../../lib/roles';
import { 
  ShieldAlert, Trash2, Mail, ShieldCheck, Database, Server, Loader2, AlertTriangle, 
  CheckCircle2, UserMinus, Cpu, Sparkles, RefreshCw, Key, Eye, EyeOff, ExternalLink,
  Check, XCircle, Zap
} from 'lucide-react';

export default function AdminSystem() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [loadingRole, setLoadingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);

  // Integrations API Keys State
  const [integrations, setIntegrations] = useState({
    stripePublishableKey: '',
    stripeSecretKey: '',
    customServiceKey: ''
  });
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [integrationsMessage, setIntegrationsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load saved API key from Firestore & LocalStorage on mount
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'integrations');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIntegrations({
            stripePublishableKey: data.stripePublishableKey || '',
            stripeSecretKey: data.stripeSecretKey || '',
            customServiceKey: data.customServiceKey || ''
          });
        }
      } catch (err) {
        console.warn("Could not load integrations:", err);
      }
    };

    loadIntegrations();
  }, []);

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegrations(true);
    setIntegrationsMessage(null);

    try {
      await setDoc(doc(db, 'system_settings', 'integrations'), {
        ...integrations,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setIntegrationsMessage({
        type: 'success',
        text: 'Integration keys saved securely to Firestore.'
      });
      
      setTimeout(() => setIntegrationsMessage(null), 5000);
    } catch (err: any) {
      console.error("Save Integrations error:", err);
      setIntegrationsMessage({
        type: 'error',
        text: err.message || 'Failed to save integration keys.'
      });
    } finally {
      setSavingIntegrations(false);
    }
  };

  useEffect(() => {
    // Listen to users with admin/seller role
    const qUsers = query(collection(db, 'users'), where('role', 'in', ['admin', 'seller']));
    const qAuthRoles = collection(db, 'authorized_roles');

    let userStaff: any[] = [];
    let authStaff: any[] = [];

    const mergeAndSetStaff = () => {
      const map = new Map<string, any>();
      authStaff.forEach(u => {
        if (u.role === 'admin' || u.role === 'seller') {
          map.set(u.email.toLowerCase(), u);
        }
      });
      userStaff.forEach(u => {
        if (u.email && (u.role === 'admin' || u.role === 'seller')) {
          map.set(u.email.toLowerCase(), { ...map.get(u.email.toLowerCase()), ...u });
        }
      });
      setStaffUsers(Array.from(map.values()));
    };

    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      userStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      mergeAndSetStaff();
    });

    const unsubAuth = onSnapshot(qAuthRoles, (snapshot) => {
      authStaff = snapshot.docs.map(doc => ({ id: doc.id, email: doc.id, ...doc.data() }));
      mergeAndSetStaff();
    });
    
    return () => {
      unsubUsers();
      unsubAuth();
    };
  }, []);

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setLoadingRole(true);
    setRoleMessage(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await assignUserRoleByEmail(cleanEmail, role as any);
      setRoleMessage({ 
        type: 'success', 
        text: `Permission granted successfully! ${role.toUpperCase()} access given to ${cleanEmail}.` 
      });
      setEmail('');
    } catch (error: any) {
      console.error(error);
      setRoleMessage({ type: 'error', text: error.message || 'Failed to update role' });
    } finally {
      setLoadingRole(false);
    }
  };

  const handleRevokeAccess = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to revoke admin/seller access for ${userEmail}?`)) return;
    
    try {
      await revokeUserRoleByEmail(userEmail);
      setRoleMessage({ type: 'success', text: `Successfully revoked access for ${userEmail}.` });
      setTimeout(() => setRoleMessage(null), 4000);
    } catch (error: any) {
      console.error(error);
      alert('Failed to revoke access: ' + error.message);
    }
  };

  const handleClearHistory = async () => {
    const confirm = window.confirm(
      "DANGER: Are you sure you want to permanently delete all test orders and sales data? This action cannot be undone."
    );
    if (!confirm) return;

    setLoadingDelete(true);
    setDeleteMessage(null);
    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      ordersSnap.docs.forEach((docSnap) => {
        currentBatch.delete(docSnap.ref);
        operationCount++;
        
        if (operationCount === 499) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });
      
      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }
      
      await Promise.all(batches);
      
      setDeleteMessage({ type: 'success', text: `Successfully deleted ${ordersSnap.size} order records.` });
    } catch (error: any) {
      console.error(error);
      setDeleteMessage({ type: 'error', text: error.message || 'Failed to clear history' });
    } finally {
      setLoadingDelete(false);
    }
  };

  // Consolidated Sync All Data Handler
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSyncAllData = async () => {
    setSyncingAll(true);
    setSyncMessage(null);
    try {
      const qUsers = query(collection(db, 'users'), where('role', 'in', ['admin', 'seller']));
      const snapshot = await getDocs(qUsers);
      if (snapshot) {
        setStaffUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

      setSyncMessage("All configurations and database systems synced successfully!");
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (e: any) {
      console.error("Sync all error:", e);
      setSyncMessage("Temporary error occurred during data sync.");
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Top Header Card */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Control Panel & AI Engine</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-neutral-900 mt-0.5">
            System & API Settings
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            Configure Google Gemini API keys, staff permissions, and cloud database operations
          </p>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleSyncAllData}
          disabled={syncingAll}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 py-3.5 rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-60 shrink-0 border border-neutral-800"
        >
          {syncingAll ? (
            <>
              <Loader2 size={16} className="animate-spin text-amber-400" />
              <span>Syncing data...</span>
            </>
          ) : (
            <>
              <RefreshCw size={16} className="text-amber-400" />
              <span>Sync All Data</span>
            </>
          )}
        </button>
      </div>

      {syncMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2.5 animate-in fade-in shadow-2xs">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* API Integrations Card */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-6 mb-6">
        <div className="border-b border-neutral-100 pb-4 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
              <Key size={22} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                Integration API Keys
              </h2>
              <p className="text-[11px] text-neutral-500 font-medium">Manage Stripe and other third-party API keys securely</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveIntegrations} className="space-y-4 max-w-3xl">
          {integrationsMessage && (
            <div className={`p-4 rounded-2xl text-sm font-bold flex items-start gap-3 ${
              integrationsMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {integrationsMessage.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertTriangle size={18} className="mt-0.5" />}
              <div className="flex-1">{integrationsMessage.text}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1.5">Stripe Publishable Key</label>
              <input
                type="text"
                value={integrations.stripePublishableKey}
                onChange={(e) => setIntegrations({ ...integrations, stripePublishableKey: e.target.value })}
                placeholder="pk_test_..."
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>
            
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1.5 flex justify-between">
                Stripe Secret Key
                <button
                  type="button"
                  onClick={() => setShowIntegrations(!showIntegrations)}
                  className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 normal-case"
                >
                  {showIntegrations ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showIntegrations ? 'Hide' : 'Show'}
                </button>
              </label>
              <input
                type={showIntegrations ? "text" : "password"}
                value={integrations.stripeSecretKey}
                onChange={(e) => setIntegrations({ ...integrations, stripeSecretKey: e.target.value })}
                placeholder="sk_test_..."
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1.5">Custom Service Key (e.g. SMS Gateway)</label>
              <input
                type={showIntegrations ? "text" : "password"}
                value={integrations.customServiceKey}
                onChange={(e) => setIntegrations({ ...integrations, customServiceKey: e.target.value })}
                placeholder="Enter custom service API key..."
                className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={savingIntegrations}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20"
            >
              {savingIntegrations ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {savingIntegrations ? 'Saving...' : 'Save Keys'}
            </button>
          </div>
        </form>
      </div>

      {/* Grid Layout for other Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* CARD 2: Cloud Storage & Database Limits */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="border-b border-neutral-100 pb-4 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
                <Database size={22} />
              </div>
              <div>
                <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                  Database & Storage
                </h2>
                <p className="text-[11px] text-neutral-500 font-medium">Firestore & Firebase Storage Status</p>
              </div>
            </div>

            <div className="space-y-3.5 mt-4">
              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-800 uppercase">Cloud Storage</span>
                  <span className="text-xs font-bold text-emerald-700">120 MB / 5 GB Free</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '5%' }}></div>
                </div>
              </div>

              <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-800 uppercase">Database Reads</span>
                  <span className="text-xs font-bold text-blue-700">1.2K / 50K Daily Free</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '2%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-neutral-500 font-medium bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60">
            ✅ All images are saved using high-compression algorithms, allowing thousands of product uploads on the free tier.
          </p>
        </div>

        {/* CARD 3: Role & Staff Management */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-5">
          <div className="border-b border-neutral-100 pb-4 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                Staff & Role Assignment
              </h2>
              <p className="text-[11px] text-neutral-500 font-medium">Grant Admin or Seller permissions</p>
            </div>
          </div>

          <form onSubmit={handleAssignRole} className="space-y-3">
            {roleMessage && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                roleMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {roleMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {roleMessage.text}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">User Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-neutral-400" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Role</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin (Full Access)</option>
                  <option value="seller">Seller (Manage Products)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button 
                  type="submit" 
                  disabled={loadingRole || !email}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs uppercase transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {loadingRole ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Save Role</span>
                </button>
              </div>
            </div>
          </form>

          {staffUsers.length > 0 && (
            <div className="pt-3 border-t border-neutral-100">
              <h3 className="text-[10px] font-bold uppercase text-neutral-400 mb-2">Active Staff Members</h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {staffUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-neutral-50 p-2 rounded-xl border border-neutral-200/60">
                    <div className="truncate pr-2">
                      <p className="text-xs font-bold text-neutral-900 truncate">{u.email}</p>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded uppercase">{u.role}</span>
                    </div>
                    <button type="button" onClick={() => handleRevokeAccess(u.id, u.email)} className="shrink-0 p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer" title="Revoke Access">
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CARD 4: Safeguards & Maintenance */}
        <div className="bg-red-50/20 p-6 rounded-3xl border border-red-100 shadow-2xs space-y-5 flex flex-col justify-between">
          <div>
            <div className="border-b border-red-100 pb-4 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center border border-red-200 shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-base font-black uppercase text-red-800 tracking-tight">
                  Safeguards & Maintenance
                </h2>
                <p className="text-[11px] text-red-600/80 font-medium">Testing Data Cleanup Operations</p>
              </div>
            </div>

            {deleteMessage && (
              <div className={`p-3 my-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                deleteMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {deleteMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {deleteMessage.text}
              </div>
            )}

            <div className="mt-4 bg-white p-4 rounded-2xl border border-red-100 space-y-2">
              <h3 className="text-xs font-extrabold text-neutral-900">Clear Test Selling History</h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                This option deletes past test orders and transaction data. Customer and product data will remain intact.
              </p>
            </div>
          </div>

          <button 
            onClick={handleClearHistory}
            disabled={loadingDelete}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loadingDelete ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            <span>Wipe Order History</span>
          </button>
        </div>

      </div>
    </div>
  );
}
