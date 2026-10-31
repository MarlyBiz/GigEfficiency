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
import { AppSettings, DayRecord, PlatformSlot, WeekDayPart } from '../types';
import { formatCurrency, formatHM, parseHM } from '../utils/calculations';
import { PlatformRowsEditor } from './PlatformRowsEditor';
import { NumericInput } from './NumericInput';
import {
  buildSummaryRecord, buildWeekRecord, currentMonthKey, findMonthOverlaps, findSummaryConflicts, findWeekConflicts,
  isPastPeriod, periodLabel, recordKind, sumRows, weekMonths, weekWarnings,
} from '../utils/periodSummaries';
import { dateKey, formatClock, getWeek, ruleFor, weekDates, weekRangeLabel, WEEKDAYS } from '../utils/workday';

type Kind = 'month' | 'week' | 'year';
interface DayForm { rows: PlatformSlot[]; tips: number; workText: string; totalText: string; totalMiles: string; workMiles: string }
const emptyDay = (): DayForm => ({ rows: [], tips: 0, workText: '', totalText: '', totalMiles: '', workMiles: '' });
const toDayForm = (d: WeekDayPart): DayForm => ({
  rows: d.platformEarnings || [], tips: d.cashTips || 0, workText: d.workSeconds ? formatHM(d.workSeconds) : '',
  totalText: d.totalSeconds ? formatHM(d.totalSeconds) : '', totalMiles: d.totalMiles ? String(d.totalMiles) : '', workMiles: d.workMiles ? String(d.workMiles) : '',
});
const fromDayForm = (dateStr: string, f: DayForm): WeekDayPart => ({
  dateStr, platformEarnings: f.rows, cashTips: Number(f.tips) || 0,
  workSeconds: parseHM(f.workText) ?? 0, totalSeconds: parseHM(f.totalText) ?? 0,
  totalMiles: parseFloat(f.totalMiles) || 0, workMiles: parseFloat(f.workMiles) || 0,
});
const md = (k: string) => { const [, m, d] = k.split('-').map(Number); return `${m}/${d}`; };

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
  const startKind = editing ? (recordKind(editing) as Kind) : 'month';
  const [kind, setKind] = useState<Kind>(startKind);
  // Weeks: start follows the chosen app's week start (e.g. Uber: Monday 4:00 AM)
  const appChoices = settings.defaultPlatforms?.length ? settings.defaultPlatforms : ['Uber Rides'];
  const [weekApp, setWeekApp] = useState<string>(editing?.weekApp || appChoices.find(a => /uber/i.test(a)) || appChoices[0]);
  const weekRule = ruleFor(settings, weekApp);
  const weekOptions = useMemo(() => {
    const cur = getWeek(Date.now(), weekRule).startDate;
    return Array.from({ length: 26 }, (_, i) => dateKey(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7 * i)));
  }, [weekRule.weekStartDay, weekRule.weekStartMinutes]); // eslint-disable-line react-hooks/exhaustive-deps
  const [weekKey, setWeekKey] = useState<string>(editing && startKind === 'week' ? editing.periodKey! : weekOptions[1]);
  const [split, setSplit] = useState<boolean>(!!editing?.weekDays?.length);
  const [dayForms, setDayForms] = useState<Record<string, DayForm>>(() =>
    Object.fromEntries((editing?.weekDays || []).map(d => [d.dateStr, toDayForm(d)])));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const setDay = (k: string, patch: Partial<DayForm>) => setDayForms(prev => ({ ...prev, [k]: { ...(prev[k] || emptyDay()), ...patch } }));
  const [monthKey, setMonthKey] = useState(editing && startKind === 'month' ? editing.periodKey! : lastMonthKey());
  const [yearKey, setYearKey] = useState(editing && startKind === 'year' ? editing.periodKey! : String(new Date().getFullYear() - 1));
  const [rows, setRows] = useState<PlatformSlot[]>(editing?.platformEarnings || []);
  const [bonus, setBonus] = useState<number>(editing?.totalBonusEarnings || 0);
  const [tips, setTips] = useState<number>(editing?.cashTips || 0);
  const [workText, setWorkText] = useState(editing ? formatHM(editing.workSeconds) : '');
  const [totalText, setTotalText] = useState(editing ? formatHM(editing.totalSeconds) : '');
  const [totalMiles, setTotalMiles] = useState(editing ? String(editing.totalMiles) : '');
  const [workMiles, setWorkMiles] = useState(editing ? String(editing.workMiles) : '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Load an existing summary into the form ("Edit it"). */
  const loadRecord = (r: DayRecord) => {
    const k = recordKind(r) as Kind;
    setEditing(r); setKind(k);
    if (k === 'month') setMonthKey(r.periodKey!); else if (k === 'week') setWeekKey(r.periodKey!); else setYearKey(r.periodKey!);
    if (k === 'week') {
      if (r.weekApp) setWeekApp(r.weekApp);
      setSplit(!!r.weekDays?.length); setDayForms(Object.fromEntries((r.weekDays || []).map(d => [d.dateStr, toDayForm(d)])));
    }
    setRows(r.platformEarnings || []); setBonus(r.totalBonusEarnings || 0); setTips(r.cashTips || 0);
    setWorkText(formatHM(r.workSeconds)); setTotalText(formatHM(r.totalSeconds));
    setTotalMiles(String(r.totalMiles)); setWorkMiles(String(r.workMiles)); setNotes(r.notes || ''); setError(null);
  };

  const periodKey = kind === 'month' ? monthKey : kind === 'week' ? weekKey : yearKey;
  const conflicts = useMemo(() => kind === 'week' ? { same: null, other: [] as DayRecord[] } : findSummaryConflicts(records, kind, periodKey, editing?.id), [records, kind, periodKey, editing?.id]);
  const thisWeekDates = kind === 'week' ? weekDates(weekKey) : [];
  /** The week as it would be saved (used for totals, month hint and overlap warnings). */
  const weekDraft = kind === 'week' ? buildWeekRecord({
    id: editing?.id || 'draft', periodKey: weekKey, weekApp, rows, bonus: Number(bonus) || 0, cashTips: Number(tips) || 0,
    workSeconds: parseHM(workText) ?? 0, totalSeconds: parseHM(totalText) ?? 0,
    totalMiles: parseFloat(totalMiles) || 0, workMiles: parseFloat(workMiles) || 0,
    days: split ? thisWeekDates.filter(d => dayForms[d]).map(d => fromDayForm(d, dayForms[d])) : [], notes,
  }) : null;
  const weekConf = weekDraft ? findWeekConflicts(records, weekDraft, settings, editing?.id) : null;
  const weekWarn = weekConf ? weekWarnings(weekConf) : [];
  const monthOverlap = kind === 'month' ? findMonthOverlaps(records, monthKey, settings, editing?.id) : null;
  const total = weekDraft ? weekDraft.totalEarnings : sumRows(rows) + (Number(bonus) || 0) + (Number(tips) || 0);
  const now = new Date();
  const years = Array.from({ length: 15 }, (_, i) => String(now.getFullYear() - 1 - i));

  const handleSave = () => {
    setError(null);
    if (kind === 'week' && weekDraft && weekConf) {
      if (weekKey > dateKey(new Date())) return setError('Pick a week that has started.');
      if (weekConf.same) return setError(`The week of ${weekRangeLabel(weekKey)} already has an entry. Use "Edit it" to change it.`);
      if (split && !weekDraft.weekDays?.length) return setError('Enter at least one day, or turn off "Break into days".');
      const bad = (weekDraft.weekDays || []).find(d => d.workSeconds > d.totalSeconds && d.totalSeconds > 0);
      if (bad || (!split && weekDraft.workSeconds > weekDraft.totalSeconds && weekDraft.totalSeconds > 0)) return setError('Active work time can’t be more than total time.');
      if (weekWarn.length && !window.confirm(`${weekWarn.join('\n\n')}\n\nSave anyway?`)) return;
      onSave({ ...weekDraft, id: editing?.id || `week-summary-${weekKey}-${Date.now()}`, createdAt: editing?.createdAt || weekDraft.createdAt }, []);
      onClose();
      return;
    }
    if (!isPastPeriod(kind as 'month' | 'year', periodKey)) {
      return setError(kind === 'month' ? 'Pick a month before the current month.' : 'Pick a year before this year.');
    }
    if (conflicts.same) return setError(`${periodLabel(kind, periodKey)} already has a summary. Use "Edit it" to change it.`);
    if (monthOverlap && (monthOverlap.weeks.length || monthOverlap.days.length)) {
      const parts = [
        monthOverlap.weeks.length ? `${monthOverlap.weeks.length} week entr${monthOverlap.weeks.length === 1 ? 'y' : 'ies'}` : '',
        monthOverlap.days.length ? `${monthOverlap.days.length} logged shift${monthOverlap.days.length === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(' and ');
      if (!window.confirm(`${periodLabel('month', monthKey)} already has ${parts}. A month total is added on top of them, so only enter what they don't cover.\n\nSave anyway?`)) return;
    }
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
      id: editing?.id, kind: kind as 'month' | 'year', periodKey, rows, workSeconds, totalSeconds,
      totalMiles: parseFloat(totalMiles) || 0, workMiles: parseFloat(workMiles) || 0,
      bonus: Number(bonus) || 0, cashTips: Number(tips) || 0, notes, createdAt: editing?.createdAt,
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
              <h3 className="text-base font-bold">{editing ? `Edit ${kind === 'month' ? 'Month' : kind === 'week' ? 'Week' : 'Year'} Summary` : 'Catch Up Past Months'}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Totals for a period you didn't track day by day.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Month vs whole year (year is optional, for previous years) */}
        {!editing && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 font-semibold">
            {(['month', 'week', 'year'] as const).map(k => (
              <button key={k} type="button" onClick={() => { setKind(k); setError(null); }}
                className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${kind === k ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                {k === 'month' ? 'One month' : k === 'week' ? 'Weeks' : 'Whole past year'}
              </button>
            ))}
          </div>
        )}

        <div>
          {kind === 'week' ? (
            <div className="space-y-2" data-testid="week-picker">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>Week follows</label>
                  <select aria-label="Week follows app" value={weekApp} disabled={!!editing} onChange={e => { const app = e.target.value; setWeekApp(app); setWeekKey(dateKey(getWeek(new Date(`${weekKey}T12:00:00`).getTime(), ruleFor(settings, app)).startDate)); setDayForms({}); setError(null); }} className={input}>
                    {appChoices.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Week</label>
                  <select aria-label="Week" value={weekKey} disabled={!!editing} onChange={e => { setWeekKey(e.target.value); setDayForms({}); setOpenDay(null); setError(null); }} className={input}>
                    {(weekOptions.includes(weekKey) ? weekOptions : [weekKey, ...weekOptions]).map(k => <option key={k} value={k}>{weekRangeLabel(k)}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-500" data-testid="week-hint">
                {weekApp} weeks start {WEEKDAYS[weekRule.weekStartDay]} {formatClock(weekRule.weekStartMinutes)}.{' '}
                {split
                  ? <>Each day counts in its own month{weekDraft && weekMonths(weekDraft, settings).length > 1 ? ` (${weekMonths(weekDraft, settings).map(m => periodLabel('month', m)).join(' / ')})` : ''}. The days are the whole week.</>
                  : <>A whole week counts in the month holding most of its days{weekDraft ? ` (${periodLabel('month', weekMonths(weekDraft, settings)[0])})` : ''}. Use "Break into days" to split a week across months.</>}
              </p>
              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" aria-label="Break into days" checked={split} onChange={e => { setSplit(e.target.checked); setError(null); }} className="w-4 h-4 accent-emerald-600" />
                Break into days
              </label>
            </div>
          ) : kind === 'month' ? (
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
          {kind === 'week' && weekConf?.same && (
            <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 flex items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
              <span>This week already has an entry.</span>
              <button type="button" onClick={() => loadRecord(weekConf.same!)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold cursor-pointer">Edit it</button>
            </div>
          )}
          {kind === 'week' && weekWarn.length > 0 && (
            <ul className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 space-y-1 list-disc pl-5" data-testid="week-warnings">
              {weekWarn.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {monthOverlap && (monthOverlap.weeks.length > 0 || monthOverlap.days.length > 0) && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400" data-testid="month-overlap">
              {periodLabel('month', monthKey)} already has {[
                monthOverlap.weeks.length ? `${monthOverlap.weeks.length} week entr${monthOverlap.weeks.length === 1 ? 'y' : 'ies'}` : '',
                monthOverlap.days.length ? `${monthOverlap.days.length} logged shift${monthOverlap.days.length === 1 ? '' : 's'}` : '',
              ].filter(Boolean).join(' and ')}. A month total is added on top of them.
            </p>
          )}
          {!conflicts.same && conflicts.other.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {kind === 'year'
                ? `${periodKey} already has ${conflicts.other.length} month summar${conflicts.other.length === 1 ? 'y' : 'ies'}. Saving will ask which to keep.`
                : `${periodKey.slice(0, 4)} has a whole-year summary. Saving will ask which to keep.`}
            </p>
          )}
        </div>

        {kind === 'week' && split ? (
          <div className="space-y-2" data-testid="week-days">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">Days (fill any)</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400" data-testid="summary-total">Week total: {formatCurrency(total, settings.currency)}</span>
            </div>
            {thisWeekDates.map(d => {
              const f = dayForms[d] || emptyDay();
              const dayTotal = sumRows(f.rows) + (Number(f.tips) || 0);
              const wd = WEEKDAYS[new Date(`${d}T12:00:00`).getDay()];
              return (
                <div key={d} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950" data-testid={`week-day-${d}`}>
                  <button type="button" onClick={() => setOpenDay(openDay === d ? null : d)} aria-label={`Day ${d}`}
                    className="w-full flex items-center justify-between px-3 py-2 cursor-pointer">
                    <span className="font-semibold">{wd} {md(d)}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">{dayTotal > 0 ? formatCurrency(dayTotal, settings.currency) : openDay === d ? 'Close' : 'Add'}</span>
                  </button>
                  {openDay === d && (
                    <div className="px-3 pb-3 space-y-2">
                      <PlatformRowsEditor rows={f.rows} onChange={rows => setDay(d, { rows })} options={settings.defaultPlatforms || []} currency={settings.currency} />
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className={label}>Work time</label>
                          <input type="text" aria-label="Day work time" placeholder="e.g. 6h 30m" value={f.workText} onChange={e => setDay(d, { workText: e.target.value })} className={input} /></div>
                        <div><label className={label}>Total time</label>
                          <input type="text" aria-label="Day total time" placeholder="e.g. 8h" value={f.totalText} onChange={e => setDay(d, { totalText: e.target.value })} className={input} /></div>
                        <div><label className={label}>Total miles</label>
                          <NumericInput aria-label="Day total miles" placeholder="0" value={f.totalMiles} onChange={(_v, raw) => setDay(d, { totalMiles: raw })} className={input} /></div>
                        <div><label className={label}>Work miles</label>
                          <NumericInput aria-label="Day work miles" placeholder="0" value={f.workMiles} onChange={(_v, raw) => setDay(d, { workMiles: raw })} className={input} /></div>
                        <div><label className={label}>Cash tips</label>
                          <NumericInput aria-label="Day cash tips" step="0.01" min={0} placeholder="0" value={f.tips} onChange={v => setDay(d, { tips: Math.max(0, Number(v) || 0) })} className={input} /></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (<>
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
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-700 dark:text-slate-300 font-medium">Cash tips (optional)</span>
            <div className="flex items-center gap-1 pr-8">
              <span className="text-slate-500 font-mono">{settings.currency}</span>
              <NumericInput step="0.01" min={0} value={tips} onChange={v => setTips(Math.max(0, Number(v) || 0))} placeholder="0" aria-label="Summary cash tips"
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
            <NumericInput aria-label="Total Miles" placeholder="0" value={totalMiles} onChange={(_v, raw) => setTotalMiles(raw)} className={input} />
          </div>
          <div>
            <label className={label}>Work Miles</label>
            <NumericInput aria-label="Work Miles" placeholder="0" value={workMiles} onChange={(_v, raw) => setWorkMiles(raw)} className={input} />
          </div>
        </div>

        </>)}

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
