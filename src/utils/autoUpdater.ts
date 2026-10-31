/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CURRENT_BUILD_VERSION = '2.6.11';

/**
 * Initializes automatic version checking and service worker updates.
 * Every time the user opens the app or returns to the tab/PWA, it checks
 * for and loads the newest version without touching localStorage or user data.
 */
export function initAutoUpdater(): void {
  if (typeof window === 'undefined') return;

  let isReloading = false;

  const performSafeReload = () => {
    if (isReloading) return;
    isReloading = true;
    window.location.reload();
  };

  // 1. Service Worker Update Handling
  if ('serviceWorker' in navigator) {
    // Listen for controllerchange (new service worker took control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      performSafeReload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(reg => {
          // Immediately check for update
          reg.update().catch(() => {});

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available; prompt the new service worker to activate
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(() => {});
    });
  }

  // 2. Client-side Version Check against /version.json
  const checkLatestVersion = async () => {
    try {
      // Also request service worker check if available
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update().catch(() => {});
        });
      }

      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data && data.version && data.version !== CURRENT_BUILD_VERSION) {
        console.log(`[AutoUpdater] New version detected: ${data.version} (current: ${CURRENT_BUILD_VERSION}). Refreshing...`);
        performSafeReload();
      }
    } catch {
      // Offline or network error - ignore gracefully
    }
  };

  // Check on visibility change (user re-opens PWA or switches back to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkLatestVersion();
    }
  });

  // Check when window gains focus
  window.addEventListener('focus', () => {
    checkLatestVersion();
  });

  // Initial check shortly after load
  setTimeout(checkLatestVersion, 3000);

  // Periodic check every 5 minutes while active
  setInterval(checkLatestVersion, 5 * 60 * 1000);
}
