// 412 px: on-load repair of a doubled Thu 10/29 (two identical copies) + undo copy; two open tabs stay in sync
// so a stale tab can't save the same shift again. Usage: node test/dupes-e2e.mjs <url>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const [url] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York' });
const p = await ctx.newPage();
const errs = [], out = {};
p.on('pageerror', e => errs.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true'); localStorage.setItem('gig_tracker_samples_seeded', 'true');
  const st = new Date('2026-10-29T17:45:00').getTime();
  const rec = id => ({ id, dateStr: '2026-10-29', startTime: st, endTime: st + 26700e3 / 1000 * 1000, totalSeconds: 26700, workSeconds: 22500, totalMiles: 185, workMiles: 160,
    platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 60.98 }, { id: 'l', name: 'Lyft', amount: 172.74 }], bonusEarnings: [], totalEarnings: 233.72,
    dollarsPerHourTotal: 31.51, dollarsPerHourWork: 37.4, dollarsPerMileTotal: 1.26, dollarsPerMileWork: 1.46, notes: '', createdAt: 1 });
  localStorage.setItem('gig_tracker_history_records', JSON.stringify([rec('a'), rec('b')]));
});
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
out.recordsAfterLoad = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records')).map(r => r.id + ':' + r.totalEarnings));
out.undo = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_undo_v1') || '[]').map(s => `${s.label} (${s.before.map(b => b.id)})`));
await p.locator('button:visible').filter({ hasText: /^\s*7-Day Week\s*$/ }).first().click(); await p.waitForTimeout(400);
const week = await p.locator('main').innerText();
out.weekShows233 = week.includes('$233.72'); out.weekShows467 = week.includes('$467.44');
// Two tabs: tab B is open while tab A ends and saves a shift; B must pick up the reset shift
await p.evaluate(() => localStorage.setItem('gig_tracker_history_records', '[]'));
const q = await ctx.newPage(); await q.goto(url, { waitUntil: 'networkidle' }); await q.waitForTimeout(2500);
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
await p.locator('button:visible').filter({ hasText: /^\s*Live Shift\s*$/ }).first().click();
await p.click('button:has-text("Start Day")'); await p.waitForTimeout(200); await p.click('button:has-text("Start Work")');
await q.waitForTimeout(500);
out.tabBSawShift = await q.locator('button:has-text("End Day")').count() > 0;
await p.click('button:has-text("End Day")'); await p.waitForTimeout(300);
await p.locator('button:has-text("Save & Reset Timers")').evaluate(el => { el.click(); el.click(); });
await q.waitForTimeout(600);
out.tabBReset = await q.locator('button:has-text("Start Day")').count() > 0;
out.historyAfterSave = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records')).length);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
