import React, { lazy, ComponentType } from 'react';

/**
 * Enhanced lazy import with automatic retry and backoff on dynamic import failure.
 * Fixes "Failed to fetch dynamically imported module" errors in Vite/SPA environments.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  interval = 400
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (retriesLeft: number) => {
        factory()
          .then((comp) => {
            // Clear reload tracker on success
            try {
              window.sessionStorage.removeItem('retry_reload_' + window.location.pathname);
            } catch (e) {
              // ignore
            }
            resolve(comp);
          })
          .catch((error) => {
            if (retriesLeft <= 0) {
              // If dynamic import failed after all retries, try safe single reload
              try {
                const reloadKey = 'retry_reload_' + window.location.pathname;
                const hasReloaded = window.sessionStorage.getItem(reloadKey);
                if (!hasReloaded) {
                  window.sessionStorage.setItem(reloadKey, 'true');
                  window.location.reload();
                  return;
                }
              } catch (e) {
                // ignore
              }
              reject(error);
              return;
            }
            // Exponential backoff
            const delay = interval * (4 - retriesLeft);
            setTimeout(() => {
              attempt(retriesLeft - 1);
            }, delay);
          });
      };
      attempt(retries);
    })
  );
}

