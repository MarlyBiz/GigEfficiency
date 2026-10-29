/**
 * Round-trip test: seeded records -> exportRecordsToCSV() -> importShiftsCSV()
 * into an empty history -> compare. Then re-import to confirm duplicates are skipped.
 * Run: TZ=America/New_York npx tsx test/csvImport.roundtrip.test.ts
 */
import assert from 'node:assert/strict';
import { exportRecordsToCSV } from '../src/utils/csvExport';
import { importShiftsCSV } from '../src/utils/csvImport';
import { DEFAULT_SETTINGS } from '../src/utils/storage';
import { DayRecord } from '../src/types';

// Minimal DOM stubs so the browser export function can run in Node and we can capture its CSV.
let captured = '';
(globalThis as any).Blob = class { constructor(parts: string[]) { captured = parts.join(''); } };
(globalThis as any).URL.createObjectURL = () => 'blob:x';
(globalThis as any).URL.revokeObjectURL = () => {};
(globalThis as any).document = { createElement: () => ({ setAttribute() {}, click() {} }), body: { appendChild() {}, removeChild() {} } };
(globalThis as any).alert = () => {};

const t = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).getTime();
const rec = (o: Partial<DayRecord>): DayRecord => ({
  id: 'x', dateStr: '', startTime: 0, endTime: 0, totalSeconds: 0, workSeconds: 0, totalMiles: 0, workMiles: 0,
  platformEarnings: [], totalEarnings: 0, dollarsPerHourTotal: 0, dollarsPerHourWork: 0,
  dollarsPerMileTotal: 0, dollarsPerMileWork: 0, notes: '', createdAt: 0, ...o,
});
const seeded: DayRecord[] = [
  rec({ id: 'a', dateStr: '2026-10-29', startTime: t(2026, 10, 29, 7, 15), endTime: t(2026, 10, 29, 15, 45),
    totalSeconds: 8.5 * 3600, workSeconds: 6.25 * 3600, totalMiles: 142.3, workMiles: 118.7,
    platformEarnings: [{ id: '1', name: 'Uber', amount: 132.4 }, { id: '2', name: 'Lyft', amount: 61.15 }],
    totalEarnings: 193.55, notes: 'Airport run, "surge" at 9' }),
  // Ends after midnight, has a bonus (total > platform sum), one platform at 0
  rec({ id: 'b', dateStr: '2026-10-28', startTime: t(2026, 10, 28, 18, 0), endTime: t(2026, 10, 29, 1, 30),
    totalSeconds: 7.5 * 3600, workSeconds: 6 * 3600, totalMiles: 98, workMiles: 80.5,
    platformEarnings: [{ id: '3', name: 'Uber', amount: 150 }, { id: '4', name: 'Lyft', amount: 0 }],
    bonusEarnings: [{ id: 'q', platform: 'Uber', bonusType: 'uber_quest', amount: 25, dateStr: '2026-10-28', createdAt: 0 }],
    totalEarnings: 175, notes: '' }),
];

exportRecordsToCSV(seeded);
assert.ok(captured.startsWith('"Date","Start Time"'), 'export produced CSV');

const { toAdd, duplicates, invalid } = importShiftsCSV(captured, [], DEFAULT_SETTINGS);
assert.equal(toAdd.length, 2); assert.equal(duplicates, 0); assert.equal(invalid, 0);

for (const orig of seeded) {
  const got = toAdd.find(r => r.dateStr === orig.dateStr)!;
  assert.ok(got, `record ${orig.dateStr} imported`);
  assert.equal(got.startTime, orig.startTime, 'start time (local)');
  assert.equal(got.endTime, orig.endTime, 'end time (local, past-midnight aware)');
  assert.equal(got.totalSeconds, orig.totalSeconds);
  assert.equal(got.workSeconds, orig.workSeconds);
  assert.equal(got.totalMiles, orig.totalMiles);
  assert.equal(got.workMiles, orig.workMiles);
  assert.equal(got.totalEarnings, orig.totalEarnings);
  assert.deepEqual(got.platformEarnings.map(p => [p.name, p.amount]).sort(),
    orig.platformEarnings.filter(p => p.amount).map(p => [p.name, p.amount]).sort());
  assert.equal(got.notes, orig.notes);
  const h = orig.totalSeconds / 3600, wh = orig.workSeconds / 3600;
  assert.equal(got.dollarsPerHourTotal, Number((orig.totalEarnings / h).toFixed(2)));
  assert.equal(got.dollarsPerHourWork, Number((orig.totalEarnings / wh).toFixed(2)));
  assert.equal(got.dollarsPerMileTotal, Number((orig.totalEarnings / orig.totalMiles).toFixed(2)));
}
assert.equal(toAdd.find(r => r.dateStr === '2026-10-28')!.totalBonusEarnings, 25, 'bonus remainder kept');

// Re-importing the same file into the now-populated history skips everything
const again = importShiftsCSV(captured, toAdd, DEFAULT_SETTINGS);
assert.equal(again.toAdd.length, 0); assert.equal(again.duplicates, 2);
console.log('csv round-trip (detailed layout): PASS');
