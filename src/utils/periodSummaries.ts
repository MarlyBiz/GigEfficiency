/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Helpers for editable earnings rows (per app) and for catch-up summaries:
 * month summaries ('YYYY-MM') and year summaries ('YYYY') stored alongside daily shifts.
 *
 * Where each kind counts:
 *  - day:   everything (7-Day Week, daily/weekly charts and averages, all totals)
 *  - month: monthly, yearly and closeout totals, goals/YTD, monthly charts; never in
 *           the 7-Day Week or daily/weekly averages
 *  - year:  only that year's yearly/closeout totals (past years only)
 *  - week:  like month (monthly/yearly totals, goals, monthly charts; never the 7-Day Week or
 *           daily/weekly charts). A whole week counts in the month holding most of its days;
 *           a week broken into days counts each day on its own date (see periodParts).
 */

import { AppSettings, BonusEntry, DayRecord, PlatformSlot, RecordKind, WeekDayPart } from '../types';
import { monthKeyForRecord, weekDates, weekRangeLabel } from './workday';

export const recordKind = (r: Pick<DayRecord, 'kind'>): RecordKind => (r.kind === 'month' || r.kind === 'year' || r.kind === 'week' ? r.kind : 'day');
export const isDayRecord = (r: Pick<DayRecord, 'kind'>) => recordKind(r) === 'day';
export const isSummaryRecord = (r: Pick<DayRecord, 'kind'>) => recordKind(r) !== 'day';

// ---------- Editable app rows ----------

const norm = (s: string) => s.trim().toLowerCase();

/** Apps from Settings that aren't already a row. */
export function availableApps(options: string[], rows: PlatformSlot[]): string[] {
  const used = new Set(rows.map(r => norm(r.name)));
  return [...new Set(options.map(o => o.trim()).filter(Boolean))].filter(o => !used.has(norm(o)));
}

/** Adds an app row; throws a readable Error for empty names or duplicates (case-insensitive). */
export function addAppRow(rows: PlatformSlot[], name: string): PlatformSlot[] {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error('Enter an app name.');
  if (rows.some(r => norm(r.name) === norm(clean))) throw new Error(`${clean} is already in the list.`);
  return [...rows, { id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: clean, amount: 0 }];
}

export const removeAppRow = (rows: PlatformSlot[], id: string) => rows.filter(r => r.id !== id);
export const sumRows = (rows: PlatformSlot[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

// ---------- Periods ----------

const pad = (n: number) => String(n).padStart(2, '0');
export const currentMonthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** Month 'YYYY-MM' strictly before the current month, or year 'YYYY' strictly before the current year. */
export function isPastPeriod(kind: 'month' | 'year', key: string, now = new Date()): boolean {
  if (kind === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) && key < currentMonthKey(now) && key >= '1990-01';
  return /^\d{4}$/.test(key) && +key < now.getFullYear() && +key >= 1990;
}

export function periodLabel(kind: 'week' | 'month' | 'year', key: string): string {
  if (kind === 'year') return key;
  if (kind === 'week') return weekRangeLabel(key);
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Conflicts for saving a summary:
 *  - same: an existing summary for exactly this period (block or edit it instead)
 *  - other: for a year summary, that year's month summaries; for a month summary, that
 *    month's year summary (a year can't have both at once)
 */
export function findSummaryConflicts(records: DayRecord[], kind: 'month' | 'year', key: string, excludeId?: string) {
  const others = records.filter(r => r.id !== excludeId);
  const same = others.find(r => recordKind(r) === kind && r.periodKey === key) || null;
  const year = key.slice(0, 4);
  const other = kind === 'year'
    ? others.filter(r => recordKind(r) === 'month' && (r.periodKey || '').startsWith(`${year}-`))
    : others.filter(r => recordKind(r) === 'year' && r.periodKey === year);
  return { same, other };
}

export interface SummaryInput {
  id?: string;
  kind: 'month' | 'year';
  periodKey: string;
  rows: PlatformSlot[];
  workSeconds: number;
  totalSeconds: number;
  totalMiles: number;
  workMiles: number;
  bonus: number;
  cashTips?: number;
  notes: string;
  createdAt?: number;
}

/** Builds the stored record for a month/year summary (rates use the app's usual formulas). */
export function buildSummaryRecord(i: SummaryInput, now = Date.now()): DayRecord {
  const [y, m] = i.kind === 'month' ? i.periodKey.split('-').map(Number) : [Number(i.periodKey), 1];
  const dateStr = `${y}-${pad(m)}-01`;
  const startTime = new Date(y, m - 1, 1, 0, 0, 0, 0).getTime();
  const baseEarnings = Number(sumRows(i.rows).toFixed(2));
  const bonusAmt = Math.max(0, Number(i.bonus) || 0);
  const bonusEarnings: BonusEntry[] = bonusAmt > 0
    ? [{ id: `${i.id || 'sum'}-bonus`, platform: 'All apps', bonusType: 'other_custom', amount: bonusAmt, dateStr, notes: 'Bonus total (catch-up)', createdAt: now }]
    : [];
  const tips = Math.max(0, Number(i.cashTips) || 0);
  const totalEarnings = Number((baseEarnings + bonusAmt + tips).toFixed(2));
  const tH = i.totalSeconds / 3600, wH = i.workSeconds / 3600;
  const r2 = (n: number) => Number(n.toFixed(2));
  return {
    id: i.id || `${i.kind}-summary-${i.periodKey}-${now}`,
    kind: i.kind,
    periodKey: i.periodKey,
    dateStr,
    startTime,
    endTime: startTime,
    totalSeconds: Math.max(0, Math.round(i.totalSeconds)),
    workSeconds: Math.max(0, Math.round(i.workSeconds)),
    totalMiles: Math.max(0, i.totalMiles || 0),
    workMiles: Math.max(0, i.workMiles || 0),
    platformEarnings: i.rows.map(r => ({ ...r, amount: Math.max(0, Number(r.amount) || 0) })),
    bonusEarnings,
    baseEarnings,
    totalBonusEarnings: bonusAmt,
    cashTips: tips,
    totalEarnings,
    dollarsPerHourTotal: tH > 0 ? r2(totalEarnings / tH) : 0,
    dollarsPerHourWork: wH > 0 ? r2(totalEarnings / wH) : 0,
    dollarsPerMileTotal: i.totalMiles > 0 ? r2(totalEarnings / i.totalMiles) : 0,
    dollarsPerMileWork: i.workMiles > 0 ? r2(totalEarnings / i.workMiles) : 0,
    notes: i.notes || '',
    createdAt: i.createdAt || now,
  };
}

/** Empty record for "Add past day" (no apps pre-chosen). */
export function emptyDayRecord(dateStr: string, now = Date.now()): DayRecord {
  const startTime = new Date(`${dateStr}T16:00:00`).getTime();
  return {
    id: `manual-${dateStr}-${now}`, dateStr, startTime, endTime: startTime, totalSeconds: 0, workSeconds: 0,
    totalMiles: 0, workMiles: 0, platformEarnings: [], bonusEarnings: [], baseEarnings: 0, totalBonusEarnings: 0,
    totalEarnings: 0, dollarsPerHourTotal: 0, dollarsPerHourWork: 0, dollarsPerMileTotal: 0, dollarsPerMileWork: 0,
    notes: '', createdAt: now,
  };
}

// ---------- Week summaries ----------

const r2w = (n: number) => Number((Number(n) || 0).toFixed(2));
const partEarnings = (d: WeekDayPart) => sumRows(d.platformEarnings || []) + (Number(d.cashTips) || 0);
const hasData = (d: WeekDayPart) => partEarnings(d) > 0 || d.workSeconds > 0 || d.totalSeconds > 0 || d.totalMiles > 0 || d.workMiles > 0;

export interface WeekInput {
  id?: string;
  periodKey: string; // week start 'YYYY-MM-DD'
  weekApp?: string;
  rows: PlatformSlot[];
  bonus: number;
  cashTips: number;
  workSeconds: number;
  totalSeconds: number;
  totalMiles: number;
  workMiles: number;
  /** Break into days: when any day has data, the days replace the week-level amounts. */
  days?: WeekDayPart[];
  notes: string;
  createdAt?: number;
}

/** Stored record for a week summary. Split weeks: totals are the sum of the days (no bonus/remainder). */
export function buildWeekRecord(i: WeekInput, now = Date.now()): DayRecord {
  const inWeek = new Set(weekDates(i.periodKey));
  const days = (i.days || []).filter(d => inWeek.has(d.dateStr) && hasData(d)).map(d => ({
    dateStr: d.dateStr,
    platformEarnings: (d.platformEarnings || []).map(p => ({ ...p, amount: Math.max(0, Number(p.amount) || 0) })),
    cashTips: Math.max(0, Number(d.cashTips) || 0),
    workSeconds: Math.max(0, Math.round(d.workSeconds || 0)), totalSeconds: Math.max(0, Math.round(d.totalSeconds || 0)),
    totalMiles: Math.max(0, Number(d.totalMiles) || 0), workMiles: Math.max(0, Number(d.workMiles) || 0),
  })).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const split = days.length > 0;
  let rows: PlatformSlot[], bonusAmt: number, tips: number, ws: number, ts: number, tm: number, wm: number;
  if (split) {
    const byApp = new Map<string, PlatformSlot>();
    for (const d of days) for (const p of d.platformEarnings) {
      const k = p.name.trim().toLowerCase(), hit = byApp.get(k);
      if (hit) hit.amount = r2w(hit.amount + p.amount); else byApp.set(k, { ...p });
    }
    rows = [...byApp.values()]; bonusAmt = 0;
    tips = r2w(days.reduce((s, d) => s + (d.cashTips || 0), 0));
    ws = days.reduce((s, d) => s + d.workSeconds, 0); ts = days.reduce((s, d) => s + d.totalSeconds, 0);
    tm = r2w(days.reduce((s, d) => s + d.totalMiles, 0)); wm = r2w(days.reduce((s, d) => s + d.workMiles, 0));
  } else {
    rows = i.rows.map(r => ({ ...r, amount: Math.max(0, Number(r.amount) || 0) }));
    bonusAmt = Math.max(0, Number(i.bonus) || 0); tips = Math.max(0, Number(i.cashTips) || 0);
    ws = Math.max(0, Math.round(i.workSeconds)); ts = Math.max(0, Math.round(i.totalSeconds));
    tm = Math.max(0, i.totalMiles || 0); wm = Math.max(0, i.workMiles || 0);
  }
  const [y, m, d] = i.periodKey.split('-').map(Number);
  const startTime = new Date(y, m - 1, d).getTime();
  const baseEarnings = r2w(sumRows(rows));
  const totalEarnings = r2w(baseEarnings + bonusAmt + tips);
  const bonusEarnings: BonusEntry[] = bonusAmt > 0
    ? [{ id: `${i.id || 'wk'}-bonus`, platform: 'All apps', bonusType: 'other_custom', amount: bonusAmt, dateStr: i.periodKey, notes: 'Bonus total (week catch-up)', createdAt: now }]
    : [];
  const tH = ts / 3600, wH = ws / 3600;
  return {
    id: i.id || `week-summary-${i.periodKey}-${now}`,
    kind: 'week', periodKey: i.periodKey, ...(i.weekApp ? { weekApp: i.weekApp } : {}),
    ...(split ? { weekDays: days } : {}),
    dateStr: i.periodKey, startTime, endTime: startTime,
    totalSeconds: ts, workSeconds: ws, totalMiles: tm, workMiles: wm,
    platformEarnings: rows, bonusEarnings, baseEarnings, totalBonusEarnings: bonusAmt, cashTips: tips, totalEarnings,
    dollarsPerHourTotal: tH > 0 ? r2w(totalEarnings / tH) : 0,
    dollarsPerHourWork: wH > 0 ? r2w(totalEarnings / wH) : 0,
    dollarsPerMileTotal: tm > 0 ? r2w(totalEarnings / tm) : 0,
    dollarsPerMileWork: wm > 0 ? r2w(totalEarnings / wm) : 0,
    notes: i.notes || '', createdAt: i.createdAt || now,
  };
}

/**
 * Records as they count in month/year totals: a week broken into days becomes one part per day
 * (each on its own date's month); everything else is unchanged.
 */
export function periodParts(records: DayRecord[]): DayRecord[] {
  const out: DayRecord[] = [];
  for (const r of records) {
    if (recordKind(r) !== 'week' || !r.weekDays?.length) { out.push(r); continue; }
    for (const d of r.weekDays) {
      const base = sumRows(d.platformEarnings || []), tips = Number(d.cashTips) || 0, total = r2w(base + tips);
      out.push({
        ...r, id: `${r.id}@${d.dateStr}`, weekDays: undefined, attributedDate: d.dateStr,
        platformEarnings: d.platformEarnings, bonusEarnings: [], baseEarnings: r2w(base), totalBonusEarnings: 0, cashTips: tips,
        totalEarnings: total, workSeconds: d.workSeconds, totalSeconds: d.totalSeconds, totalMiles: d.totalMiles, workMiles: d.workMiles,
      });
    }
  }
  return out;
}

/** Months ('YYYY-MM') a week record (or week input) counts in. */
export function weekMonths(r: DayRecord, settings: Partial<AppSettings>): string[] {
  return [...new Set(periodParts([r]).map(p => monthKeyForRecord(p, settings)))].sort();
}

/**
 * What a week entry could double count with:
 *  - same:   a week summary starting the same day (block; edit it instead)
 *  - weeks:  other week summaries covering any of the same dates
 *  - days:   real logged shifts on the week's dates (their money is already counted)
 *  - months: month summaries for a month this week counts in
 *  - years:  year summaries for a year this week counts in
 */
export function findWeekConflicts(records: DayRecord[], week: DayRecord, settings: Partial<AppSettings>, excludeId?: string) {
  const others = records.filter(r => r.id !== excludeId && r.id !== week.id);
  const dates = new Set(weekDates(week.periodKey!));
  const months = new Set(weekMonths(week, settings));
  const years = new Set([...months].map(m => m.slice(0, 4)));
  const same = others.find(r => recordKind(r) === 'week' && r.periodKey === week.periodKey) || null;
  const weeks = others.filter(r => recordKind(r) === 'week' && r !== same && weekDates(r.periodKey || r.dateStr).some(d => dates.has(d)));
  const days = others.filter(r => recordKind(r) === 'day' && dates.has(r.dateStr));
  const monthSums = others.filter(r => recordKind(r) === 'month' && months.has(r.periodKey || ''));
  const yearSums = others.filter(r => recordKind(r) === 'year' && years.has(r.periodKey || ''));
  return { same, weeks, days, months: monthSums, years: yearSums };
}

/** Week summaries and real shifts already counted in a month (warned about when saving a month total). */
export function findMonthOverlaps(records: DayRecord[], monthKey: string, settings: Partial<AppSettings>, excludeId?: string) {
  const others = records.filter(r => r.id !== excludeId);
  const weeks = others.filter(r => recordKind(r) === 'week' && weekMonths(r, settings).includes(monthKey));
  const days = others.filter(r => recordKind(r) === 'day' && monthKeyForRecord(r, settings) === monthKey);
  return { weeks, days };
}

/** Plain-language overlap warnings for a week (empty = none). */
export function weekWarnings(c: ReturnType<typeof findWeekConflicts>): string[] {
  const w: string[] = [];
  const md = (k: string) => { const [, m, d] = k.split('-').map(Number); return `${m}/${d}`; };
  if (c.days.length) {
    const ds = [...new Set(c.days.map(d => d.dateStr))].sort();
    w.push(`You logged shifts on ${ds.map(md).join(', ')} in this week. Those already count, so enter only what's not in them, or this double counts.`);
  }
  if (c.weeks.length) w.push(`Another week entry (${c.weeks.map(r => weekRangeLabel(r.periodKey || r.dateStr)).join(', ')}) covers some of the same days.`);
  for (const m of c.months) w.push(`${periodLabel('month', m.periodKey!)} already has a month total. This week would be added on top of it.`);
  for (const y of c.years) w.push(`${y.periodKey} has a whole-year total. This week would be added on top of it.`);
  return w;
}

