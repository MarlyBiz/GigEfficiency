/**
 * Editable app rows, month/year catch-up summaries, storage + backup handling.
 * Run: TZ=America/New_York npx tsx test/periodSummaries.test.ts
 */
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };

const P = await import('../src/utils/periodSummaries');
const { loadHistory, saveHistory } = await import('../src/utils/storage');
const { buildBackup, parseBackup, applyBackup } = await import('../src/utils/backup');

// --- App rows: add from Settings list or custom, no duplicates, remove, live total
let rows = P.addAppRow([], 'Uber Rides');
rows = P.addAppRow(rows, 'DoorDash');
assert.throws(() => P.addAppRow(rows, ' uber rides '), /already/, 'same app twice is blocked (case-insensitive)');
assert.throws(() => P.addAppRow(rows, '   '), /Enter/);
rows = P.removeAppRow(rows, rows[1].id); // remove DoorDash
rows = P.addAppRow(rows, 'Lyft');
rows = rows.map(r => ({ ...r, amount: r.name === 'Lyft' ? 45 : 95 }));
assert.deepEqual(rows.map(r => r.name), ['Uber Rides', 'Lyft']);
assert.equal(P.sumRows(rows), 140);
assert.deepEqual(P.availableApps(['Uber Rides', 'DoorDash', 'Lyft', 'Uber Eats'], rows), ['DoorDash', 'Uber Eats']);
rows = P.addAppRow(rows, 'Instacart'); // custom name
assert.equal(rows.length, 3);

// --- New past day starts with no apps
const day = P.emptyDayRecord('2026-10-20');
assert.equal(day.platformEarnings.length, 0); assert.equal(day.totalEarnings, 0); assert.ok(P.isDayRecord(day));

// --- Periods: only past months / past years
const now = new Date(2026, 9, 29);
assert.ok(P.isPastPeriod('month', '2026-09', now)); assert.ok(!P.isPastPeriod('month', '2026-10', now)); assert.ok(!P.isPastPeriod('month', '2026-13', now));
assert.ok(P.isPastPeriod('year', '2025', now)); assert.ok(!P.isPastPeriod('year', '2026', now));

// --- Building summaries: exactly the rows shown + bonus, rates by the usual formulas
const march = P.buildSummaryRecord({ kind: 'month', periodKey: '2026-03', rows: [{ id: 'u', name: 'Uber Rides', amount: 1800 }, { id: 'l', name: 'Lyft', amount: 700 }], workSeconds: 80 * 3600, totalSeconds: 100 * 3600, totalMiles: 2000, workMiles: 1500, bonus: 100, notes: 'catch-up' }, 1);
assert.equal(march.kind, 'month'); assert.equal(march.dateStr, '2026-03-01'); assert.equal(march.totalEarnings, 2600);
assert.equal(march.baseEarnings, 2500); assert.equal(march.totalBonusEarnings, 100); assert.equal(march.dollarsPerHourWork, 32.5);
assert.deepEqual(march.platformEarnings.map(p => p.name), ['Uber Rides', 'Lyft']);
const y2025 = P.buildSummaryRecord({ kind: 'year', periodKey: '2025', rows: [{ id: 'u', name: 'Uber Rides', amount: 30000 }], workSeconds: 1000 * 3600, totalSeconds: 1300 * 3600, totalMiles: 25000, workMiles: 20000, bonus: 0, notes: '' }, 2);
assert.equal(y2025.dateStr, '2025-01-01'); assert.equal(y2025.bonusEarnings!.length, 0);

// --- Conflicts: one summary per period; a year can't have both year and month summaries
const may2025 = P.buildSummaryRecord({ kind: 'month', periodKey: '2025-05', rows: [], workSeconds: 0, totalSeconds: 0, totalMiles: 0, workMiles: 0, bonus: 0, notes: '' }, 3);
const all = [march, y2025, may2025, day];
assert.equal(P.findSummaryConflicts(all, 'month', '2026-03').same?.id, march.id, 'month already has a summary');
assert.equal(P.findSummaryConflicts(all, 'month', '2026-03', march.id).same, null, 'editing itself is fine');
assert.deepEqual(P.findSummaryConflicts(all, 'year', '2025').other.map(r => r.id), [may2025.id], 'year vs its month summaries');
assert.deepEqual(P.findSummaryConflicts(all, 'month', '2025-06').other.map(r => r.id), [y2025.id], 'month vs its year summary');

// --- Storage keeps kind + periodKey; backup round-trip + merge without duplicates
saveHistory(all);
const loaded = loadHistory();
assert.equal(loaded.find(r => r.id === march.id)!.kind, 'month');
assert.equal(loaded.find(r => r.id === y2025.id)!.periodKey, '2025');
assert.ok(P.isDayRecord(loaded.find(r => r.id === day.id)!));
const text = JSON.stringify(buildBackup());
store.clear();
applyBackup(parseBackup(text), 'replace');
assert.equal(loadHistory().filter(P.isSummaryRecord).length, 3, 'summaries survive backup/restore');
const again = applyBackup(parseBackup(text), 'merge');
assert.equal(again.shiftsAdded, 0); assert.equal(again.duplicates, 4, 'merge skips existing days and summaries');
// A backup month summary for a year that has a year summary here is skipped (device wins)
const other = JSON.parse(text); other.data.history = [P.buildSummaryRecord({ kind: 'month', periodKey: '2025-08', rows: [], workSeconds: 0, totalSeconds: 0, totalMiles: 0, workMiles: 0, bonus: 0, notes: '' }, 9)];
store.set('gig_tracker_history_records', JSON.stringify([y2025]));
assert.equal(applyBackup(parseBackup(JSON.stringify(other)), 'merge').shiftsAdded, 0);
console.log('period summaries + app rows tests: PASS');
