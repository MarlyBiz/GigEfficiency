/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CalendarCheck, AlertTriangle } from 'lucide-react';
import { DayRecord } from '../types';
import { formatCurrency, formatHM } from '../utils/calculations';
import { prettyDate } from '../utils/workday';

export interface DayConfirmRequest {
  dateStr: string;
  existing: DayRecord[];
  onContinue: () => void;
  onStartOver: () => void;
}

/** "You already have data for this day" — Continue (merge) / Start over (double confirm) / Cancel. */
export const ConfirmDayModal: React.FC<{ request: DayConfirmRequest | null; currency: string; onClose: () => void }> = ({ request, currency, onClose }) => {
  const [step, setStep] = useState<'ask' | 'erase'>('ask');
  if (!request) return null;
  const secs = request.existing.reduce((s, r) => s + (r.totalSeconds || 0), 0);
  const money = request.existing.reduce((s, r) => s + (r.totalEarnings || 0), 0);
  const day = prettyDate(request.dateStr);
  const weekday = day.split(',')[0];
  const done = (fn: () => void) => () => { setStep('ask'); onClose(); fn(); };
  const cancel = () => { setStep('ask'); onClose(); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md" role="dialog" aria-label="Day already has data" data-testid="day-confirm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4 text-center">
        {step === 'ask' ? (
          <>
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">Are you sure?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1" data-testid="day-confirm-msg">
                You already have data for {day} ({formatHM(secs)}, {formatCurrency(money, currency)}).
              </p>
            </div>
            <div className="grid gap-2">
              <button onClick={done(request.onContinue)} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer">
                Continue this day
              </button>
              <button onClick={() => setStep('erase')} className="py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold cursor-pointer">
                Start over
              </button>
              <button onClick={cancel} className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold cursor-pointer">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold">This erases {weekday}'s data</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {formatHM(secs)} and {formatCurrency(money, currency)} will be replaced by the new shift when it's saved. A copy is kept in Undo history (Settings) in case you change your mind.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep('ask')} className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold cursor-pointer">
                Go back
              </button>
              <button onClick={done(request.onStartOver)} className="py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold cursor-pointer">
                Yes, erase it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
