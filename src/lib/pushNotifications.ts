import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { fetchClientNetworkInfo, parseUserAgent } from '../utils/deviceParser';

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
}

/**
 * Request Notification Permission and register Service Worker token
 */
export async function requestPushNotificationPermission(userId?: string, userPhone?: string, role?: string): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("Firebase Web Push is not supported in this browser environment.");
      return null;
    }

    if (!('Notification' in window)) {
      console.warn("This browser does not support desktop notifications.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info("Notification permission was not granted:", permission);
      return null;
    }

    // Register service worker if not already registered
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    }

    const messaging = getMessaging();
    
    // Optional VAPID key support from environment or default
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey
    });

    if (currentToken) {
      console.log("FCM Device Token retrieved:", currentToken);
      
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

      // Save or update token in Firestore under fcm_tokens collection
      const tokenDocRef = doc(db, 'fcm_tokens', currentToken);
      await setDoc(tokenDocRef, {
        token: currentToken,
        userId: userId || 'anonymous',
        userPhone: userPhone || '',
        role: role || 'customer',
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

      return currentToken;
    } else {
      console.warn("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (error) {
    console.warn("Error retrieving Firebase FCM token:", error);
    return null;
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
      
      // Show in-app banner or toast
      onNotificationReceived({
        title,
        body,
        data: payload.data
      });

      // Also trigger browser Notification if permission is granted
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png'
        });
      }
    });
  } catch (error) {
    console.warn("Foreground message listener setup failed:", error);
    return () => {};
  }
}
