// E2E at 412 px: Settings > Reminders & Home screenshot, geofence prompt flow, push subscribe + test push.
// Usage: node test/reminders-e2e.mjs <url> <shot-prefix>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const url = process.argv[2], shot = process.argv[3] || '/tmp/rem';
const HOME = { latitude: 42.6600, longitude: -83.3800 };
// Persistent profile: Chrome disables Web Push in incognito-style contexts.
import { mkdtempSync } from 'node:fs';
const ctx = await chromium.launchPersistentContext(mkdtempSync('/tmp/gigprof-'), {
  executablePath: '/usr/bin/google-chrome', headless: !process.env.HEADED,
  viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York', geolocation: HOME,
});
const b = ctx;
await ctx.grantPermissions(['geolocation', 'notifications'], { origin: new URL(url).origin });
const p = ctx.pages()[0] || await ctx.newPage();
const errs = [], out = {};
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true'); });
await p.reload({ waitUntil: 'networkidle' });

// 1. Settings section + home via "Use my current location", radius 300, enable prompt
await p.click('[aria-label="Settings"], button[title*="Settings"]');
await p.click('text=Use my current location');
await p.waitForSelector('text=Home area saved on this device');
await p.click('[aria-label="Back-home prompt"]');
await p.waitForTimeout(500);
out.homeLabel = await p.textContent('[data-testid="home-label"]');
// Work reminders -> requests push permission + subscribes
await p.click('[aria-label="Work reminders"]');
await p.waitForTimeout(4000);
out.pushMsg = (await p.locator('[data-testid="reminders-settings"] > div').nth(1).textContent()).slice(0, 140);
console.log('PUSHMSG', out.pushMsg); await p.fill('[aria-label="Minutes before"]', '25'); await p.locator('[aria-label="Minutes before"]').blur();
const sec = p.locator('[data-testid="reminders-settings"]');
await sec.scrollIntoViewIfNeeded();
await sec.screenshot({ path: `${shot}-settings.png` });
out.cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_reminders_v1')));
out.subscribed = await p.evaluate(async () => !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()));
await p.click('text=Cancel');

// 2. Start shift at home, drive away, come back -> prompt once, Stop opens End & Save
await p.click('text=Start Day (Leave Home)');
await p.waitForTimeout(1500);
await ctx.setGeolocation({ latitude: HOME.latitude + 0.03, longitude: HOME.longitude }); // ~3.3 km away
await p.waitForTimeout(2500);
out.promptWhileAway = await p.isVisible('text=Back home, done working?');
await ctx.setGeolocation({ latitude: HOME.latitude + 0.001, longitude: HOME.longitude }); // ~110 m from home
await p.waitForSelector('text=Back home, done working?', { timeout: 15000 }).catch(() => {});
out.promptOnReturn = await p.isVisible('text=Back home, done working?');
await p.screenshot({ path: `${shot}-backhome.png` });
if (!out.promptOnReturn) { console.log(JSON.stringify({ ...out, fence: await p.evaluate(() => localStorage.getItem('gig_tracker_geofence_state_v1')), sess: await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_active_session')).status), errs }, null, 1)); process.exit(1); }
await p.click('text=Keep going');
await ctx.setGeolocation({ latitude: HOME.latitude + 0.0012, longitude: HOME.longitude });
await p.waitForTimeout(2500);
out.repromptWithoutLeaving = await p.isVisible('text=Back home, done working?');
// Leave and return again, then Stop
await ctx.setGeolocation({ latitude: HOME.latitude + 0.03, longitude: HOME.longitude }); await p.waitForTimeout(2500);
await ctx.setGeolocation(HOME);
await p.waitForSelector('text=Back home, done working?', { timeout: 15000 });
await p.click('button:has-text("Stop")');
await p.waitForTimeout(800);
out.statusAfterStop = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_active_session')).status);
out.endSaveDialog = await p.isVisible('text=/Save/i');
out.errs = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
