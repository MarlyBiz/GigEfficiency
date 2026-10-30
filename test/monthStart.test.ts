// Month start setting: boundaries, Feb/leap years, 28-day cap, 3:59 vs 4:00 AM, summaries, backup.
// Run: TZ=America/New_York npx tsx test/monthStart.test.ts
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
const W = await import('../src/utils/workday');
const S = await import('../src/utils/storage');
const P = await import('../src/utils/periodSummaries');
const { buildBackup, parseBackup, applyBackup } = await import('../src/utils/backup');

const def = S.loadSettings(); // default cutoff 4:00 AM, month start unset
const mark = { ...def, monthStart: { day: 2, minutes: 240 } };
const t = (y: number, m: number, d: number, h: number, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const day = (ts: number) => ({ id: 'x' + ts, dateStr: W.dateKey(new Date(ts)), startTime: ts } as any);

// Default: 1st at the workday cutoff (4:00 AM)
assert.deepEqual(W.resolveMonthStart(def), { day: 1, minutes: 240 });
assert.equal(W.monthKeyForTime(t(2026, 11, 1, 3, 59), def), '2026-10');
assert.equal(W.monthKeyForTime(t(2026, 11, 1, 4, 0), def), '2026-11');
assert.equal(W.monthPeriodLabel('2026-11', def), 'Nov 1 4:00 AM – Dec 1 4:00 AM');
assert.equal(W.monthKeyForTime(t(2026, 10, 31, 23, 0), def), '2026-10', 'last day of month stays in it');
// Mark: 2nd at 4:00 AM, 3:59 vs 4:00 on the 2nd; the 1st counts toward the previous month
assert.equal(W.monthKeyForTime(t(2026, 11, 2, 3, 59), mark), '2026-10');
assert.equal(W.monthKeyForTime(t(2026, 11, 2, 4, 0), mark), '2026-11');
assert.equal(W.monthKeyForTime(t(2026, 11, 1, 18, 0), mark), '2026-10');
assert.equal(W.monthPeriodLabel('2026-11', mark), 'Nov 2 4:00 AM – Dec 2 4:00 AM');
assert.equal(W.monthKeyForTime(t(2027, 1, 1, 20, 0), mark), '2026-12', 'Jan 1 counts toward December');
assert.equal(W.yearKeyForRecord(day(t(2027, 1, 1, 20, 0)), mark), '2026', 'and toward that year');
// February: leap and non-leap years
assert.equal(W.monthPeriodLabel('2028-02', def), 'Feb 1 4:00 AM – Mar 1 4:00 AM');
assert.equal(W.monthKeyForTime(t(2028, 2, 29, 22, 0), def), '2028-02', 'Feb 29 in a leap year');
assert.equal(W.monthKeyForTime(t(2028, 3, 1, 3, 59), def), '2028-02', 'Mar 1 before cutoff still Feb (leap)');
assert.equal(W.monthKeyForTime(t(2027, 3, 1, 3, 59), def), '2027-02', 'Mar 1 before cutoff still Feb (non-leap)');
assert.equal(W.monthKeyForTime(t(2027, 2, 28, 12, 0), def), '2027-02');
assert.equal(W.monthPeriodLabel('2027-02', mark), 'Feb 2 4:00 AM – Mar 2 4:00 AM');
assert.equal(W.monthKeyForTime(t(2027, 3, 1, 12, 0), mark), '2027-02');
// Start day 31 (or 0, junk) is impossible: capped to 1..28
assert.equal(W.resolveMonthStart({ ...def, monthStart: { day: 31 } }).day, 28);
assert.equal(W.resolveMonthStart({ ...def, monthStart: { day: 0 } }).day, 1);
assert.equal(W.resolveMonthStart({ ...def, monthStart: { day: 'x' as any } }).day, 1);
const s28 = { ...def, monthStart: { day: 31, minutes: 0 } };
assert.equal(W.monthPeriodLabel('2027-02', s28), 'Feb 28 12:00 AM – Mar 28 12:00 AM');
assert.equal(W.monthKeyForTime(t(2027, 3, 27, 23, 59), s28), '2027-02');
// Time defaults to the workday cutoff and follows it when unset
const c5 = S.withCutoffs({ ...def, cutoffs: { ...def.cutoffs!, default: { ...def.cutoffs!.default, dayMinutes: 300 } }, monthStart: { day: 2 } });
assert.equal(W.resolveMonthStart(c5).minutes, 300);
// Catch-up month summaries stay in their entered month; expenses by date
const sum = P.buildSummaryRecord({ kind: 'month', periodKey: '2026-03', rows: [], workSeconds: 0, totalSeconds: 0, totalMiles: 0, workMiles: 0, bonus: 0, notes: '' }, 1);
assert.equal(W.monthKeyForRecord(sum, mark), '2026-03', 'summary dated Mar 1 is still March');
const ysum = P.buildSummaryRecord({ kind: 'year', periodKey: '2025', rows: [], workSeconds: 0, totalSeconds: 0, totalMiles: 0, workMiles: 0, bonus: 0, notes: '' }, 2);
assert.equal(W.yearKeyForRecord(ysum, mark), '2025', 'year summary dated Jan 1 stays in its year');
assert.equal(W.monthKeyForDate('2026-11-01', mark), '2026-10');
assert.equal(W.monthKeyForDate('2026-11-02', mark), '2026-11');
// Saved + JSON backup/restore
S.saveSettings(mark);
assert.deepEqual(S.loadSettings().monthStart, { day: 2, minutes: 240 });
const text = JSON.stringify(buildBackup());
store.clear();
assert.equal(S.loadSettings().monthStart, undefined);
applyBackup(parseBackup(text), 'replace');
assert.deepEqual(S.loadSettings().monthStart, { day: 2, minutes: 240 });
console.log('month start tests: PASS');
