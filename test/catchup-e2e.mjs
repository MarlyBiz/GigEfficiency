// Browser check at 412 px: edit app rows (remove DoorDash, add Lyft), Add past day (no apps preset),
// month + year catch-up summaries, duplicate-month block, closeouts totals, CSV leaves summaries out.
// Usage: node test/catchup-e2e.mjs <url> <shot-prefix>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
import { readFileSync } from 'node:fs';
const [url, prefix] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York', acceptDownloads: true });
const p = await ctx.newPage();
const errs = [], out = {};
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
const hist = () => p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records') || '[]'));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true');
  const st = new Date('2026-10-27T16:00:00').getTime();
  localStorage.setItem('gig_tracker_history_records', JSON.stringify([{ id: 'd1', dateStr: '2026-10-27', startTime: st, endTime: st + 5 * 3600e3, totalSeconds: 18000, workSeconds: 14400, totalMiles: 75, workMiles: 65, platformEarnings: [{ id: 'uber', name: 'Uber Rides', amount: 95 }, { id: 'doordash', name: 'DoorDash', amount: 45 }], bonusEarnings: [], totalEarnings: 140, dollarsPerHourTotal: 28, dollarsPerHourWork: 35, dollarsPerMileTotal: 1.87, dollarsPerMileWork: 2.15, notes: '', createdAt: 1 }]));
});
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const tab = name => p.locator('button:visible').filter({ hasText: new RegExp('^\\s*' + name + '\\s*$') }).first().click();

// 1. Edit Shift: remove DoorDash, add Lyft $45
await tab('History');
await p.click('button:has-text("Edit")');
await p.click('[aria-label="Remove DoorDash"]');
await p.click('button:has-text("Add app")');
await p.selectOption('[aria-label="Choose app"]', 'Lyft');
await p.click('[data-testid="app-rows"] button:text-is("Add")');
const lyftRow = p.locator('[data-testid="app-rows"] > div').filter({ hasText: 'Lyft' });
await lyftRow.locator('input').fill('45'); await lyftRow.locator('input').blur();
out.dupOptionHidden = !(await p.locator('[aria-label="Choose app"] option', { hasText: /^Lyft$/ }).count());
out.editTotal = await p.locator('text=/^Total: /').first().textContent();
await p.locator('[data-testid="app-rows"]').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${prefix}-edit-shift-lyft.png` });
await p.click('button:has-text("Save")');
const h1 = await hist();
out.savedRows = h1.find(r => r.id === 'd1').platformEarnings.map(r => `${r.name}=${r.amount}`);
out.savedTotal = h1.find(r => r.id === 'd1').totalEarnings;

// 2. Add past day: no apps pre-chosen
await p.click('button:has-text("Add past day")');
out.addDayTitle = await p.locator('h3:has-text("Add Past Day")').count();
out.addDayStartsEmpty = await p.locator('text=No apps yet').count();
await p.locator('input[type="date"]').fill('2026-10-25');
await p.click('button:has-text("Add app")');
await p.selectOption('[aria-label="Choose app"]', 'Uber Rides');
await p.click('[data-testid="app-rows"] button:text-is("Add")');
await p.locator('[data-testid="app-rows"] > div').filter({ hasText: 'Uber Rides' }).locator('input').fill('80');
await p.fill('[aria-label="Total Shift Time"]', '3h 30m');
await p.fill('[aria-label="Active Work Time"]', '3h');
await p.click('button:has-text("Save")');
const added = (await hist()).find(r => r.dateStr === '2026-10-25');
out.pastDay = added && { rows: added.platformEarnings.map(r => r.name), total: added.totalEarnings, totalSeconds: added.totalSeconds };

// 3. Month catch-up (March 2026) + screenshot of the form
await p.click('button:has-text("Catch up past months")');
await p.fill('[aria-label="Month"]', '2026-03');
for (const [app, amt] of [['Uber Rides', '1800'], ['Lyft', '700']]) {
  await p.click('[data-testid="summary-editor"] button:has-text("Add app")');
  await p.selectOption('[aria-label="Choose app"]', app);
  await p.click('[data-testid="app-rows"] button:text-is("Add")');
  await p.locator('[data-testid="app-rows"] > div').filter({ hasText: app }).locator('input').fill(amt);
}
await p.fill('[aria-label="Active Work Time"]', '80h');
await p.fill('[aria-label="Total Time"]', '100h 30m');
await p.fill('[aria-label="Total Miles"]', '2000'); await p.fill('[aria-label="Work Miles"]', '1500');
await p.locator('[aria-label="Notes"]').click();
out.summaryTotal = await p.textContent('[data-testid="summary-total"]');
await p.locator('[data-testid="summary-editor"]').screenshot({ path: `${prefix}-catchup-form.png` });
await p.click('button:has-text("Save Summary")');
// Same month again -> blocked, offers Edit it
await p.click('button:has-text("Catch up past months")');
await p.fill('[aria-label="Month"]', '2026-03');
out.dupMonthOffer = await p.locator('button:has-text("Edit it")').count();
await p.click('button:has-text("Cancel")');

// 4. Whole past year 2025
await p.click('button:has-text("Catch up past months")');
await p.click('button:has-text("Whole past year")');
await p.selectOption('[aria-label="Year"]', '2025');
await p.click('[data-testid="summary-editor"] button:has-text("Add app")');
await p.selectOption('[aria-label="Choose app"]', 'Uber Rides');
await p.click('[data-testid="app-rows"] button:text-is("Add")');
await p.locator('[data-testid="app-rows"] > div').filter({ hasText: 'Uber Rides' }).locator('input').fill('30000');
await p.fill('[aria-label="Active Work Time"]', '1000h'); await p.fill('[aria-label="Total Time"]', '1300h');
await p.click('button:has-text("Save Summary")');
out.badges = await p.locator('[data-testid="summary-badge"]').allTextContents();
out.historyHeader = await p.locator('h2:has-text("Driving History")').textContent();

// 5. Closeouts: monthly has March 2026 = $2,500; yearly 2025 = $30,000 and 2026 includes March
await tab('Closeouts');
await p.waitForTimeout(500);
out.monthlyHasMarch = (await p.locator('main').innerText()).includes('2,500');
await p.locator('button', { hasText: /^Yearly/ }).first().click().catch(() => {});
await p.waitForTimeout(300);
const yearly = await p.locator('main').innerText();
out.yearlyHas2025 = yearly.includes('30,000'); out.yearly2026 = yearly.includes('2,720') || yearly.includes('2720');

// 6. CSV leaves summaries out
await p.click('[aria-label="Export Statements"]');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Shifts CSV Spreadsheet Export')]);
await dl.saveAs('/tmp/catchup.csv');
out.csvDataRows = readFileSync('/tmp/catchup.csv', 'utf8').trim().split('\n').length - 1;
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
