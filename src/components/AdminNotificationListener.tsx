import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { playNewOrderSound } from '../utils/audioAlert';
import { showSystemNotification, requestPushNotificationPermission } from '../lib/pushNotifications';
import { ShoppingBag, ArrowRight, X, Volume2, BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface NewOrderNotification {
  id: string;
  orderId?: string;
  customerName?: string;
  phone?: string;
  total?: number;
  message?: string;
  createdAt?: any;
}

export const AdminNotificationListener: React.FC = () => {
  const { user } = useAuthStore();
  const [activeAlert, setActiveAlert] = useState<NewOrderNotification | null>(null);
  const isInitialMount = useRef(true);
  const appStartTime = useRef(new Date());

  const isAdminOrSeller = Boolean(
    user && (user.role === 'admin' || user.role === 'seller' || user.email?.toLowerCase().trim() === 'xmrezaul.karim998@gmail.com')
  );

  useEffect(() => {
    if (!isAdminOrSeller) return;

    // Ask for browser notification permission on admin entry if not asked
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestPushNotificationPermission(user?.id, user?.phone, 'admin');
    }

    // Real-time listener on new_order notifications
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('type', '==', 'new_order'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      notifsQuery,
      (snapshot) => {
        // Skip historical notifications on first snapshot mount
        if (isInitialMount.current) {
          isInitialMount.current = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

            // Only trigger if order came in after or around app start time
            if (createdAtDate.getTime() >= appStartTime.current.getTime() - 10000) {
              const orderId = data.orderId || change.doc.id;
              const customerName = data.customerName || 'কাস্টমার';
              const formattedTotal = '৳' + Number(data.total || 0).toLocaleString('en-IN');

              // 1. Play real-time chime sound
              playNewOrderSound();

              // 2. Trigger native OS / browser notification
              showSystemNotification(`🛍️ নতুন অর্ডার এসেছে! (${formattedTotal})`, {
                body: `কাস্টমার: ${customerName} (${data.phone || ''})\nঅর্ডার আইডি: #${orderId.slice(-6)}`,
                icon: '/pwa-192x192.png',
                tag: 'order_' + orderId,
                url: `/admin/orders`
              });

              // 3. Show in-app banner
              setActiveAlert({
                id: change.doc.id,
                orderId: orderId,
                customerName: customerName,
                phone: data.phone,
                total: data.total,
                message: data.message
              });
            }
          }
        });
      },
      (error) => {
        console.warn('Admin new order notification listener error:', error);
      }
    );

    return () => unsubscribe();
  }, [isAdminOrSeller, user]);

  if (!isAdminOrSeller || !activeAlert) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[1100] bg-neutral-900/95 text-white backdrop-blur-md p-4 rounded-2xl shadow-2xl border-2 border-amber-500/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center shrink-0 font-bold shadow-md animate-pulse">
            <BellRing size={22} className="animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-amber-400 text-neutral-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                নতুন অর্ডার
              </span>
              <span className="text-xs font-bold text-amber-300">
                {activeAlert.total ? '৳' + Number(activeAlert.total).toLocaleString('en-IN') : ''}
              </span>
            </div>
            <h4 className="text-sm font-black text-white mt-1 truncate">
              {activeAlert.customerName} {activeAlert.phone ? `(${activeAlert.phone})` : ''}
            </h4>
            <p className="text-xs text-neutral-300 mt-0.5">
              অর্ডার #{activeAlert.orderId ? activeAlert.orderId.slice(-6) : ''} এখনই রিভিউ করুন
            </p>
          </div>
          <button
            onClick={() => setActiveAlert(null)}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close alert"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-center justify-between gap-2">
          <button
            onClick={() => playNewOrderSound()}
            className="text-[11px] text-neutral-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
            title="সাউন্ড শুনুন"
          >
            <Volume2 size={13} /> টেস্ট সাউন্ড
          </button>
          <Link
            to="/admin/orders"
            onClick={() => setActiveAlert(null)}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-xl font-bold text-xs flex items-center gap-1 transition-all shadow-xs cursor-pointer"
          >
            <span>অর্ডারে যান</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AdminNotificationListener;
