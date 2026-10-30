// 412 px: Adjust Timers > Restart day: confirm (Go back changes nothing; Yes, restart zeroes timers, keeps
// earnings/miles, saves an undo copy). Usage: node test/restart-e2e.mjs <url> <shot-prefix>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const [url, prefix] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await (await b.newContext({ viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York' })).newPage();
const errs = [], out = {};
p.on('pageerror', e => errs.push(e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true'); localStorage.setItem('gig_tracker_samples_seeded', 'true');
  const t0 = Date.now() - 2 * 3600e3;
  localStorage.setItem('gig_tracker_active_session', JSON.stringify({ status: 'working', startDayTimestamp: t0, startWorkTimestamp: t0, endDayTimestamp: null,
    workSegments: [{ startTime: t0 + 600e3 }], breakSegments: [], manualAdjustmentSeconds: 300, manualWorkAdjustmentSeconds: 0,
    platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 61 }], bonusEarnings: [], totalMiles: 40, workMiles: 30, notes: '' }));
  localStorage.setItem('gig_tracker_history_records', '[]');
});
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const sess = () => p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_active_session')));
const before = await sess();
await p.click('button:has-text("Time Offsets")');
await p.locator('[data-testid="restart-day"]').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${prefix}-restart-button.png` });
await p.click('[data-testid="restart-day"]');
out.confirmText = await p.locator('[data-testid="restart-confirm"]').innerText();
await p.screenshot({ path: `${prefix}-restart-confirm.png` });
await p.click('button:text-is("Go back")');
out.goBackUnchanged = JSON.stringify(await sess()) === JSON.stringify(before) && !(await p.locator('[data-testid="restart-confirm"]').count());
await p.click('[data-testid="restart-day"]');
await p.click('button:text-is("Yes, restart")');
await p.waitForTimeout(1200);
const s = await sess();
out.after = { manualTotal: s.manualAdjustmentSeconds, manualWork: s.manualWorkAdjustmentSeconds, startAgoSec: Math.round((Date.now() - s.startDayTimestamp) / 1000), workSegs: s.workSegments.length, earnings: s.platformEarnings[0].amount, miles: s.totalMiles, status: s.status };
out.pending = await p.textContent('[data-testid="work-offset-pending"]');
out.undo = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_undo_v1') || '[]').map(u => u.label + (u.session ? ' +session' : '')));
await p.click('button:text-is("Done")');
await p.waitForTimeout(1500);
out.timerText = (await p.locator('main').innerText()).match(/\b0:0[0-9]:[0-9]{2}\b/g)?.slice(0, 2);
out.history = await p.evaluate(() => localStorage.getItem('gig_tracker_history_records'));
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
