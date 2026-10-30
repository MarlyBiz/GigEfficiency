# Gig Efficiency Tracker

A private, phone-first tracker for rideshare and delivery drivers (Uber, Lyft, DoorDash and more).
Live at **https://gig.marlylabs.app**. Installable as a PWA.

## Features

- One-tap shift timer: leave home, start work, breaks, headed home, close out and save the day
- Earnings per app plus bonuses/quests, miles, expenses (Schedule C categories) and the IRS mileage deduction
- Live $/hr and $/mi, daily/weekly/monthly/yearly goals, with times shown as hours and minutes
- Workday cutoffs: a global default plus per-app day and week boundaries (Uber 4:00 AM, weeks Monday 4:00 AM; others midnight) with optional per-weekday overrides
- Safe saves: starting on a day that already has data asks first (Continue / Start over / Cancel); saves merge, never silently replace, and the last 10 changes can be restored from Settings → Data Management → Undo history
- History editing, past days, month/year catch-up totals
- CSV import/export, PDF statements, JSON full backup and restore (Replace everything or Merge shifts)
- Start-work reminders and a shift-end safety reminder by web push; optional "Done working?" prompt near home

## Privacy

All shift, earnings, mileage, expense and home-location data stay in the phone's local storage.
Only the push subscription, time zone and reminder schedule (plus whether a shift is running and its
end-reminder time) are sent to the small push server in `worker/` (`gig-push`). The JSON backup never
includes the home location. iOS may limit alerts if the app hasn't been opened for days, and the
"Done working?" prompt only works while the app is open.

## Development

Requires Node.js 20+.

```sh
npm install
npm run dev        # http://localhost:3000
npm run lint       # TypeScript type check
npx tsx test/<name>.test.ts        # unit tests
node test/<name>-e2e.mjs <url> ...  # browser tests (Playwright, headless Chrome)
```

## Build and deploy

```sh
npx vite build && npx wrangler deploy --config wrangler.jsonc
```

Static assets in `dist/` are served by Cloudflare at gig.marlylabs.app. When releasing, bump the version in
`public/version.json`, `public/sw.js` (cache name), `src/utils/autoUpdater.ts` and `package.json`.
The push server lives in `worker/` and is deployed separately.
