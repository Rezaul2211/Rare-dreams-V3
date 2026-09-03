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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
