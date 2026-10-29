/**
 * Unit tests: worker scheduling (dueReminders, weekMinutes), geofence hysteresis, end-time math.
 * Run: TZ=America/New_York npx tsx test/reminders.test.ts
 */
import assert from 'node:assert/strict';
// @ts-ignore plain JS worker module
import { dueReminders, weekMinutes } from '../worker/src/index.js';
import { fenceStep } from '../src/hooks/useHomeGeofence';
import { nextLocalTime, parseLeadMinutes, distanceMeters } from '../src/utils/reminders';

// weekMinutes: Thu 2026-10-29 18:35 EDT = 22:35 UTC -> Thu(4)*1440 + 18*60 + 35
assert.equal(weekMinutes('America/New_York', new Date('2026-10-29T22:35:00Z')), 4 * 1440 + 18 * 60 + 35);

const rec = { remindersEnabled: true, leadMinutes: 15, reminders: [{ days: [1, 2, 3, 4, 5], time: '09:00' }] };
const thu = (h: number, m: number) => 4 * 1440 + h * 60 + m;
assert.equal(dueReminders(rec, thu(8, 44)).length, 0, 'not due 16 min before');
assert.equal(dueReminders(rec, thu(8, 45)).length, 1, 'due 15 min before');
assert.equal(dueReminders(rec, thu(9, 14)).length, 1, 'still in 30-min catch-up window');
assert.equal(dueReminders(rec, thu(9, 15)).length, 0, 'window closed');
assert.equal(dueReminders(rec, 6 * 1440 + 8 * 60 + 45).length, 0, 'Saturday not selected');
assert.equal(dueReminders({ ...rec, remindersEnabled: false }, thu(8, 45)).length, 0);
// Lead time crossing midnight and the week boundary: Sunday 00:10 with 15 min lead fires Saturday 23:55
assert.equal(dueReminders({ ...rec, reminders: [{ days: [0], time: '00:10' }] }, 6 * 1440 + 23 * 60 + 55).length, 1);

// Geofence: no prompt until outside then back inside; once per return
let s = { shiftStart: 1, wasOutside: false };
let r = fenceStep(s, 100, 20, 300); assert.equal(r.prompt, false, 'starting at home does not prompt');
r = fenceStep(r.state, 340, 20, 300); assert.equal(r.state.wasOutside, false, 'edge jitter ignored');
r = fenceStep(r.state, 2000, 20, 300); assert.equal(r.state.wasOutside, true);
r = fenceStep(r.state, 250, 20, 300); assert.equal(r.prompt, true, 'prompt on return');
r = fenceStep(r.state, 200, 20, 300); assert.equal(r.prompt, false, 'only once per return');

// End-reminder time: next occurrence after shift start (rolls to tomorrow when earlier)
const start = new Date(2026, 9, 29, 18, 0).getTime();
assert.equal(nextLocalTime(start, '22:00'), new Date(2026, 9, 29, 22, 0).getTime());
assert.equal(nextLocalTime(start, '02:00'), new Date(2026, 9, 30, 2, 0).getTime());
assert.equal(parseLeadMinutes('25'), 25); assert.equal(parseLeadMinutes(' 7.6 '), 8); assert.equal(parseLeadMinutes('abc'), 15);
assert.ok(Math.abs(distanceMeters(42.0, -83.0, 42.001, -83.0) - 111.2) < 1);
console.log('reminders/geofence unit tests: PASS');
