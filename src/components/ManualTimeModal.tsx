/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Clock, Plus, Minus, RotateCcw } from 'lucide-react';
import { ActiveSession } from '../types';
import { NumericInput } from './NumericInput';
import { formatHM } from '../utils/calculations';

/** +5m, −10m, +1h 05m */
export function formatOffset(seconds: number): string {
  const mins = Math.round(seconds / 60);
  const a = Math.abs(mins);
  const body = a >= 60 ? `${Math.floor(a / 60)}h ${String(a % 60).padStart(2, '0')}m` : `${a}m`;
  return `${mins < 0 ? '\u2212' : '+'}${body}`;
}

interface ManualTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ActiveSession;
  onUpdateSession: (updater: (prev: ActiveSession) => ActiveSession) => void;
  /** Live clock values (already include the offsets) for the preview */
  workSeconds?: number;
  totalSeconds?: number;
}

export const ManualTimeModal: React.FC<ManualTimeModalProps> = ({
  isOpen,
  onClose,
  session,
  onUpdateSession,
  workSeconds,
  totalSeconds,
}) => {
  // Offsets saved before this pop-up opened, so the pending change can be shown on every tap
  const [opened, setOpened] = useState<{ work: number; total: number } | null>(null);
  if (isOpen && !opened) setOpened({ work: session.manualWorkAdjustmentSeconds || 0, total: session.manualAdjustmentSeconds || 0 });
  if (!isOpen && opened) setOpened(null);
  if (!isOpen || !opened) return null;

  const workNow = session.manualWorkAdjustmentSeconds || 0;
  const totalNow = session.manualAdjustmentSeconds || 0;
  const offsetInfo = (now: number, before: number, clock: number | undefined, testId: string) => (
    <div className="flex items-end justify-between gap-2" data-testid={testId}>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
        {before !== 0 && <span className="block">Current offset {formatOffset(before)}</span>}
        {clock !== undefined && <span className="block">New time: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatHM(clock)}</strong></span>}
        {now !== before && before !== 0 && <span className="block">Offset after Done: {formatOffset(now)}</span>}
      </div>
      <span className={`font-mono font-extrabold text-lg ${now - before === 0 ? 'text-slate-400' : now - before > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} data-testid={`${testId}-pending`}>
        {formatOffset(now - before)}
      </span>
    </div>
  );

  const currentWorkMins = Math.round((session.manualWorkAdjustmentSeconds || 0) / 60);
  const currentTotalMins = Math.round((session.manualAdjustmentSeconds || 0) / 60);

  const handleAdjustTotal = (minutes: number) => {
    onUpdateSession(prev => ({
      ...prev,
      manualAdjustmentSeconds: (prev.manualAdjustmentSeconds || 0) + minutes * 60,
    }));
  };

  const handleSetTotalMinutes = (minutes: number) => {
    onUpdateSession(prev => ({
      ...prev,
      manualAdjustmentSeconds: minutes * 60,
    }));
  };

  const handleAdjustWork = (minutes: number) => {
    onUpdateSession(prev => ({
      ...prev,
      manualWorkAdjustmentSeconds: (prev.manualWorkAdjustmentSeconds || 0) + minutes * 60,
    }));
  };

  const handleSetWorkMinutes = (minutes: number) => {
    onUpdateSession(prev => ({
      ...prev,
      manualWorkAdjustmentSeconds: minutes * 60,
    }));
  };

  const handleResetAdjustments = () => {
    onUpdateSession(prev => ({
      ...prev,
      manualAdjustmentSeconds: 0,
      manualWorkAdjustmentSeconds: 0,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-900 dark:text-slate-100 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Adjust Timers</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Forgot to press a button? Quickly adjust either clock without restarting your shift.
          </p>

          {/* Work Time Adjuster */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                Work Time Offset
              </span>
            </div>
            {offsetInfo(workNow, opened.work, workSeconds, 'work-offset')}

            <div className="flex items-center justify-between gap-2">
              {[-30, -15, -5, 5, 15, 30].map(mins => (
                <button
                  key={`work-offset-${mins}`}
                  onClick={() => handleAdjustWork(mins)}
                  className={`flex-1 py-1.5 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer ${
                    mins > 0
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {mins > 0 ? `+${mins}` : mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Total Shift Time Adjuster */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-700 dark:text-blue-400">
                Total Shift Time Offset
              </span>
            </div>
            {offsetInfo(totalNow, opened.total, totalSeconds, 'total-offset')}

            <div className="flex items-center justify-between gap-2">
              {[-30, -15, -5, 5, 15, 30].map(mins => (
                <button
                  key={`total-offset-${mins}`}
                  onClick={() => handleAdjustTotal(mins)}
                  className={`flex-1 py-1.5 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer ${
                    mins > 0
                      ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950/60 dark:hover:bg-blue-900 dark:text-blue-300'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {mins > 0 ? `+${mins}` : mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleResetAdjustments}
              className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset offsets to zero</span>
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
