// Browser check at 412 px: Export Backup downloads gig-backup-YYYY-MM-DD.json; Restore validates,
// shows Replace/Merge, merge skips duplicates; bad file changes nothing. Screenshot of the Export modal.
// Usage: node test/backup-e2e.mjs <url> <shot.png>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';
const [url, shot] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, acceptDownloads: true, timezoneId: 'America/New_York' });
const p = await ctx.newPage();
const errs = [], out = {};
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true');
  const r = (id, d, earn) => ({ id, dateStr: `2026-10-${d}`, startTime: new Date(`2026-10-${d}T09:00:00`).getTime(), endTime: new Date(`2026-10-${d}T14:00:00`).getTime(), totalSeconds: 18000, workSeconds: 14400, totalMiles: 80, workMiles: 60, platformEarnings: [{ id: 'p', name: 'Uber', amount: earn }], bonusEarnings: [], totalEarnings: earn, dollarsPerHourTotal: earn / 5, dollarsPerHourWork: earn / 4, dollarsPerMileTotal: earn / 80, dollarsPerMileWork: earn / 60, notes: '', createdAt: 1 });
  localStorage.setItem('gig_tracker_history_records', JSON.stringify([r('a', '27', 150), r('b', '28', 120)]));
  localStorage.setItem('gig_tracker_reminders_v1', JSON.stringify({ version: 1, homeEnabled: true, home: { lat: 42.66, lon: -83.38, label: 'Home', radius: 300 } }));
});
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.click('[aria-label="Export Statements"]');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Export Backup (JSON)')]);
out.fileName = dl.suggestedFilename();
const path = '/tmp/gig-backup-test.json'; await dl.saveAs(path);
const txt = (await import('node:fs')).readFileSync(path, 'utf8');
out.noHome = !/42\.66|-83\.38|"home"/.test(txt);
// Bad file -> error, nothing changed
writeFileSync('/tmp/bad-backup.json', '{"app":"gig-efficiency","schema":1,"data":{"settings":{},"history":"x"}}');
await p.setInputFiles('[data-testid="restore-input"]', '/tmp/bad-backup.json');
await p.waitForTimeout(300);
out.badMsg = await p.textContent('[data-testid="import-result"]');
// Valid file -> confirm with both choices -> merge (2 duplicates)
await p.setInputFiles('[data-testid="restore-input"]', path);
await p.waitForSelector('[data-testid="restore-confirm"]');
out.choices = await p.locator('[data-testid="restore-confirm"] button').allTextContents();
await p.locator('[data-testid="restore-confirm"]').scrollIntoViewIfNeeded();
await p.screenshot({ path: shot });
await p.click('[data-testid="restore-confirm"] button:has-text("Merge shifts")'); await p.waitForTimeout(500); await p.screenshot({ path: '/tmp/after-merge.png' }); console.log('ERRS', JSON.stringify(errs), 'MSGS', await p.locator('[data-testid="import-result"]').count());
out.mergeMsg = await p.locator('[data-testid="import-result"]').count() && await p.textContent('[data-testid="import-result"]');
out.historyCount = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records')).length);
out.version = await p.evaluate(async () => (await (await fetch('/version.json', { cache: 'no-store' })).json()).version);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
