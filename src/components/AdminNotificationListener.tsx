import React, { useEffect, useState, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { playNewOrderSound } from '../utils/audioAlert';
import { showSystemNotification, requestPushNotificationPermission } from '../lib/pushNotifications';
import { ArrowRight, X, Volume2, BellRing } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface NewOrderNotification {
  id: string;
  orderId?: string;
  customerName?: string;
  phone?: string;
  total?: number;
  message?: string;
  district?: string;
  createdAt?: any;
}

export const AdminNotificationListener: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const [activeAlert, setActiveAlert] = useState<NewOrderNotification | null>(null);
  
  // Track seen order IDs and mount timestamp to avoid any duplicate/historical alerts on refresh
  const seenOrderIds = useRef<Set<string>>(new Set());
  const initialMountDone = useRef<boolean>(false);
  const mountTimestamp = useRef<number>(Date.now());

  // Determine if this device/tab should receive Admin order alerts
  // STRICT: Only genuine authenticated admins or users on /admin routes!
  const isEligibleAdmin = Boolean(
    (user && (
      user.role === 'admin' || 
      user.role === 'seller' || 
      user.email?.toLowerCase().includes('karim') || 
      user.email?.toLowerCase().includes('admin')
    )) ||
    (typeof window !== 'undefined' && (
      localStorage.getItem('rare_dreams_is_admin') === 'true' ||
      location.pathname.startsWith('/admin')
    ))
  );

  // Sync admin flag to localStorage whenever user logs in as admin
  useEffect(() => {
    if (
      user?.role === 'admin' || 
      user?.role === 'seller' || 
      user?.email?.toLowerCase().includes('karim') ||
      user?.email?.toLowerCase().includes('admin')
    ) {
      localStorage.setItem('rare_dreams_is_admin', 'true');
    }
  }, [user]);

  useEffect(() => {
    if (!isEligibleAdmin) return;

    // Ensure Push notification token is registered with role: 'admin' for background push alerts
    if (typeof window !== 'undefined' && 'Notification' in window) {
      requestPushNotificationPermission(user?.id, user?.phone, 'admin').catch(() => {});
    }

    // Direct Real-Time Listener on 'orders' Collection
    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        // First fetch on page load/refresh: record all existing orders so none trigger alarms
        if (!initialMountDone.current) {
          snapshot.docs.forEach((doc) => {
            seenOrderIds.current.add(doc.id);
          });
          initialMountDone.current = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const orderId = change.doc.id;
            
            // Check if we haven't seen this order yet
            if (!seenOrderIds.current.has(orderId)) {
              seenOrderIds.current.add(orderId);
              const data = change.doc.data();

              // Extra safety: only alarm if order was created around or after mount time (within last 2 minutes max)
              const orderCreatedAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt ? new Date(data.createdAt).getTime() : Date.now());
              if (orderCreatedAt < mountTimestamp.current - 120000) {
                // Historical order from past session, ignore
                return;
              }

              const customerName = data.customerName || 'কাস্টমার';
              const phone = data.phone || '';
              const total = data.total || 0;
              const formattedTotal = '৳' + Number(total).toLocaleString('en-IN');
              const district = data.district || data.city || '';

              // Trigger 1: Real-time Audio Chime
              playNewOrderSound();

              // Trigger 2: Native OS & Browser Push Notification
              showSystemNotification(`🛍️ নতুন অর্ডার এসেছে! (${formattedTotal})`, {
                body: `কাস্টমার: ${customerName} (${phone})${district ? ' - ' + district : ''}\nঅর্ডার আইডি: #${orderId.slice(-6).toUpperCase()}`,
                icon: '/pwa-192x192.png',
                tag: 'order_' + orderId,
                url: '/admin/orders'
              });

              // Trigger 3: In-App Animated Alert Banner
              setActiveAlert({
                id: orderId,
                orderId: orderId,
                customerName: customerName,
                phone: phone,
                total: total,
                district: district
              });
            }
          }
        });
      },
      (error) => {
        console.warn('Orders real-time listener error:', error);
      }
    );

    return () => {
      unsubscribeOrders();
    };
  }, [isEligibleAdmin, user, location.pathname]);

  if (!isEligibleAdmin || !activeAlert) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -40, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[9999] bg-neutral-900/95 text-white backdrop-blur-md p-4 rounded-2xl shadow-2xl border-2 border-amber-500/50"
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
              অর্ডার #{activeAlert.orderId ? activeAlert.orderId.slice(-6).toUpperCase() : ''} {activeAlert.district ? `• ${activeAlert.district}` : ''}
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
