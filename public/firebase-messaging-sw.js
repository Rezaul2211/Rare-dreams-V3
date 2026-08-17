// Firebase Web Push Notification Service Worker (FCM)
// Works in the background even when Chrome / browser tab is closed

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Config will be populated at runtime or default fallback
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForWorker",
  authDomain: "ai-studio-52c30446-74a2-476d-a811-4a823b07db28.firebaseapp.com",
  projectId: "ai-studio-52c30446-74a2-476d-a811-4a823b07db28",
  storageBucket: "ai-studio-52c30446-74a2-476d-a811-4a823b07db28.appspot.com",
  messagingSenderId: "385106484967",
  appId: "1:385106484967:web:c6e5e0324869c9eb18a24c"
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message: ', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Rare Dreams Order Update';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'আপনার অর্ডারের নতুন আপডেট এসেছে!',
      icon: payload.notification?.icon || payload.data?.icon || '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        url: payload.data?.url || payload.notification?.click_action || '/account'
      },
      vibrate: [200, 100, 200]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.warn("FCM Service worker setup:", e);
}

// Fallback native push listener
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Rare Dreams';
      const options = {
        body: data.body || 'আপনার অর্ডার আপডেট হয়েছে!',
        icon: data.icon || '/icon-192.png',
        badge: '/badge-72.png',
        data: { url: data.url || '/account' },
        vibrate: [200, 100, 200]
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {
      event.waitUntil(
        self.registration.showNotification('Rare Dreams Update', {
          body: event.data.text(),
          icon: '/icon-192.png'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  
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
