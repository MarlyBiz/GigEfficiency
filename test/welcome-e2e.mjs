// 412 px: welcome on first open, Next/Back/X/Skip, "Don't show again", Settings > Show welcome again,
// Share fallback toast, Install button (Chrome: instructions; iPhone: short Share sheet).
// Usage: node test/welcome-e2e.mjs <url> <shot-prefix>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const [url, prefix] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York' });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
const p = await ctx.newPage();
const errs = [], out = {};
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const W = '[data-testid="welcome-modal"]';
const fresh = async () => { await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500); };
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.evaluate(() => localStorage.clear()); await fresh();
out.firstOpen = await p.locator(W).isVisible();
await p.screenshot({ path: `${prefix}-welcome.png` });
await p.click(`${W} button:has-text("Next")`);
out.step2 = await p.locator(`${W} h3`).innerText();
await p.click(`${W} button:has-text("Back")`);
out.backTo1 = (await p.locator(`${W} h3`).innerText()) === 'Your real pay per hour';
await p.click('[aria-label="Close welcome"]');
out.flagAfterX = await p.evaluate(() => localStorage.getItem('gig_tracker_has_onboarded'));
const samples1 = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records') || '[]').length);
await fresh();
out.showsAgainUnchecked = await p.locator(W).isVisible();
out.samplesNotReseeded = samples1 === await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records') || '[]').length);
await p.check('[aria-label="Don\'t show again"]');
await p.click(`${W} button:has-text("Skip")`);
await fresh();
out.hiddenAfterDontShow = !(await p.locator(W).isVisible());
// Settings: Share + Show welcome again
await p.click('[aria-label="Settings"]');
out.settingsShare = await p.locator('[role="dialog"], div').locator('text=Share the app').first().isVisible();
await p.click('button:has-text("Show welcome again")');
out.reopened = await p.locator(W).isVisible();
for (let i = 0; i < 4; i++) await p.click(`${W} button:has-text("Next")`);
await p.click(`${W} button:has-text("Get started")`);
out.flagAfterFinish = await p.evaluate(() => localStorage.getItem('gig_tracker_has_onboarded'));
await fresh();
out.hiddenAfterFinish = !(await p.locator(W).isVisible());
// Header share -> copies link (no Web Share in desktop Linux Chrome)
await p.click('header [aria-label="Share app"], [aria-label="Share app"] >> nth=0');
out.toast = await p.locator('[data-testid="share-toast"]').innerText().catch(() => null);
out.clipboard = await p.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message);
await p.waitForTimeout(2700);
await p.screenshot({ path: `${prefix}-header-install-share.png`, clip: { x: 0, y: 0, width: 412, height: 140 } });
await p.click('[aria-label="Install app"]');
out.chromeInstallHelp = await p.locator('text=Install to Home Screen').first().isVisible();
// iPhone Safari: short Share sheet
const ios = await b.newContext({ viewport: { width: 412, height: 900 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
const q = await ios.newPage();
await q.goto(url, { waitUntil: 'networkidle' }); await q.waitForTimeout(2500);
await q.evaluate(() => localStorage.setItem('gig_tracker_has_onboarded', 'true')); await q.reload({ waitUntil: 'networkidle' }); await q.waitForTimeout(1500);
await q.click('[aria-label="Install app"]');
out.iosSheet = await q.locator('[data-testid="ios-install-sheet"]').innerText();
await q.screenshot({ path: `${prefix}-ios-install-sheet.png` });
const man = await (await p.request.get(new URL('/manifest.json', url).href)).json();
out.manifestOk = man.display === 'standalone' && man.icons.some(i => i.sizes === '512x512') && man.icons.some(i => i.sizes === '192x192');
out.version = await p.evaluate(async () => (await (await fetch('/version.json?t=' + Date.now())).json()).version);
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
