// Settings app list: add/remove with cutoffs, history untouched, backup round-trip.
// Run: TZ=America/New_York npx tsx test/appList.test.ts
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
const L = await import('../src/utils/appList');
const S = await import('../src/utils/storage');
const { ruleFor } = await import('../src/utils/workday');
const { buildBackup, parseBackup, applyBackup } = await import('../src/utils/backup');

let s = S.loadSettings();
assert.deepEqual(s.defaultPlatforms, ['Uber Rides', 'DoorDash', 'Lyft', 'Uber Eats']);
assert.deepEqual(L.suggestableApps(s), ['Instacart', 'Grubhub', 'Amazon Flex', 'Spark']);
s = L.addAppToSettings(s, 'Instacart');
assert.deepEqual(s.cutoffs!.apps['Instacart'], { dayMinutes: 0, weekStartDay: 1, weekStartMinutes: 0, weekdayOverrides: {} }, 'midnight / Mon 12:00 AM');
s = L.addAppToSettings(s, '  Uber   Connect ');
assert.equal(s.cutoffs!.apps['Uber Connect'].dayMinutes, 240, 'Uber apps default to 4 AM');
assert.equal(s.cutoffs!.apps['Uber Connect'].weekStartMinutes, 240);
assert.throws(() => L.addAppToSettings(s, 'doordash'), /already/);
assert.throws(() => L.addAppToSettings(s, '  '), /Enter/);
assert.ok(!L.suggestableApps(s).includes('Instacart'));

// Remove Lyft: list + its rule only; history keeps Lyft earnings
const lyftDay = { id: 'd1', dateStr: '2026-10-27', startTime: 1, endTime: 2, totalSeconds: 3600, workSeconds: 3000, totalMiles: 10, workMiles: 8,
  platformEarnings: [{ id: 'l', name: 'Lyft', amount: 45 }, { id: 'u', name: 'Uber Rides', amount: 95 }], bonusEarnings: [], totalEarnings: 140,
  dollarsPerHourTotal: 140, dollarsPerHourWork: 168, dollarsPerMileTotal: 14, dollarsPerMileWork: 17.5, notes: '', createdAt: 1 };
S.saveHistory([lyftDay as any]);
const before = localStorage.getItem(S.STORAGE_KEYS.HISTORY);
s = { ...s, cutoffs: { ...s.cutoffs!, apps: { ...s.cutoffs!.apps, Lyft: { dayMinutes: 120, weekStartDay: 1, weekStartMinutes: 0, weekdayOverrides: {} } } } };
s = L.removeAppFromSettings(s, 'Lyft');
assert.ok(!s.defaultPlatforms.includes('Lyft')); assert.equal(s.cutoffs!.apps['Lyft'], undefined);
S.saveSettings(S.withCutoffs(s));
assert.equal(localStorage.getItem(S.STORAGE_KEYS.HISTORY), before, 'history byte-identical after removing an app');
assert.equal(S.loadHistory()[0].platformEarnings.find(p => p.name === 'Lyft')!.amount, 45);
assert.equal(ruleFor(S.loadSettings(), 'Lyft').dayMinutes, 0, 'removed app falls back to its default rule');
assert.ok(!S.loadSettings().defaultPlatforms.includes('Lyft'), 'removal persists');
// Can't remove the last app
assert.throws(() => L.removeAppFromSettings({ ...s, defaultPlatforms: ['DoorDash'] }, 'DoorDash'), /at least one/);

// Backup round-trip keeps the list + cutoffs
const text = JSON.stringify(buildBackup());
store.clear();
applyBackup(parseBackup(text), 'replace');
const r = S.loadSettings();
assert.deepEqual(r.defaultPlatforms, ['Uber Rides', 'DoorDash', 'Uber Eats', 'Instacart', 'Uber Connect']);
assert.equal(r.cutoffs!.apps['Uber Connect'].dayMinutes, 240);
console.log('app list tests: PASS');
