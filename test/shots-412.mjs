// 412 px screenshots of the goal card (with a seeded running shift) and Settings > Reminders & Home.
// Usage: node test/shots-412.mjs <url> <shot-prefix>
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const [url, prefix] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage({ viewport: { width: 412, height: 900 } });
const errs = [];
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
const now = Date.now();
await p.evaluate(now => {
  localStorage.clear();
  localStorage.setItem('gig_tracker_has_onboarded', 'true');
  // Running shift: 1.5 h work, $45 earned -> $30/hr; $105 left to a $150 goal -> 3h 30m
  localStorage.setItem('gig_tracker_active_session', JSON.stringify({
    status: 'working', startDayTimestamp: now - 2 * 3600e3, startWorkTimestamp: now - 1.5 * 3600e3, endDayTimestamp: null,
    workSegments: [{ startTime: now - 1.5 * 3600e3 }], breakSegments: [], manualAdjustmentSeconds: 0, manualWorkAdjustmentSeconds: 0,
    platformEarnings: [{ id: 'u', name: 'Uber Rides', amount: 30 }, { id: 'l', name: 'Lyft', amount: 15 }], bonusEarnings: [],
    totalMiles: 40, workMiles: 32, notes: '',
  }));
}, now);
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
const est = p.locator('text=/remaining at current work pace/');
const estText = await est.textContent();
// Whole goal card: nearest ancestor that contains both the title and the estimate
await p.locator('text=Shift Target Goal').evaluate(el => el.scrollIntoView({ block: 'start' }));
const box = await p.evaluate(() => {
  const est = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /remaining at current work pace/.test(e.textContent));
  let el = est; while (el && !/Shift Target Goal/.test(el.textContent)) el = el.parentElement;
  const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 880) };
});
await p.screenshot({ path: `${prefix}-goal-card.png`, clip: box });
await p.click('[aria-label="Settings"]');
await p.evaluate(() => localStorage.setItem('gig_tracker_reminders_v1', JSON.stringify({ version: 1, remindersEnabled: true, leadMinutes: 15, reminders: [{ id: 'a', days: [1, 2, 3, 4, 5], time: '09:00' }], safetyEnabled: true, safetyEndTime: '22:00', homeEnabled: false, home: null })));
await p.evaluate(() => window.dispatchEvent(new Event('gig-reminders-changed')));
await p.waitForTimeout(400);
const sec = p.locator('[data-testid="reminders-settings"]');
await sec.scrollIntoViewIfNeeded();
await sec.screenshot({ path: `${prefix}-settings-reminders.png` });
// "min before" must sit on the same line as its input
const sameLine = await p.evaluate(() => {
  const inp = document.querySelector('[aria-label="Minutes before"]');
  const lbl = [...document.querySelectorAll('span')].find(s => s.textContent === 'min before');
  return Math.abs(inp.getBoundingClientRect().top - lbl.getBoundingClientRect().top) < 12;
});
console.log(JSON.stringify({ estText, sameLine, version: await (await fetch(new URL('/version.json', url))).json().then(j => j.version), errs }));
await b.close();
