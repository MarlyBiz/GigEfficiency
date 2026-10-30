// Charts at 360 and 412 px: all 14 bars fit (no horizontal scroll) on every tab. Usage: node test/charts-e2e.mjs <url> <shot-prefix>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const [url, prefix] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const out = {}, errs = [];
for (const width of [360, 412]) {
  const p = await (await b.newContext({ viewport: { width, height: 900 }, timezoneId: 'America/New_York' })).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true'); localStorage.setItem('gig_tracker_samples_seeded', 'true');
    const recs = []; for (let i = 0; i < 20; i++) { const st = new Date(2026, 9, 29 - i, 16).getTime(); const amt = 80 + (i * 37) % 160;
      const d = new Date(st); const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      recs.push({ id: 'r' + i, dateStr: ds, startTime: st, endTime: st + 6 * 3600e3, totalSeconds: 21600, workSeconds: 18000, totalMiles: 120, workMiles: 100, platformEarnings: [{ id: 'u' + i, name: 'Uber Rides', amount: amt }], bonusEarnings: [], totalEarnings: amt, dollarsPerHourTotal: amt / 6, dollarsPerHourWork: amt / 5, dollarsPerMileTotal: amt / 120, dollarsPerMileWork: amt / 100, notes: '', createdAt: 1 }); }
    localStorage.setItem('gig_tracker_history_records', JSON.stringify(recs));
  });
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  await p.locator('button:visible').filter({ hasText: /^\s*Charts\s*$/ }).first().click(); await p.waitForTimeout(400);
  for (const tab of ['Daily Earnings', '$/Hr Trend', 'Weekly Compare', 'Monthly Compare']) {
    await p.locator('button', { hasText: tab }).first().click(); await p.waitForTimeout(250);
    out[`${width}:${tab}`] = await p.evaluate(() => {
      const chart = [...document.querySelectorAll('div.h-64')].find(el => el.offsetParent);
      const box = chart.parentElement;
      const bars = [...chart.children].filter(c => c.classList.contains('flex-1'));
      const visLabels = bars.filter(c => { const l = c.lastElementChild; return l && getComputedStyle(l).visibility === 'visible'; }).length;
      const inside = bars.every(c => { const r = c.getBoundingClientRect(), R = box.getBoundingClientRect(); return r.left >= R.left - 0.5 && r.right <= R.right + 0.5; });
      return { bars: bars.length, labels: visLabels, fits: box.scrollWidth <= box.clientWidth && inside, pageScroll: document.documentElement.scrollWidth > innerWidth, peak: !!document.body.innerText.match(/Peak: /) };
    });
    if (width === 412 && tab === 'Daily Earnings') await p.locator('section', { has: p.locator('div.h-64:visible') }).last().screenshot({ path: `${prefix}-charts-daily.png` });
  }
}
out.errs = errs;
console.log(JSON.stringify(out));
await b.close();
