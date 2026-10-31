// Week catch-up: month attribution (whole week vs broken into days), totals, overlap warnings,
// storage, backup merge/restore. Run: TZ=America/New_York npx tsx test/weekSummary.test.ts
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
const P = await import('../src/utils/periodSummaries');
const W = await import('../src/utils/workday');
const S = await import('../src/utils/storage');
const { buildBackup, parseBackup, applyBackup } = await import('../src/utils/backup');

const mark = { ...S.loadSettings(), monthStart: { day: 2, minutes: 240 } }; // Mark: month starts the 2nd 4:00 AM
const plain = S.loadSettings(); // 1st
const uber = (amount: number) => [{ id: 'u', name: 'Uber Rides', amount }];
const base = { rows: [], bonus: 0, cashTips: 0, workSeconds: 0, totalSeconds: 0, totalMiles: 0, workMiles: 0, notes: '' };

// Uber week start (Monday 4 AM) and label
const wk = W.getWeek(new Date(2026, 9, 8, 12).getTime(), W.ruleFor(plain, 'Uber Rides'));
assert.equal(W.dateKey(wk.startDate), '2026-10-05');
assert.equal(W.weekRangeLabel('2026-10-05', new Date(2026, 9, 31)), 'Oct 5 – Oct 11');

// Whole week Oct 5–11: Uber $500 / 25h / 300 mi -> October
const oct = P.buildWeekRecord({ ...base, periodKey: '2026-10-05', weekApp: 'Uber Rides', rows: uber(500), workSeconds: 25 * 3600, totalSeconds: 25 * 3600, totalMiles: 300, workMiles: 300 }, 1);
assert.equal(oct.kind, 'week'); assert.equal(oct.totalEarnings, 500); assert.equal(oct.dollarsPerHourWork, 20);
assert.equal(W.monthKeyForRecord(oct, mark), '2026-10');
assert.equal(P.isDayRecord(oct), false); assert.equal(P.isSummaryRecord(oct), true);

// Spanning week Sep 28 – Oct 4, whole: month holding most days (4th day = Oct 1)
const spanWhole = P.buildWeekRecord({ ...base, periodKey: '2026-09-28', rows: uber(700) }, 1);
assert.deepEqual(P.weekMonths(spanWhole, plain), ['2026-10']); // Oct 1-4 = 4 days in October
assert.deepEqual(P.weekMonths(spanWhole, mark), ['2026-09']); // month starts the 2nd: Sep 28–Oct 1 = 4 days in Sept

// Broken into days: each day counts on its own date; week total = sum of days; bonus/remainder ignored
const day = (dateStr: string, amount: number, tips = 0) => ({ dateStr, platformEarnings: uber(amount), cashTips: tips, workSeconds: 5 * 3600, totalSeconds: 6 * 3600, totalMiles: 60, workMiles: 50 });
const split = P.buildWeekRecord({ ...base, periodKey: '2026-09-28', rows: uber(999), bonus: 50,
  days: [day('2026-09-29', 100), day('2026-09-30', 120, 5), day('2026-10-02', 150), day('2026-10-03', 130), { ...day('2026-10-04', 0), workSeconds: 0, totalSeconds: 0, totalMiles: 0, workMiles: 0 }, day('2026-10-12', 999)] }, 1);
assert.equal(split.weekDays!.length, 4, 'empty and out-of-week days dropped');
assert.equal(split.totalEarnings, 505); assert.equal(split.cashTips, 5); assert.equal(split.totalBonusEarnings, 0);
assert.equal(split.workSeconds, 20 * 3600); assert.equal(split.totalMiles, 240);
const parts = P.periodParts([split]);
assert.equal(parts.length, 4);
const sumBy = (s: any) => { const m: Record<string, number> = {}; for (const p of P.periodParts([split])) { const k = W.monthKeyForRecord(p, s); m[k] = (m[k] || 0) + p.totalEarnings; } return m; };
assert.deepEqual(sumBy(mark), { '2026-09': 225, '2026-10': 280 });
assert.equal(W.yearKeyForRecord(parts[0], mark), '2026');
assert.deepEqual(P.weekMonths(split, mark), ['2026-09', '2026-10']);

// Overlap warnings
const shift = { id: 'd1', dateStr: '2026-10-07', startTime: new Date(2026, 9, 7, 16).getTime(), endTime: 0, totalSeconds: 3600, workSeconds: 3600, totalMiles: 1, workMiles: 1, platformEarnings: uber(40), totalEarnings: 40, dollarsPerHourTotal: 0, dollarsPerHourWork: 0, dollarsPerMileTotal: 0, dollarsPerMileWork: 0, notes: '', createdAt: 1 } as any;
const monthSum = P.buildSummaryRecord({ kind: 'month', periodKey: '2026-10', rows: uber(2000), workSeconds: 0, totalSeconds: 0, totalMiles: 0, workMiles: 0, bonus: 0, notes: '' }, 1);
const c = P.findWeekConflicts([shift, monthSum, oct], { ...oct, id: 'new' }, mark);
assert.ok(c.same, 'same week start = edit it'); assert.equal(c.days.length, 1); assert.equal(c.months.length, 1);
const warn = P.weekWarnings(c);
assert.ok(warn.some(w => w.includes('10/7') && w.includes('double counts')));
assert.ok(warn.some(w => w.includes('October 2026 already has a month total')));
// The spanning week (by days) touches Sept + Oct; overlapping another week's dates is warned
const c2 = P.findWeekConflicts([P.buildWeekRecord({ ...base, periodKey: '2026-10-01', rows: uber(5) }, 1)], split, mark);
assert.equal(c2.weeks.length, 1); assert.equal(c2.same, null);
// Saving a month total warns about weeks and shifts in that month
const mo = P.findMonthOverlaps([oct, shift, split], '2026-10', mark);
assert.equal(mo.weeks.length, 2); assert.equal(mo.days.length, 1);
assert.equal(P.findMonthOverlaps([oct], '2026-09', mark).weeks.length, 0);

// Storage keeps week fields; old files unaffected
S.saveHistory([split, oct, shift]);
const h = S.loadHistory();
assert.equal(h[0].kind, 'week'); assert.equal(h[0].weekDays!.length, 4); assert.equal(h[1].weekApp, 'Uber Rides'); assert.equal(h[2].kind, undefined);
// Backup: replace keeps; merge adds new weeks once and skips a week already here
const text = JSON.stringify(buildBackup());
store.clear(); applyBackup(parseBackup(text), 'replace');
assert.equal(S.loadHistory().find(r => r.id === split.id)!.weekDays!.length, 4);
store.clear(); S.saveHistory([oct]);
const res = applyBackup(parseBackup(text), 'merge');
assert.equal(res.shiftsAdded, 2); assert.equal(res.duplicates, 1);
assert.equal(applyBackup(parseBackup(text), 'merge').shiftsAdded, 0);
console.log('week summary tests: PASS');
