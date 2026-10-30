/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  // Safari (iPhone/iPad or Mac) has no beforeinstallprompt: install is Share > Add to Home Screen / Add to Dock
  const [isSafari, setIsSafari] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed & launched from homescreen)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // Detect Device OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setIsSafari(/safari/.test(userAgent) && !/chrome|chromium|crios|fxios|edg|opr|android/.test(userAgent));
    setIsMac(/macintosh|mac os x/.test(userAgent) && !isIosDevice);

    // Hide the install button as soon as the app switches to standalone
    const mq = window.matchMedia('(display-mode: standalone)');
    const onModeChange = (e: MediaQueryListEvent) => { if (e.matches) setIsInstalled(true); };
    mq.addEventListener?.('change', onModeChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mq.removeEventListener?.('change', onModeChange);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isSafari,
    isMac,
    install,
  };
}
