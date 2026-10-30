/**
 * JSON backup tests: round-trip, bad files never change anything, merge skips duplicates,
 * home location never leaves the device.
 * Run: TZ=America/New_York npx tsx test/backup.test.ts
 */
import assert from 'node:assert/strict';

// Minimal localStorage + window for Node
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };

const { buildBackup, parseBackup, applyBackup, backupFileName } = await import('../src/utils/backup');
const { STORAGE_KEYS } = await import('../src/utils/storage');

const t = (d: number, h: number) => new Date(2026, 9, d, h, 0).getTime();
const rec = (id: string, d: number, h: number, earn: number) => ({
  id, dateStr: `2026-10-${String(d).padStart(2, '0')}`, startTime: t(d, h), endTime: t(d, h + 5), totalSeconds: 18000, workSeconds: 14400,
  totalMiles: 80, workMiles: 60, platformEarnings: [{ id: 'p', name: 'Uber', amount: earn }], bonusEarnings: [], totalEarnings: earn,
  dollarsPerHourTotal: earn / 5, dollarsPerHourWork: earn / 4, dollarsPerMileTotal: earn / 80, dollarsPerMileWork: earn / 60, notes: 'n', createdAt: 1,
});
const HOME = { lat: 42.66, lon: -83.38, label: 'My house', radius: 300 };
function seed() {
  store.clear();
  store.set(STORAGE_KEYS.SETTINGS, JSON.stringify({ dayCutoffHour: 4, weekStartDay: 1, monthStartDay: 1, currency: '$', defaultPlatforms: ['Uber', 'Lyft'], standardMileageRate: 0.7, darkMode: true, goals: { dailyEarnings: 200, hourlyRate: 30, weeklyEarnings: 900, monthlyEarnings: 3600, yearlyEarnings: 40000, activeTrackerGoal: 'earnings' } }));
  store.set(STORAGE_KEYS.HISTORY, JSON.stringify([rec('a', 27, 9, 150), rec('b', 28, 10, 120)]));
  store.set(STORAGE_KEYS.EXPENSES, JSON.stringify([{ id: 'e', dateStr: '2026-10-27', amount: 40, category: 'vehicle_car', createdAt: 1 }]));
  store.set(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify({ status: 'working', startDayTimestamp: t(29, 8), startWorkTimestamp: t(29, 8), endDayTimestamp: null, workSegments: [{ startTime: t(29, 8) }], breakSegments: [], manualAdjustmentSeconds: 0, manualWorkAdjustmentSeconds: 0, platformEarnings: [{ id: 'u', name: 'Uber', amount: 33 }], bonusEarnings: [], totalMiles: 10, workMiles: 8, notes: '' }));
  store.set(STORAGE_KEYS.ONBOARDED, 'true');
  store.set('gig_tracker_reminders_v1', JSON.stringify({ version: 1, remindersEnabled: true, reminders: [{ id: 'r', days: [1, 3], time: '09:00' }], leadMinutes: 20, safetyEnabled: true, safetyEndTime: '22:30', homeEnabled: true, home: HOME }));
}

// 1. Round-trip (Replace everything)
seed();
const backup = buildBackup(new Date(2026, 9, 29, 20, 0));
const text = JSON.stringify(backup);
assert.equal(backup.app, 'gig-efficiency'); assert.equal(backup.schema, 1);
assert.equal(backupFileName(new Date(2026, 9, 29)), 'gig-backup-2026-10-29.json');
assert.ok(!/42\.66|-83\.38|My house|"home"|homeEnabled|endpoint/.test(text), 'no home location or push endpoint in the backup');
assert.equal(backup.data.history.length, 2); assert.ok(backup.data.activeSession, 'in-progress shift included');
const snapshot = new Map(store);
store.clear();
store.set('gig_tracker_reminders_v1', JSON.stringify({ version: 1, homeEnabled: true, home: { ...HOME, label: 'New phone home' } }));
const r1 = applyBackup(parseBackup(text), 'replace');
assert.equal(r1.shiftsAdded, 2);
for (const k of [STORAGE_KEYS.HISTORY, STORAGE_KEYS.EXPENSES, STORAGE_KEYS.ACTIVE_SESSION, STORAGE_KEYS.ONBOARDED]) {
  assert.deepEqual(JSON.parse(store.get(k)!), JSON.parse(snapshot.get(k)!), `round-trip ${k}`);
}
assert.equal(JSON.parse(store.get(STORAGE_KEYS.SETTINGS)!).goals.dailyEarnings, 200, 'goals restored');
const rem = JSON.parse(store.get('gig_tracker_reminders_v1')!);
assert.equal(rem.leadMinutes, 20); assert.equal(rem.safetyEndTime, '22:30');
assert.equal(rem.home.label, 'New phone home', "this device's home area is kept, not overwritten");

// 2. Bad files: rejected before anything is written
seed();
const before = JSON.stringify([...store]);
const bad = [
  'not json', '{}', JSON.stringify({ app: 'other', schema: 1, data: {} }),
  JSON.stringify({ ...backup, schema: 99 }),
  JSON.stringify({ ...backup, data: { ...backup.data, history: [{ dateStr: 'x' }] } }),
  JSON.stringify({ ...backup, data: { ...backup.data, history: 'nope' } }),
];
for (const b of bad) assert.throws(() => applyBackup(parseBackup(b), 'replace'), Error, `rejects: ${b.slice(0, 30)}`);
assert.equal(JSON.stringify([...store]), before, 'storage untouched after bad files');

// 3. Merge without duplicates
seed();
const withNew = JSON.parse(text);
withNew.data.history.push(rec('c', 26, 14, 99));
const r3 = applyBackup(parseBackup(JSON.stringify(withNew)), 'merge');
assert.equal(r3.shiftsAdded, 1); assert.equal(r3.duplicates, 2);
assert.equal(JSON.parse(store.get(STORAGE_KEYS.HISTORY)!).length, 3);
const r4 = applyBackup(parseBackup(JSON.stringify(withNew)), 'merge');
assert.equal(r4.shiftsAdded, 0); assert.equal(r4.duplicates, 3, 'second merge adds nothing');
assert.equal(JSON.parse(store.get(STORAGE_KEYS.ACTIVE_SESSION)!).platformEarnings[0].amount, 33, 'merge leaves current shift alone');
console.log('backup tests: PASS');
