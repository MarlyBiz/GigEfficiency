/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Save, Trash2, Calendar, AlertTriangle, Gift, Plus, Edit3 } from 'lucide-react';
import { AppSettings, DayRecord, PlatformSlot, BonusEntry } from '../types';
import { formatCurrency, formatHM, parseHM } from '../utils/calculations';
import { getBonusTypeMeta } from '../utils/bonuses';
import { BonusEntryModal } from './BonusEntryModal';
import { NumericInput } from './NumericInput';

interface EditDayModalProps {
  record: DayRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DayRecord) => void;
  onDelete: (id: string) => void;
  settings: AppSettings;
}

export const EditDayModal: React.FC<EditDayModalProps> = ({
  record,
  isOpen,
  onClose,
  onSave,
  onDelete,
  settings,
}) => {
  if (!isOpen || !record) return null;

  const [dateStr, setDateStr] = useState(record.dateStr);
  const [totalHours, setTotalHours] = useState(formatHM(record.totalSeconds));
  const [workHours, setWorkHours] = useState(formatHM(record.workSeconds));
  const [totalMiles, setTotalMiles] = useState(String(record.totalMiles));
  const [workMiles, setWorkMiles] = useState(String(record.workMiles));
  const [notes, setNotes] = useState(record.notes || '');
  const [platforms, setPlatforms] = useState<PlatformSlot[]>(record.platformEarnings || []);
  const [bonuses, setBonuses] = useState<BonusEntry[]>(record.bonusEarnings || []);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [editingBonus, setEditingBonus] = useState<BonusEntry | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleUpdatePlatformAmount = (id: string, val: number | string) => {
    const num = Math.max(0, typeof val === 'number' ? val : parseFloat(val) || 0);
    setPlatforms(prev => prev.map(p => (p.id === id ? { ...p, amount: num } : p)));
  };

  const handleSaveBonus = (savedBonus: BonusEntry) => {
    setBonuses(prev => {
      const idx = prev.findIndex(b => b.id === savedBonus.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedBonus;
        return next;
      }
      return [...prev, savedBonus];
    });
  };

  const handleDeleteBonus = (bonusId: string) => {
    setBonuses(prev => prev.filter(b => b.id !== bonusId));
  };

  const baseEarnings = platforms.reduce((s, p) => s + (p.amount || 0), 0);
  const totalBonusEarnings = bonuses.reduce((s, b) => s + (b.amount || 0), 0);
  const totalEarnings = baseEarnings + totalBonusEarnings;

  const handleSave = () => {
    // Durations are typed as "2h 15m" (also accepts "2:15", "45m"); stored as whole seconds.
    const tSeconds = parseHM(totalHours) ?? record.totalSeconds;
    const wSeconds = parseHM(workHours) ?? record.workSeconds;
    const tHours = tSeconds / 3600;
    const wHours = wSeconds / 3600;
    const tMiles = parseFloat(totalMiles) || 0;
    const wMiles = parseFloat(workMiles) || 0;

    const updated: DayRecord = {
      ...record,
      dateStr,
      totalSeconds: tSeconds,
      workSeconds: wSeconds,
      totalMiles: tMiles,
      workMiles: wMiles,
      platformEarnings: platforms,
      bonusEarnings: bonuses,
      baseEarnings,
      totalBonusEarnings,
      totalEarnings,
      dollarsPerHourTotal: tHours > 0 ? Number((totalEarnings / tHours).toFixed(2)) : 0,
      dollarsPerHourWork: wHours > 0 ? Number((totalEarnings / wHours).toFixed(2)) : 0,
      dollarsPerMileTotal: tMiles > 0 ? Number((totalEarnings / tMiles).toFixed(2)) : 0,
      dollarsPerMileWork: wMiles > 0 ? Number((totalEarnings / wMiles).toFixed(2)) : 0,
      notes,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Shift Record</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 space-y-4 text-xs">
          {/* Date Picker */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Shift Date</label>
            <input
              type="date"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Hours Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Active Work Time</label>
              <input
                type="text"
                aria-label="Active Work Time"
                value={workHours}
                onChange={e => setWorkHours(e.target.value)}
                onBlur={() => { const s = parseHM(workHours); if (s !== null) setWorkHours(formatHM(s)); }}
                placeholder="e.g. 2h 15m"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Total Shift Time</label>
              <input
                type="text"
                aria-label="Total Shift Time"
                value={totalHours}
                onChange={e => setTotalHours(e.target.value)}
                onBlur={() => { const s = parseHM(totalHours); if (s !== null) setTotalHours(formatHM(s)); }}
                placeholder="e.g. 2h 15m"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Miles Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Total Miles Driven</label>
              <NumericInput
                step="0.1"
                min={0}
                value={totalMiles}
                onChange={val => setTotalMiles(String(val))}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Work Miles</label>
              <NumericInput
                step="0.1"
                min={0}
                value={workMiles}
                onChange={val => setWorkMiles(String(val))}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Platform breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">Earnings Breakdown</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                Total: {formatCurrency(totalEarnings, settings.currency)}
              </span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {platforms.map((p, pIdx) => (
                <div key={p.id ? `${p.id}-${pIdx}` : `edit-plat-${p.name}-${pIdx}`} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{p.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-mono">{settings.currency}</span>
                    <NumericInput
                      step="0.01"
                      min={0}
                      value={p.amount}
                      onChange={val => handleUpdatePlatformAmount(p.id, val)}
                      placeholder="0"
                      className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs text-right focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bonuses & Quests Section */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-500" />
                <span>Bonuses & Quests</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  +{formatCurrency(totalBonusEarnings, settings.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBonus(null);
                    setIsBonusModalOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {bonuses.length === 0 ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                No bonuses logged for this shift. Tap "+ Add" to log an Uber Quest, Lyft Challenge, or streak.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {bonuses.map((b, bIdx) => {
                  const meta = getBonusTypeMeta(b.bonusType);
                  return (
                    <div
                      key={b.id || `edit-bonus-${bIdx}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="min-w-0 flex-1">
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

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          +{formatCurrency(b.amount, settings.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBonus(b);
                            setIsBonusModalOpen(true);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBonus(b.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
            title="Delete this shift"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>

      {showConfirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xs p-5 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-sm">Delete Shift?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to permanently delete this shift record?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(record.id);
                  onClose();
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <BonusEntryModal
        isOpen={isBonusModalOpen}
        onClose={() => {
          setIsBonusModalOpen(false);
          setEditingBonus(null);
        }}
        initialBonus={editingBonus}
        availablePlatforms={platforms.map(p => p.name)}
        defaultDate={dateStr}
        currency={settings.currency}
        onSave={handleSaveBonus}
        onDelete={handleDeleteBonus}
      />
    </div>
  );
};
