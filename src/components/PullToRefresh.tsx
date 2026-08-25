import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, CheckCircle2, RotateCw } from 'lucide-react';
import { useCategoryStore } from '../store/useCategoryStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
}

const PULL_THRESHOLD = 75; // px required to trigger
const MAX_PULL = 100;

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const location = useLocation();

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { fetchCategories } = useCategoryStore();
  const { fetchConfig } = useStoreConfigStore();

  // Keep ref in sync with state
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  // Always reset on route navigation
  useEffect(() => {
    isPullingRef.current = false;
    pullDistRef.current = 0;
    setPullDistance(0);
    setIsRefreshing(false);
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
    setRefreshSuccess(false);
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
  };

  // Listen to window scroll to immediately cancel pull if user scrolls down
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 5 && !isRefreshingRef.current && isPullingRef.current) {
        forceReset();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Native Non-Passive Touch Handlers on the element
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 2 && !isRefreshingRef.current) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshingRef.current) return;

      if (window.scrollY > 2) {
        isPullingRef.current = false;
        pullDistRef.current = 0;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const rawDelta = currentY - startYRef.current;

      if (rawDelta > 0) {
        // Prevent native Chrome pull-to-refresh & black spinner from firing!
        if (e.cancelable) {
          e.preventDefault();
        }

        // Apply smooth resistance damping
        const damped = Math.min(MAX_PULL, Math.pow(rawDelta, 0.8) * 2.1);
        pullDistRef.current = damped;
        setPullDistance(damped);
      } else {
        pullDistRef.current = 0;
        setPullDistance(0);
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

        // 3-second safety timer: NEVER stays stuck
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = setTimeout(() => {
          forceReset();
        }, 3500);

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Re-fetch stores & delay slightly for smooth animation
            await Promise.allSettled([
              fetchCategories(),
              fetchConfig(),
              new Promise((r) => setTimeout(r, 800)),
            ]);
          }

          setRefreshSuccess(true);
          await new Promise((r) => setTimeout(r, 600));
        } catch (err) {
          console.warn('Pull-to-refresh error:', err);
        } finally {
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
  }, [onRefresh, fetchCategories, fetchConfig]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div ref={containerRef} className="relative w-full min-h-screen">
      {/* PULL REFRESH FLOATING BADGE */}
      <AnimatePresence>
        {(pullDistance > 8 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: isRefreshing ? 12 : Math.max(6, pullDistance * 0.4),
              scale: 1,
            }}
            exit={{ opacity: 0, y: -24, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed top-14 left-0 right-0 z-40 flex justify-center items-center pointer-events-none px-4"
          >
            <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_8px_30px_rgba(0,82,212,0.18)] border border-blue-100/90 flex items-center gap-2.5 transition-all">
              
              {/* Spinner / Status icon */}
              <div className="relative w-5 h-5 flex items-center justify-center">
                {refreshSuccess ? (
                  <CheckCircle2 size={19} className="text-emerald-600 animate-in zoom-in-75 duration-200" />
                ) : isRefreshing ? (
                  <Loader2 size={18} className="text-[#0052D4] animate-spin" />
                ) : (
                  <motion.div
                    style={{ rotate: progress * 360 }}
                    className="flex items-center justify-center text-[#0052D4]"
                  >
                    <RotateCw size={17} strokeWidth={2.4} />
                  </motion.div>
                )}
              </div>

              {/* Dynamic Label */}
              <span className="text-xs font-black tracking-tight text-neutral-800">
                {refreshSuccess ? (
                  <span className="text-emerald-700 font-bold">
                    রিফ্রেশ সম্পন্ন হয়েছে!
                  </span>
                ) : isRefreshing ? (
                  <span className="text-[#0052D4]">
                    রিফ্রেশ হচ্ছে...
                  </span>
                ) : progress >= 1 ? (
                  <span className="text-[#0052D4]">ছেড়ে দিন রিফ্রেশ করতে</span>
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

      {/* Children Content */}
      <motion.div
        animate={{
          y: isRefreshing ? 8 : Math.min(18, pullDistance * 0.16),
        }}
        transition={{
          type: 'spring',
          damping: 26,
          stiffness: 300,
          mass: 0.7,
        }}
        className="w-full flex-grow flex flex-col"
      >
        {children}
      </motion.div>
    </div>
  );
}
