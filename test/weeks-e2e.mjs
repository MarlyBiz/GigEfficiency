// Week catch-up e2e at 412px. BASE=https://gig.marlylabs.app PREFIX=shots/live-2.6.11 node test/weeks-e2e.mjs
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const BASE = process.env.BASE || 'http://localhost:4173', prefix = process.env.PREFIX || '/tmp/weeks';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })).newPage();
p.on('dialog', d => { console.log('dialog:', d.message().slice(0, 120)); d.accept(); });
await p.addInitScript(() => { if (!localStorage.getItem('seeded_w')) { localStorage.setItem('seeded_w', '1'); localStorage.setItem('gig_tracker_has_onboarded', 'true'); localStorage.setItem('gig_tracker_samples_seeded', 'true'); } });
await p.goto(BASE); await p.waitForTimeout(3500);
const out = { version: await p.evaluate(() => fetch('/version.json').then(r => r.json()).then(j => j.version)) };
const tab = async name => { await p.locator('button:visible').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).first().click(); await p.waitForTimeout(700); };
const monthRow = async label => {
  await tab('Closeouts');
  const row = p.locator('tr').filter({ has: p.locator('td', { hasText: new RegExp(`^${label}$`) }) }).first();
  if (!(await row.count())) return { total: '$0.00' };
  const tds = await row.locator('td').allTextContents();
  return { shifts: tds[1], total: tds[2], workH: tds[3], miles: tds[7] };
};
const addApp = async (scope, app, amt) => {
  await p.locator(`${scope} button:has-text("Add app")`).first().click();
  await p.selectOption(`${scope} [aria-label="Choose app"]`, app);
  await p.locator(`${scope} [data-testid="app-rows"] button:text-is("Add")`).click();
  await p.locator(`${scope} [data-testid="app-rows"] > div`).filter({ hasText: app }).locator('input').fill(amt);
};
out.octBefore = await monthRow('October 2026');

// 1. Whole week Oct 5–11: Uber $500 / 25h / 300 mi
await tab('History');
await p.click('button:has-text("Catch up past months")');
await p.click('[data-testid="summary-editor"] button:has-text("Weeks")');
await p.selectOption('[aria-label="Week"]', { label: 'Oct 5 – Oct 11' });
await addApp('[data-testid="summary-editor"]', 'Uber Rides', '500');
await p.fill('[aria-label="Active Work Time"]', '25h'); await p.fill('[aria-label="Total Time"]', '25h');
await p.fill('[aria-label="Total Miles"]', '300'); await p.fill('[aria-label="Work Miles"]', '300');
await p.locator('[aria-label="Notes"]').click();
out.hint1 = await p.textContent('[data-testid="week-hint"]');
await p.locator('[data-testid="summary-editor"]').screenshot({ path: `${prefix}-week-form.png` });
await p.click('button:has-text("Save Summary")'); await p.waitForTimeout(500);
out.octAfter = await monthRow('October 2026');
await p.screenshot({ path: `${prefix}-closeouts-october.png`, fullPage: false });
await p.locator('tr').filter({ hasText: 'October 2026' }).first().scrollIntoViewIfNeeded();
await p.screenshot({ path: `${prefix}-closeouts-october.png` });

// 2. Sep 28 – Oct 4 broken into days: 9/29 $100, 10/2 $150
await tab('History');
await p.click('button:has-text("Catch up past months")');
await p.click('[data-testid="summary-editor"] button:has-text("Weeks")');
await p.selectOption('[aria-label="Week"]', { label: 'Sep 28 – Oct 4' });
await p.check('[aria-label="Break into days"]');
for (const [d, amt, h] of [['2026-09-29', '100', '5h'], ['2026-10-02', '150', '6h']]) {
  await p.click(`[aria-label="Day ${d}"]`);
  await addApp(`[data-testid="week-day-${d}"]`, 'Uber Rides', amt);
  await p.fill(`[data-testid="week-day-${d}"] [aria-label="Day work time"]`, h);
  await p.fill(`[data-testid="week-day-${d}"] [aria-label="Day total miles"]`, '50');
}
await p.locator('[aria-label="Notes"]').click();
out.splitTotal = await p.textContent('[data-testid="summary-total"]');
out.hint2 = await p.textContent('[data-testid="week-hint"]');
await p.locator('[data-testid="summary-editor"]').screenshot({ path: `${prefix}-split-form.png` });
await p.click('button:has-text("Save Summary")'); await p.waitForTimeout(500);
out.badges = await p.locator('[data-testid="summary-badge"]:visible').allTextContents();
out.countsIn = await p.locator('[data-testid="week-months"]:visible').allTextContents();
await p.screenshot({ path: `${prefix}-history-weeks.png` });
out.sep = await monthRow('September 2026'); out.oct = await monthRow('October 2026');
await p.locator('tr').filter({ hasText: 'September 2026' }).first().scrollIntoViewIfNeeded();
await p.screenshot({ path: `${prefix}-closeouts-sep-oct.png` });
out.hscroll = await p.evaluate(() => document.documentElement.scrollWidth);

// 3. Overlap warning: a real shift on 10/7 vs a new week entry Oct 5–11 (shown, then cancel)
// 4. Delete the test data
await tab('History');
for (let i = 0; i < 2; i++) {
  const card = p.locator('[data-testid="summary-badge"]:visible').first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  await card.locator('button:has-text("Edit")').click();
  await p.click('[aria-label="Delete summary"]');
  await p.click('[data-testid="summary-editor"] button:text-is("Delete")'); await p.waitForTimeout(400);
}
out.weeksLeft = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records') || '[]').filter(r => r.kind === 'week').length);
out.octFinal = await monthRow('October 2026');
console.log(JSON.stringify(out, null, 1));
await b.close();
