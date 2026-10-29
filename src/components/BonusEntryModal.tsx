/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Gift, Sparkles, Check, Trash2, Calendar, HelpCircle } from 'lucide-react';
import { BonusEntry, BonusType } from '../types';
import { BONUS_TYPES, getBonusTypeMeta } from '../utils/bonuses';
import { formatCurrency } from '../utils/calculations';
import { NumericInput } from './NumericInput';

interface BonusEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBonus?: BonusEntry | null;
  availablePlatforms: string[];
  defaultDate?: string;
  currency: string;
  onSave: (bonus: BonusEntry) => void;
  onDelete?: (bonusId: string) => void;
}

export const BonusEntryModal: React.FC<BonusEntryModalProps> = ({
  isOpen,
  onClose,
  initialBonus,
  availablePlatforms,
  defaultDate,
  currency,
  onSave,
  onDelete,
}) => {
  const [platform, setPlatform] = useState('Uber Rides');
  const [customPlatform, setCustomPlatform] = useState('');
  const [bonusType, setBonusType] = useState<BonusType>('uber_quest');
  const [amount, setAmount] = useState('');
  const [dateStr, setDateStr] = useState(
    defaultDate || new Date().toISOString().slice(0, 10)
  );
  const [hasDateRange, setHasDateRange] = useState(false);
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Standard platform options merged with session platforms
  const platformOptions = Array.from(
    new Set([
      ...availablePlatforms,
      'Uber Rides',
      'DoorDash',
      'Lyft',
      'Uber Eats',
      'Grubhub',
      'Instacart',
      'Spark Delivery',
      'Amazon Flex',
      'Roadie',
    ])
  ).filter(Boolean);

  useEffect(() => {
    if (initialBonus) {
      if (platformOptions.includes(initialBonus.platform)) {
        setPlatform(initialBonus.platform);
        setCustomPlatform('');
      } else {
        setPlatform('custom');
        setCustomPlatform(initialBonus.platform);
      }
      setBonusType(initialBonus.bonusType);
      setAmount(String(initialBonus.amount || ''));
      setDateStr(initialBonus.dateStr);
      if (initialBonus.dateRangeEnd) {
        setHasDateRange(true);
        setDateRangeEnd(initialBonus.dateRangeEnd);
      } else {
        setHasDateRange(false);
        setDateRangeEnd('');
      }
      setNotes(initialBonus.notes || '');
    } else {
      // Default to first available or standard
      const firstPlatform = availablePlatforms[0] || 'Uber Rides';
      setPlatform(firstPlatform);
      setCustomPlatform('');
      setBonusType('uber_quest');
      setAmount('');
      setDateStr(defaultDate || new Date().toISOString().slice(0, 10));
      setHasDateRange(false);
      setDateRangeEnd('');
      setNotes('');
    }
    setError(null);
  }, [initialBonus, isOpen, defaultDate]);

  if (!isOpen) return null;

  const currentMeta = getBonusTypeMeta(bonusType);

  const handleBonusTypeChange = (newType: BonusType) => {
    setBonusType(newType);
    const meta = getBonusTypeMeta(newType);
    // If user hasn't typed a note yet, give a helpful prompt
    if (!notes) {
      setNotes(meta.exampleNote);
    }
    // Suggest appropriate default platform if not already set by user
    if (meta.defaultPlatform && meta.defaultPlatform !== 'General' && !initialBonus) {
      if (platformOptions.includes(meta.defaultPlatform)) {
        setPlatform(meta.defaultPlatform);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid bonus amount greater than $0.00');
      return;
    }

    const effectivePlatform =
      platform === 'custom' ? customPlatform.trim() || 'Custom Platform' : platform;

    const entry: BonusEntry = {
      id: initialBonus ? initialBonus.id : `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      platform: effectivePlatform,
      bonusType,
      amount: Number(parsedAmount.toFixed(2)),
      dateStr,
      dateRangeEnd: hasDateRange && dateRangeEnd ? dateRangeEnd : undefined,
      notes: notes.trim(),
      createdAt: initialBonus ? initialBonus.createdAt : Date.now(),
    };

    onSave(entry);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                {initialBonus ? 'Edit Platform Bonus' : 'Log Extra Bonus / Quest'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rolls into total earnings, $/hr, and $/mile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Bonus Type Selection */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Bonus / Promotion Type
            </label>
            <select
              value={bonusType}
              onChange={e => handleBonusTypeChange(e.target.value as BonusType)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs focus:outline-none focus:border-emerald-500"
            >
              {BONUS_TYPES.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
              {currentMeta.description}
            </p>
          </div>

          {/* Amount input & Quick preset buttons */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Bonus Amount ({currency})
              </label>
              <div className="flex gap-1">
                {[15, 30, 60, 100, 150].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(String(val))}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    +${val}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-base font-bold font-mono text-slate-500">
                {currency}
              </span>
              <NumericInput
                step="0.01"
                min={0}
                required
                value={amount}
                onChange={val => setAmount(String(val))}
                placeholder="0"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-base font-mono font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Platform Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Gig Platform
              </label>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:border-emerald-500"
              >
                {platformOptions.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="custom">Other / Custom Platform...</option>
              </select>
            </div>

            {platform === 'custom' && (
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Custom Platform Name
                </label>
                <input
                  type="text"
                  required
                  value={customPlatform}
                  onChange={e => setCustomPlatform(e.target.value)}
                  placeholder="e.g. Gopuff, TaskRabbit"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Date */}
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Date Earned
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Optional Multi-day Date Range toggle */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasDateRange}
                onChange={e => setHasDateRange(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Multi-Day Promotion / Quest (e.g., Weekend Quest Fri–Sun)
              </span>
            </label>

            {hasDateRange && (
              <div className="pt-2 flex items-center gap-2">
                <span className="text-slate-500 font-semibold">End Date:</span>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={e => setDateRangeEnd(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Details / Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. 50 trips for $120, Weekend Quest tier 2, 3-in-a-row streak"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {initialBonus && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialBonus.id);
                  onClose();
                }}
                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                title="Delete bonus"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{initialBonus ? 'Update Bonus' : 'Save Bonus'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
