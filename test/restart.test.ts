// Restart day: timers to zero still running, paused work stays at zero, offsets cleared, money/miles kept; undo.
// Run: TZ=America/New_York npx tsx test/restart.test.ts
import assert from 'node:assert/strict';
const { restartTimers, restoreTimers } = await import('../src/utils/dayStore');
const { getSessionTimes } = await import('../src/utils/calculations');
const t0 = new Date(2026, 9, 30, 8).getTime(), now = t0 + 3 * 3600e3;
const base: any = { status: 'working', startDayTimestamp: t0, startWorkTimestamp: t0 + 600e3, endDayTimestamp: null,
  workSegments: [{ startTime: t0 + 600e3, endTime: t0 + 3600e3 }, { startTime: t0 + 7200e3 }], breakSegments: [{ startTime: t0 + 3600e3, endTime: t0 + 7200e3 }],
  manualAdjustmentSeconds: 300, manualWorkAdjustmentSeconds: 600, platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 61 }], bonusEarnings: [], totalMiles: 40, workMiles: 30, notes: 'n', workdayStr: '2026-10-30' };
assert.ok(getSessionTimes(base, now).workSeconds > 0);
// Working: both restart at 0 and keep running
const r = restartTimers(base, now);
assert.deepEqual(getSessionTimes(r, now), { totalSeconds: 0, workSeconds: 0, breakSeconds: 0 });
assert.deepEqual(getSessionTimes(r, now + 65e3), { totalSeconds: 65, workSeconds: 65, breakSeconds: 0 });
assert.equal(r.manualAdjustmentSeconds, 0); assert.equal(r.manualWorkAdjustmentSeconds, 0);
assert.deepEqual(r.platformEarnings, base.platformEarnings); assert.equal(r.totalMiles, 40); assert.equal(r.workMiles, 30); assert.equal(r.notes, 'n');
assert.equal(r.status, 'working'); assert.equal(r.workdayStr, '2026-10-30');
// Paused (on break / commuting): total runs, work stays at zero
for (const status of ['on_break', 'commuting', 'heading_home']) {
  const p = restartTimers({ ...base, status, workSegments: [{ startTime: t0, endTime: t0 + 3600e3 }] }, now);
  const t = getSessionTimes(p, now + 120e3);
  assert.equal(t.totalSeconds, 120, status); assert.equal(t.workSeconds, 0, status);
}
// Not started / ended: nothing happens
const ns = { ...base, status: 'not_started', startDayTimestamp: null };
assert.equal(restartTimers(ns, now), ns);
const ended = { ...base, status: 'ended', endDayTimestamp: now };
assert.equal(restartTimers(ended, now), ended);
// Undo: timers come back, earnings typed after the restart are kept
const later = { ...r, platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 80 }] };
const back = restoreTimers(later, base);
assert.deepEqual(getSessionTimes(back, now), getSessionTimes(base, now));
assert.equal(back.platformEarnings[0].amount, 80);
console.log('restart day tests: PASS');
