import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Firebase Web Push / Background Service Worker persistently
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Firebase messaging ServiceWorker active:', reg.scope);
      })
      .catch((err) => {
        console.info('[SW] ServiceWorker registration info:', err);
      });
  });
}

// Global safety catchers for cross-origin or unhandled iframe exceptions
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (!event.message || event.message === 'Script error.' || event.message.trim() === 'Uncaught') {
      event.preventDefault?.();
      return;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!event.reason) {
      event.preventDefault?.();
      return;
    }
    const msg = typeof event.reason === 'string' ? event.reason : event.reason?.message;
    if (!msg || msg.trim() === 'Uncaught') {
      event.preventDefault?.();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
