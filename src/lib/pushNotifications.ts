import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { fetchClientNetworkInfo, parseUserAgent } from '../utils/deviceParser';
import { playNewOrderSound, playOfferNotificationSound } from '../utils/audioAlert';

export const VAPID_PUBLIC_KEY = "BDa6JUFB_Um0OUPJxaFZUxwOxRaAGBrzsD0lemYYeZmKD45lsbpbieaA66x35A3RaRK9tfK4eQ33z5OAsHlpRYs";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushNotificationSubscription {
  token: string;
  userId?: string;
  userPhone?: string;
  role?: string;
  createdAt: any;
  updatedAt: any;
  deviceInfo: string;
  ip?: string;
  city?: string;
  country?: string;
  isp?: string;
  browser?: string;
  os?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  screen?: string;
  subscription?: any;
}

/**
 * Display native browser / system notification safely
 */
export function showSystemNotification(title: string, options?: NotificationOptions & { url?: string }) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Check if service worker can show it with action & vibration
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/favicon-32x32.png',
          vibrate: [300, 100, 300],
          ...options
        } as any);
      }).catch(() => {
        new Notification(title, {
          icon: '/pwa-192x192.png',
          badge: '/favicon-32x32.png',
          ...options
        });
      });
      return;
    }

    const notif = new Notification(title, {
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      ...options
    });

    if (options?.url) {
      notif.onclick = function () {
        window.focus();
        if (options.url) {
          window.location.href = options.url;
        }
        notif.close();
      };
    }
  } catch (e) {
    console.warn('Could not display system notification:', e);
  }
}

/**
 * Request Notification Permission and register Service Worker token + WebPush subscription
 */
export async function requestPushNotificationPermission(userId?: string, userPhone?: string, role?: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn("This browser does not support desktop notifications.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info("Notification permission was not granted:", permission);
      return null;
    }

    // Register service worker if supported
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn("Service worker registration error:", swErr);
      }
    }

    let webPushSubscription: PushSubscription | null = null;
    if (registration && 'pushManager' in registration) {
      try {
        // Subscribe to browser Web Push API with VAPID key
        webPushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        console.log('[WebPush] Successfully subscribed to PushManager:', webPushSubscription.endpoint);
      } catch (pushErr) {
        console.info('[WebPush] PushManager subscription note (checking existing):', pushErr);
        webPushSubscription = await registration.pushManager.getSubscription().catch(() => null);
      }
    }

    let currentToken: string | null = null;
    const supported = await isSupported().catch(() => false);
    
    if (supported) {
      try {
        const messaging = getMessaging();
        currentToken = await getToken(messaging, {
          serviceWorkerRegistration: registration,
          vapidKey: VAPID_PUBLIC_KEY
        });
      } catch (fcmErr) {
        console.warn("Could not get FCM token:", fcmErr);
      }
    }

    // Use endpoint hash or token
    if (!currentToken && webPushSubscription) {
      currentToken = 'sub_' + btoa(webPushSubscription.endpoint).slice(-32);
    }

    // Fallback pseudo-token if neither connected
    if (!currentToken) {
      currentToken = localStorage.getItem('rare_dreams_fcm_token') || ('fcm_client_' + Math.random().toString(36).substring(2) + Date.now().toString(36));
    }

    if (currentToken) {
      // Parse device info
      const parsedDevice = parseUserAgent(navigator.userAgent);
      
      // Fetch public IP in background
      let networkData: { ip?: string; city?: string; country?: string; isp?: string } = {};
      try {
        const net = await fetchClientNetworkInfo();
        if (net && net.ip) {
          networkData = {
            ip: net.ip,
            city: net.city,
            country: net.country,
            isp: net.isp
          };
        }
      } catch (e) {
        console.warn("Could not fetch network info:", e);
      }

      const subscriptionJSON = webPushSubscription ? webPushSubscription.toJSON() : null;

      // Save or update token in Firestore under fcm_tokens collection
      const tokenDocRef = doc(db, 'fcm_tokens', currentToken);
      await setDoc(tokenDocRef, {
        token: currentToken,
        userId: userId || 'anonymous',
        userPhone: userPhone || '',
        role: role || 'customer',
        subscription: subscriptionJSON,
        deviceInfo: navigator.userAgent,
        browser: parsedDevice.browser,
        browserVersion: parsedDevice.browserVersion,
        os: parsedDevice.os,
        deviceType: parsedDevice.deviceType,
        deviceModel: parsedDevice.deviceModel,
        screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '',
        ...networkData,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });

      // Save local storage indicator
      localStorage.setItem('rare_dreams_fcm_token', currentToken);
      localStorage.setItem('rare_dreams_push_enabled', 'true');

      // Also register with backend API for immediate push dispatch sync
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: currentToken,
          role: role || 'customer',
          userId: userId || 'anonymous',
          subscription: subscriptionJSON
        })
      }).catch(() => {});

      return currentToken;
    }
    return null;
  } catch (error) {
    console.warn("Error retrieving Web Push / FCM token:", error);
    return null;
  }
}

/**
 * Dispatch an instant Admin New Order notification
 */
export async function notifyAdminsOfNewOrder(orderData: {
  id: string;
  customerName: string;
  phone: string;
  total: number;
  district?: string;
  itemsCount?: number;
}) {
  try {
    const formattedTotal = '৳' + Number(orderData.total || 0).toLocaleString('en-IN');
    const districtInfo = orderData.district ? ` (${orderData.district})` : '';

    // 1. Add record into notifications collection for admin real-time listener
    await addDoc(collection(db, 'notifications'), {
      title: '🛍️ নতুন অর্ডার এসেছে!',
      message: `${orderData.customerName} - ${formattedTotal}${districtInfo}`,
      type: 'new_order',
      targetRole: 'admin',
      orderId: orderData.id,
      customerName: orderData.customerName,
      phone: orderData.phone,
      total: orderData.total,
      read: false,
      createdAt: serverTimestamp()
    });

    console.log('Order notification dispatched to Firestore for order:', orderData.id);

    // 2. Dispatch background FCM push notification to Admin phones / devices even when app is closed
    fetch('/api/notifications/push-admin-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderData.id,
        customerName: orderData.customerName,
        phone: orderData.phone,
        total: orderData.total,
        district: orderData.district || '',
        itemsCount: orderData.itemsCount || 1,
        url: '/admin/orders'
      })
    }).then(async (res) => {
      const data = await res.json().catch(() => null);
      console.log('Admin background push response:', data);
    }).catch((err) => {
      console.warn('Backend admin push notification trigger note:', err);
    });
  } catch (e) {
    console.warn('Could not dispatch new order notification to Firestore:', e);
  }
}

/**
 * Listen for foreground push messages
 */
export async function setupForegroundNotificationListener(
  onNotificationReceived: (payload: { title: string; body: string; data?: any }) => void
) {
  try {
    const supported = await isSupported();
    if (!supported) return () => {};

    const messaging = getMessaging();
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Rare Dreams Notification';
      const body = payload.notification?.body || payload.data?.body || 'নতুন আপডেট!';
      
      playOfferNotificationSound();

      // Show in-app banner or toast
      onNotificationReceived({
        title,
        body,
        data: payload.data
      });

      // Also trigger browser Notification if permission is granted
      showSystemNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        url: payload.data?.url || '/'
      });
    });
  } catch (error) {
    console.warn("Foreground message listener setup failed:", error);
    return () => {};
  }
}

