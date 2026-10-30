// Cash tips: totals/rates, merge, dedupe, storage (old = 0), CSV round-trip, JSON backup, summaries.
// Run: TZ=America/New_York npx tsx test/cashTips.test.ts
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
const D = await import('../src/utils/dayStore');
const S = await import('../src/utils/storage');
const P = await import('../src/utils/periodSummaries');
const { importShiftsCSV } = await import('../src/utils/csvImport');
const { buildBackup, parseBackup, applyBackup } = await import('../src/utils/backup');

const st = new Date(2026, 9, 30, 16).getTime();
const day = D.withRates({ id: 'd1', dateStr: '2026-10-30', startTime: st, endTime: st + 4 * 3600e3, totalSeconds: 4 * 3600, workSeconds: 2 * 3600, totalMiles: 50, workMiles: 40,
  platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 95 }], bonusEarnings: [{ id: 'b', platform: 'Uber Rides', bonusType: 'uber_quest', amount: 10, dateStr: '2026-10-30', notes: '', createdAt: 1 }],
  cashTips: 5, notes: '', createdAt: 1 } as any);
assert.equal(day.totalEarnings, 110, 'apps + bonus + cash tips');
assert.equal(day.cashTips, 5); assert.equal(day.dollarsPerHourWork, 55); assert.equal(day.dollarsPerHourTotal, 27.5); assert.equal(day.dollarsPerMileTotal, 2.2);
// Merge-on-save keeps (adds) cash tips
const more = { ...day, id: 'd2', startTime: st + 5 * 3600e3, platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 20 }], bonusEarnings: [], cashTips: 3 };
const merged = D.applyDaySave([day], D.withRates(more)).next;
assert.equal(merged.length, 1); assert.equal(merged[0].cashTips, 8); assert.equal(merged[0].totalEarnings, 133);
// Dedupe: identical incl. tips collapses; different tips never collapses
assert.equal(D.findDuplicateDays([day, { ...day, id: 'x' }]).removed.length, 1);
assert.equal(D.findDuplicateDays([day, D.withRates({ ...day, id: 'x', cashTips: 6 })]).removed.length, 0);
// Storage: kept; old records without the field = 0 and totals unchanged
S.saveHistory([day, { ...day, id: 'old', cashTips: undefined, totalEarnings: 105 } as any]);
const h = S.loadHistory();
assert.equal(h[0].cashTips, 5); assert.equal(h[1].cashTips, 0); assert.equal(h[1].totalEarnings, 105);
// New session starts at 0
assert.equal(S.createInitialSession(S.loadSettings()).cashTips, 0);
// CSV (app's export layout) with a Cash Tips column, and an old file without it
const hdr = 'Date,Total Time (hrs),Work Time (hrs),Base Earnings,Bonus & Quest Earnings,Cash Tips,Total Earnings,Work $/Hr,Total $/Hr,Total Miles,Work Miles,$/Mile Total,IRS Standard Deduction,Platforms Breakdown,Bonuses Breakdown,Notes';
const csv = `${hdr}\n"2026-10-29",4.00,2.00,95.00,10.00,5.00,110.00,55.00,27.50,50,40,2.20,33.50,"Uber Rides: 95","Uber Rides (uber_quest): 10",""`;
const imp = importShiftsCSV(csv, [], S.loadSettings()).toAdd[0];
assert.equal(imp.cashTips, 5); assert.equal(imp.totalEarnings, 110);
const oldHdr = hdr.replace('Cash Tips,', '');
const oldCsv = `${oldHdr}\n"2026-10-28",4.00,2.00,95.00,10.00,105.00,52.50,26.25,50,40,2.10,33.50,"Uber Rides: 95","Uber Rides (uber_quest): 10",""`;
const oldImp = importShiftsCSV(oldCsv, [], S.loadSettings()).toAdd[0];
assert.equal(oldImp.cashTips, 0); assert.equal(oldImp.totalEarnings, 105);
// JSON backup round-trip keeps cash tips; old backups (no field) load as 0
const text = JSON.stringify(buildBackup());
store.clear();
applyBackup(parseBackup(text), 'replace');
assert.equal(S.loadHistory().find(r => r.id === 'd1')!.cashTips, 5);
// Month summary with optional cash tips
const m = P.buildSummaryRecord({ kind: 'month', periodKey: '2026-03', rows: [{ id: 'u', name: 'Uber Rides', amount: 100 }], workSeconds: 3600, totalSeconds: 7200, totalMiles: 10, workMiles: 5, bonus: 0, cashTips: 25, notes: '' }, 1);
assert.equal(m.cashTips, 25); assert.equal(m.totalEarnings, 125);
console.log('cash tips tests: PASS');
