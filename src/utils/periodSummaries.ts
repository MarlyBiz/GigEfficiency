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
 */

import { BonusEntry, DayRecord, PlatformSlot, RecordKind } from '../types';

export const recordKind = (r: Pick<DayRecord, 'kind'>): RecordKind => (r.kind === 'month' || r.kind === 'year' ? r.kind : 'day');
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

export function periodLabel(kind: 'month' | 'year', key: string): string {
  if (kind === 'year') return key;
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
  const totalEarnings = Number((baseEarnings + bonusAmt).toFixed(2));
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
