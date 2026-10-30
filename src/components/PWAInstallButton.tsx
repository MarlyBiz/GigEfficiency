/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Download, 
  Smartphone, 
  X, 
  CheckCircle, 
  Share2, 
  PlusSquare, 
  MoreVertical, 
  Monitor, 
  Sparkles,
  Zap
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isSafari, isMac, install } = usePWAInstall();
  // iPhone/iPad (any browser) and Safari on Mac: no install prompt, so show the short Share sheet
  const [showShareSheet, setShowShareSheet] = useState(false);
  const useShareSheet = isIOS || isSafari;
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [activeInstructionTab, setActiveInstructionTab] = useState<'ios' | 'android' | 'desktop'>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
  );

  // If already running standalone inside the installed PWA
  if (isInstalled) {
    if (variant === 'card' || variant === 'settings') {
      return (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">Installed: App is running standalone with persistent offline timers & storage.</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (!isInstallable && useShareSheet) {
      setShowShareSheet(true);
      return;
    }
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        // If user dismissed or cancelled, or browser blocked prompt, show modal
        setShowInstructionsModal(true);
      }
    } else {
      setShowInstructionsModal(true);
    }
  };

  return (
    <>
      {/* 1. Header Compact Button */}
      {variant === 'compact' && (
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 active:scale-95 whitespace-nowrap transition-all cursor-pointer"
          title="Install Gig Efficiency Tracker to your phone or desktop home screen"
          aria-label="Install app"
        >
          <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Install</span>
        </button>
      )}

      {/* 2. Full Width Card Variant */}
      {variant === 'card' && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-800">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Install to Home Screen</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keep timers running offline, zero browser address bar, instant car access.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Install App</span>
          </button>
        </div>
      )}

      {/* 3. Settings Variant */}
      {variant === 'settings' && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 dark:text-white block text-xs">
              Install as Standalone Mobile / Desktop App
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Removes browser UI, enables full offline caching, and gives you a one-tap icon.
            </span>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
        </div>
      )}

      {/* Overlays go to <body>: the header's backdrop-blur would otherwise trap fixed elements */}
      {typeof document !== 'undefined' && createPortal(<>
      {/* Short iOS / Safari sheet: Share, then Add to Home Screen (Add to Dock on Mac) */}
      {showShareSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowShareSheet(false)}>
          <div role="dialog" aria-label="Install on this device" data-testid="ios-install-sheet" onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl text-slate-900 dark:text-slate-100 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Install Gig Tracker</h3>
              <button onClick={() => setShowShareSheet(false)} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-2">
              <li className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">1</span>
                <span>Tap <strong>Share</strong> <Share2 className="inline w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 -mt-0.5" /> {isIOS ? 'in Safari’s toolbar' : 'in the Safari toolbar'}</span>
              </li>
              <li className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
                <span>Choose <strong>{isMac && !isIOS ? 'Add to Dock' : 'Add to Home Screen'}</strong> <PlusSquare className="inline w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 -mt-0.5" />, then <strong>Add</strong></span>
              </li>
            </ol>
            {isIOS && !isSafari && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">On iPhone, open gig.marlylabs.app in Safari if you don’t see that option.</p>
            )}
            <button onClick={() => setShowShareSheet(false)} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">Got it</button>
          </div>
        </div>
      )}

      {/* Step-by-Step Install Instructions Modal (Works on iOS, Android & Desktop) */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Install to Home Screen</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Offline-ready standalone application</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Tab Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setActiveInstructionTab('ios')}
                className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeInstructionTab === 'ios'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                iOS (iPhone / iPad)
              </button>
              <button
                onClick={() => setActiveInstructionTab('android')}
                className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeInstructionTab === 'android'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Android
              </button>
              <button
                onClick={() => setActiveInstructionTab('desktop')}
                className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeInstructionTab === 'desktop'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Desktop
              </button>
            </div>

            {/* Tab 1: iOS Safari */}
            {activeInstructionTab === 'ios' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">1</span>
                    <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Tap Share Button</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 pl-7 text-[11px] leading-relaxed">
                    In Safari, tap the <strong>Share</strong> button (box with an arrow pointing upward) in the toolbar at the bottom of your screen.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">2</span>
                    <PlusSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Select "Add to Home Screen"</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 pl-7 text-[11px] leading-relaxed">
                    Scroll down the sharing sheet menu and tap <strong>Add to Home Screen</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">3</span>
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Confirm by Tapping "Add"</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 pl-7 text-[11px] leading-relaxed">
                    Tap <strong>Add</strong> in the top right corner. The Gig Efficiency Tracker icon will appear on your phone home screen!
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Android Chrome */}
            {activeInstructionTab === 'android' && (
              <div className="space-y-3 text-xs">
                {isInstallable ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl text-center space-y-2">
                    <p className="text-emerald-800 dark:text-emerald-300 font-semibold">
                      Your browser supports 1-tap installation!
                    </p>
                    <button
                      onClick={async () => {
                        const done = await install();
                        if (done) setShowInstructionsModal(false);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow cursor-pointer"
                    >
                      Trigger Android Install Prompt
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">1</span>
                        <MoreVertical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Tap the Three Dots Menu</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 pl-7 text-[11px] leading-relaxed">
                        Tap the <strong>⋮ (three dots)</strong> menu button in the top right corner of Chrome.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">2</span>
                        <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Tap "Install app" or "Add to Home screen"</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 pl-7 text-[11px] leading-relaxed">
                        Select <strong>Install app</strong> (or <strong>Add to Home screen</strong>) from the dropdown menu and confirm.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab 3: Desktop (Chrome / Edge / Mac) */}
            {activeInstructionTab === 'desktop' && (
              <div className="space-y-3 text-xs">
                {isInstallable ? (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl text-center space-y-2">
                    <p className="text-emerald-800 dark:text-emerald-300 font-semibold">
                      Click below to install as a standalone desktop window:
                    </p>
                    <button
                      onClick={async () => {
                        const done = await install();
                        if (done) setShowInstructionsModal(false);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow cursor-pointer"
                    >
                      Install Desktop App Now
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Address Bar Install Button</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      Look for the <strong>Install icon (⊕ or computer display with arrow)</strong> on the right side of your browser address bar in Chrome or Edge, or open the browser menu (⋮) and click <strong>"Install Gig Efficiency Tracker"</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Persistence & Offline Guarantee */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-[11px] text-emerald-900 dark:text-emerald-300 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Full Timestamp & Data Persistence</span>
              </span>
              <p className="text-emerald-800/80 dark:text-emerald-400/80">
                Whether you launch from your home screen or browser, timers use epoch timestamps (`Date.now()`) stored in `localStorage`. Even if you force-close the app, all clocks and records continue with exact second accuracy.
              </p>
            </div>

            <button
              onClick={() => setShowInstructionsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
      </>, document.body)}
    </>
  );
};
