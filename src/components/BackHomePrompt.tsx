/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Home } from 'lucide-react';

/** In-app prompt shown when the user returns inside the home radius during a running shift. */
export const BackHomePrompt: React.FC<{ isOpen: boolean; onStop: () => void; onKeepGoing: () => void }> = ({ isOpen, onStop, onKeepGoing }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md" role="dialog" aria-label="Back home">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
          <Home className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold">Back home, done working?</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Stop the timer?</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onKeepGoing} className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold cursor-pointer">
            Keep going
          </button>
          <button onClick={onStop} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer">
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};
