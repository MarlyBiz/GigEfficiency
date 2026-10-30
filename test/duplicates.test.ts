// Duplicate-day regression: overnight rollover with an active/ended day, repeated saves, on-load repair.
// Run: TZ=America/New_York npx tsx test/duplicates.test.ts
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
const D = await import('../src/utils/dayStore');
const W = await import('../src/utils/workday');
const S = await import('../src/utils/storage');
const rule = W.ruleFor(S.loadSettings());
const t = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime(); // Oct 2026
const shift = (start: number, end: number, uber: number, lyft: number, miles: number, workSec: number) => {
  const workday = W.getWorkday(start, rule);
  return D.withRates({ id: `shift-${workday}-${start}`, dateStr: workday, startTime: start, endTime: end, totalSeconds: (end - start) / 1000, workSeconds: workSec,
    totalMiles: miles, workMiles: miles - 20, platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: uber }, { id: 'l', name: 'Lyft', amount: lyft }], bonusEarnings: [], notes: '', createdAt: end } as any);
};
const day = (h: any[], ds: string) => h.filter(r => r.dateStr === ds);
const total = (h: any[], ds: string) => Math.round(day(h, ds).reduce((s, r) => s + r.totalEarnings, 0) * 100) / 100;

// 1. Active Thursday shift runs past midnight and ends Fri 1:10 AM (before the 4 AM cutoff): it's Thursday
const thu = shift(t(29, 17, 45), t(30, 1, 10), 60.98, 172.74, 185, 6 * 3600 + 15 * 60);
assert.equal(thu.dateStr, '2026-10-29');
assert.equal(thu.totalSeconds, 7 * 3600 + 25 * 60);
let h: any[] = [];
let r = D.applyDaySave(h, thu); h = r.next;
// Same save again: double tap, a second open tab, or saving the ended day again after 4:00 AM
r = D.applyDaySave(h, { ...thu, endTime: t(30, 4, 5) }); h = r.next;
assert.equal(day(h, '2026-10-29').length, 1, 'still one Thursday record');
assert.equal(total(h, '2026-10-29'), 233.72, 'not doubled');
assert.equal(h[0].totalMiles, 185);

// 2. Earlier shift saved, then a second Thursday shift ends after midnight; its save fires twice
h = [];
const early = shift(t(29, 9, 0), t(29, 12, 0), 40, 0, 50, 2 * 3600);
h = D.applyDaySave(h, early).next;
const late = shift(t(29, 20, 0), t(30, 2, 30), 20.98, 172.74, 135, 4 * 3600);
assert.equal(late.dateStr, '2026-10-29');
const first = D.applyDaySave(h, late); h = first.next;
const again = D.applyDaySave(h, late); h = again.next;
assert.equal(again.snapshot, null, 'second identical save is a no-op');
assert.equal(day(h, '2026-10-29').length, 1);
assert.equal(total(h, '2026-10-29'), 233.72, 'early + late once');
assert.equal(h[0].totalMiles, 185);

// 3. After 4:00 AM Friday a new day starts on Friday, separate from Thursday
const fri = shift(t(30, 4, 0), t(30, 9, 0), 50, 0, 40, 3 * 3600);
assert.equal(fri.dateStr, '2026-10-30');
assert.equal(W.getWorkday(t(30, 3, 59), rule), '2026-10-29');
h = D.applyDaySave(h, fri).next;
assert.equal(total(h, '2026-10-29'), 233.72); assert.equal(total(h, '2026-10-30'), 50);

// 4. Edit Shift "Continue" (merge) tapped twice: merged once
const edited = { ...fri, id: 'edit-x', dateStr: '2026-10-29', platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 10 }] };
const e1 = D.applyDaySave([...h, D.withRates(edited)], D.withRates(edited), 'merge');
const e2 = D.applyDaySave(e1.next, D.withRates(edited), 'merge');
assert.equal(total(e2.next, '2026-10-29'), 243.72);
assert.equal(e2.snapshot, null);

// 5. On-load repair: Mark's doubled Thursday (two identical copies) -> one, undo copy kept
const copy = { ...thu, id: 'shift-2026-10-29-dup' };
const doubled = [thu, copy, fri];
assert.equal(total(doubled, '2026-10-29'), 467.44);
const fix = D.findDuplicateDays(doubled);
assert.equal(fix.removed.length, 1); assert.equal(fix.removed[0].id, copy.id);
assert.equal(total(fix.next, '2026-10-29'), 233.72);
assert.equal(fix.next.length, 2, 'Friday kept');
// Same id twice is collapsed too
assert.equal(D.findDuplicateDays([thu, thu]).next.length, 1);
// Differing records are never removed (one cent, one second or one mile apart)
assert.equal(D.findDuplicateDays([thu, { ...copy, platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 60.99 }, { id: 'l', name: 'Lyft', amount: 172.74 }], totalEarnings: 233.73 }]).removed.length, 0);
assert.equal(D.findDuplicateDays([thu, { ...copy, totalSeconds: thu.totalSeconds + 1 }]).removed.length, 0);
assert.equal(D.findDuplicateDays([thu, { ...copy, totalMiles: 186 }]).removed.length, 0);
assert.equal(D.findDuplicateDays([thu, { ...copy, dateStr: '2026-10-28' }]).removed.length, 0, 'other day kept');
// Three copies -> one
assert.equal(D.findDuplicateDays([thu, copy, { ...thu, id: 'c3' }]).removed.length, 2);
// Undo of the repair puts the copy back exactly (nothing invented)
const snap = D.makeSnapshot('2026-10-29', 'Removed duplicate copy', fix.removed, []);
const back = D.applyRestore(fix.next, snap).next;
assert.equal(back.length, 3); assert.equal(total(back, '2026-10-29'), 467.44);

// 6. mergedFrom survives storage, so the no-op works after a reload
S.saveHistory(h);
assert.ok(S.loadHistory().some(x => (x.mergedFrom || []).includes(late.id)));
assert.equal(D.applyDaySave(S.loadHistory(), late).snapshot, null);
console.log('duplicate-day tests: PASS');
