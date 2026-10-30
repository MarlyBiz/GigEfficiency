/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, DollarSign, Clock, Navigation, TrendingUp, Sparkles, Fuel, Gift } from 'lucide-react';
import { ActiveSession, AppSettings, DayRecord } from '../types';
import { formatCurrency, formatDuration, formatRate, getEffectiveDateString, formatHM } from '../utils/calculations';
import { getBonusTypeMeta } from '../utils/bonuses';
import { getWorkday, ruleFor } from '../utils/workday';

interface DayCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ActiveSession;
  totalSeconds: number;
  workSeconds: number;
  breakSeconds: number;
  totalEarnings: number;
  dollarsPerHourTotal: number;
  dollarsPerHourWork: number;
  dollarsPerMileTotal: number;
  dollarsPerMileWork: number;
  settings: AppSettings;
  onConfirmSave: (record: DayRecord) => void;
}

export const DayCloseModal: React.FC<DayCloseModalProps> = ({
  isOpen,
  onClose,
  session,
  totalSeconds,
  workSeconds,
  breakSeconds,
  totalEarnings,
  dollarsPerHourTotal,
  dollarsPerHourWork,
  dollarsPerMileTotal,
  dollarsPerMileWork,
  settings,
  onConfirmSave,
}) => {
  const [notes, setNotes] = useState(session.notes || '');
  const savedRef = useRef(false); // a double tap must not save the shift twice
  useEffect(() => { if (isOpen) savedRef.current = false; }, [isOpen]);

  if (!isOpen) return null;

  const now = Date.now();
  const startTime = session.startDayTimestamp || now - totalSeconds * 1000;
  // Workday chosen at start (follows the cutoff), never the calendar date of 'now'
  const dateStr = session.workdayStr || getWorkday(startTime, ruleFor(settings));
  const estTaxDeduction = (session.totalMiles || 0) * (settings.standardMileageRate || 0.67);

  const baseEarnings = (session.platformEarnings || []).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const totalBonusEarnings = (session.bonusEarnings || []).reduce(
    (sum, b) => sum + (Number(b.amount) || 0),
    0
  );

  const handleSave = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    const record: DayRecord = {
      // One id per shift (its start time), so the same shift saved twice is recognised, not added again
      id: `shift-${dateStr}-${session.startDayTimestamp || Date.now()}`,
      dateStr,
      startTime,
      endTime: now,
      totalSeconds,
      workSeconds,
      totalMiles: session.totalMiles || 0,
      workMiles: session.workMiles || 0,
      platformEarnings: session.platformEarnings || [],
      bonusEarnings: session.bonusEarnings || [],
      baseEarnings,
      totalBonusEarnings,
      totalEarnings,
      dollarsPerHourTotal: Number(dollarsPerHourTotal.toFixed(2)),
      dollarsPerHourWork: Number(dollarsPerHourWork.toFixed(2)),
      dollarsPerMileTotal: Number(dollarsPerMileTotal.toFixed(2)),
      dollarsPerMileWork: Number(dollarsPerMileWork.toFixed(2)),
      notes,
      createdAt: now,
    };
    onConfirmSave(record);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Close Out & Save Day</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Shift for {dateStr}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Numbers Callout */}
        <div className="my-5 p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-300 dark:border-emerald-500/30 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
            Total Shift Earnings (Base + Bonuses)
          </span>
          <span className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 block mt-1">
            {formatCurrency(totalEarnings, settings.currency)}
          </span>
          {totalBonusEarnings > 0 && (
            <div className="mt-1 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
              <span>Base: {formatCurrency(baseEarnings, settings.currency)}</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-amber-700 dark:text-amber-400">
                <Gift className="w-3.5 h-3.5" />
                +{formatCurrency(totalBonusEarnings, settings.currency)} bonus
              </span>
            </div>
          )}
          <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
            {formatHM(workSeconds)} active work ({formatHM(totalSeconds)} total)
          </span>
        </div>

        {/* Efficiency Summary Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Work $/Hour</span>
            <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 block">
              {formatRate(dollarsPerHourWork, settings.currency, 'hr')}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Total $/Hour</span>
            <span className="text-base font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-0.5 block">
              {formatRate(dollarsPerHourTotal, settings.currency, 'hr')}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Total Miles Driven</span>
            <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white mt-0.5 block">
              {session.totalMiles} mi ({formatRate(dollarsPerMileTotal, settings.currency, 'mi')})
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block font-medium">IRS Tax Deduction</span>
            <span className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-400 mt-0.5 block">
              {formatCurrency(estTaxDeduction, settings.currency)}
            </span>
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="space-y-2 mb-5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Platform Breakdown
          </span>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {(session.platformEarnings || []).map((p, pIdx) => (
              <div
                key={p.id ? `${p.id}-${pIdx}` : `close-plat-${p.name}-${pIdx}`}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs border border-slate-200 dark:border-slate-800"
              >
                <span className="text-slate-700 dark:text-slate-300 font-medium">{p.name}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatCurrency(p.amount, settings.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bonuses & Quests Breakdown (if any) */}
        {session.bonusEarnings && session.bonusEarnings.length > 0 && (
          <div className="space-y-2 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-500" />
                <span>Promotions & Quests Breakdown</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                +{formatCurrency(totalBonusEarnings, settings.currency)}
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {session.bonusEarnings.map((b, bIdx) => {
                const meta = getBonusTypeMeta(b.bonusType);
                return (
                  <div
                    key={b.id || `bonus-close-${bIdx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs border border-slate-200 dark:border-slate-800"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}>
                          {meta.title}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {b.platform}
                        </span>
                      </div>
                      {b.notes && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          "{b.notes}"
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                      +{formatCurrency(b.amount, settings.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5 mb-6">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Shift Notes (Hotspots, weather, surges)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Great dinner airport rush, rain surge..."
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save & Reset Timers</span>
          </button>
        </div>
      </div>
    </div>
  );
};
