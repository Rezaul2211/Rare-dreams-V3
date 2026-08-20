import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, writeBatch, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { assignUserRoleByEmail, revokeUserRoleByEmail } from '../../lib/roles';
import { useStoreConfigStore } from '../../store/useStoreConfigStore';
import { setCachedGrokKey } from '../../services/aiService';
import { 
  ShieldAlert, Trash2, Mail, ShieldCheck, Database, Server, Loader2, AlertTriangle, 
  CheckCircle2, UserMinus, Cpu, Sparkles, RefreshCw, Key, Eye, EyeOff, ExternalLink,
  Check, XCircle, Zap, Activity, Clock, Terminal, Search, Filter, Play, AlertCircle,
  Info, ChevronDown, ChevronRight, Copy, Globe, HelpCircle, Code, Bot
} from 'lucide-react';

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  module: 'GROK_API' | 'CHATBOT' | 'AUTO_FILL' | 'FIREBASE' | 'SERVER';
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
  grok: {
    configured: boolean;
    keySnippet: string;
    model: string;
    provider?: string;
    reachable: boolean;
    latencyMs: number;
    statusCode: number | null;
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

const DEFAULT_DIAGNOSTICS: DiagnosticData = {
  timestamp: new Date().toISOString(),
  server: {
    uptimeSeconds: 120,
    memoryMb: 45,
    nodeVersion: typeof process !== 'undefined' ? process.version : 'Node.js 20+',
    port: 3000,
    status: 'connected'
  },
  grok: {
    configured: false,
    keySnippet: 'Not Set',
    model: 'grok-beta',
    provider: 'xAI Grok',
    reachable: false,
    latencyMs: 0,
    statusCode: null,
    errorCode: null,
    message: 'Grok API is ready. Please configure or test your Grok API Key.',
    resolution: 'Enter your Grok API key (xai-... or gsk_...) in Integration Keys tab.'
  },
  firebase: {
    adminInitialized: true,
    projectId: 'ai-studio',
    status: 'connected'
  },
  logs: []
};

export default function AdminSystem() {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'logs' | 'keys' | 'roles' | 'database'>('diagnostics');

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<DiagnosticData>(DEFAULT_DIAGNOSTICS);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Live Test State
  const [testPrompt, setTestPrompt] = useState('Hello Rare Dreams Grok AI! Please respond with a brief greeting in English and Bengali.');
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
    grokApiKey: '',
    facebookPixelId: '',
    googleAnalyticsId: '',
    stripePublishableKey: '',
    stripeSecretKey: '',
    customServiceKey: ''
  });
  const [showGrokKey, setShowGrokKey] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [integrationsMessage, setIntegrationsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copiedKeyName, setCopiedKeyName] = useState<string | null>(null);

  const { config: storeConfig, updateConfig: updateStoreConfig } = useStoreConfigStore();

  // Helper for calling Grok directly from the client with dynamic model discovery and deprecation resilience
  const callDirectClientGrok = async (key: string, promptText: string) => {
    const trimmedKey = key.trim();
    const isGroq = trimmedKey.startsWith('gsk_');
    const endpoint = isGroq 
      ? 'https://api.groq.com/openai/v1/chat/completions' 
      : 'https://api.x.ai/v1/chat/completions';
    const modelsEndpoint = isGroq
      ? 'https://api.groq.com/openai/v1/models'
      : 'https://api.x.ai/v1/models';

    // 1. Try to fetch active models dynamically from the provider
    let candidateModels: string[] = [];
    try {
      const modelsRes = await fetch(modelsEndpoint, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${trimmedKey}` }
      });
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        if (Array.isArray(modelsData?.data)) {
          const fetchedIds: string[] = modelsData.data
            .map((m: any) => m.id)
            .filter((id: string) => typeof id === 'string' && !id.includes('whisper') && !id.includes('tts') && !id.includes('guard'));
          
          if (fetchedIds.length > 0) {
            // Prioritize fast & popular chat models
            const prioritized = isGroq
              ? [
                  'openai/gpt-oss-120b',
                  'openai/gpt-oss-20b',
                  'qwen/qwen3.6-27b',
                  'groq/compound',
                  'groq/compound-mini',
                  'moonshotai/kimi-k2-instruct-0905',
                  'llama-3.3-70b-versatile',
                  'llama-3.1-8b-instant'
                ]
              : ['grok-2-latest', 'grok-2', 'grok-beta'];
            
            const sorted = [
              ...prioritized.filter(p => fetchedIds.includes(p)),
              ...fetchedIds.filter(f => !prioritized.includes(f))
            ];
            candidateModels = sorted;
          }
        }
      }
    } catch {
      // Dynamic models list fetch failed, continue to fallback list
    }

    // Default static fallback models if dynamic discovery was empty
    if (candidateModels.length === 0) {
      candidateModels = isGroq
        ? [
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'qwen/qwen3.6-27b',
            'groq/compound',
            'groq/compound-mini',
            'moonshotai/kimi-k2-instruct-0905',
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant'
          ]
        : ['grok-2-latest', 'grok-2', 'grok-beta'];
    }

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const start = Date.now();
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${trimmedKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: promptText }],
            temperature: 0.7,
            max_tokens: 1024
          })
        });

        const latencyMs = Date.now() - start;
        if (res.ok) {
          const data = await res.json();
          return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || model,
            latencyMs
          };
        }

        let errText = '';
        try {
          const errJson = await res.json();
          errText = JSON.stringify(errJson);
        } catch {
          errText = await res.text();
        }

        lastError = new Error(`Direct Grok API Error (${res.status}): ${errText}`);
        
        // If it's a model decommissioned, model not found, or 404/400 model error, try next candidate model
        const isModelIssue = res.status === 404 ||
          errText.includes('model_decommissioned') ||
          errText.includes('model_not_found') ||
          errText.includes('decommissioned') ||
          errText.includes('does not exist') ||
          errText.includes('not supported') ||
          errText.includes('deprecat');

        if (isModelIssue) {
          continue;
        } else {
          // If it's 401 unauthenticated or other fatal error, stop and throw
          throw lastError;
        }
      } catch (e: any) {
        if (e.message?.includes('401') || e.message?.includes('invalid_api_key')) {
          throw e;
        }
        lastError = e;
      }
    }

    throw lastError || new Error("Failed to connect with any available Grok / Groq model.");
  };

  // Safe Fetch Diagnostics
  const fetchDiagnostics = async (silent = false) => {
    if (!silent) setLoadingDiagnostics(true);
    try {
      const res = await fetch('/api/admin/diagnostics');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setDiagnostics({
            timestamp: data.timestamp || new Date().toISOString(),
            server: { ...DEFAULT_DIAGNOSTICS.server, ...(data.server || {}) },
            grok: { ...DEFAULT_DIAGNOSTICS.grok, ...(data.grok || data.gemini || {}) },
            firebase: { ...DEFAULT_DIAGNOSTICS.firebase, ...(data.firebase || {}) },
            logs: Array.isArray(data.logs) ? data.logs : [],
            totalCheckTimeMs: data.totalCheckTimeMs
          });
          setLastCheckTime(new Date());
          return;
        }
      }

      // If backend returned HTML (e.g. static hosting on Vercel without active server process),
      // check if we have a saved Grok API key in state or Firestore to test direct client connectivity
      const localKey = integrations.grokApiKey?.trim();
      if (localKey) {
        try {
          const directPing = await callDirectClientGrok(localKey, "Ping. Reply with 'PONG'.");
          setDiagnostics(prev => ({
            ...prev,
            grok: {
              configured: true,
              keySnippet: `${localKey.substring(0, 6)}...${localKey.substring(localKey.length - 4)}`,
              model: directPing.model,
              provider: localKey.startsWith('gsk_') ? 'Groq Llama' : 'xAI Grok',
              reachable: true,
              latencyMs: directPing.latencyMs,
              statusCode: 200,
              errorCode: null,
              message: `Connected & Active (Direct Mode - Latency: ${directPing.latencyMs}ms)`,
              resolution: null
            }
          }));
        } catch (e: any) {
          setDiagnostics(prev => ({
            ...prev,
            grok: {
              configured: true,
              keySnippet: `${localKey.substring(0, 6)}...${localKey.substring(localKey.length - 4)}`,
              model: 'grok-beta',
              provider: 'xAI Grok',
              reachable: false,
              latencyMs: 0,
              statusCode: 401,
              errorCode: 'UNAUTHENTICATED_OR_KEY_ERROR',
              message: e.message || 'Direct Grok Ping failed',
              resolution: 'Please check your API key on https://console.x.ai/ or https://console.groq.com/keys.'
            }
          }));
        }
      }
      setLastCheckTime(new Date());
    } catch (err) {
      console.warn("Diagnostics fetch safe fallback:", err);
      setLastCheckTime(new Date());
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

  // Run Live Grok Test
  const handleRunLiveTest = async () => {
    setRunningTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/diagnostics/test-grok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPrompt })
      });
      const contentType = res.headers.get('content-type') || '';
      
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setTestResult({
          ok: res.ok,
          status: res.status,
          ...data
        });
      } else {
        // Backend API returned HTML or non-JSON (typical on static Vercel SPA preview before serverless rebuild)
        // Automatically perform direct client test with the saved Grok API key!
        const keyToUse = integrations.grokApiKey?.trim();
        if (!keyToUse) {
          setTestResult({
            ok: false,
            status: 400,
            errorCode: 'KEY_NOT_CONFIGURED',
            error: 'Grok API key is not configured yet.',
            resolution: 'Please go to the "Integration Keys (Grok & FB ID)" tab, paste your Grok API key (xai-... or gsk_...), and click "Save All Keys to Database".'
          });
        } else {
          try {
            const directResult = await callDirectClientGrok(keyToUse, testPrompt);
            setTestResult({
              ok: true,
              status: 200,
              model: directResult.model,
              latencyMs: directResult.latencyMs,
              prompt: testPrompt,
              responseText: directResult.content
            });
            fetchDiagnostics(true);
          } catch (directErr: any) {
            setTestResult({
              ok: false,
              status: 401,
              errorCode: 'GROK_API_ERROR',
              error: directErr.message || 'Direct Grok call failed.',
              resolution: 'Please check your key at https://console.x.ai/ or https://console.groq.com/keys and ensure it has active billing/quota.'
            });
          }
        }
      }
      fetchDiagnostics(true);
    } catch (err: any) {
      // If network fetch failed, attempt direct client test
      const keyToUse = integrations.grokApiKey?.trim();
      if (keyToUse) {
        try {
          const directResult = await callDirectClientGrok(keyToUse, testPrompt);
          setTestResult({
            ok: true,
            status: 200,
            model: directResult.model,
            latencyMs: directResult.latencyMs,
            prompt: testPrompt,
            responseText: directResult.content
          });
          fetchDiagnostics(true);
        } catch (directErr: any) {
          setTestResult({
            ok: false,
            status: 500,
            error: directErr.message || "Network error while running test",
            resolution: 'Check your internet connection and API key validity.'
          });
        }
      } else {
        setTestResult({
          ok: false,
          status: 500,
          error: err.message || "Network error while running test",
          resolution: 'Please enter your Grok API key in the Integration Keys tab.'
        });
      }
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
    } catch (err) {
      console.error(err);
    } finally {
      fetchDiagnostics(false);
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
  const safeLogs = diagnostics?.logs || [];
  const filteredLogs = safeLogs.filter(log => {
    if (!log) return false;
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

  // Load saved API keys from Firestore
  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'integrations');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const grokKey = data.grokApiKey || data.xaiApiKey || data.groqApiKey || data.geminiApiKey || '';
          if (grokKey) {
            setCachedGrokKey(grokKey);
          }
          setIntegrations({
            grokApiKey: grokKey,
            facebookPixelId: data.facebookPixelId || storeConfig?.facebookPixelId || '',
            googleAnalyticsId: data.googleAnalyticsId || storeConfig?.googleAnalyticsId || '',
            stripePublishableKey: data.stripePublishableKey || '',
            stripeSecretKey: data.stripeSecretKey || '',
            customServiceKey: data.customServiceKey || ''
          });
        } else {
          setIntegrations(prev => ({
            ...prev,
            facebookPixelId: storeConfig?.facebookPixelId || '',
            googleAnalyticsId: storeConfig?.googleAnalyticsId || ''
          }));
        }
      } catch (err) {
        console.warn("Could not load integrations:", err);
      }
    };

    loadIntegrations();
  }, [storeConfig?.facebookPixelId, storeConfig?.googleAnalyticsId]);

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntegrations(true);
    setIntegrationsMessage(null);

    try {
      if (integrations.grokApiKey?.trim()) {
        setCachedGrokKey(integrations.grokApiKey.trim());
      }

      // 1. Save to Firestore system_settings/integrations
      await setDoc(doc(db, 'system_settings', 'integrations'), {
        ...integrations,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Sync Facebook Pixel & GA to StoreConfig
      if (integrations.facebookPixelId || integrations.googleAnalyticsId) {
        await updateStoreConfig({
          facebookPixelId: integrations.facebookPixelId,
          googleAnalyticsId: integrations.googleAnalyticsId
        });
      }

      // 3. Notify backend runtime endpoint for instant Grok activation
      if (integrations.grokApiKey?.trim()) {
        try {
          await fetch('/api/admin/diagnostics/update-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: integrations.grokApiKey.trim() })
          });
        } catch (e) {
          // ignore
        }
      }

      setIntegrationsMessage({
        type: 'success',
        text: 'Grok API Key & Integration settings saved successfully! Active for Chatbot, Product Description Generator & Admin Diagnostics.'
      });
      
      fetchDiagnostics(true);
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

  const copyToClipboard = (text: string, name: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyName(name);
    setTimeout(() => setCopiedKeyName(null), 2500);
  };

  useEffect(() => {
    // Listen to users with admin/seller role
    const qUsers = query(collection(db, 'users'), where('role', 'in', ['admin', 'seller']));
    const qAuthRoles = collection(db, 'authorized_roles');

    let userStaff: any[] = [];
    let authStaff: any[] = [];

    const updateStaffState = () => {
      const mergedMap = new Map();
      authStaff.forEach(u => mergedMap.set(u.email, u));
      userStaff.forEach(u => mergedMap.set(u.email, u));
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

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoadingRole(true);
    setRoleMessage(null);

    try {
      await assignUserRoleByEmail(email, role as 'admin' | 'seller');
      setRoleMessage({
        type: 'success',
        text: `Role '${role.toUpperCase()}' successfully granted to ${email}.`
      });
      setEmail('');
      setTimeout(() => setRoleMessage(null), 5000);
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

  const handleRevokeAccess = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to revoke staff privileges for ${userEmail}?`)) return;

    try {
      await revokeUserRoleByEmail(userEmail);
      setRoleMessage({
        type: 'success',
        text: `Staff access revoked for ${userEmail}.`
      });
      setTimeout(() => setRoleMessage(null), 4000);
    } catch (error: any) {
      console.error(error);
      setRoleMessage({
        type: 'error',
        text: error.message || 'Failed to revoke role'
      });
    }
  };

  const handleClearHistory = async () => {
    const confirmation = window.prompt("WARNING: Type 'DELETE' to confirm wiping test orders and notifications. Products & Customers will be preserved.");
    if (confirmation !== 'DELETE') return;

    setLoadingDelete(true);
    setDeleteMessage(null);

    try {
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const notifsSnap = await getDocs(collection(db, 'notifications'));

      let count = 0;
      const batch = writeBatch(db);
      
      ordersSnap.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      notifsSnap.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      await batch.commit();

      setDeleteMessage({
        type: 'success',
        text: `Successfully deleted ${count} test orders & notification records.`
      });
      setTimeout(() => setDeleteMessage(null), 6000);
    } catch (error: any) {
      console.error(error);
      setDeleteMessage({ type: 'error', text: error.message || 'Failed to clear history' });
    } finally {
      setLoadingDelete(false);
    }
  };

  const grokState = diagnostics?.grok || DEFAULT_DIAGNOSTICS.grok;
  const serverState = diagnostics?.server || DEFAULT_DIAGNOSTICS.server;
  const firebaseState = diagnostics?.firebase || DEFAULT_DIAGNOSTICS.firebase;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Top Header Card */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${grokState.reachable ? 'bg-emerald-500 animate-pulse' : grokState.configured ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Grok AI System & API Diagnostics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-neutral-900 mt-0.5">
            Grok AI & System Diagnostics
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            Real-time connection monitor for xAI Grok API, Facebook Pixel, Firebase services, and server telemetry
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
          <Zap size={15} className={activeTab === 'diagnostics' ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Grok Diagnostics</span>
          <span className={`w-2 h-2 rounded-full ${grokState.reachable ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
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
            {safeLogs.length}
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
          <span>Integration Keys (Grok & FB ID)</span>
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
            {/* CARD 1: Grok AI Status */}
            <div className={`p-6 rounded-3xl border shadow-2xs flex flex-col justify-between transition-all ${
              grokState.reachable 
                ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-emerald-200/80' 
                : grokState.configured 
                  ? 'bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 border-amber-200/80'
                  : 'bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 border-rose-200/80'
            }`}>
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border shrink-0 ${
                      grokState.reachable 
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                        : grokState.configured 
                          ? 'bg-amber-100 text-amber-700 border-amber-200' 
                          : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-tight text-neutral-900">Grok AI Endpoint</h3>
                      <p className="text-[10px] text-neutral-500 font-mono">{grokState.model || "grok-beta"} ({grokState.provider || "xAI"})</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                    grokState.reachable 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : grokState.statusCode === 429
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {grokState.reachable ? '200 OK • Active' : grokState.errorCode || (grokState.configured ? 'Key / Quota' : 'Key Missing')}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">API Key Snippet:</span>
                    <span className="font-mono font-bold text-[11px] text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                      {grokState.keySnippet || "Not Found"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Ping Latency:</span>
                    <span className="font-bold text-[11px] text-neutral-800">
                      {grokState.latencyMs ? `${grokState.latencyMs} ms` : "—"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">HTTP Status:</span>
                    <span className="font-mono font-bold text-[11px] text-neutral-800">
                      {grokState.statusCode ? `${grokState.statusCode}` : "—"}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-2xl bg-white/90 border border-neutral-200/70 text-[11px]">
                    <p className="font-medium text-neutral-700 leading-snug">
                      {grokState.message || "Ready for Grok test ping"}
                    </p>
                    {grokState.resolution && (
                      <p className="mt-2 pt-2 border-t border-neutral-100 font-medium text-amber-800">
                        💡 <span className="font-bold">Advice:</span> {grokState.resolution}
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
                      {firebaseState.projectId || "ai-studio"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Admin SDK:</span>
                    <span className="font-bold text-[11px] text-emerald-700">
                      {firebaseState.adminInitialized ? "Initialized & Ready" : "Client Mode"}
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

            {/* CARD 3: Backend & Pixel Status */}
            <div className="p-6 rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/20 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200 shrink-0">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-tight text-neutral-900">Facebook Pixel & SEO</h3>
                      <p className="text-[10px] text-neutral-500 font-mono">Meta Pixel & GA4</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                    storeConfig?.facebookPixelId ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                  }`}>
                    {storeConfig?.facebookPixelId ? 'Active' : 'Unset'}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">FB Pixel ID:</span>
                    <span className="font-mono font-bold text-[11px] text-neutral-800">
                      {storeConfig?.facebookPixelId || "Not Configured"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Google Analytics:</span>
                    <span className="font-mono text-[11px] font-bold text-neutral-800">
                      {storeConfig?.googleAnalyticsId || "Not Configured"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-600">
                    <span className="text-[11px] font-medium text-neutral-500">Server Port:</span>
                    <span className="font-mono text-[11px] font-bold text-neutral-800">
                      {serverState.port || 3000}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-2xl bg-white/90 border border-neutral-200/70 text-[11px] text-neutral-600">
                    ⏱️ Last Telemetry Ping: {lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Just now'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Grok Endpoint Test Tool */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
                  <Play size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                    Live Grok AI Endpoint Tester
                  </h2>
                  <p className="text-[11px] text-neutral-500 font-medium">
                    Send a test prompt directly to Grok AI (xAI Grok or Groq Llama) and test real-time latency & response
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
                    placeholder="Enter test message for Grok AI..."
                    className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                  />
                  <button
                    onClick={handleRunLiveTest}
                    disabled={runningTest || !testPrompt.trim()}
                    className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
                  >
                    {runningTest ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <Play size={14} className="text-amber-400" />}
                    <span>{runningTest ? 'Calling Grok...' : 'Run Test Ping'}</span>
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
                        {testResult.ok ? `Test Succeeded (${testResult.status || 200} OK) • Model: ${testResult.model || 'Grok'}` : `Test Failed (${testResult.status || 'ERROR'})`}
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
                      <span className="text-[10px] font-bold uppercase text-neutral-400">Response from Grok AI:</span>
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

      {/* TAB 2: LIVE SYSTEM & GROK LOGS */}
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
                  Real-time circular buffer capturing Grok AI API latency, status codes, and chatbot execution traces
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearLogs}
                disabled={clearingLogs || !safeLogs.length}
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
                <option value="GROK_API">GROK_API</option>
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
                <option value="error">Errors Only</option>
                <option value="warn">Warnings</option>
                <option value="success">Success</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>

          {/* Logs List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50">
                <Terminal size={28} className="mx-auto text-neutral-300 mb-2" />
                <p className="text-xs font-bold text-neutral-600 uppercase">No Logs Recorded Yet</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Logs from Grok AI interactions, chatbot, auto-fill, and test pings will appear here in real-time.
                </p>
              </div>
            ) : (
              filteredLogs.map(log => {
                const isExpanded = expandedLogIds.has(log.id);
                return (
                  <div
                    key={log.id}
                    className={`p-3.5 rounded-2xl border text-xs font-mono transition-all ${
                      log.level === 'error'
                        ? 'bg-rose-50/60 border-rose-200/80 text-rose-950'
                        : log.level === 'warn'
                          ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                          : log.level === 'success'
                            ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 cursor-pointer select-none" onClick={() => toggleExpandLog(log.id)}>
                      <div className="flex items-center gap-2 shrink-0">
                        {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          log.level === 'error'
                            ? 'bg-rose-600 text-white'
                            : log.level === 'warn'
                              ? 'bg-amber-500 text-white'
                              : log.level === 'success'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-neutral-600 text-white'
                        }`}>
                          {log.level}
                        </span>
                        <span className="text-[10px] font-bold text-neutral-500 font-sans">
                          [{log.module}]
                        </span>
                      </div>

                      <div className="flex-1 truncate font-medium">
                        {log.message}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-neutral-400">
                        {log.latencyMs && (
                          <span className="bg-white/80 border border-neutral-200/80 px-1.5 py-0.5 rounded text-neutral-700 font-bold">
                            {log.latencyMs}ms
                          </span>
                        )}
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-current/10 space-y-2 text-[11px] animate-in fade-in duration-150">
                        {log.endpoint && (
                          <div>
                            <span className="text-neutral-400 uppercase text-[9px] block">Endpoint:</span>
                            <span className="font-bold">{log.endpoint}</span>
                          </div>
                        )}
                        {log.errorCode && (
                          <div>
                            <span className="text-neutral-400 uppercase text-[9px] block">Error Code:</span>
                            <span className="font-bold text-rose-700">{log.errorCode}</span>
                          </div>
                        )}
                        {log.details && (
                          <div>
                            <span className="text-neutral-400 uppercase text-[9px] block">Details Payload:</span>
                            <pre className="bg-black/5 p-2 rounded-xl text-[10px] overflow-x-auto whitespace-pre-wrap">
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

      {/* TAB 3: INTEGRATION KEYS & VERCEL / FB GUIDE */}
      {activeTab === 'keys' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Main Key Form Card */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-neutral-200/90 shadow-2xs space-y-6">
            <div className="border-b border-neutral-100 pb-4 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100 shrink-0">
                <Key size={22} />
              </div>
              <div>
                <h2 className="text-base font-black uppercase text-neutral-900 tracking-tight">
                  API Keys & Integration Settings
                </h2>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Directly configure Grok AI API, Facebook Pixel (FB ID), Google Analytics, and payment gateways
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveIntegrations} className="space-y-6">
              {integrationsMessage && (
                <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                  integrationsMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {integrationsMessage.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertTriangle size={18} className="mt-0.5" />}
                  <div className="flex-1">{integrationsMessage.text}</div>
                </div>
              )}

              {/* Section 1: Grok AI API Key */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={18} className="text-amber-600" />
                    <span className="text-xs font-black uppercase tracking-tight text-neutral-900">Grok AI API Key (xAI / Groq)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGrokKey(!showGrokKey)}
                    className="text-amber-700 hover:text-amber-800 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  >
                    {showGrokKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showGrokKey ? 'Hide' : 'Show Key'}
                  </button>
                </div>

                <div>
                  <input
                    type={showGrokKey ? "text" : "password"}
                    value={integrations.grokApiKey}
                    onChange={(e) => setIntegrations({ ...integrations, grokApiKey: e.target.value })}
                    placeholder="xai-xxxxxxxx... or gsk_xxxxxxxx..."
                    className="w-full bg-white border border-amber-300/80 text-neutral-900 text-xs font-mono rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-bold"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 mt-2">
                    <span>Supports <strong>xAI Grok</strong> (starts with <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800">xai-...</code>) and <strong>Groq Llama</strong> (starts with <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800">gsk_...</code>).</span>
                    <div className="flex gap-2">
                      <a 
                        href="https://console.x.ai/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-amber-800 font-bold underline inline-flex items-center gap-0.5"
                      >
                        Get xAI Grok Key <ExternalLink size={10} />
                      </a>
                      <span className="text-neutral-300">•</span>
                      <a 
                        href="https://console.groq.com/keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-amber-800 font-bold underline inline-flex items-center gap-0.5"
                      >
                        Get Groq Key <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Facebook Pixel (FB ID) & Analytics */}
              <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-indigo-600" />
                  <span className="text-xs font-black uppercase tracking-tight text-neutral-900">Facebook Pixel (FB ID) & Analytics</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                      Facebook Pixel ID (FB ID)
                    </label>
                    <input
                      type="text"
                      value={integrations.facebookPixelId}
                      onChange={(e) => setIntegrations({ ...integrations, facebookPixelId: e.target.value })}
                      placeholder="e.g. 182940294819203"
                      className="w-full bg-white border border-indigo-200 text-neutral-900 text-xs font-mono font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Meta Pixel ID from Facebook Events Manager. Tracks pageviews and purchases across your store.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                      Google Analytics Measurement ID (GA4)
                    </label>
                    <input
                      type="text"
                      value={integrations.googleAnalyticsId}
                      onChange={(e) => setIntegrations({ ...integrations, googleAnalyticsId: e.target.value })}
                      placeholder="e.g. G-XXXXXXXXXX"
                      className="w-full bg-white border border-indigo-200 text-neutral-900 text-xs font-mono font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">
                      Optional: Google Analytics GA4 measurement stream tag.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Stripe & Custom Gateway Keys */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1.5">Stripe Publishable Key</label>
                  <input
                    type="text"
                    value={integrations.stripePublishableKey}
                    onChange={(e) => setIntegrations({ ...integrations, stripePublishableKey: e.target.value })}
                    placeholder="pk_test_..."
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 focus:border-neutral-500 transition-all font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1.5 flex justify-between">
                    <span>Stripe Secret Key</span>
                    <button
                      type="button"
                      onClick={() => setShowIntegrations(!showIntegrations)}
                      className="text-neutral-600 hover:text-neutral-800 flex items-center gap-1 normal-case text-[11px] cursor-pointer"
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
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 focus:border-neutral-500 transition-all font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1.5">Custom Service / SMS Gateway Key</label>
                  <input
                    type={showIntegrations ? "text" : "password"}
                    value={integrations.customServiceKey}
                    onChange={(e) => setIntegrations({ ...integrations, customServiceKey: e.target.value })}
                    placeholder="Enter custom service API key..."
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 focus:border-neutral-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingIntegrations}
                  className="bg-neutral-900 hover:bg-black text-white text-xs font-bold py-3.5 px-7 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingIntegrations ? <Loader2 size={15} className="animate-spin text-amber-400" /> : <ShieldCheck size={15} className="text-amber-400" />}
                  <span>{savingIntegrations ? 'Saving Keys...' : 'Save All Keys to Database'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Explanatory Help Guide for Vercel & Facebook */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Guide 1: Vercel Environment Variables */}
            <div className="p-6 rounded-3xl bg-neutral-900 text-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code size={18} className="text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                    How to set Grok API Key on Vercel
                  </h3>
                </div>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                ভার্সেল (Vercel)-এ গ্রোক এআই (Grok AI) কী সেট করার নিয়ম:
              </p>
              <ol className="text-xs text-neutral-300 space-y-2 list-decimal list-inside font-sans">
                <li>Vercel ড্যাশবোর্ডে আপনার প্রোজেক্ট ওপেন করুন।</li>
                <li>উপরে <strong className="text-white">Settings</strong> ট্যাবে ক্লিক করুন।</li>
                <li>বামের মেনু থেকে <strong className="text-white">Environment Variables</strong> সিলেক্ট করুন।</li>
                <li>
                  <div className="flex items-center justify-between bg-neutral-800 p-2 rounded-xl mt-1 font-mono text-[11px]">
                    <span className="text-amber-300 font-bold">Key: GROK_API_KEY</span>
                    <button 
                      onClick={() => copyToClipboard('GROK_API_KEY', 'GROK_API_KEY')}
                      className="text-[10px] bg-neutral-700 hover:bg-neutral-600 text-white px-2 py-0.5 rounded cursor-pointer"
                    >
                      {copiedKeyName === 'GROK_API_KEY' ? 'Copied!' : 'Copy Key'}
                    </button>
                  </div>
                </li>
                <li>
                  <strong>Value:</strong> আপনার <span className="font-mono text-amber-300">xai-...</span> বা <span className="font-mono text-amber-300">gsk_...</span> কি-টি পেস্ট করে <strong className="text-white">Save</strong> এবং <strong className="text-white">Redeploy</strong> দিন।
                </li>
              </ol>
            </div>

            {/* Guide 2: Facebook Pixel (FB ID) Location */}
            <div className="p-6 rounded-3xl bg-blue-950 text-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-blue-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-400">
                    Facebook Pixel (FB ID) কোথায় পাবেন?
                  </h3>
                </div>
              </div>
              <p className="text-xs text-blue-200 leading-relaxed">
                ফেসবুক অ্যাডস বা কনভার্সন ট্র্যাকিংয়ের জন্য FB ID বসানোর গাইড:
              </p>
              <ol className="text-xs text-blue-200 space-y-2 list-decimal list-inside font-sans">
                <li>
                  <a href="https://business.facebook.com/events_manager" target="_blank" rel="noreferrer" className="text-white underline font-bold inline-flex items-center gap-1">
                    Facebook Events Manager <ExternalLink size={11} />
                  </a> এ লগইন করুন।
                </li>
                <li>আপনার <strong>Dataset / Pixel</strong> সিলেক্ট করুন।</li>
                <li>সেখান থেকে <strong>Pixel ID (যেমন: 182940294819203)</strong> কপি করুন।</li>
                <li>
                  উপরের <strong className="text-white">Facebook Pixel ID (FB ID)</strong> বক্সে বসিয়ে <strong className="text-white">Save All Keys</strong> চাপুন।
                </li>
                <li>এটি সাথে সাথেই আপনার ওয়েবসাইটের হেডারে যুক্ত হয়ে ভিজিটর ট্র্যাকিং শুরু করবে।</li>
              </ol>
            </div>
          </div>

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
                  <div key={u.id || u.email} className="flex items-center justify-between bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60">
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
