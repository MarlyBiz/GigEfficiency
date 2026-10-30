// Browser test at 412 px: Thursday stays the workday until Fri 4:00 AM; starting on a day with data shows
// the confirm modal (Continue / Start over with second confirm / Cancel); Continue + End Day merges, no overwrite.
// Screenshots: confirm modal + cutoff settings. Usage: node test/dayconfirm-e2e.mjs <url> <shots-dir>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const [url, dir] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => { errs.push('PAGEERROR ' + e.message); console.log('PAGEERROR', e.message); });
p.on('dialog', d => d.accept());
await p.clock.install({ time: new Date('2026-10-29T21:30:00-04:00') });
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true');
  // Old 2.6.3 settings (no cutoffs field) must migrate safely
  localStorage.setItem('gig_tracker_settings', JSON.stringify({ dayCutoffHour: 4, weekStartDay: 1, currency: '$', defaultPlatforms: ['Uber Rides', 'DoorDash', 'Lyft'] }));
  const s = new Date('2026-10-29T10:00:00-04:00').getTime();
  localStorage.setItem('gig_tracker_history_records', JSON.stringify([{ id: 'thu', dateStr: '2026-10-29', startTime: s, endTime: s + 18000e3, totalSeconds: 18000, workSeconds: 15300, totalMiles: 90, workMiles: 70, platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 120 }], bonusEarnings: [], totalEarnings: 120, dollarsPerHourTotal: 24, dollarsPerHourWork: 28, dollarsPerMileTotal: 1.3, dollarsPerMileWork: 1.7, notes: 'day', createdAt: s }]));
});
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
const ends = await p.textContent('[data-testid="workday-ends"]');
assert.match(ends, /Thursday, Oct 29.*ends Fri 4:00 AM/, ends);
const sess = () => p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_active_session') || '{}'));
// Start -> confirm modal
await p.click('text=Start Day (Leave Home)');
const msg = await p.textContent('[data-testid="day-confirm-msg"]');
assert.equal(msg.trim(), 'You already have data for Thursday, Oct 29 (5h, $120.00).');
const btns = await p.locator('[data-testid="day-confirm"] button').allTextContents();
assert.deepEqual(btns.map(s => s.trim()), ['Continue this day', 'Start over', 'Cancel']);
await p.screenshot({ path: `${dir}/2.6.4-confirm.png` });
// Start over needs a second confirm; Go back + Cancel changes nothing
await p.click('[data-testid="day-confirm"] >> text=Start over');
assert.match(await p.textContent('[data-testid="day-confirm"]'), /This erases Thursday's data/);
await p.click('text=Go back'); await p.click('[data-testid="day-confirm"] >> text=Cancel');
assert.equal(await p.locator('[data-testid="day-confirm"]').count(), 0);
assert.notEqual((await sess()).status, 'commuting', 'cancel did not start');
// Start over -> Yes -> session in replace mode (only on save); then Cancel path back via fresh start check
await p.click('text=Start Day (Leave Home)'); await p.click('[data-testid="day-confirm"] >> text=Start over'); await p.click('text=Yes, erase it');
assert.equal((await sess()).saveMode, 'replace');
// Reset session and test Continue -> merge
await p.evaluate(() => localStorage.removeItem('gig_tracker_active_session')); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
await p.click('text=Start Day (Leave Home)'); await p.click('text=Continue this day');
let s = await sess(); assert.equal(s.status, 'commuting'); assert.equal(s.workdayStr, '2026-10-29'); assert.equal(s.saveMode, 'merge');
await p.click('text=Start Work / First Dispatch');
// 3:59 AM Friday: still Thursday's workday
await p.clock.fastForward('06:29:00'); await p.waitForTimeout(1200);
assert.match(await p.textContent('[data-testid="workday-ends"]'), /Thursday, Oct 29/);
await p.click('text=End Day & Save'); await p.click('text=Save & Reset Timers'); await p.waitForTimeout(500);
const hist = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records')));
assert.equal(hist.length, 1, 'merged into one Thursday record'); assert.equal(hist[0].id, 'thu'); assert.equal(hist[0].dateStr, '2026-10-29');
assert.ok(hist[0].totalSeconds > 18000 + 6 * 3600, 'kept the earlier 5h and added the new time');
assert.equal(hist[0].totalEarnings, 120, 'earlier earnings kept');
const undo = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_undo_v1')));
assert.equal(undo[0].before[0].totalSeconds, 18000, 'undo snapshot of the pre-merge day');
// 4:00 AM: Friday becomes the workday
await p.clock.fastForward('00:01:30'); await p.waitForTimeout(1200); await p.locator('button:visible', { hasText: 'Live Shift' }).first().click();
assert.match(await p.textContent('[data-testid="workday-ends"]'), /Friday, Oct 30.*ends Sat 4:00 AM/);
// Settings: version, cutoffs (expand Uber + weekday overrides), undo list
await p.click('[aria-label="Settings"]').catch(async () => p.click('button:has(svg.lucide-settings)'));
await p.waitForSelector('[data-testid="cutoff-settings"]');
assert.equal(await p.textContent('[data-testid="app-version"]'), 'v2.6.4');
await p.click('[data-testid="cutoff-settings"] >> text=Uber Rides');
await p.locator('[data-testid="cutoff-app-Uber Rides"] >> text=Different cutoff on some days').click();
await p.fill('[aria-label="Uber Rides Fri cutoff"]', '05:00');
await p.locator('[data-testid="cutoff-settings"]').scrollIntoViewIfNeeded();
await p.locator('[data-testid="cutoff-settings"]').screenshot({ path: `${dir}/2.6.4-cutoffs.png` });
await p.click('text=Save Settings');
const st = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_settings')));
assert.equal(st.cutoffs.apps['Uber Rides'].weekdayOverrides['5'], 300); assert.equal(st.cutoffs.default.dayMinutes, 240);
assert.deepEqual(errs, []);
console.log('day confirm / cutoff e2e: PASS');
await b.close();
