import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clean up any previously registered Service Workers safely in supported contexts
try {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations?.().then((registrations) => {
      if (Array.isArray(registrations)) {
        for (const registration of registrations) {
          registration.unregister().catch(() => {});
        }
      }
    }).catch(() => {});
  }
} catch {
  // Ignored in sandboxed iframes or environments where service workers are restricted
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
