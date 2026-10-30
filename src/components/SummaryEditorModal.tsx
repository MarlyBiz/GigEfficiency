/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * "Catch up past months": enter totals for a past month, or (optionally) a whole past year,
 * without inventing daily shifts. Saved as a month/year summary record.
 * A period can only have one summary, and a year can't have a year summary and month summaries
 * at the same time (the user is asked which to keep).
 */

import React, { useMemo, useState } from 'react';
import { X, Save, Trash2, CalendarRange } from 'lucide-react';
import { AppSettings, DayRecord, PlatformSlot } from '../types';
import { formatCurrency, formatHM, parseHM } from '../utils/calculations';
import { PlatformRowsEditor } from './PlatformRowsEditor';
import { NumericInput } from './NumericInput';
import {
  buildSummaryRecord, currentMonthKey, findSummaryConflicts, isPastPeriod, periodLabel, recordKind, sumRows,
} from '../utils/periodSummaries';

interface Props {
  record: DayRecord | null; // existing summary to edit, or null for a new one
  records: DayRecord[];
  settings: AppSettings;
  onSave: (record: DayRecord, removeIds: string[]) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const input = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500';
const label = 'font-bold text-slate-700 dark:text-slate-300 block mb-1';

/** Previous month as 'YYYY-MM'. */
function lastMonthKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return currentMonthKey(d);
}

export const SummaryEditorModal: React.FC<Props> = ({ record, records, settings, onSave, onDelete, onClose }) => {
  const [editing, setEditing] = useState<DayRecord | null>(record);
  const startKind = editing ? (recordKind(editing) as 'month' | 'year') : 'month';
  const [kind, setKind] = useState<'month' | 'year'>(startKind);
  const [monthKey, setMonthKey] = useState(editing && startKind === 'month' ? editing.periodKey! : lastMonthKey());
  const [yearKey, setYearKey] = useState(editing && startKind === 'year' ? editing.periodKey! : String(new Date().getFullYear() - 1));
  const [rows, setRows] = useState<PlatformSlot[]>(editing?.platformEarnings || []);
  const [bonus, setBonus] = useState<number>(editing?.totalBonusEarnings || 0);
  const [workText, setWorkText] = useState(editing ? formatHM(editing.workSeconds) : '');
  const [totalText, setTotalText] = useState(editing ? formatHM(editing.totalSeconds) : '');
  const [totalMiles, setTotalMiles] = useState(editing ? String(editing.totalMiles) : '');
  const [workMiles, setWorkMiles] = useState(editing ? String(editing.workMiles) : '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Load an existing summary into the form ("Edit it"). */
  const loadRecord = (r: DayRecord) => {
    const k = recordKind(r) as 'month' | 'year';
    setEditing(r); setKind(k);
    if (k === 'month') setMonthKey(r.periodKey!); else setYearKey(r.periodKey!);
    setRows(r.platformEarnings || []); setBonus(r.totalBonusEarnings || 0);
    setWorkText(formatHM(r.workSeconds)); setTotalText(formatHM(r.totalSeconds));
    setTotalMiles(String(r.totalMiles)); setWorkMiles(String(r.workMiles)); setNotes(r.notes || ''); setError(null);
  };

  const periodKey = kind === 'month' ? monthKey : yearKey;
  const conflicts = useMemo(() => findSummaryConflicts(records, kind, periodKey, editing?.id), [records, kind, periodKey, editing?.id]);
  const total = sumRows(rows) + (Number(bonus) || 0);
  const now = new Date();
  const years = Array.from({ length: 15 }, (_, i) => String(now.getFullYear() - 1 - i));

  const handleSave = () => {
    setError(null);
    if (!isPastPeriod(kind, periodKey)) {
      return setError(kind === 'month' ? 'Pick a month before the current month.' : 'Pick a year before this year.');
    }
    if (conflicts.same) return setError(`${periodLabel(kind, periodKey)} already has a summary. Use "Edit it" to change it.`);
    const workSeconds = parseHM(workText) ?? 0;
    const totalSeconds = parseHM(totalText) ?? 0;
    if (workSeconds > totalSeconds && totalSeconds > 0) return setError('Active work time can’t be more than total time.');
    let removeIds: string[] = [];
    if (conflicts.other.length) {
      const yr = periodKey.slice(0, 4);
      const ok = kind === 'year'
        ? window.confirm(`${yr} already has ${conflicts.other.length} month summar${conflicts.other.length === 1 ? 'y' : 'ies'}.\n\nOK: keep this year summary and delete those month summaries.\nCancel: keep the month summaries.`)
        : window.confirm(`${yr} already has a whole-year summary.\n\nOK: switch ${yr} to month by month (deletes the year summary).\nCancel: keep the year summary.`);
      if (!ok) return;
      removeIds = conflicts.other.map(r => r.id);
    }
    onSave(buildSummaryRecord({
      id: editing?.id, kind, periodKey, rows, workSeconds, totalSeconds,
      totalMiles: parseFloat(totalMiles) || 0, workMiles: parseFloat(workMiles) || 0,
      bonus: Number(bonus) || 0, notes, createdAt: editing?.createdAt,
    }), removeIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md" role="dialog" aria-label="Catch up past months">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto space-y-4 text-xs" data-testid="summary-editor">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-base font-bold">{editing ? `Edit ${kind === 'month' ? 'Month' : 'Year'} Summary` : 'Catch Up Past Months'}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Totals for a period you didn't track day by day.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Month vs whole year (year is optional, for previous years) */}
        {!editing && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 font-semibold">
            {(['month', 'year'] as const).map(k => (
              <button key={k} type="button" onClick={() => { setKind(k); setError(null); }}
                className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${kind === k ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                {k === 'month' ? 'One month' : 'Whole past year'}
              </button>
            ))}
          </div>
        )}

        <div>
          {kind === 'month' ? (
            <>
              <label className={label}>Month</label>
              <input type="month" aria-label="Month" value={monthKey} max={lastMonthKey()} min="1990-01" disabled={!!editing}
                onChange={e => { setMonthKey(e.target.value); setError(null); }} className={input} />
            </>
          ) : (
            <>
              <label className={label}>Year</label>
              <select aria-label="Year" value={yearKey} disabled={!!editing} onChange={e => { setYearKey(e.target.value); setError(null); }} className={input}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Counts only in {yearKey}'s yearly totals. To enter {yearKey} month by month, use "One month" instead.</p>
            </>
          )}
          {conflicts.same && (
            <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 flex items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
              <span>{periodLabel(kind, periodKey)} already has a summary.</span>
              <button type="button" onClick={() => loadRecord(conflicts.same!)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold cursor-pointer">Edit it</button>
            </div>
          )}
          {!conflicts.same && conflicts.other.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {kind === 'year'
                ? `${periodKey} already has ${conflicts.other.length} month summar${conflicts.other.length === 1 ? 'y' : 'ies'}. Saving will ask which to keep.`
                : `${periodKey.slice(0, 4)} has a whole-year summary. Saving will ask which to keep.`}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 dark:text-slate-300">Earnings per app</span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400" data-testid="summary-total">Total: {formatCurrency(total, settings.currency)}</span>
          </div>
          <PlatformRowsEditor rows={rows} onChange={setRows} options={settings.defaultPlatforms || []} currency={settings.currency} />
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Bonuses & quests (optional)</span>
            <div className="flex items-center gap-1 pr-8">
              <span className="text-slate-500 font-mono">{settings.currency}</span>
              <NumericInput step="0.01" min={0} value={bonus} onChange={v => setBonus(Math.max(0, Number(v) || 0))} placeholder="0"
                className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-right focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Active Work Time</label>
            <input type="text" aria-label="Active Work Time" placeholder="e.g. 96h 30m" value={workText}
              onChange={e => setWorkText(e.target.value)} onBlur={() => { const s = parseHM(workText); if (s !== null) setWorkText(formatHM(s)); }} className={input} />
          </div>
          <div>
            <label className={label}>Total Time</label>
            <input type="text" aria-label="Total Time" placeholder="e.g. 120h" value={totalText}
              onChange={e => setTotalText(e.target.value)} onBlur={() => { const s = parseHM(totalText); if (s !== null) setTotalText(formatHM(s)); }} className={input} />
          </div>
          <div>
            <label className={label}>Total Miles</label>
            <input type="text" inputMode="decimal" aria-label="Total Miles" placeholder="0" value={totalMiles} onChange={e => setTotalMiles(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Work Miles</label>
            <input type="text" inputMode="decimal" aria-label="Work Miles" placeholder="0" value={workMiles} onChange={e => setWorkMiles(e.target.value)} className={input} />
          </div>
        </div>

        <div>
          <label className={label}>Notes</label>
          <textarea aria-label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${input} font-sans`} />
        </div>

        {error && <p className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 font-semibold" data-testid="summary-error">{error}</p>}

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          {editing ? (
            confirmDelete ? (
              <span className="flex items-center gap-2">
                <span className="text-rose-600 font-semibold">Delete?</span>
                <button type="button" onClick={() => { onDelete(editing.id); onClose(); }} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer">Delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer">No</button>
              </span>
            ) : (
              <button type="button" title="Delete this summary" aria-label="Delete summary" onClick={() => setConfirmDelete(true)}
                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            )
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer">Cancel</button>
            <button type="button" onClick={handleSave} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer">
              <Save className="w-4 h-4" /> Save Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
