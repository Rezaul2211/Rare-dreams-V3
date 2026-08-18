import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Check, X, Share, PlusSquare, ArrowUpRight } from 'lucide-react';
import { useLanguageStore } from '../store/useLanguageStore';
import { motion, AnimatePresence } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallAppBanner: React.FC = () => {
  const { language } = useLanguageStore();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already running as standalone app / installed
    const isApp = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true;
    if (isApp) {
      setIsStandalone(true);
      return;
    }

    // Detect iOS (Safari / WebKit)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Capture standard PWA install prompt (Chrome, Edge, Samsung Internet, Firefox on Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      const dismissed = localStorage.getItem('rare_dreams_pwa_dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed, 10) > 3 * 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Track app installed event
    const handleAppInstalled = () => {
      setInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem('rare_dreams_pwa_installed', 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // For iOS users, show helpful subtle install banner if not dismissed
    if (isIosDevice && !isApp) {
      const dismissed = localStorage.getItem('rare_dreams_pwa_dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed, 10) > 3 * 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => setShowBanner(true), 2500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Chrome / Edge / Samsung Internet
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          setShowBanner(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    } else if (isIOS) {
      // Show guided modal for Safari
      setShowIOSInstructions(true);
    } else {
      // Generic fallback (e.g. Chrome desktop / Opera)
      alert(language === 'bn' 
        ? 'ব্রাউজারের ৩ ডট মেনু (⋮) তে ক্লিক করে "Add to Home screen" বা "Install App" সিলেক্ট করুন।' 
        : 'Click on browser menu (⋮) and choose "Add to Home screen" or "Install App".'
      );
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('rare_dreams_pwa_dismissed', Date.now().toString());
    setShowBanner(false);
  };

  if (isStandalone || installed || !showBanner) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-neutral-950 text-white px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-lg border-b border-neutral-800 z-40 relative"
          id="pwa-install-header-banner"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-neutral-950 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                RD
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-2">
                  <span>{language === 'bn' ? 'Rare Dreams অ্যাপ ইনস্টল করুন' : 'Install Rare Dreams App'}</span>
                  <span className="hidden sm:inline-block text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                    Fast & Offline
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate hidden xs:block">
                  {language === 'bn' 
                    ? 'হোম স্ক্রিন থেকে ১-ট্যাপে সরাসরি শপিং করুন ও অফার পান' 
                    : 'Add to home screen for 1-tap fast access and live alerts'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Download size={14} className="stroke-[2.5]" />
                <span>{language === 'bn' ? 'ইনস্টল' : 'Install'}</span>
              </button>
              <button
                onClick={handleDismiss}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
                aria-label="Close banner"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* iOS Safari Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white text-neutral-900 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                <span>{language === 'bn' ? 'হোম স্ক্রিনে অ্যাপ যুক্ত করুন (iPhone)' : 'Add to Home Screen (iOS)'}</span>
              </h3>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="p-1 rounded-full text-neutral-400 hover:bg-neutral-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-700">
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                <div>
                  ব্রাউজারের নিচের <strong>Share বাটনে</strong> (<Share className="w-3.5 h-3.5 inline mx-1" />) চাপ দিন।
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                <div>
                  মেনু স্ক্রল করে <strong>"Add to Home Screen"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-1" />) অপশনটি নির্বাচন করুন।
                </div>
              </div>
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                <div>
                  উপরে ডানপাশে <strong>"Add"</strong> বাটনে ক্লিক করলেই অ্যাপটি সরাসরি আপনার ফোনের হোম স্ক্রিনে ইনস্টল হয়ে যাবে!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full py-3 rounded-2xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition-colors"
            >
              {language === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppBanner;
