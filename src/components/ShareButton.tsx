/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { APP_URL, shareApp } from '../utils/share';

interface ShareButtonProps {
  variant?: 'compact' | 'settings';
}

export const ShareButton: React.FC<ShareButtonProps> = ({ variant = 'compact' }) => {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const onShare = async () => {
    const r = await shareApp();
    if (r === 'copied') setToast('Link copied: gig.marlylabs.app');
    else if (r === 'failed') setToast(`Copy this link: ${APP_URL}`);
  };

  const toastEl = toast && (
    <div role="status" data-testid="share-toast"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-lg">
      {toast}
    </div>
  );

  if (variant === 'settings') {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="font-bold text-slate-900 dark:text-white block text-xs">Share the app</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Send gig.marlylabs.app to another driver.</span>
        </div>
        <button onClick={onShare} aria-label="Share app"
          className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
        {toastEl}
      </div>
    );
  }

  return (
    <>
      <button onClick={onShare} aria-label="Share app" title="Share this app"
        className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer">
        <Share2 className="w-4 h-4" />
      </button>
      {toastEl}
    </>
  );
};
