/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Safe day saves: a save never silently replaces a workday. New shifts on a day that
 * already has data are merged in; replacing needs an explicit 'replace'. Every change
 * keeps an undo snapshot of what the day looked like before (last 10, on this phone only).
 */
import { DayRecord, PlatformSlot, BonusEntry } from '../types';
import { isDayRecord } from './periodSummaries';

export const UNDO_KEY = 'gig_tracker_undo_v1';
export const UNDO_LIMIT = 10;

export interface UndoSnapshot {
  id: string;
  at: number;
  dateStr: string;
  label: string;
  before: DayRecord[]; // the day's records before the change
  afterIds: string[]; // ids the change left behind (removed again on restore)
}

const round2 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(2));

export function withRates(r: DayRecord): DayRecord {
  const base = (r.platformEarnings || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const bonus = (r.bonusEarnings || []).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const total = base + bonus;
  const th = r.totalSeconds / 3600, wh = r.workSeconds / 3600;
  return {
    ...r,
    baseEarnings: base,
    totalBonusEarnings: bonus,
    totalEarnings: total,
    dollarsPerHourTotal: th > 0 ? round2(total / th) : 0,
    dollarsPerHourWork: wh > 0 ? round2(total / wh) : 0,
    dollarsPerMileTotal: r.totalMiles > 0 ? round2(total / r.totalMiles) : 0,
    dollarsPerMileWork: r.workMiles > 0 ? round2(total / r.workMiles) : 0,
  };
}

/** Combine a new shift into an existing day (keeps the existing id + date). */
export function mergeDayRecords(existing: DayRecord, add: DayRecord): DayRecord {
  const apps: PlatformSlot[] = (existing.platformEarnings || []).map(p => ({ ...p }));
  for (const p of add.platformEarnings || []) {
    const hit = apps.find(a => a.name === p.name);
    if (hit) hit.amount = round2((Number(hit.amount) || 0) + (Number(p.amount) || 0));
    else apps.push({ ...p });
  }
  const bonuses: BonusEntry[] = [...(existing.bonusEarnings || [])];
  for (const b of add.bonusEarnings || []) if (!bonuses.some(x => x.id === b.id)) bonuses.push({ ...b, dateStr: existing.dateStr });
  const notes = [existing.notes, add.notes].map(n => (n || '').trim()).filter(Boolean);
  return withRates({
    ...existing,
    startTime: Math.min(existing.startTime, add.startTime),
    endTime: Math.max(existing.endTime, add.endTime),
    totalSeconds: (existing.totalSeconds || 0) + (add.totalSeconds || 0),
    workSeconds: (existing.workSeconds || 0) + (add.workSeconds || 0),
    totalMiles: round2((existing.totalMiles || 0) + (add.totalMiles || 0)),
    workMiles: round2((existing.workMiles || 0) + (add.workMiles || 0)),
    platformEarnings: apps,
    bonusEarnings: bonuses,
    notes: [...new Set(notes)].join(' | '),
  });
}

/** Other real day records already on this record's date. */
export const sameDayRecords = (history: DayRecord[], dateStr: string, excludeId?: string) =>
  history.filter(r => isDayRecord(r) && r.dateStr === dateStr && r.id !== excludeId);

export type SaveMode = 'merge' | 'replace';

/**
 * Pure: apply a day save to history. Default 'merge' never drops data.
 * - edit of an existing record with no other data on its date: update in place
 * - date already has other data: merge into it ('merge') or replace it ('replace')
 */
export function applyDaySave(history: DayRecord[], record: DayRecord, mode: SaveMode = 'merge'): { next: DayRecord[]; snapshot: UndoSnapshot } {
  const prevSelf = history.find(r => r.id === record.id);
  const others = sameDayRecords(history, record.dateStr, record.id);
  let next: DayRecord[];
  let before: DayRecord[] = prevSelf ? [prevSelf] : [];
  let afterIds: string[];
  let label: string;
  if (others.length && mode === 'merge') {
    const target = others[0];
    const merged = mergeDayRecords(target, record);
    next = history.filter(r => r.id !== record.id).map(r => (r.id === target.id ? merged : r));
    before = [...before, target];
    afterIds = [merged.id];
    label = 'Shift added to day';
  } else if (others.length && mode === 'replace') {
    const drop = new Set([record.id, ...others.map(o => o.id)]);
    next = [record, ...history.filter(r => !drop.has(r.id))];
    before = [...before, ...others];
    afterIds = [record.id];
    label = 'Day started over';
  } else if (prevSelf) {
    next = history.map(r => (r.id === record.id ? record : r));
    afterIds = [record.id];
    label = 'Day edited';
  } else {
    next = [record, ...history];
    afterIds = [record.id];
    label = 'Day saved';
  }
  return { next, snapshot: makeSnapshot(record.dateStr, label, before, afterIds) };
}

export function makeSnapshot(dateStr: string, label: string, before: DayRecord[], afterIds: string[]): UndoSnapshot {
  return { id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), dateStr, label, before, afterIds };
}

/** Pure: newest first, capped. */
export const pushSnapshot = (list: UndoSnapshot[], s: UndoSnapshot) => [s, ...list].slice(0, UNDO_LIMIT);

/** Pure: put a day back the way the snapshot saw it (and snapshot the current state so restore is undoable). */
export function applyRestore(history: DayRecord[], s: UndoSnapshot): { next: DayRecord[]; snapshot: UndoSnapshot } {
  const drop = new Set([...s.afterIds, ...s.before.map(b => b.id)]);
  const current = history.filter(r => drop.has(r.id));
  const next = [...s.before, ...history.filter(r => !drop.has(r.id))];
  return { next, snapshot: makeSnapshot(s.dateStr, 'Before restore', current, s.before.map(b => b.id)) };
}

export function loadUndo(): UndoSnapshot[] {
  try {
    const v = JSON.parse(localStorage.getItem(UNDO_KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => x && Array.isArray(x.before) && Array.isArray(x.afterIds)).slice(0, UNDO_LIMIT) : [];
  } catch { return []; }
}

export function saveUndoSnapshot(s: UndoSnapshot) {
  try { localStorage.setItem(UNDO_KEY, JSON.stringify(pushSnapshot(loadUndo(), s))); } catch (e) { console.error('Undo save failed', e); }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('gig-undo-changed'));
}
