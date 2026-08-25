import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, CheckCircle2, RotateCw } from 'lucide-react';
import { useCategoryStore } from '../store/useCategoryStore';
import { useStoreConfigStore } from '../store/useStoreConfigStore';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
}

const PULL_THRESHOLD = 75; // px to trigger refresh
const MAX_PULL = 110;

export default function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const isThresholdCrossedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { fetchCategories } = useCategoryStore();
  const { fetchConfig } = useStoreConfigStore();

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull-to-refresh if we are at the very top of the page
    if (window.scrollY <= 0 && !isRefreshing) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
      isThresholdCrossedRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshing) return;

    // If user has scrolled down, cancel pull
    if (window.scrollY > 0) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const rawDelta = currentY - startYRef.current;

    if (rawDelta > 0) {
      // Apply elastic damping curve
      const damped = Math.min(MAX_PULL, Math.pow(rawDelta, 0.82) * 2.2);
      setPullDistance(damped);

      // Trigger subtle haptic when crossing threshold
      if (damped >= PULL_THRESHOLD && !isThresholdCrossedRef.current) {
        isThresholdCrossedRef.current = true;
        try {
          if (navigator.vibrate) {
            navigator.vibrate(15);
          }
        } catch {
          // ignore if not supported
        }
      } else if (damped < PULL_THRESHOLD && isThresholdCrossedRef.current) {
        isThresholdCrossedRef.current = false;
      }
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(56); // Hold at active spinner height

      try {
        if (onRefresh) {
          await onRefresh();
        } else {
          // Default store revalidations
          await Promise.all([
            fetchCategories(),
            fetchConfig(),
            new Promise((r) => setTimeout(r, 900)),
          ]);
        }

        setRefreshSuccess(true);
        try {
          if (navigator.vibrate) {
            navigator.vibrate(25);
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        console.warn('Pull refresh error:', err);
      } finally {
        setRefreshSuccess(false);
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Animate back to 0
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full min-h-screen"
    >
      {/* PULL REFRESH FLOATING INDICATOR */}
      <AnimatePresence>
        {(pullDistance > 10 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{
              opacity: 1,
              y: isRefreshing ? 14 : Math.max(8, pullDistance * 0.45),
            }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.25 } }}
            className="fixed top-14 left-0 right-0 z-40 flex justify-center items-center pointer-events-none px-4"
          >
            <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_8px_30px_rgba(0,82,212,0.18)] border border-blue-100 flex items-center gap-2.5 transition-all">
              
              {/* Spinner / Icon */}
              <div className="relative w-6 h-6 flex items-center justify-center">
                {refreshSuccess ? (
                  <CheckCircle2 size={20} className="text-emerald-600 animate-in zoom-in-75 duration-200" />
                ) : isRefreshing ? (
                  <Loader2 size={19} className="text-[#0052D4] animate-spin" />
                ) : (
                  <motion.div
                    style={{ rotate: progress * 360 }}
                    className="flex items-center justify-center text-[#0052D4]"
                  >
                    <RotateCw size={18} strokeWidth={2.4} />
                  </motion.div>
                )}
              </div>

              {/* Status Label */}
              <span className="text-xs font-black tracking-tight text-neutral-800">
                {refreshSuccess ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    রিফ্রেশ সম্পন্ন হয়েছে!
                  </span>
                ) : isRefreshing ? (
                  <span className="text-[#0052D4] flex items-center gap-1">
                    রিফ্রেশ হচ্ছে...
                  </span>
                ) : progress >= 1 ? (
                  <span className="text-[#0052D4]">ছেড়ে দিন রিফ্রেশ করতে</span>
                ) : (
                  <span className="text-neutral-500">নিচে টেনে রিফ্রেশ করুন</span>
                )}
              </span>

              {/* Subtle Sparkle */}
              <Sparkles size={13} className="text-blue-500 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children Content with subtle translateY while dragging */}
      <motion.div
        animate={{
          y: isRefreshing ? 12 : Math.min(24, pullDistance * 0.18),
        }}
        transition={{
          type: 'spring',
          damping: 24,
          stiffness: 280,
          mass: 0.8,
        }}
        className="w-full flex-grow flex flex-col"
      >
        {children}
      </motion.div>
    </div>
  );
}
