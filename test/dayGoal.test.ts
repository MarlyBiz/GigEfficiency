// Day-only shift goal: session override per workday, saved on the record, merge, storage, backup merge.
// Run: TZ=America/New_York npx tsx test/dayGoal.test.ts
import assert from 'node:assert/strict';
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
const D = await import('../src/utils/dayStore');
const S = await import('../src/utils/storage');
const { buildBackup, parseBackup, applyBackup } = await import('../src/utils/backup');

const settings = S.loadSettings();
const def = settings.goals.dailyEarnings;
const sess = S.createInitialSession(settings);
assert.equal(sess.dayGoal, undefined);
// No override: Settings default
assert.deepEqual(D.effectiveDayGoal(sess, [], '2026-10-30', def), { goal: def, isOverride: false });
// Day-only $137 for 10/30; Settings untouched; another workday falls back to default
const s1 = { ...sess, dayGoal: { workday: '2026-10-30', amount: 137 } };
assert.deepEqual(D.effectiveDayGoal(s1, [], '2026-10-30', def), { goal: 137, isOverride: true });
assert.deepEqual(D.effectiveDayGoal(s1, [], '2026-10-31', def), { goal: def, isOverride: false });
assert.equal(S.loadSettings().goals.dailyEarnings, def);
// Reset (null) = default
assert.equal(D.effectiveDayGoal({ dayGoal: { workday: '2026-10-30', amount: null } }, [], '2026-10-30', def).isOverride, false);

const st = new Date(2026, 9, 30, 16).getTime();
const rec = (id: string, t: number, extra: any = {}) => D.withRates({ id, dateStr: '2026-10-30', startTime: t, endTime: t + 3600e3, totalSeconds: 3600, workSeconds: 3600, totalMiles: 10, workMiles: 10,
  platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 50 }], bonusEarnings: [], notes: '', createdAt: 1, ...extra } as any);
const a = rec('a', st, { dayGoalOverride: 137 });
// Continuing the same workday (new session, no edit) keeps the saved day's goal
assert.deepEqual(D.effectiveDayGoal(S.createInitialSession(settings), [a], '2026-10-30', def), { goal: 137, isOverride: true });
// Merge keeps the goal when the later part didn't change it; a later edit wins; a reset clears it
assert.equal(D.applyDaySave([a], rec('b', st + 2 * 3600e3)).next[0].dayGoalOverride, 137);
assert.equal(D.applyDaySave([a], rec('c', st + 2 * 3600e3, { dayGoalOverride: 90 })).next[0].dayGoalOverride, 90);
assert.equal(D.applyDaySave([a], rec('d', st + 2 * 3600e3, { dayGoalOverride: null })).next[0].dayGoalOverride, null);
// Storage keeps it; old records have none (fall back to default)
S.saveHistory([a, rec('old', st - 86400e3, { dateStr: '2026-10-29' })]);
const h = S.loadHistory();
assert.equal(h[0].dayGoalOverride, 137); assert.equal('dayGoalOverride' in h[1], false);
// Backup: replace keeps it; merge onto the same day without a goal carries it over; old files fine
const text = JSON.stringify(buildBackup());
store.clear(); applyBackup(parseBackup(text), 'replace');
assert.equal(S.loadHistory()[0].dayGoalOverride, 137);
store.clear(); S.saveHistory([rec('a', st)]);
const r = applyBackup(parseBackup(text), 'merge');
assert.equal(S.loadHistory().find(x => x.id === 'a')!.dayGoalOverride, 137);
assert.equal(r.shiftsAdded, 1); // the 'old' day
console.log('day goal tests: PASS');
