// Firebase Web Push Notification Service Worker (FCM)
// Works in the background even when Chrome / browser tab is closed

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Active Firebase project configuration for Rare Dreams
const firebaseConfig = {
  apiKey: "AIzaSyC7ED5GJQyE1Q5ZH4A-pnMMzpq3KCoNCLg",
  authDomain: "lofty-theme-0nn32.firebaseapp.com",
  projectId: "lofty-theme-0nn32",
  storageBucket: "lofty-theme-0nn32.firebasestorage.app",
  messagingSenderId: "438820802878",
  appId: "1:438820802878:web:e53af076a1800d3c229c6f"
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message: ', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Rare Dreams Notification';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'আপনার নতুন নোটিফিকেশন এসেছে!',
      icon: payload.notification?.icon || payload.data?.icon || '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      data: {
        url: payload.data?.url || payload.notification?.click_action || '/admin/orders'
      },
      vibrate: [250, 100, 250, 100, 250],
      tag: payload.data?.tag || payload.data?.orderId || 'rare_dreams_notification',
      renotify: true
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn("FCM Service worker setup note:", e);
}

// Fallback native web push listener
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || data.notification?.title || '🛍️ নতুন অর্ডার - Rare Dreams';
      const options = {
        body: data.body || data.notification?.body || 'একটি নতুন অর্ডার এসেছে!',
        icon: data.icon || data.notification?.icon || '/pwa-192x192.png',
        badge: '/favicon-32x32.png',
        data: { 
          url: data.url || data.data?.url || (data.targetRole === 'admin' ? '/admin/orders' : '/account') 
        },
        vibrate: [300, 100, 300, 100, 300],
        tag: data.tag || 'rare_dreams_push_' + Date.now(),
        renotify: true
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      event.waitUntil(
        self.registration.showNotification('Rare Dreams Update', {
          body: event.data.text(),
          icon: '/pwa-192x192.png',
          badge: '/favicon-32x32.png',
          data: { url: '/admin/orders' }
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/admin/orders';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
