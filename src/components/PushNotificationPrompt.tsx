import React, { useState, useEffect } from 'react';
import { Bell, X, Check, ShieldCheck } from 'lucide-react';
import { requestPushNotificationPermission } from '../lib/pushNotifications';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { motion, AnimatePresence } from 'motion/react';

export const PushNotificationPrompt: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    // Check if notifications are supported and not previously dismissed
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      // Refresh token quietly in background
      requestPushNotificationPermission(user?.id, user?.phone, user?.role);
      return;
    }

    if (Notification.permission === 'denied') return;

    const dismissed = localStorage.getItem('rare_dreams_push_dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Don't show again for 7 days if dismissed
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Show banner after 3 seconds of browsing
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const token = await requestPushNotificationPermission(user?.id, user?.phone, user?.role);
      if (token) {
        setGranted(true);
        setTimeout(() => {
          setShowPrompt(false);
        }, 2000);
      } else {
        setShowPrompt(false);
      }
    } catch (e) {
      console.warn('Notification prompt error:', e);
      setShowPrompt(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('rare_dreams_push_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-neutral-900/95 text-white backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-neutral-700/60"
        id="push-notification-banner"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            {granted ? <Check className="w-5 h-5 text-emerald-400" /> : <Bell className="w-5 h-5 animate-bounce" />}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
              {language === 'bn' ? 'অর্ডার ও অফার নোটিফিকেশন' : 'Order & Discount Alerts'}
              <span className="text-[10px] bg-amber-500/30 text-amber-300 font-bold px-1.5 py-0.5 rounded">লাইভ</span>
            </h4>
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
              {granted
                ? (language === 'bn' ? 'নোটিফিকেশন সফলভাবে চালু হয়েছে!' : 'Notification enabled successfully!')
                : (language === 'bn'
                  ? 'ব্রাউজার বন্ধ থাকলেও আপনার অর্ডারের ডেলিভারি স্ট্যাটাস ও স্পেশাল ডিসকাউন্ট সরাসরি স্ক্রিনে পান।'
                  : 'Get instant order tracking and secret flash sale alerts even when the browser is closed.')}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!granted && (
          <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              onClick={handleDismiss}
              className="text-xs font-semibold text-neutral-400 hover:text-neutral-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {language === 'bn' ? 'পরে' : 'Later'}
            </button>
            <button
              onClick={handleEnable}
              disabled={loading}
              className="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 px-4 py-1.5 rounded-lg transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>চালু হচ্ছে...</span>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>{language === 'bn' ? 'চালু করুন' : 'Enable Alerts'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default PushNotificationPrompt;
