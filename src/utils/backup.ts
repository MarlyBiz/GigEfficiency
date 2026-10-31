/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Full JSON backup / restore of everything the app keeps in localStorage.
 *
 * Shape: { app: 'gig-efficiency', schema: 1, exportedAt, data: {...} }
 * Included: shift history, the in-progress shift (timestamps are absolute, so it keeps
 * counting correctly after a restore), expenses, settings (goals, rates, cutoffs),
 * onboarding flag, and reminder settings.
 * Never included: the home location (stays on this phone), geofence state, and any push
 * subscription/endpoint (those live in the browser, not in localStorage).
 *
 * Restore validates the whole file before writing anything, and rolls back if a write fails.
 */

import { ActiveSession, AppSettings, DayRecord, ExpenseRecord } from '../types';
import {
  STORAGE_KEYS, loadSettings, loadHistory, loadExpenses, loadHasOnboarded,
} from './storage';
import { loadReminderConfig } from './reminders';
import { minuteKey, summaryKey } from './csvImport';
import { recordKind } from './periodSummaries';

export const BACKUP_APP = 'gig-efficiency';
export const BACKUP_SCHEMA = 1;
const REMINDERS_KEY = 'gig_tracker_reminders_v1';

export interface BackupData {
  settings: AppSettings;
  history: DayRecord[];
  expenses: ExpenseRecord[];
  activeSession: ActiveSession | null;
  hasOnboarded: boolean;
  /** Reminder settings without the home area (device-only). */
  reminders: Record<string, unknown>;
}

export interface GigBackup {
  app: typeof BACKUP_APP;
  schema: typeof BACKUP_SCHEMA;
  exportedAt: string; // ISO timestamp
  data: BackupData;
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Reminder config minus anything location-related. */
function remindersWithoutHome(cfg: Record<string, unknown>): Record<string, unknown> {
  const { home, homeEnabled, ...rest } = cfg as any;
  void home; void homeEnabled;
  return rest;
}

/** Safe JSON read of one key (null on missing or corrupt data). */
function readJSON(key: string): any {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/**
 * Snapshot of the app's stored data, exactly as stored (so a restore is lossless).
 * Falls back to the app's own safe loaders when a key is missing or corrupt.
 */
export function buildBackup(now = new Date()): GigBackup {
  const rawSettings = readJSON(STORAGE_KEYS.SETTINGS);
  const settings: AppSettings = isObj(rawSettings) ? (rawSettings as AppSettings) : loadSettings();
  const rawHistory = readJSON(STORAGE_KEYS.HISTORY);
  const rawExpenses = readJSON(STORAGE_KEYS.EXPENSES);
  const rawSession = readJSON(STORAGE_KEYS.ACTIVE_SESSION);
  const session: ActiveSession | null = isObj(rawSession) && Array.isArray(rawSession.workSegments)
    ? (rawSession as ActiveSession)
    : null;
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: now.toISOString(),
    data: {
      settings,
      history: Array.isArray(rawHistory) ? rawHistory : loadHistory(),
      expenses: Array.isArray(rawExpenses) ? rawExpenses : loadExpenses(),
      activeSession: session && session.status !== 'not_started' ? session : null,
      hasOnboarded: loadHasOnboarded(),
      reminders: remindersWithoutHome(loadReminderConfig() as unknown as Record<string, unknown>),
    },
  };
}

/** Local-date file name: gig-backup-YYYY-MM-DD.json */
export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `gig-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export function downloadBackup(): GigBackup {
  const backup = buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return backup;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses and checks a backup file. Throws an Error with a readable message on anything wrong.
 * Nothing is written here.
 */
export function parseBackup(text: string): GigBackup {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!isObj(j) || j.app !== BACKUP_APP) throw new Error('This is not a Gig Efficiency Tracker backup.');
  if (j.schema !== BACKUP_SCHEMA) throw new Error(`Unsupported backup version (${String(j.schema)}).`);
  const d = j.data;
  if (!isObj(d)) throw new Error('Backup has no data.');
  if (!isObj(d.settings)) throw new Error('Backup settings are missing.');
  if (!Array.isArray(d.history)) throw new Error('Backup shift history is missing.');
  d.history.forEach((r: any, i: number) => {
    if (!isObj(r) || !DATE.test(String(r.dateStr)) || !Number.isFinite(r.startTime) || !Number.isFinite(r.totalSeconds)
      || !Number.isFinite(r.totalEarnings) || !Array.isArray(r.platformEarnings)) {
      throw new Error(`Shift #${i + 1} in the backup is damaged.`);
    }
  });
  const expenses = d.expenses ?? [];
  if (!Array.isArray(expenses) || expenses.some((e: any) => !isObj(e) || !DATE.test(String(e.dateStr)) || !Number.isFinite(e.amount))) {
    throw new Error('Backup expenses are damaged.');
  }
  const session = d.activeSession ?? null;
  if (session !== null && (!isObj(session) || typeof session.status !== 'string' || !Array.isArray(session.workSegments))) {
    throw new Error('The in-progress shift in the backup is damaged.');
  }
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: String(j.exportedAt || ''),
    data: {
      settings: d.settings as AppSettings,
      history: d.history,
      expenses,
      activeSession: session,
      hasOnboarded: !!d.hasOnboarded,
      reminders: isObj(d.reminders) ? remindersWithoutHome(d.reminders) : {},
    },
  };
}

/** Writes key/value pairs; if any write fails (e.g. storage full) every key is put back. */
function writeAllOrNothing(entries: [string, string | null][]) {
  const before = entries.map(([k]) => [k, localStorage.getItem(k)] as const);
  try {
    for (const [k, v] of entries) v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
  } catch (e) {
    for (const [k, v] of before) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } }
    throw new Error('Could not save the backup on this device (storage may be full). Nothing was changed.');
  }
}

export interface RestoreResult { mode: 'replace' | 'merge'; shiftsAdded: number; duplicates: number }

/**
 * Replace: everything from the backup replaces this device's data, except the home area,
 * which is kept from this device. Merge: only shifts are added, skipping duplicates with the
 * same rule as the CSV import (date + local start minute, or date + total time + earnings).
 */
export function applyBackup(backup: GigBackup, mode: 'replace' | 'merge'): RestoreResult {
  const d = backup.data;
  if (mode === 'replace') {
    const current = loadReminderConfig();
    const reminders = { ...d.reminders, home: current.home, homeEnabled: current.homeEnabled };
    writeAllOrNothing([
      [STORAGE_KEYS.SETTINGS, JSON.stringify(d.settings)],
      [STORAGE_KEYS.HISTORY, JSON.stringify(d.history)],
      [STORAGE_KEYS.EXPENSES, JSON.stringify(d.expenses)],
      [STORAGE_KEYS.ACTIVE_SESSION, d.activeSession ? JSON.stringify(d.activeSession) : null],
      [STORAGE_KEYS.ONBOARDED, String(d.hasOnboarded || loadHasOnboarded())],
      [REMINDERS_KEY, JSON.stringify(reminders)],
    ]);
    return { mode, shiftsAdded: d.history.length, duplicates: 0 };
  }
  const existing = loadHistory();
  // Days: same rule as the CSV import. Month/year summaries: one per period, and a year can't
  // have both a year summary and month summaries (the device's existing ones win).
  const periodKeys = (r: DayRecord): string[] => {
    const k = recordKind(r), p = String(r.periodKey || '');
    if (k === 'week') return [`week:${p}`];
    return k === 'month' ? [`month:${p}`, `month-in-year:${p.slice(0, 4)}`] : [`year:${p}`];
  };
  const keys = new Set<string>();
  const byMinute = new Map<string, DayRecord>();
  for (const r of existing) {
    if (recordKind(r) === 'day') { keys.add(minuteKey(r.dateStr, r.startTime)); keys.add(summaryKey(r)); byMinute.set(minuteKey(r.dateStr, r.startTime), r); }
    else periodKeys(r).forEach(k => keys.add(k));
  }
  const toAdd: DayRecord[] = [];
  let duplicates = 0, goalsCarried = 0;
  for (const r of d.history) {
    const kind = recordKind(r);
    if (kind !== 'day') {
      const p = String(r.periodKey || '');
      const clash = kind === 'week' ? keys.has(`week:${p}`) : kind === 'month'
        ? keys.has(`month:${p}`) || keys.has(`year:${p.slice(0, 4)}`)
        : keys.has(`year:${p}`) || keys.has(`month-in-year:${p}`);
      if (clash) { duplicates++; continue; }
      periodKeys(r).forEach(k => keys.add(k));
      toAdd.push(r);
      continue;
    }
    const k1 = minuteKey(r.dateStr, r.startTime), k2 = summaryKey(r);
    if (keys.has(k1) || keys.has(k2)) {
      duplicates++;
      const mine = byMinute.get(k1); // same day already here: keep its data, but take the backup's day goal if it has none
      if (mine && mine.dayGoalOverride === undefined && Number(r.dayGoalOverride) > 0) { mine.dayGoalOverride = Number(r.dayGoalOverride); goalsCarried++; }
      continue;
    }
    keys.add(k1); keys.add(k2);
    toAdd.push(r);
  }
  if (toAdd.length || goalsCarried) {
    const merged = [...toAdd.sort((a, b) => b.startTime - a.startTime), ...existing];
    writeAllOrNothing([[STORAGE_KEYS.HISTORY, JSON.stringify(merged)]]);
  }
  return { mode, shiftsAdded: toAdd.length, duplicates };
}
