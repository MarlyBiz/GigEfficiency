// E2E: seed history -> Export modal "Shifts CSV" download -> clear -> Import CSV -> compare.
// Usage: node test/import-e2e.mjs <url> [screenshot]
import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const url = process.argv[2], shot = process.argv[3];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, acceptDownloads: true, timezoneId: 'America/New_York' });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
const t = (d, h, m) => new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime();
const seeded = [
  { id: 'a', dateStr: '2026-10-29', startTime: t('2026-10-29', 7, 15), endTime: t('2026-10-29', 15, 45), totalSeconds: 30600, workSeconds: 22500,
    totalMiles: 142.3, workMiles: 118.7, platformEarnings: [{ id: '1', name: 'Uber', amount: 132.4 }, { id: '2', name: 'Lyft', amount: 61.15 }],
    bonusEarnings: [], totalEarnings: 193.55, dollarsPerHourTotal: 22.77, dollarsPerHourWork: 30.97, dollarsPerMileTotal: 1.36, dollarsPerMileWork: 1.63,
    notes: 'Airport run, "surge" at 9', createdAt: 1 },
  { id: 'b', dateStr: '2026-10-28', startTime: t('2026-10-28', 18, 0), endTime: t('2026-10-29', 1, 30), totalSeconds: 27000, workSeconds: 21600,
    totalMiles: 98, workMiles: 80.5, platformEarnings: [{ id: '3', name: 'Uber', amount: 150 }],
    bonusEarnings: [{ id: 'q', platform: 'Uber', bonusType: 'uber_quest', amount: 25, dateStr: '2026-10-28', notes: '3 trips', createdAt: 1 }],
    totalEarnings: 175, dollarsPerHourTotal: 23.33, dollarsPerHourWork: 29.17, dollarsPerMileTotal: 1.79, dollarsPerMileWork: 2.17, notes: '', createdAt: 1 },
];
await p.goto(url);
await p.evaluate(s => { localStorage.clear(); localStorage.setItem('gig_tracker_has_onboarded', 'true'); localStorage.setItem('gig_tracker_history_records', JSON.stringify(s)); }, seeded);
await p.reload({ waitUntil: 'networkidle' });
const openModal = () => p.click('[aria-label="Export Statements"]');
await openModal();
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Shifts CSV Spreadsheet Export')]);
const csvPath = '/tmp/roundtrip.csv'; await dl.saveAs(csvPath);
// Clear history, reload, import the file
await p.evaluate(() => localStorage.setItem('gig_tracker_history_records', '[]'));
await p.reload({ waitUntil: 'networkidle' });
await openModal();
let dialogMsg = '';
p.once('dialog', d => { dialogMsg = d.message(); d.accept(); });
await p.setInputFiles('[data-testid="import-input"]', csvPath);
await p.waitForSelector('[data-testid="import-result"]');
const result1 = await p.textContent('[data-testid="import-result"]');
if (shot) await p.screenshot({ path: shot });
const got = await p.evaluate(() => JSON.parse(localStorage.getItem('gig_tracker_history_records')));
// Re-import same file -> all duplicates
await p.setInputFiles('[data-testid="import-input"]', csvPath);
await p.waitForTimeout(300);
const result2 = await p.textContent('[data-testid="import-result"]');
const cmp = r => ({ d: r.dateStr, ts: r.totalSeconds, ws: r.workSeconds, tm: r.totalMiles, wm: r.workMiles, te: r.totalEarnings,
  base: r.baseEarnings ?? r.platformEarnings.reduce((s, x) => s + x.amount, 0), bonus: (r.bonusEarnings || []).reduce((s, x) => s + x.amount, 0),
  pl: r.platformEarnings.map(x => `${x.name}=${x.amount}`).sort().join(';'),
  bl: (r.bonusEarnings || []).map(x => `${x.platform}|${x.bonusType}|${x.amount}|${x.notes || ''}`).join(';'),
  rates: [r.dollarsPerHourTotal, r.dollarsPerHourWork, r.dollarsPerMileTotal, r.dollarsPerMileWork].join(','), n: r.notes });
const a = JSON.stringify(seeded.map(cmp).sort((x, y) => x.d.localeCompare(y.d)));
const g = JSON.stringify(got.map(cmp).sort((x, y) => x.d.localeCompare(y.d)));
console.log(JSON.stringify({ dialogMsg, result1, result2, match: a === g, errs }, null, 1));
if (a !== g) console.log('EXPECTED', a, '\nGOT     ', g);
await b.close();
process.exit(a === g && dialogMsg === 'Import 2 days?' && errs.length === 0 ? 0 : 1);
