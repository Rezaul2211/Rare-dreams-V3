import { create } from 'zustand';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { PriceAlert, UserNotification } from '../types';

interface PriceAlertState {
  alerts: PriceAlert[];
  notifications: UserNotification[];
  loading: boolean;
  unreadNotificationsCount: number;
  
  // Actions
  fetchUserAlerts: (userId?: string, email?: string) => Promise<void>;
  fetchUserNotifications: (userId?: string, email?: string) => Promise<void>;
  subscribeToPriceDrop: (params: {
    productId: string;
    productName: string;
    productImage?: string;
    initialPrice: number;
    targetPrice?: number;
    userEmail?: string;
    userPhone?: string;
    userId?: string;
    notificationChannels?: ('email' | 'sms' | 'in_app')[];
  }) => Promise<{ success: boolean; alertId?: string; message: string }>;
  unsubscribeFromPriceDrop: (alertId: string) => Promise<boolean>;
  togglePriceDropAlert: (product: {
    id: string;
    name: string;
    price: number;
    images?: string[];
  }) => Promise<{ subscribed: boolean; message: string }>;
  isProductSubscribed: (productId: string) => boolean;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
}

export const usePriceAlertStore = create<PriceAlertState>((set, get) => ({
  alerts: [],
  notifications: [],
  loading: false,
  unreadNotificationsCount: 0,

  fetchUserAlerts: async (userId?: string, email?: string) => {
    set({ loading: true });
    try {
      const currentUid = userId || auth.currentUser?.uid;
      const currentEmail = email || auth.currentUser?.email;

      let alertsData: PriceAlert[] = [];

      if (currentUid) {
        const q = query(
          collection(db, 'price_alerts'),
          where('userId', '==', currentUid)
        );
        const snapshot = await getDocs(q);
        alertsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PriceAlert));
      } else if (currentEmail) {
        const q = query(
          collection(db, 'price_alerts'),
          where('userEmail', '==', currentEmail)
        );
        const snapshot = await getDocs(q);
        alertsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PriceAlert));
      }

      // Also check local storage for guest alert subscriptions
      const localAlertsRaw = localStorage.getItem('rare_dreams_guest_price_alerts');
      if (localAlertsRaw) {
        try {
          const localAlerts: PriceAlert[] = JSON.parse(localAlertsRaw);
          const combined = [...alertsData];
          localAlerts.forEach(la => {
            if (!combined.some(a => a.id === la.id || (a.productId === la.productId && a.status === 'active'))) {
              combined.push(la);
            }
          });
          alertsData = combined;
        } catch (e) {
          console.warn('Error reading local alerts', e);
        }
      }

      set({ alerts: alertsData });
    } catch (error) {
      console.error('Error fetching user price alerts:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchUserNotifications: async (userId?: string, email?: string) => {
    try {
      const currentUid = userId || auth.currentUser?.uid;
      const currentEmail = email || auth.currentUser?.email;

      let notifs: UserNotification[] = [];

      if (currentUid) {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', currentUid)
        );
        const snapshot = await getDocs(q);
        notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserNotification));
      } else if (currentEmail) {
        const q = query(
          collection(db, 'notifications'),
          where('userEmail', '==', currentEmail)
        );
        const snapshot = await getDocs(q);
        notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserNotification));
      }

      // Sort newest first
      notifs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      const unread = notifs.filter(n => !n.read).length;
      set({ notifications: notifs, unreadNotificationsCount: unread });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  },

  subscribeToPriceDrop: async (params) => {
    try {
      const currentUid = params.userId || auth.currentUser?.uid || null;
      const email = params.userEmail || auth.currentUser?.email || '';
      const phone = params.userPhone || '';

      if (!email && !phone) {
        return { success: false, message: 'Please provide an email or phone number for notification alerts.' };
      }

      const alertPayload = {
        productId: params.productId,
        productName: params.productName,
        productImage: params.productImage || '',
        initialPrice: Number(params.initialPrice),
        targetPrice: params.targetPrice ? Number(params.targetPrice) : Number(params.initialPrice),
        currentPrice: Number(params.initialPrice),
        userEmail: email,
        userPhone: phone,
        userId: currentUid,
        status: 'active',
        notificationChannels: params.notificationChannels || ['email', 'in_app'],
        createdAt: serverTimestamp(),
      };

      // Write to Firestore
      const docRef = await addDoc(collection(db, 'price_alerts'), alertPayload);
      const newAlert: PriceAlert = {
        id: docRef.id,
        ...alertPayload,
        createdAt: new Date().toISOString()
      } as PriceAlert;

      // Update state
      set(state => {
        const existingFiltered = state.alerts.filter(a => a.productId !== params.productId);
        return { alerts: [newAlert, ...existingFiltered] };
      });

      // Save to localStorage for instant UI persistence
      try {
        const localAlertsRaw = localStorage.getItem('rare_dreams_guest_price_alerts');
        const localList = localAlertsRaw ? JSON.parse(localAlertsRaw) : [];
        const updatedList = [newAlert, ...localList.filter((a: any) => a.productId !== params.productId)];
        localStorage.setItem('rare_dreams_guest_price_alerts', JSON.stringify(updatedList));
      } catch (e) {
        console.warn('Could not save to local storage', e);
      }

      // Also call server backend helper to register listener
      try {
        await fetch('/api/price-alerts/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alertId: docRef.id,
            ...alertPayload
          })
        });
      } catch (e) {
        // Non-blocking
      }

      return { 
        success: true, 
        alertId: docRef.id, 
        message: 'Successfully subscribed! You will be notified the instant the price drops.' 
      };
    } catch (error: any) {
      console.error('Error subscribing to price drop:', error);
      return { success: false, message: error.message || 'Failed to subscribe to price alerts' };
    }
  },

  unsubscribeFromPriceDrop: async (alertId: string) => {
    try {
      try {
        await deleteDoc(doc(db, 'price_alerts', alertId));
      } catch (e) {
        console.warn('Error deleting alert document from Firestore:', e);
      }

      // Update store
      set(state => ({
        alerts: state.alerts.filter(a => a.id !== alertId)
      }));

      // Update localStorage
      try {
        const localAlertsRaw = localStorage.getItem('rare_dreams_guest_price_alerts');
        if (localAlertsRaw) {
          const list = JSON.parse(localAlertsRaw);
          localStorage.setItem('rare_dreams_guest_price_alerts', JSON.stringify(list.filter((a: any) => a.id !== alertId)));
        }
      } catch (e) {
        // ignore
      }

      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    }
  },

  togglePriceDropAlert: async (product) => {
    const { alerts, subscribeToPriceDrop, unsubscribeFromPriceDrop } = get();
    const existingAlert = alerts.find(a => a.productId === product.id && a.status === 'active');

    if (existingAlert) {
      await unsubscribeFromPriceDrop(existingAlert.id);
      return {
        subscribed: false,
        message: 'unsubscribed'
      };
    } else {
      const email = auth.currentUser?.email || (auth.currentUser?.uid ? `${auth.currentUser.uid}@raredreams.app` : 'guest@raredreams.app');
      const phone = auth.currentUser?.phoneNumber || '';

      const res = await subscribeToPriceDrop({
        productId: product.id,
        productName: product.name,
        productImage: product.images?.[0] || '',
        initialPrice: Number(product.price),
        userEmail: email,
        userPhone: phone,
        userId: auth.currentUser?.uid || undefined,
        notificationChannels: ['in_app', 'email']
      });

      return {
        subscribed: res.success,
        message: res.success ? 'subscribed' : res.message
      };
    }
  },

  isProductSubscribed: (productId: string) => {
    const alerts = get().alerts;
    return alerts.some(a => a.productId === productId && a.status === 'active');
  },

  markNotificationAsRead: async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
      set(state => {
        const updated = state.notifications.map(n => n.id === notificationId ? { ...n, read: true } : n);
        return {
          notifications: updated,
          unreadNotificationsCount: updated.filter(n => !n.read).length
        };
      });
    } catch (e) {
      console.warn('Error marking notification as read:', e);
    }
  },

  markAllNotificationsAsRead: async () => {
    const { notifications } = get();
    set({
      notifications: notifications.map(n => ({ ...n, read: true })),
      unreadNotificationsCount: 0
    });
    try {
      notifications.filter(n => !n.read).forEach(async (n) => {
        try {
          await updateDoc(doc(db, 'notifications', n.id), { read: true });
        } catch (err) {
          // ignore
        }
      });
    } catch (e) {
      console.warn('Error marking all as read:', e);
    }
  }
}));
