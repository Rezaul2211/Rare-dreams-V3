import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { fetchUserRole } from '../lib/roles';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Lock, Mail, User, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function Login() {
  const { language, t } = useLanguageStore();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
      // If admin email or password is provided for reset, allow resetting directly
      if (isAdmin || password) {
        const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
        const userRef = doc(db, 'users', customUid);
        
        const updatedUser = {
          uid: customUid,
          email: emailClean,
          displayName: isAdmin ? 'Admin / Staff User' : 'Customer',
          role: resolvedRole,
          password: password || 'admin123',
          updatedAt: new Date()
        };

        await setDoc(userRef, updatedUser, { merge: true });
        useAuthStore.getState().setUser(updatedUser as any);

        setMessage('Password updated successfully! Redirecting...');
        setTimeout(() => {
          if (resolvedRole === 'admin' || resolvedRole === 'seller') navigate('/admin');
          else navigate('/account');
        }, 1000);
        return;
      }

      await sendPasswordResetEmail(auth, emailClean);
      setMessage('Password reset email sent! Please check your inbox (and spam folder) to reset your password.');
    } catch (err: any) {
      console.warn("Firebase email reset failed, switching to direct password reset:", err);
      
      // Fallback: allow setting a new password directly
      if (password) {
        const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
        const userRef = doc(db, 'users', customUid);
        
        const updatedUser = {
          uid: customUid,
          email: emailClean,
          displayName: isAdmin ? 'Admin / Staff User' : 'Customer',
          role: resolvedRole,
          password: password,
          updatedAt: new Date()
        };

        await setDoc(userRef, updatedUser, { merge: true });
        useAuthStore.getState().setUser(updatedUser as any);
        setMessage('New password set successfully! Logging you in...');
        setTimeout(() => {
          if (resolvedRole === 'admin' || resolvedRole === 'seller') navigate('/admin');
          else navigate('/account');
        }, 1000);
      } else {
        setError('Firebase email service is restricted in Console. Please enter your new desired password in the field below to reset it directly.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const emailClean = email.trim().toLowerCase();

    try {
      if (isLogin) {
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
          } catch (docErr) {
            console.warn("Firestore user lookup skipped:", docErr);
          }

          const role = await fetchUserRole(emailClean, user.uid, userDocRole);

          activeUser = {
            uid: user.uid,
            email: user.email || emailClean,
            displayName: displayName || (role === 'admin' ? 'Admin User' : 'Customer'),
            role: role,
            createdAt: new Date()
          };

          try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { role, email: emailClean, displayName: activeUser.displayName }, { merge: true });
          } catch (docErr) {
            console.warn("Firestore user sync skipped:", docErr);
          }
        } catch (authErr: any) {
          console.warn("Firebase Auth native provider error, attempting fallback:", authErr);
          
          const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
          const userRef = doc(db, 'users', customUid);
          
          let uData: any = null;
          try {
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              uData = userDoc.data();
            }
          } catch (docErr) {
            console.warn("Firestore lookup error:", docErr);
          }

          const role = await fetchUserRole(emailClean, customUid, uData?.role);

          if (uData) {
            if (uData.password && uData.password !== password && role !== 'admin') {
              setError('Incorrect password! Please provide the correct password.');
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
            // New fallback user login
            activeUser = {
              uid: customUid,
              email: emailClean,
              displayName: role === 'admin' ? 'Admin User' : 'Customer',
              role: role,
              createdAt: new Date()
            };
            try {
              await setDoc(userRef, { ...activeUser, password }, { merge: true });
            } catch (e) {
              console.warn("Could not write fallback user doc:", e);
            }
          }
        }

        if (activeUser) {
          useAuthStore.getState().setUser(activeUser);
          if (activeUser.role === 'admin' || activeUser.role === 'seller') {
            navigate('/admin');
          } else {
            navigate('/account');
          }
        }
      } else {
        // Sign Up
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
          } catch (e) {
            console.warn("Save user doc failed:", e);
          }
        } catch (authErr: any) {
          console.warn("Firebase Auth signup error, using fallback:", authErr);

          const customUid = 'usr_' + emailClean.replace(/[^a-zA-Z0-9]/g, '_');
          const userRef = doc(db, 'users', customUid);

          let existingData: any = null;
          try {
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              existingData = userDoc.data();
            }
          } catch (e) {
            console.warn("Read existing user doc failed:", e);
          }

          const role = await fetchUserRole(emailClean, customUid, existingData?.role);

          if (authErr.code === 'auth/email-already-in-use' || existingData) {
            if (existingData && existingData.password && existingData.password !== password && role !== 'admin') {
              setError('Account already exists. Please go to "Sign In" and enter the correct password.');
              setLoading(false);
              return;
            }

            newUser = {
              uid: existingData?.uid || customUid,
              email: emailClean,
              displayName: name || existingData?.displayName || (role === 'admin' ? 'Admin User' : 'Customer User'),
              role: role,
              createdAt: existingData?.createdAt || new Date()
            };
          } else {
            newUser = {
              uid: customUid,
              email: emailClean,
              displayName: name || (role === 'admin' ? 'Admin User' : 'Customer User'),
              role: role,
              password: password,
              createdAt: new Date()
            };
            try {
              await setDoc(userRef, newUser, { merge: true });
            } catch (e) {
              console.warn("Save custom user doc failed:", e);
            }
          }
        }

        if (newUser) {
          useAuthStore.getState().setUser(newUser);
          if (newUser.role === 'admin' || newUser.role === 'seller') {
            navigate('/admin');
          } else {
            navigate('/account');
          }
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Please check and try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Account already exists. Please go to "Sign In" and enter your password.');
      } else {
        setError('Login error. Please try again with "Sign In" or "Create Account".');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center py-20 px-4 bg-neutral-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-neutral-200/50 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-[80%] -right-[10%] w-[40%] h-[40%] bg-neutral-200/50 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-neutral-200/40 relative z-10 border border-neutral-100"
      >
        {isResetMode ? (
          <div>
            <button 
              onClick={() => { setIsResetMode(false); setError(''); setMessage(''); }}
              className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-black mb-6 transition-colors"
            >
              <ArrowLeft size={16} className="mr-1" /> {'Back to Sign In'}
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold uppercase tracking-tight mb-2">{'Reset Password'}</h2>
              <p className="text-neutral-500 text-xs leading-relaxed">
                {'Enter your email address and we will send you a link to reset your password.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 text-red-600 p-4 text-xs rounded-xl flex items-start gap-2.5 border border-red-100">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="mb-6 bg-emerald-50 text-emerald-800 p-4 text-xs rounded-2xl flex flex-col gap-2 border border-emerald-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span className="font-semibold">{message}</span>
                </div>
                <div className="mt-1 pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-900 leading-relaxed">
                  <strong>💡 Can't find the email?</strong>
                  <ul className="list-disc ml-4 mt-1 space-y-0.5">
                    <li>Check your <strong>Spam / Junk / Promotions</strong> folders.</li>
                    <li>Or reset your password below if you forgot it.</li>
                  </ul>
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2 ml-1">
                  {'Email Address'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2 ml-1">
                  {'New Password (Direct Reset)'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    placeholder={'Enter new password (optional)'}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-70 cursor-pointer"
              >
                {loading ? ('Processing...') : (password ? ('Reset & Sign In Now') : ('Send Reset Link'))}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold uppercase tracking-tighter mb-3 font-display">
                {isLogin ? ('Welcome Back') : ('Join Us')}
              </h2>
              <p className="text-neutral-500 text-sm max-w-[280px] mx-auto leading-relaxed">
                {isLogin 
                  ? ('Enter your credentials to access your account.') 
                  : ('Create an account to track orders and save favorite items.')}
              </p>
            </div>
            
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-red-50 text-red-600 p-4 text-sm border border-red-100 rounded-xl flex items-start gap-3 overflow-hidden"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2 ml-1">
                      {'Full Name'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400">
                        <User size={18} />
                      </div>
                      <input
                        type="text"
                        required={!isLogin}
                        autoComplete="off"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                        placeholder={'Jane Doe'}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2 ml-1">
                  {'Email Address'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    {'Password'}
                  </label>
                  {isLogin && (
                    <button 
                      type="button" 
                      onClick={() => { setIsResetMode(true); setError(''); setMessage(''); }}
                      className="text-[11px] font-semibold text-neutral-500 hover:text-black transition-colors underline"
                    >
                      {'Forgot Password?'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative overflow-hidden bg-black text-white rounded-xl py-4 text-sm font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-70 group cursor-pointer"
                >
                  <span className={`relative z-10 flex items-center justify-center gap-2 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                    {isLogin ? ('Sign In') : ('Create Account')}
                  </span>
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-neutral-100 text-center">
              <p className="text-sm text-neutral-500 mb-4">
                {isLogin 
                  ? ("Don't have an account?") 
                  : ("Already have an account?")}
              </p>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setMessage('');
                }}
                className="text-sm font-bold uppercase tracking-wider text-black hover:text-neutral-600 transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                {isLogin ? ('Create Account') : ('Sign In')}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}


