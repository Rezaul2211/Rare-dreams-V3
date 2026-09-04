// Firebase Web Push Notification Service Worker (FCM)
// Works in the background even when Chrome / browser tab / app is completely closed

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Active Firebase project configuration
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
  
  // Note: Since we send a `notification` payload from the server with `webpush` options,
  // the Firebase Service Worker automatically displays the notification. 
  // onBackgroundMessage is ONLY triggered if the payload is DATA-only.
  // We keep it here just in case a data-only payload is ever sent.
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received data-only background message: ', payload);
    if (!payload.notification) {
      const notificationTitle = payload.data?.title || 'Rare Dreams Notification';
      const notificationOptions = {
        body: payload.data?.body || payload.data?.message || 'আপনার নতুন নোটিফিকেশন এসেছে!',
        icon: payload.data?.icon || '/pwa-192x192.png',
        badge: '/favicon-32x32.png',
        data: {
          url: payload.data?.url || '/admin/orders',
          orderId: payload.data?.orderId || ''
        },
        vibrate: [350, 120, 350, 120, 350],
        requireInteraction: true,
        tag: payload.data?.tag || payload.data?.orderId || 'rare_dreams_' + Date.now(),
        renotify: true
      };
      self.registration.showNotification(notificationTitle, notificationOptions);
    }
  });

} catch (e) {
  console.warn("FCM Service worker setup note:", e);
}

// Ensure notification clicks route to the correct app URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Firebase SDK might handle the link natively via webpush.fcmOptions.link,
  // but this is a fallback to guarantee our PWA focuses the tab.
  const urlToOpen = event.notification.data?.url || '/admin/orders';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
