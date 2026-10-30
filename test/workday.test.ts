/** Workday cutoffs, safe merge saves, undo cap. Run: TZ=America/New_York npx tsx test/workday.test.ts */
import assert from 'node:assert/strict';
import { getWorkday, workdayEnd, getWeek, normalizeCutoffs, ruleFor, UBER_RULE, MIDNIGHT_RULE } from '../src/utils/workday';
import { applyDaySave, applyRestore, pushSnapshot, makeSnapshot, UNDO_LIMIT } from '../src/utils/dayStore';
import { DayRecord, AppSettings } from '../src/types';

const t = (s: string) => new Date(s).getTime(); // local time
// 3:59 vs 4:00 boundary (Uber 4 AM): Thursday Oct 29 stays the workday until Fri Oct 30 4:00 AM
assert.equal(getWorkday(t('2026-10-29T21:30:00'), UBER_RULE), '2026-10-29', 'Thu evening = Thu');
assert.equal(getWorkday(t('2026-10-30T03:59:59'), UBER_RULE), '2026-10-29', '3:59 AM still Thursday');
assert.equal(getWorkday(t('2026-10-30T04:00:00'), UBER_RULE), '2026-10-30', '4:00 AM is Friday');
assert.equal(getWorkday(t('2026-10-30T00:00:00'), MIDNIGHT_RULE), '2026-10-30', 'midnight rule');
assert.equal(workdayEnd('2026-10-29', UBER_RULE).getTime(), t('2026-10-30T04:00:00'));
// Custom cutoff 5:30 AM + per-weekday override: Friday's workday runs until Sat 6:00 AM
const custom = { dayMinutes: 330, weekStartDay: 0, weekStartMinutes: 0, weekdayOverrides: { 5: 360 } };
assert.equal(getWorkday(t('2026-10-30T05:29:00'), custom), '2026-10-29');
assert.equal(getWorkday(t('2026-10-30T05:30:00'), custom), '2026-10-30');
assert.equal(getWorkday(t('2026-10-31T05:45:00'), custom), '2026-10-30', 'Fri override 6:00 AM');
assert.equal(getWorkday(t('2026-10-31T06:00:00'), custom), '2026-10-31');
// Weeks: Uber Monday 4 AM
assert.equal(getWeek(t('2026-10-26T03:59:00'), UBER_RULE).days[0], '2026-10-19');
assert.equal(getWeek(t('2026-10-26T04:00:00'), UBER_RULE).days[0], '2026-10-26');
assert.equal(getWeek(t('2026-10-26T00:00:00'), MIDNIGHT_RULE).days[0], '2026-10-26');
// Migration: old settings (dayCutoffHour 4, no cutoffs) -> default 4:00, Uber 4:00, Lyft midnight
const c = normalizeCutoffs({ dayCutoffHour: 4, weekStartDay: 1 });
assert.equal(c.default.dayMinutes, 240);
const s = { cutoffs: c } as AppSettings;
assert.equal(ruleFor(s, 'Uber Eats').dayMinutes, 240); assert.equal(ruleFor(s, 'Lyft').dayMinutes, 0);
assert.equal(normalizeCutoffs({ cutoffs: { default: { dayMinutes: 'x' }, apps: { Lyft: { dayMinutes: 120 } } } }).apps.Lyft.weekStartDay, 1, 'missing fields -> defaults');

// End day then restart: second save on Thursday MERGES, never overwrites
const rec = (id: string, start: string, secs: number, uber: number, notes = ''): DayRecord => ({
  id, dateStr: '2026-10-29', startTime: t(start), endTime: t(start) + secs * 1000, totalSeconds: secs, workSeconds: secs,
  totalMiles: 10, workMiles: 8, platformEarnings: [{ id: 'u' + id, name: 'Uber Rides', amount: uber }], bonusEarnings: [],
  totalEarnings: uber, dollarsPerHourTotal: 0, dollarsPerHourWork: 0, dollarsPerMileTotal: 0, dollarsPerMileWork: 0, notes, createdAt: 1,
});
let h: DayRecord[] = [];
h = applyDaySave(h, rec('a', '2026-10-29T10:00:00', 3600 * 5, 120, 'morning')).next;
const second = applyDaySave(h, rec('b', '2026-10-29T22:00:00', 3600, 30, 'night'));
assert.equal(second.next.length, 1, 'one record for Thursday');
const th = second.next[0];
assert.equal(th.id, 'a'); assert.equal(th.totalSeconds, 6 * 3600); assert.equal(th.totalEarnings, 150);
assert.equal(th.platformEarnings[0].amount, 150); assert.equal(th.totalMiles, 20); assert.equal(th.notes, 'morning | night');
assert.equal(second.snapshot.before[0].totalEarnings, 120, 'undo keeps the pre-merge day');
// Restore puts the day back
assert.equal(applyRestore(second.next, second.snapshot).next[0].totalEarnings, 120);
// Replace only when asked
const rep = applyDaySave(h, rec('c', '2026-10-29T22:00:00', 3600, 30), 'replace');
assert.equal(rep.next.length, 1); assert.equal(rep.next[0].totalEarnings, 30); assert.equal(rep.snapshot.before[0].id, 'a');

// Undo snapshots capped at 10
let list: ReturnType<typeof makeSnapshot>[] = [];
for (let i = 0; i < 15; i++) list = pushSnapshot(list, makeSnapshot('2026-10-29', 'x' + i, [], []));
assert.equal(UNDO_LIMIT, 10); assert.equal(list.length, 10); assert.equal(list[0].label, 'x14');
console.log('workday/merge/undo tests: PASS');
