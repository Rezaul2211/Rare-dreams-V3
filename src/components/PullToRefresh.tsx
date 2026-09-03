import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, CheckCircle2, RotateCw } from 'lucide-react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
}

const PULL_THRESHOLD = 75; // px required to trigger reload
const MAX_PULL = 110;

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [showPostReloadSuccess, setShowPostReloadSuccess] = useState(false);
  const location = useLocation();

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if page just reloaded from a pull-to-refresh
  useEffect(() => {
    try {
      if (sessionStorage.getItem('rd_just_refreshed') === 'true') {
        sessionStorage.removeItem('rd_just_refreshed');
        setShowPostReloadSuccess(true);
        const timer = setTimeout(() => {
          setShowPostReloadSuccess(false);
        }, 1800);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  // Always reset on route navigation
  useEffect(() => {
    isPullingRef.current = false;
    pullDistRef.current = 0;
    setPullDistance(0);
    setIsRefreshing(false);
    isRefreshingRef.current = false;
    setRefreshSuccess(false);
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
  }, [location.pathname]);

  // Reset helper
  const forceReset = () => {
    isPullingRef.current = false;
    pullDistRef.current = 0;
    setPullDistance(0);
    setIsRefreshing(false);
    isRefreshingRef.current = false;
    setRefreshSuccess(false);
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
  };

  // Cancel pull if user scrolls down
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 5 && !isRefreshingRef.current && isPullingRef.current) {
        forceReset();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Native Touch Handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only initiate pull when at the exact top of the viewport
      if ((window.scrollY || document.documentElement.scrollTop || 0) <= 0 && !isRefreshingRef.current) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshingRef.current) return;

      const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
      if (currentScroll > 0) {
        isPullingRef.current = false;
        pullDistRef.current = 0;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      // If user is swiping UP to scroll down the page, immediately release pull-to-refresh
      if (rawDelta <= 0) {
        isPullingRef.current = false;
        pullDistRef.current = 0;
        setPullDistance(0);
        return;
      }

      // Only engage if pulling downwards with significant intentional distance
      if (rawDelta > 15) {
        if (e.cancelable) {
          e.preventDefault();
        }

        const damped = Math.min(MAX_PULL, Math.pow(rawDelta - 15, 0.8) * 2.1);
        pullDistRef.current = damped;
        setPullDistance(damped);
      }
    };

    const onTouchEnd = async () => {
      if (!isPullingRef.current || isRefreshingRef.current) return;
      isPullingRef.current = false;

      const currentDist = pullDistRef.current;
      if (currentDist >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        isRefreshingRef.current = true;
        setPullDistance(52); // lock at spinner position

        // Haptic feedback
        try {
          if (navigator.vibrate) {
            navigator.vibrate([20, 40, 20]);
          }
        } catch {
          // ignore
        }

        // Perform actual real reload!
        try {
          if (onRefresh) {
            await onRefresh();
            setRefreshSuccess(true);
            await new Promise((r) => setTimeout(r, 500));
            forceReset();
          } else {
            // Real Full Browser Reload (clears inputs, re-fetches images & products, resets state completely)
            sessionStorage.setItem('rd_just_refreshed', 'true');
            // Brief visual animation before reload
            await new Promise((r) => setTimeout(r, 450));
            window.location.reload();
          }
        } catch (err) {
          console.warn('Pull-to-refresh reload error:', err);
          forceReset();
        }
      } else {
        pullDistRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchCancel = () => {
      if (!isRefreshingRef.current) {
        forceReset();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [onRefresh]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div ref={containerRef} className="relative w-full min-h-screen">
      {/* PULL REFRESH FLOATING BADGE (DURING PULL / RELOAD) */}
      <AnimatePresence>
        {(pullDistance > 8 || isRefreshing || showPostReloadSuccess) && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: isRefreshing || showPostReloadSuccess ? 12 : Math.max(6, pullDistance * 0.4),
              scale: 1,
            }}
            exit={{ opacity: 0, y: -24, scale: 0.9, transition: { duration: 0.25 } }}
            className="fixed top-14 left-0 right-0 z-50 flex justify-center items-center pointer-events-none px-4"
          >
            <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_8px_30px_rgba(0,82,212,0.18)] border border-blue-100 flex items-center gap-2.5 transition-all">
              
              {/* Spinner / Status icon */}
              <div className="relative w-5 h-5 flex items-center justify-center">
                {showPostReloadSuccess || refreshSuccess ? (
                  <CheckCircle2 size={19} className="text-emerald-600 animate-in zoom-in-75 duration-200" />
                ) : isRefreshing ? (
                  <Loader2 size={18} className="text-[#0052D4] animate-spin" />
                ) : (
                  <div
                    style={{ transform: `rotate(${progress * 360}deg)` }}
                    className="flex items-center justify-center text-[#0052D4]"
                  >
                    <RotateCw size={17} strokeWidth={2.4} />
                  </div>
                )}
              </div>

              {/* Dynamic Label */}
              <span className="text-xs font-black tracking-tight text-neutral-800">
                {showPostReloadSuccess || refreshSuccess ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    রিফ্রেশ সম্পন্ন হয়েছে!
                  </span>
                ) : isRefreshing ? (
                  <span className="text-[#0052D4] flex items-center gap-1">
                    পেজ রিলোড হচ্ছে...
                  </span>
                ) : progress >= 1 ? (
                  <span className="text-[#0052D4]">ছেড়ে দিন রিলোড করতে</span>
                ) : (
                  <span className="text-neutral-500">নিচে টেনে রিফ্রেশ করুন</span>
                )}
              </span>

              {/* Sparkle icon */}
              <Sparkles size={12} className="text-blue-500 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children Content without layout-thrashing motion wrappers */}
      <div className="w-full flex-grow flex flex-col">
        {children}
      </div>
    </div>
  );
}
