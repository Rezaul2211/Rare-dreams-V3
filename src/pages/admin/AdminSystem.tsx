import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, writeBatch, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { assignUserRoleByEmail, revokeUserRoleByEmail } from '../../lib/roles';
import { 
  ShieldAlert, Trash2, Mail, ShieldCheck, Database, Server, Loader2, AlertTriangle, 
  CheckCircle2, UserMinus, Cpu, Sparkles, RefreshCw, Key, Eye, EyeOff, ExternalLink,
  Check, XCircle, Zap, Activity, Clock, Terminal, Search, Filter, Play, AlertCircle,
  Info, ChevronDown, ChevronRight, Copy
} from 'lucide-react';

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  module: 'GEMINI_API' | 'CHATBOT' | 'AUTO_FILL' | 'FIREBASE' | 'SERVER';
  endpoint?: string;
  message: string;
  errorCode?: string;
  statusCode?: number;
  latencyMs?: number;
  details?: any;
}

interface DiagnosticData {
  timestamp: string;
  server: {
    uptimeSeconds: number;
    memoryMb: number;
    nodeVersion: string;
    port: number;
    status: string;
  };
  gemini: {
    configured: boolean;
    keySnippet: string;
    model: string;
    reachable: boolean;
    latencyMs: number;
    statusCode: number;
    errorCode: string | null;
    message: string;
    resolution: string | null;
  };
  firebase: {
    adminInitialized: boolean;
    projectId: string;
    status: string;
  };
  logs: SystemLog[];
  totalCheckTimeMs?: number;
}

export default function AdminSystem() {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'logs' | 'keys' | 'roles' | 'database'>('diagnostics');

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Live Test State
  const [testPrompt, setTestPrompt] = useState('Hello Rare Dreams AI! Please respond with a brief greeting in English and Bengali.');
  const [runningTest, setRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Logs Filtering
  const [logFilterModule, setLogFilterModule] = useState<string>('ALL');
  const [logFilterLevel, setLogFilterLevel] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [clearingLogs, setClearingLogs] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Existing states
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

  // Fetch Diagnostics
  const fetchDiagnostics = async (silent = false) => {
    if (!silent) setLoadingDiagnostics(true);
    try {
      const res = await fetch('/api/admin/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
        setLastCheckTime(new Date());
      }
    } catch (err) {
      console.warn("Diagnostics fetch failed:", err);
    } finally {
      if (!silent) setLoadingDiagnostics(false);
    }
  };

  // Initial & Interval load
  useEffect(() => {
    fetchDiagnostics();

    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchDiagnostics(true);
      }, 6000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Run Live Gemini Test
  const handleRunLiveTest = async () => {
    setRunningTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/diagnostics/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPrompt })
      });
      const data = await res.json();
      setTestResult({
        ok: res.ok,
        status: res.status,
        ...data
      });
      // Refresh logs immediately
      fetchDiagnostics(true);
    } catch (err: any) {
      setTestResult({
        ok: false,
        status: 500,
        error: err.message || "Network error while running test"
      });
    } finally {
      setRunningTest(false);
    }
  };

  // Clear System Logs
  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear system diagnostic logs?")) return;
    setClearingLogs(true);
    try {
      await fetch('/api/admin/diagnostics/logs', { method: 'DELETE' });
      fetchDiagnostics(false);
    } catch (err) {
      console.error(err);
    } finally {
      setClearingLogs(false);
    }
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered Logs
  const filteredLogs = (diagnostics?.logs || []).filter(log => {
    if (logFilterModule !== 'ALL' && log.module !== logFilterModule) return false;
    if (logFilterLevel !== 'ALL' && log.level !== logFilterLevel) return false;
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const matchMsg = log.message?.toLowerCase().includes(q);
      const matchEndpoint = log.endpoint?.toLowerCase().includes(q);
      const matchCode = log.errorCode?.toLowerCase().includes(q);
      return matchMsg || matchEndpoint || matchCode;
    }
    return true;
  });

  // Load saved API keys
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Top Header Card */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${diagnostics?.gemini.reachable ? 'bg-emerald-500 animate-pulse' : diagnostics?.gemini.configured ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">System Diagnostics & Control Panel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-neutral-900 mt-0.5">
            System & API Diagnostics
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            Real-time connection monitor for Google Gemini AI, Firebase services, and server telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs font-bold px-3 py-2.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              autoRefresh 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
            title="Toggle 6s auto-refresh polling"
          >
            <Activity size={14} className={autoRefresh ? "animate-pulse" : ""} />
            <span>{autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}</span>
          </button>

          <button
            onClick={() => fetchDiagnostics(false)}
            disabled={loadingDiagnostics}
            className="inline-flex items-center justify-center gap-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60 shrink-0"
          >
            <RefreshCw size={14} className={loadingDiagnostics ? "animate-spin text-amber-400" : "text-amber-400"} />
            <span>{loadingDiagnostics ? "Checking..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'diagnostics'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
          }`}
        >
          <Activity size={15} className={activeTab === 'diagnostics' ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Real-Time Diagnostics</span>
          {diagnostics?.gemini && (
            <span className={`w-2 h-2 rounded-full ${diagnostics.gemini.reachable ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
          }`}
        >
          <Terminal size={15} className={activeTab === 'logs' ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Live API Logs</span>
          <span className="bg-neutral-200/70 text-neutral-800 text-[10px] px-1.5 py-0.2 rounded-full">
            {diagnostics?.logs?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'keys'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
          }`}
        >
          <Key size={15} className={activeTab === 'keys' ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Integration Keys</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'roles'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
          }`}
        >
          <ShieldCheck size={15} className={activeTab === 'roles' ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Staff Roles ({staffUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'database'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
          }`}
        >
          <Database size={15} className={activeTab === 'database' ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Database & Maintenance</span>
        </button>
      </div>

      {/* TAB 1: DIAGNOSTICS & LIVE TEST */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Status Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* CARD 1: Google Gemini API Status */}
            <div className={`p-6 rounded-3xl border shadow-2xs flex flex-col justify-between transition-all ${
              diagnostics?.gemini.reachable 
                ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-emerald-200/80' 
                : diagnostics?.gemini.configured 
                  ? 'bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 border-amber-200/80'
                  : 'bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 border-rose-200/80'
            }`}>
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border shrink-0 ${
                      diagnostics?.gemini.reachable 
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                        : diagnostics?.gemini.configured 
                          ? 'bg-amber-100 text-amber-700 border-amber-200' 
                          : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}>
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-tight text-neutral-900">Gemini AI Endpoint</h3>
                      <p className="text-[10px] text-neutral-500 font-mono">{diagnostics?.gemini.model || "gemini-3.7-flash"}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                    diagnostics?.gemini.reachable 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : diagnostics?.gemini.statusCode === 429
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {diagnostics?.gemini.reachable ? '200 OK • Online' : diagnostics?.gemini.errorCode || (diagnostics?.gemini.configured ? 'Quota / Busy' : 'Key Missing')}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">API Key Config:</span>
                    <span className="font-mono font-bold text-[11px] text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                      {diagnostics?.gemini.keySnippet || "Not Found"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Ping Latency:</span>
                    <span className="font-bold text-[11px] text-neutral-800">
                      {diagnostics?.gemini.latencyMs ? `${diagnostics.gemini.latencyMs} ms` : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">HTTP Status:</span>
                    <span className="font-mono font-bold text-[11px] text-neutral-800">
                      {diagnostics?.gemini.statusCode ? `${diagnostics.gemini.statusCode}` : "—"}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-2xl bg-white/90 border border-neutral-200/70 text-[11px]">
                    <p className="font-medium text-neutral-700 leading-snug">
                      {diagnostics?.gemini.message}
                    </p>
                    {diagnostics?.gemini.resolution && (
                      <p className="mt-2 pt-2 border-t border-neutral-100 font-medium text-amber-800">
                        💡 <span className="font-bold">Advice:</span> {diagnostics.gemini.resolution}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: Firebase Status */}
            <div className="p-6 rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                      <Database size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-tight text-neutral-900">Firebase Firestore</h3>
                      <p className="text-[10px] text-neutral-500">Database & Security Rules</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                    Connected
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Project ID:</span>
                    <span className="font-mono text-[10px] font-bold text-neutral-800 truncate max-w-[140px]">
                      {diagnostics?.firebase.projectId || "ai-studio"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Admin SDK:</span>
                    <span className="font-bold text-[11px] text-emerald-700">
                      {diagnostics?.firebase.adminInitialized ? "Initialized & Ready" : "Client Mode"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Auth & Roles:</span>
                    <span className="font-bold text-[11px] text-neutral-800">
                      {staffUsers.length} active staff accounts
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-2xl bg-white/90 border border-neutral-200/70 text-[11px] text-neutral-600">
                    ✅ Products, Orders, Users & Price Drop tracking collections are live and synchronizing.
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: Express Server & Container Telemetry */}
            <div className="p-6 rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/20 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
                      <Server size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-tight text-neutral-900">Backend Server</h3>
                      <p className="text-[10px] text-neutral-500 font-mono">Express Node.js</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-blue-100 text-blue-800 border-blue-300">
                    Port {diagnostics?.server.port || 3000}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Memory Usage:</span>
                    <span className="font-bold text-[11px] text-neutral-800">
                      {diagnostics?.server.memoryMb ? `${diagnostics.server.memoryMb} MB` : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Uptime:</span>
                    <span className="font-bold text-[11px] text-neutral-800">
                      {diagnostics?.server.uptimeSeconds ? `${Math.floor(diagnostics.server.uptimeSeconds / 60)} mins` : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Runtime Engine:</span>
                    <span className="font-mono text-[11px] font-bold text-neutral-800">
                      {diagnostics?.server.nodeVersion || process.version || "Node 20+"}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-2xl bg-white/90 border border-neutral-200/70 text-[11px] text-neutral-600">
                    ⏱️ Last Telemetry Ping: {lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Just now'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Gemini Endpoint Test Tool */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
                  <Play size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                    Live Gemini Endpoint Tester
                  </h2>
                  <p className="text-[11px] text-neutral-500 font-medium">
                    Send an instantaneous test prompt directly to Gemini 3.7 Flash and measure latency and error response codes
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1.5">
                  Test Prompt Payload
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Enter test message for Gemini AI..."
                    className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                  />
                  <button
                    onClick={handleRunLiveTest}
                    disabled={runningTest || !testPrompt.trim()}
                    className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
                  >
                    {runningTest ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <Play size={14} className="text-amber-400" />}
                    <span>{runningTest ? 'Calling API...' : 'Run Test Ping'}</span>
                  </button>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in duration-200 ${
                  testResult.ok 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                    : 'bg-rose-50/80 border-rose-200 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <div className="flex items-center gap-2">
                      {testResult.ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-rose-600" />}
                      <span className="uppercase tracking-wider">
                        {testResult.ok ? `Test Succeeded (${testResult.status} OK)` : `Test Failed (${testResult.status || 'ERROR'})`}
                      </span>
                    </div>
                    {testResult.latencyMs && (
                      <span className="text-[11px] font-mono bg-white/80 px-2 py-0.5 rounded border border-current">
                        Latency: {testResult.latencyMs}ms
                      </span>
                    )}
                  </div>

                  {testResult.ok ? (
                    <div className="bg-white p-3 rounded-xl border border-emerald-200/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-neutral-400">Response Text from Gemini:</span>
                      <p className="text-neutral-800 whitespace-pre-wrap font-sans text-xs">{testResult.responseText}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-white p-3 rounded-xl border border-rose-200/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-rose-700">Error Code: {testResult.errorCode || 'UNKNOWN'}</span>
                        </div>
                        <p className="text-rose-900 font-mono text-[11px] break-all">{testResult.error}</p>
                      </div>

                      {testResult.resolution && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                          <span className="font-bold">🔧 Suggested Resolution: </span>
                          {testResult.resolution}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE SYSTEM & GEMINI LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-amber-400 flex items-center justify-center border border-neutral-800 shrink-0">
                <Terminal size={20} />
              </div>
              <div>
                <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                  Live API & Error Log Viewer
                </h2>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Real-time circular buffer capturing Gemini API latency, status codes, and chatbot execution traces
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearLogs}
                disabled={clearingLogs || !diagnostics?.logs?.length}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Clear Logs</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Search error messages or endpoints..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-neutral-400 shrink-0">Module:</span>
              <select
                value={logFilterModule}
                onChange={(e) => setLogFilterModule(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
              >
                <option value="ALL">All Modules</option>
                <option value="GEMINI_API">GEMINI_API</option>
                <option value="CHATBOT">CHATBOT</option>
                <option value="AUTO_FILL">AUTO_FILL</option>
                <option value="SERVER">SERVER</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-neutral-400 shrink-0">Level:</span>
              <select
                value={logFilterLevel}
                onChange={(e) => setLogFilterLevel(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
              >
                <option value="ALL">All Levels</option>
                <option value="error">Errors Only (🔴)</option>
                <option value="warn">Warnings (🟡)</option>
                <option value="success">Success (🟢)</option>
                <option value="info">Info (🔵)</option>
              </select>
            </div>
          </div>

          {/* Logs Table / List */}
          <div className="border border-neutral-200/80 rounded-2xl overflow-hidden divide-y divide-neutral-100 bg-neutral-900 text-neutral-100 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 font-sans space-y-2">
                <Info size={24} className="mx-auto text-neutral-500" />
                <p className="text-xs font-bold">No log events recorded matching the selected filters.</p>
                <p className="text-[11px] text-neutral-500">Run a test ping or interact with the AI Chatbot to generate real-time traces.</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogIds.has(log.id);
                const isErr = log.level === 'error';
                const isWarn = log.level === 'warn';
                const isSuccess = log.level === 'success';

                return (
                  <div key={log.id} className="hover:bg-neutral-800/60 transition-colors">
                    <div 
                      onClick={() => toggleExpandLog(log.id)}
                      className="p-3 flex items-start justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="mt-0.5 shrink-0">
                          {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          isErr ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          isWarn ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          isSuccess ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          'bg-neutral-800 text-neutral-300'
                        }`}>
                          {log.level}
                        </span>

                        <span className="bg-neutral-800 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0">
                          {log.module}
                        </span>

                        {log.endpoint && (
                          <span className="text-neutral-400 text-[11px] truncate shrink-0">
                            {log.endpoint}
                          </span>
                        )}

                        <span className={`text-[11px] truncate ${isErr ? 'text-rose-200 font-semibold' : 'text-neutral-200'}`}>
                          {log.message}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-neutral-400">
                        {log.latencyMs !== undefined && (
                          <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">
                            {log.latencyMs}ms
                          </span>
                        )}
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-3 pt-1 border-t border-neutral-800/80 bg-black/40 text-[11px] space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-neutral-400 text-[10px] pt-1">
                          <div>
                            <span className="text-neutral-500">Time: </span>
                            {new Date(log.timestamp).toISOString()}
                          </div>
                          <div>
                            <span className="text-neutral-500">Status: </span>
                            {log.statusCode || 'N/A'}
                          </div>
                          <div>
                            <span className="text-neutral-500">Error Code: </span>
                            <span className="text-rose-400 font-bold">{log.errorCode || 'NONE'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Latency: </span>
                            {log.latencyMs ? `${log.latencyMs}ms` : 'N/A'}
                          </div>
                        </div>

                        {log.details && (
                          <div className="mt-2">
                            <span className="text-[10px] uppercase text-neutral-400 font-bold block mb-1">Payload Details:</span>
                            <pre className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 text-[10px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: INTEGRATION KEYS */}
      {activeTab === 'keys' && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-neutral-100 pb-4 flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                <Key size={22} />
              </div>
              <div>
                <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                  Integration API Keys
                </h2>
                <p className="text-[11px] text-neutral-500 font-medium">Manage Stripe payment gateway and custom notification keys</p>
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
                    className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 normal-case cursor-pointer"
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs shadow-indigo-600/20"
              >
                {savingIntegrations ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                <span>{savingIntegrations ? 'Saving Keys...' : 'Save Integration Keys'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: ROLES */}
      {activeTab === 'roles' && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-neutral-100 pb-4 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                Staff & Role Assignment
              </h2>
              <p className="text-[11px] text-neutral-500 font-medium">Grant Admin or Seller management access to designated team email addresses</p>
            </div>
          </div>

          <form onSubmit={handleAssignRole} className="space-y-4 max-w-2xl">
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
                  placeholder="staff@raredreams.com.bd"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Role Privilege</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="admin">Admin (Full Control)</option>
                  <option value="seller">Seller (Products & Inventory)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button 
                  type="submit" 
                  disabled={loadingRole || !email}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {loadingRole ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  <span>Save Role</span>
                </button>
              </div>
            </div>
          </form>

          {staffUsers.length > 0 && (
            <div className="pt-4 border-t border-neutral-100">
              <h3 className="text-[11px] font-bold uppercase text-neutral-400 mb-3">Active Staff Members ({staffUsers.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {staffUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60">
                    <div className="truncate pr-2">
                      <p className="text-xs font-bold text-neutral-900 truncate">{u.email}</p>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase">{u.role}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleRevokeAccess(u.id, u.email)} 
                      className="shrink-0 p-2 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer" 
                      title="Revoke Access"
                    >
                      <UserMinus size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DATABASE & MAINTENANCE */}
      {activeTab === 'database' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Cloud Storage & Database Limits */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-5 flex flex-col justify-between">
            <div>
              <div className="border-b border-neutral-100 pb-4 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                    Database & Storage
                  </h2>
                  <p className="text-[11px] text-neutral-500 font-medium">Firestore & Firebase Storage Limits</p>
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

            <p className="text-[11px] text-neutral-500 font-medium bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60">
              ✅ All product photos are compressed via WebP and client-side high-fidelity optimizers for instant loading.
            </p>
          </div>

          {/* Safeguards & Order History Cleanup */}
          <div className="bg-red-50/20 p-6 sm:p-7 rounded-3xl border border-red-100 shadow-2xs space-y-5 flex flex-col justify-between">
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
      )}
    </div>
  );
}
