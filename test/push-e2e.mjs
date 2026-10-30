// Push E2E (headed Chrome + persistent profile; Chrome disables push in incognito-style contexts):
//   HEADED=1 xvfb-run -a node test/push-e2e.mjs <url>
// Turns on Work reminders (subscribes), taps "Send test push", checks the notification arrived, then turns it off.
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
import { mkdtempSync } from 'node:fs';
const url = process.argv[2];
const ctx = await chromium.launchPersistentContext(mkdtempSync('/tmp/gigpush-'), {
  executablePath: '/usr/bin/google-chrome', headless: !process.env.HEADED, viewport: { width: 412, height: 900 }, timezoneId: 'America/New_York',
});
await ctx.grantPermissions(['notifications'], { origin: new URL(url).origin });
const p = ctx.pages()[0] || await ctx.newPage();
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true'); });
await p.reload({ waitUntil: 'networkidle' });
const notes = () => p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(n => `${n.title} | ${n.body}`));
await p.click('[aria-label="Settings"]');
await p.click('[aria-label="Work reminders"]');
await p.waitForSelector('text=Notifications are on', { timeout: 20000 }).catch(async () => { console.log('SECTION:', (await p.locator('[data-testid="reminders-settings"]').innerText()).slice(0, 300)); });
await p.waitForTimeout(2000); // debounced /subscribe
await p.click('text=Send test push');
let got = [];
for (let i = 0; i < 25 && !got.length; i++) { await p.waitForTimeout(1000); got = await notes(); }
const sent = (await p.locator('[data-testid="reminders-settings"]').innerText()).includes('Test push sent.');
await p.click('[aria-label="Work reminders"]'); await p.waitForTimeout(2500); // off -> server record removed
console.log(JSON.stringify({ serverAccepted: sent, notificationShown: got }));
await ctx.close();
