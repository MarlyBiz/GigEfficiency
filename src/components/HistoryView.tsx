/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Calendar, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  Clock, 
  Navigation, 
  AlertTriangle, 
  X, 
  Sparkles,
  Gift
} from 'lucide-react';
import { AppSettings, DayRecord } from '../types';
import { formatCurrency, formatDuration, formatRate, formatHM } from '../utils/calculations';
import { getBonusTypeMeta } from '../utils/bonuses';

interface HistoryViewProps {
  records: DayRecord[];
  settings: AppSettings;
  onSelectRecord: (record: DayRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAllData?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  records,
  settings,
  onSelectRecord,
  onDeleteRecord,
  onClearAllData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recordToDelete, setRecordToDelete] = useState<DayRecord | null>(null);

  // Total historical bonus calculations
  const totalHistoricalBonuses = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.totalBonusEarnings || 0), 0);
  }, [records]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return records
      .filter(r => {
        const matchesDate = r.dateStr.includes(term);
        const matchesNotes = (r.notes || '').toLowerCase().includes(term);
        const matchesPlatform = (r.platformEarnings || []).some(p =>
          p.name.toLowerCase().includes(term)
        );
        const matchesBonus = (r.bonusEarnings || []).some(b =>
          b.platform.toLowerCase().includes(term) ||
          (b.notes || '').toLowerCase().includes(term) ||
          b.bonusType.toLowerCase().includes(term)
        );
        return matchesDate || matchesNotes || matchesPlatform || matchesBonus;
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [records, searchTerm]);

  const confirmDelete = () => {
    if (recordToDelete) {
      onDeleteRecord(recordToDelete.id);
      setRecordToDelete(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP HEADER & SEARCH */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Shift Log Archive
            </span>
            <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Driving History ({records.length} shifts)
              </h2>
              {totalHistoricalBonuses > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 font-mono">
                  <Gift className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  +{formatCurrency(totalHistoricalBonuses, settings.currency)} in Quests & Bonuses
                </span>
              )}
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by date, platform, notes..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Shift List Cards */}
        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 space-y-2">
            <p>No driving records match your search.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {filteredRecords.map((record, rIdx) => {
              const estTax = record.totalMiles * (settings.standardMileageRate || 0.67);
              return (
                <div
                  key={record.id ? `${record.id}-${rIdx}` : `shift-${record.dateStr}-${rIdx}`}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                        {record.dateStr}
                      </span>
                      <span className="text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                        {formatCurrency(record.totalEarnings, settings.currency)}
                      </span>
                      {record.totalBonusEarnings && record.totalBonusEarnings > 0 ? (
                        <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                          <Gift className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          +{formatCurrency(record.totalBonusEarnings, settings.currency)} bonus
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-1">
                      <span>Work $/Hr: <strong className="font-mono text-emerald-700 dark:text-emerald-400">{formatRate(record.dollarsPerHourWork, settings.currency, 'hr')}</strong></span>
                      <span>Total $/Hr: <strong className="font-mono text-blue-700 dark:text-blue-400">{formatRate(record.dollarsPerHourTotal, settings.currency, 'hr')}</strong></span>
                      <span>Work Time: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatHM(record.workSeconds)}</strong></span>
                      <span>Miles: <strong className="font-mono text-slate-800 dark:text-slate-200">{record.totalMiles} mi</strong></span>
                      <span>Tax Write-off: <strong className="font-mono text-amber-700 dark:text-amber-400">{formatCurrency(estTax, settings.currency)}</strong></span>
                    </div>

                    {record.notes && (
                      <p className="text-xs italic text-slate-500 pt-1">"{record.notes}"</p>
                    )}

                    {/* Platform slots & Bonuses tags */}
                    <div className="flex flex-wrap items-center gap-1 pt-1.5">
                      {record.platformEarnings && (
                        record.platformEarnings
                          .filter(p => p.amount > 0)
                          .map((p, pIdx) => (
                            <span
                              key={p.id ? `${p.id}-${pIdx}` : `plat-${p.name}-${pIdx}`}
                              className="px-2 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                            >
                              {p.name}: {formatCurrency(p.amount, settings.currency)}
                            </span>
                          ))
                      )}

                      {record.bonusEarnings && record.bonusEarnings.length > 0 && (
                        record.bonusEarnings.map((b, bIdx) => {
                          const meta = getBonusTypeMeta(b.bonusType);
                          return (
                            <span
                              key={b.id ? `${b.id}-${bIdx}` : `hist-bonus-${bIdx}`}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono border ${meta.badgeBg} ${meta.badgeText} flex items-center gap-1`}
                              title={b.notes || meta.title}
                            >
                              <Gift className="w-2.5 h-2.5 opacity-70" />
                              <span>{b.platform} {meta.title.split(' ')[0]}:</span>
                              <strong className="font-bold">+{formatCurrency(b.amount, settings.currency)}</strong>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => onSelectRecord(record)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setRecordToDelete(record)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Delete Shift"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Shift Record?</h3>
              </div>
              <button
                onClick={() => setRecordToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 text-xs text-slate-600 dark:text-slate-400">
              <p>
                Are you sure you want to delete the shift for <strong>{recordToDelete.dateStr}</strong> ({formatCurrency(recordToDelete.totalEarnings, settings.currency)})?
              </p>
              <p className="mt-1 text-slate-500">This action cannot be undone.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
