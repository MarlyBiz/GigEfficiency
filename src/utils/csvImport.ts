/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CSV import: rebuilds DayRecord objects from a shifts CSV exported by this app
 * and merges them into history.
 *
 * Two layouts are accepted (detected from the header row):
 *  - "detailed": written by exportRecordsToCSV() in csvExport.ts
 *    (Date, Start Time, End Time, Total/Active HH:MM(:SS), distances,
 *     Total Earnings, rates, one column per platform, Notes).
 *  - "modal": written by the Export modal's "Shifts CSV Spreadsheet Export"
 *    (Date, Total/Work hrs, Base/Bonus/Total Earnings, miles,
 *     "Platforms Breakdown", "Bonuses Breakdown", Notes). This is what the
 *    in-app CSV button actually produces. It has no start/end time.
 */

import { AppSettings, BonusEntry, BonusType, DayRecord, PlatformSlot } from '../types';

export interface CSVImportResult {
  toAdd: DayRecord[]; // new, non-duplicate records
  duplicates: number; // rows skipped because they already exist (or repeat in the file)
  invalid: number; // rows that could not be parsed
}

/** RFC 4180-style CSV parser (quoted fields, "" escapes, CRLF or LF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, ''); // strip BOM (Excel)
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some(f => f.trim() !== '')) rows.push(row);
  return rows;
}

const num = (v: string | undefined): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
};
const round2 = (n: number) => Number(n.toFixed(2));

/** Local-time timestamp for a YYYY-MM-DD date at the given clock time. */
function localTimestamp(dateStr: string, h: number, m: number, s = 0): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!d) return null;
  return new Date(+d[1], +d[2] - 1, +d[3], h, m, s, 0).getTime();
}

/** Parses "14:30", "02:30 PM", "2:30 p.m." etc. into 24h hours/minutes. */
function parseClock(str: string): { h: number; m: number; s: number } | null {
  const t = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?/i.exec(str.trim());
  if (!t) return null;
  let h = +t[1];
  const ap = t[4]?.toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return { h, m: +t[2], s: t[3] ? +t[3] : 0 };
}

/** "HH:MM" or "HH:MM:SS" -> seconds; null if not in that shape. */
function parseDuration(str: string): number | null {
  const t = /^\s*(\d+):(\d{2})(?::(\d{2}))?\s*$/.exec(str);
  if (!t) return null;
  return +t[1] * 3600 + +t[2] * 60 + (t[3] ? +t[3] : 0);
}

/** Minute-precision key used for duplicate detection (date + local start time). */
function minuteKey(dateStr: string, ts: number): string {
  const d = new Date(ts);
  return `${dateStr}|${d.getHours()}:${d.getMinutes()}`;
}
/** Fallback key for the modal layout, which carries no start time. */
function summaryKey(r: Pick<DayRecord, 'dateStr' | 'totalSeconds' | 'totalEarnings'>): string {
  return `${r.dateStr}|${(r.totalSeconds / 3600).toFixed(2)}|${r.totalEarnings.toFixed(2)}`;
}

/** Same rate formulas the app uses when saving a day (see EditDayModal). */
function withRates(r: Omit<DayRecord, 'dollarsPerHourTotal' | 'dollarsPerHourWork' | 'dollarsPerMileTotal' | 'dollarsPerMileWork'>): DayRecord {
  const tHours = r.totalSeconds / 3600;
  const wHours = r.workSeconds / 3600;
  return {
    ...r,
    dollarsPerHourTotal: tHours > 0 ? round2(r.totalEarnings / tHours) : 0,
    dollarsPerHourWork: wHours > 0 ? round2(r.totalEarnings / wHours) : 0,
    dollarsPerMileTotal: r.totalMiles > 0 ? round2(r.totalEarnings / r.totalMiles) : 0,
    dollarsPerMileWork: r.workMiles > 0 ? round2(r.totalEarnings / r.workMiles) : 0,
  };
}

const BONUS_TYPES: BonusType[] = ['uber_quest', 'lyft_challenge', 'doordash_challenge', 'peak_pay_boost', 'streak', 'guarantee', 'other_custom'];

/**
 * Parses CSV text and returns the records that are not already in `existing`.
 * Throws an Error with a readable message if the file isn't a shifts CSV.
 */
export function importShiftsCSV(text: string, existing: DayRecord[], settings: AppSettings): CSVImportResult {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('The file has no data rows.');
  const header = rows[0].map(h => h.trim());
  const col = (prefix: string) => header.findIndex(h => h.toLowerCase().startsWith(prefix.toLowerCase()));

  const iDate = col('Date');
  const isDetailed = col('Start Time') >= 0 && col('Total Shift Time') >= 0;
  const isModal = col('Platforms Breakdown') >= 0;
  if (iDate < 0 || (!isDetailed && !isModal)) {
    throw new Error('Not a Gig Efficiency Tracker shifts CSV (unrecognized columns).');
  }

  const existingKeys = new Set<string>();
  for (const r of existing) {
    existingKeys.add(minuteKey(r.dateStr, r.startTime));
    existingKeys.add(summaryKey(r));
  }

  const now = Date.now();
  const toAdd: DayRecord[] = [];
  let duplicates = 0;
  let invalid = 0;

  rows.slice(1).forEach((cells, idx) => {
    const get = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '');
    const dateStr = get(iDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { invalid++; return; }
    const id = `import-${now}-${idx}-${Math.random().toString(36).slice(2, 7)}`;

    let record: DayRecord;
    let key: string;

    if (isDetailed) {
      const start = parseClock(get(col('Start Time')));
      const end = parseClock(get(col('End Time')));
      const startTime = start ? localTimestamp(dateStr, start.h, start.m, start.s) : null;
      if (startTime === null) { invalid++; return; }
      let endTime = end ? (localTimestamp(dateStr, end.h, end.m, end.s) as number) : startTime;
      if (endTime < startTime) endTime += 24 * 3600 * 1000; // shift ran past midnight

      const totalSeconds = parseDuration(get(col('Total Shift Time'))) ?? Math.round(num(get(col('Total Hours'))) * 3600);
      const workSeconds = parseDuration(get(col('Active Work Time'))) ?? Math.round(num(get(col('Work Hours'))) * 3600);

      // Platform columns sit between the last rate column and Notes: "Uber ($)".
      const iNotes = header.length - 1;
      const iFirstPlatform = col('Rate Work Distance') + 1;
      const platformEarnings: PlatformSlot[] = [];
      for (let i = iFirstPlatform; i > 0 && i < iNotes; i++) {
        const amount = num(get(i));
        if (amount !== 0) {
          platformEarnings.push({ id: `${id}-p${i}`, name: header[i].replace(/\s*\([^)]*\)\s*$/, ''), amount });
        }
      }
      const baseEarnings = round2(platformEarnings.reduce((s, p) => s + p.amount, 0));
      const totalEarnings = num(get(col('Total Earnings')));
      // This layout has no bonus breakdown; keep any remainder as one bonus entry
      // so totals survive loadHistory(), which recomputes bonuses from entries.
      const bonusAmt = round2(totalEarnings - baseEarnings);
      const bonusEarnings: BonusEntry[] = bonusAmt > 0
        ? [{ id: `${id}-b0`, platform: 'Imported', bonusType: 'other_custom', amount: bonusAmt, dateStr, notes: 'Bonus total from CSV import', createdAt: now }]
        : [];

      record = withRates({
        id, dateStr, startTime, endTime, totalSeconds, workSeconds,
        totalMiles: num(get(col('Total Distance'))),
        workMiles: num(get(col('Work Distance'))),
        platformEarnings, bonusEarnings, baseEarnings,
        totalBonusEarnings: bonusEarnings.reduce((s, b) => s + b.amount, 0),
        totalEarnings, notes: get(iNotes), createdAt: now,
      });
      key = minuteKey(dateStr, startTime);
    } else {
      // Modal layout: "Uber: 12.5; Lyft: 8" and "Uber (uber_quest): 20 - notes".
      const platformEarnings: PlatformSlot[] = get(col('Platforms Breakdown'))
        .split(';').map(s => s.trim()).filter(Boolean)
        .map((s, i) => {
          const at = s.lastIndexOf(':');
          return { id: `${id}-p${i}`, name: (at >= 0 ? s.slice(0, at) : s).trim() || 'Platform', amount: at >= 0 ? num(s.slice(at + 1)) : 0 };
        });
      const bonusEarnings: BonusEntry[] = get(col('Bonuses Breakdown'))
        .split(';').map(s => s.trim()).filter(Boolean)
        .map((s, i) => {
          const m = /^(.*?)\s*\(([^)]*)\):\s*(-?[\d.]+)(?:\s*-\s*(.*))?$/.exec(s);
          const type = (m?.[2] || 'other_custom') as BonusType;
          return {
            id: `${id}-b${i}`, platform: m?.[1] || 'Imported',
            bonusType: BONUS_TYPES.includes(type) ? type : 'other_custom',
            amount: m ? num(m[3]) : 0, dateStr, notes: m?.[4] || '', createdAt: now,
          };
        });
      const totalSeconds = Math.round(num(get(col('Total Time'))) * 3600);
      const workSeconds = Math.round(num(get(col('Work Time'))) * 3600);
      // No clock times in this layout: anchor at local noon of the shift date.
      const startTime = localTimestamp(dateStr, 12, 0) as number;
      const baseEarnings = round2(platformEarnings.reduce((s, p) => s + p.amount, 0));
      const totalBonusEarnings = round2(bonusEarnings.reduce((s, b) => s + b.amount, 0));
      record = withRates({
        id, dateStr, startTime, endTime: startTime + totalSeconds * 1000, totalSeconds, workSeconds,
        totalMiles: num(get(col('Total Miles'))),
        workMiles: num(get(col('Work Miles'))),
        platformEarnings, bonusEarnings, baseEarnings, totalBonusEarnings,
        totalEarnings: num(get(col('Total Earnings'))) || round2(baseEarnings + totalBonusEarnings),
        notes: get(col('Notes')), createdAt: now,
      });
      key = summaryKey(record);
    }

    if (existingKeys.has(key)) { duplicates++; return; }
    existingKeys.add(key); // also de-dupe repeated rows within the same file
    toAdd.push(record);
  });

  void settings; // reserved: settings currently not needed for parsing
  return { toAdd, duplicates, invalid };
}
