// 412 px: Settings > Month starts = 2nd 4:00 AM; closeouts put Oct 1 and Oct 2 3:59 AM shifts in September.
// Usage: node test/monthstart-e2e.mjs <url> <shot-prefix>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const [url, prefix] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await (await b.newContext({ viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York' })).newPage();
const errs = [], out = {};
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true'); localStorage.setItem('gig_tracker_samples_seeded', 'true');
  const mk = (id, iso, amt) => { const st = new Date(iso).getTime(); const d = new Date(st - 4 * 3600e3);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { id, dateStr: ds, startTime: st, endTime: st + 3600e3, totalSeconds: 3600, workSeconds: 3000, totalMiles: 10, workMiles: 8, platformEarnings: [{ id: id + 'u', name: 'Uber Rides', amount: amt }], bonusEarnings: [], totalEarnings: amt, dollarsPerHourTotal: amt, dollarsPerHourWork: amt, dollarsPerMileTotal: 1, dollarsPerMileWork: 1, notes: '', createdAt: 1 }; };
  localStorage.setItem('gig_tracker_history_records', JSON.stringify([
    mk('a', '2026-10-01T18:00:00', 100), mk('b', '2026-10-02T03:59:00', 50), mk('c', '2026-10-02T04:00:00', 30), mk('d', '2026-10-15T12:00:00', 20)]));
});
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const closeouts = async () => {
  await p.locator('button:visible').filter({ hasText: /^\s*Closeouts\s*$/ }).first().click(); await p.waitForTimeout(400);
  return p.locator('main').innerText();
};
let txt = await closeouts();
out.defaultRange = await p.locator('[data-testid="current-month-range"]').innerText();
out.defaultHasOct200 = txt.includes('$200.00');
await p.click('[aria-label="Settings"]');
out.defaultPeriod = await p.locator('[data-testid="month-period"]').innerText();
out.dayOptions = (await p.locator('[aria-label="Month start day"] option').allTextContents()).slice(-1)[0];
await p.selectOption('[aria-label="Month start day"]', '2');
await p.fill('[aria-label="Month start time"]', '04:00');
out.markPeriod = await p.locator('[data-testid="month-period"]').innerText();
await p.locator('[data-testid="month-start"]').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${prefix}-month-start-settings.png` });
await p.click('button:has-text("Save Settings")');
out.saved = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_settings')).monthStart);
txt = await closeouts();
out.markRange = await p.locator('[data-testid="current-month-range"]').innerText();
out.currentMonthLine = (txt.match(/Current Month: \$[\d,.]+/) || [])[0];
out.septemberRow = (txt.match(/September 2026[^\n]*\n?[^\n]*/) || [])[0];
out.hasSept150 = txt.includes('$150.00');
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
