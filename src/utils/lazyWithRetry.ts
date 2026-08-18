import React, { lazy, ComponentType } from 'react';

/**
 * Enhanced lazy import with automatic retry on dynamic import failure.
 * Fixes "Failed to fetch dynamically imported module" errors in Vite/SPA environments.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 500
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (retriesLeft: number) => {
        factory()
          .then(resolve)
          .catch((error) => {
            if (retriesLeft === 0) {
              // If dynamic import failed, check if page reload was already attempted
              const hasReloaded = window.sessionStorage.getItem('retry_reload_' + window.location.pathname);
              if (!hasReloaded) {
                window.sessionStorage.setItem('retry_reload_' + window.location.pathname, 'true');
                window.location.reload();
                return;
              }
              reject(error);
              return;
            }
            setTimeout(() => {
              attempt(retriesLeft - 1);
            }, interval);
          });
      };
      attempt(retries);
    })
  );
}
