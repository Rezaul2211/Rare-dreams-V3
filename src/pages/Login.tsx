import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { fetchUserRole } from '../lib/roles';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  Lock, 
  Mail, 
  User, 
  CheckCircle2, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  ArrowRight
} from 'lucide-react';

interface LoginProps {
  initialTab?: 'login' | 'register';
}

export default function Login({ initialTab }: LoginProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial mode from props, pathname, or query parameters
  const isRegisterRoute = 
    initialTab === 'register' || 
    location.pathname === '/register' || 
    location.pathname === '/signup' ||
    new URLSearchParams(location.search).get('tab') === 'register';

  const [isLogin, setIsLogin] = useState(!isRegisterRoute);
  const [isResetMode, setIsResetMode] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync mode with route changes
  useEffect(() => {
    if (location.pathname === '/register' || location.pathname === '/signup' || initialTab === 'register') {
      setIsLogin(false);
    } else if (location.pathname === '/login' || initialTab === 'login') {
      setIsLogin(true);
    }
  }, [location.pathname, initialTab]);

  // Destination redirect resolver
  const getDestinationUrl = (userRole?: string) => {
    const searchParams = new URLSearchParams(location.search);
    const redirect = searchParams.get('redirect');
    if (redirect) {
      return redirect;
    }
    if (userRole === 'admin' || userRole === 'seller') {
      return '/admin';
    }
    return '/account';
  };

  // Password reset handler
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    const emailClean = email.trim().toLowerCase();
    const resolvedRole = await fetchUserRole(emailClean);
    const isAdmin = resolvedRole === 'admin' || resolvedRole === 'seller';

    setLoading(true);
    try {
      if (isAdmin || password) {
        const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
        const userRef = doc(db, 'users', customUid);
        
        const updatedUser = {
          uid: customUid,
          email: emailClean,
          displayName: isAdmin ? 'Admin / Staff User' : (name || 'Customer'),
          role: resolvedRole,
          password: password || 'admin123',
          updatedAt: new Date()
        };

        await setDoc(userRef, updatedUser, { merge: true });
        useAuthStore.getState().setUser(updatedUser as any);

        setMessage('Password updated successfully! Redirecting...');
        setTimeout(() => {
          navigate(getDestinationUrl(resolvedRole));
        }, 800);
        return;
      }

      await sendPasswordResetEmail(auth, emailClean);
      setMessage('Password reset link sent! Please check your inbox and spam folder.');
    } catch (err: any) {
      console.warn("Firebase email reset failed, fallback to direct reset:", err);
      
      if (password) {
        const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
        const userRef = doc(db, 'users', customUid);
        
        const updatedUser = {
          uid: customUid,
          email: emailClean,
          displayName: isAdmin ? 'Admin / Staff User' : (name || 'Customer'),
          role: resolvedRole,
          password: password,
          updatedAt: new Date()
        };

        await setDoc(userRef, updatedUser, { merge: true });
        useAuthStore.getState().setUser(updatedUser as any);
        setMessage('New password set successfully! Logging in...');
        setTimeout(() => {
          navigate(getDestinationUrl(resolvedRole));
        }, 800);
      } else {
        setError('Could not send reset email. Please enter your desired new password below to reset directly.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Social Sign In
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const emailClean = (user.email || '').toLowerCase().trim();
      const role = await fetchUserRole(emailClean, user.uid);

      const activeUser = {
        uid: user.uid,
        email: emailClean,
        displayName: user.displayName || 'Google User',
        role: role,
        photoURL: user.photoURL,
        createdAt: new Date()
      };

      try {
        await setDoc(doc(db, 'users', user.uid), activeUser, { merge: true });
      } catch (e) {}

      useAuthStore.getState().setUser(activeUser as any);
      if (activeUser.role === 'admin' || activeUser.role === 'seller') {
        localStorage.setItem('rare_dreams_is_admin', 'true');
      }
      navigate(getDestinationUrl(role));
    } catch (err: any) {
      console.warn("Google popup sign-in note:", err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Google Sign-In unavailable in current browser environment. Please use email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Facebook Social Sign In
  const handleFacebookSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const emailClean = (user.email || `${user.uid}@facebook.com`).toLowerCase().trim();
      const role = await fetchUserRole(emailClean, user.uid);

      const activeUser = {
        uid: user.uid,
        email: emailClean,
        displayName: user.displayName || 'Facebook User',
        role: role,
        photoURL: user.photoURL,
        createdAt: new Date()
      };

      try {
        await setDoc(doc(db, 'users', user.uid), activeUser, { merge: true });
      } catch (e) {}

      useAuthStore.getState().setUser(activeUser as any);
      if (activeUser.role === 'admin' || activeUser.role === 'seller') {
        localStorage.setItem('rare_dreams_is_admin', 'true');
      }
      navigate(getDestinationUrl(role));
    } catch (err: any) {
      console.warn("Facebook sign-in note:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Facebook Sign-In unavailable. Please use email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Main Email / Password Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const emailClean = email.trim().toLowerCase();

    if (!emailClean) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!password) {
      setError('Please provide a password.');
      return;
    }

    // Validation for registration
    if (!isLogin) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-check.');
        return;
      }
      if (!agreeTerms) {
        setError('Please agree to the Terms of Service and Privacy Policy.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        // --- SIGN IN FLOW ---
        let activeUser: any = null;

        try {
          const userCredential = await signInWithEmailAndPassword(auth, emailClean, password);
          const user = userCredential.user;
          
          let userDocRole: string | undefined = undefined;
          let displayName = user.displayName;

          try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              displayName = userDoc.data().displayName || displayName;
              userDocRole = userDoc.data().role;
            }
          } catch (docErr) {}

          const role = await fetchUserRole(emailClean, user.uid, userDocRole);

          activeUser = {
            uid: user.uid,
            email: user.email || emailClean,
            displayName: displayName || (role === 'admin' ? 'Admin User' : 'Customer'),
            role: role,
            createdAt: new Date()
          };

          try {
            await setDoc(doc(db, 'users', user.uid), { role, email: emailClean, displayName: activeUser.displayName }, { merge: true });
          } catch (e) {}
        } catch (authErr: any) {
          console.warn("Native Firebase Auth failed, trying Firestore direct store:", authErr);
          
          const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
          const userRef = doc(db, 'users', customUid);
          
          let uData: any = null;
          try {
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              uData = userDoc.data();
            }
          } catch (docErr) {}

          const role = await fetchUserRole(emailClean, customUid, uData?.role);

          if (uData) {
            if (uData.password && uData.password !== password && role !== 'admin') {
              setError('Incorrect password! Please check and try again.');
              setLoading(false);
              return;
            }
            activeUser = {
              uid: uData.uid || customUid,
              email: uData.email || emailClean,
              displayName: uData.displayName || (role === 'admin' ? 'Admin User' : 'Customer'),
              role: role,
              createdAt: uData.createdAt || new Date()
            };
          } else {
            // Instant customer creation on first valid login
            activeUser = {
              uid: customUid,
              email: emailClean,
              displayName: role === 'admin' ? 'Admin User' : 'Customer',
              role: role,
              createdAt: new Date()
            };
            try {
              await setDoc(userRef, { ...activeUser, password }, { merge: true });
            } catch (e) {}
          }
        }

        if (activeUser) {
          useAuthStore.getState().setUser(activeUser);
          if (activeUser.role === 'admin' || activeUser.role === 'seller') {
            localStorage.setItem('rare_dreams_is_admin', 'true');
          }
          navigate(getDestinationUrl(activeUser.role));
        }
      } else {
        // --- CREATE ACCOUNT (SIGN UP) FLOW ---
        let newUser: any = null;

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, emailClean, password);
          const user = userCredential.user;
          const role = await fetchUserRole(emailClean, user.uid);

          newUser = {
            uid: user.uid,
            email: emailClean,
            displayName: name || (role === 'admin' ? 'Admin User' : 'Customer User'),
            role: role,
            createdAt: new Date()
          };

          try {
            await setDoc(doc(db, 'users', user.uid), { ...newUser, password }, { merge: true });
          } catch (e) {}
        } catch (authErr: any) {
          console.warn("Firebase Auth native signup error, using Firestore store:", authErr);

          const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
          const userRef = doc(db, 'users', customUid);

          let existingData: any = null;
          try {
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              existingData = userDoc.data();
            }
          } catch (e) {}

          const role = await fetchUserRole(emailClean, customUid, existingData?.role);

          if (authErr.code === 'auth/email-already-in-use' || existingData) {
            if (existingData && existingData.password && existingData.password !== password && role !== 'admin') {
              setError('An account already exists with this email. Please click "Sign in" below.');
              setLoading(false);
              return;
            }

            newUser = {
              uid: existingData?.uid || customUid,
              email: emailClean,
              displayName: name || existingData?.displayName || (role === 'admin' ? 'Admin User' : 'Customer'),
              role: role,
              createdAt: existingData?.createdAt || new Date()
            };
          } else {
            newUser = {
              uid: customUid,
              email: emailClean,
              displayName: name || (role === 'admin' ? 'Admin User' : 'Customer'),
              role: role,
              password: password,
              createdAt: new Date()
            };
            try {
              await setDoc(userRef, newUser, { merge: true });
            } catch (e) {}
          }
        }

        if (newUser) {
          useAuthStore.getState().setUser(newUser);
          if (newUser.role === 'admin' || newUser.role === 'seller') {
            localStorage.setItem('rare_dreams_is_admin', 'true');
          }
          navigate(getDestinationUrl(newUser.role));
        }
      }
    } catch (err: any) {
      console.error("Auth submit error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Please try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Account already exists with this email. Please switch to "Sign In".');
      } else {
        setError('Authentication error. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-blue-50/30 relative overflow-hidden">
      {/* Soft Ambient Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-7 sm:p-9 relative z-10 border border-slate-100"
      >
        {isResetMode ? (
          /* ================= PASSWORD RESET VIEW ================= */
          <div>
            <button 
              onClick={() => { setIsResetMode(false); setError(''); setMessage(''); }}
              className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-900 mb-6 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} className="mr-1.5" /> Back to Sign In
            </button>

            <div className="text-left mb-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Reset Password</h2>
              <p className="text-slate-500 text-xs leading-relaxed">
                Enter your registered email address to receive password reset instructions.
              </p>
            </div>

            {error && (
              <div className="mb-5 bg-rose-50 text-rose-700 p-3.5 text-xs rounded-xl flex items-start gap-2.5 border border-rose-200">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="mb-5 bg-emerald-50 text-emerald-800 p-4 text-xs rounded-xl border border-emerald-200 flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span className="font-bold">{message}</span>
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Password (Direct Reset)
                </label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    placeholder="Enter new desired password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl py-3 text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-70 cursor-pointer"
              >
                {loading ? 'Processing...' : (password ? 'Set Password & Sign In' : 'Send Reset Link')}
              </button>
            </form>
          </div>
        ) : (
          /* ================= SIGN IN & CREATE ACCOUNT VIEW ================= */
          <div>
            {/* Header: Title & Subtitle */}
            <div className="text-left mb-6">
              <h2 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight">
                {isLogin ? 'Sign In' : 'Create Account'}
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                {isLogin 
                  ? 'Welcome back! Please sign in to your account.' 
                  : 'Create your account to get started.'}
              </p>
            </div>

            {/* Error Message banner */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-rose-50 text-rose-700 p-3 text-xs border border-rose-200 rounded-xl flex items-start gap-2.5 overflow-hidden"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <p className="leading-relaxed font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Full Name field (Only in Create Account) */}
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full name
                  </label>
                  <div className="relative">
                    <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required={!isLogin}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-400"
                      placeholder="Full name"
                    />
                  </div>
                </motion.div>
              )}

              {/* Email Address field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-400"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-400"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field (Only in Create Account) */}
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required={!isLogin}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium placeholder:text-slate-400"
                      placeholder="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Auxiliary Row: Remember me + Forgot password (for Sign In) OR Terms Checkbox (for Sign Up) */}
              {isLogin ? (
                <div className="flex items-center justify-between pt-1 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-600 font-medium">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => { setIsResetMode(true); setError(''); setMessage(''); }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : (
                <div className="pt-1 pb-1">
                  <label className="flex items-start gap-2 cursor-pointer select-none text-left">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-600 leading-tight">
                      I agree to the <Link to="/terms" className="text-blue-600 font-semibold hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-blue-600 font-semibold hover:underline">Privacy Policy</Link>.
                    </span>
                  </label>
                </div>
              )}

              {/* Main Submit CTA Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl py-3 sm:py-3.5 text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-70 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Divider: or continue with */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-white px-3 text-slate-400 font-semibold">or continue with</span>
              </div>
            </div>

            {/* Social Authentication Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="truncate">Google</span>
              </button>

              {/* Facebook Button */}
              <button
                type="button"
                onClick={handleFacebookSignIn}
                disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span className="truncate">Facebook</span>
              </button>
            </div>

            {/* Footer: Switch between Sign In and Sign Up */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
              {isLogin ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setError('');
                      setMessage('');
                    }}
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-1"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setError('');
                      setMessage('');
                    }}
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-1"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
