// gig-push: Web Push reminders for Gig Efficiency Tracker (https://gig.marlylabs.app).
// Stores per subscription only: push endpoint + keys, IANA timezone, work-reminder schedule,
// and shift state (running flag + end-reminder time). Never a location. No request logging.
import { sendPush } from './webpush.js';

const ALLOWED_ORIGIN = /^(https:\/\/gig\.marlylabs\.app|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEK = 7 * 1440; // minutes in a week
const WINDOW = 30; // a due reminder may still go out up to 30 min late (missed cron ticks)
const APP_URL = 'https://gig.marlylabs.app/';

const cors = (origin) => (origin && ALLOWED_ORIGIN.test(origin)
  ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
  : {});
const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) } });

async function keyFor(endpoint) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return 'sub:' + [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Minutes since local Sunday 00:00 in the given timezone. */
export function weekMinutes(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return dow * 1440 + +p.hour * 60 + +p.minute;
}
const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);

function validEndpoint(e) {
  try { const u = new URL(e); return u.protocol === 'https:' && e.length < 1024 && PUSH_HOSTS.test(u.hostname); } catch { return false; }
}
function validTz(tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string'; } catch { return false; } }

// Normalise the client payload into the stored record (only these fields are ever kept)
function clean(b, prev = {}) {
  const s = b.subscription || {};
  const rec = {
    endpoint: s.endpoint ?? prev.endpoint,
    keys: s.keys ? { p256dh: String(s.keys.p256dh || ''), auth: String(s.keys.auth || '') } : prev.keys,
    timezone: b.timezone ?? prev.timezone,
    remindersEnabled: !!(b.remindersEnabled ?? prev.remindersEnabled),
    leadMinutes: Math.round(Math.min(720, Math.max(0, Number(b.leadMinutes ?? prev.leadMinutes ?? 15) || 0))),
    reminders: Array.isArray(b.reminders) ? b.reminders : prev.reminders || [],
    safetyEnabled: !!(b.safetyEnabled ?? prev.safetyEnabled),
    shiftRunning: !!(b.shiftRunning ?? prev.shiftRunning),
    endReminderAt: b.endReminderAt !== undefined ? b.endReminderAt : prev.endReminderAt ?? null,
    sent: prev.sent || {},
  };
  if (!validEndpoint(rec.endpoint)) return 'bad endpoint';
  if (!rec.keys || !/^[A-Za-z0-9_-]{80,100}$/.test(rec.keys.p256dh) || !/^[A-Za-z0-9_-]{16,30}$/.test(rec.keys.auth)) return 'bad keys';
  if (!validTz(rec.timezone)) return 'bad timezone';
  if (rec.reminders.length > 20) return 'too many reminders';
  rec.reminders = rec.reminders.map((r) => ({
    days: [...new Set((Array.isArray(r?.days) ? r.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
    time: String(r?.time || ''),
  }));
  if (!rec.reminders.every((r) => TIME.test(r.time))) return 'bad time';
  if (rec.endReminderAt !== null && !(Number.isFinite(rec.endReminderAt) && rec.endReminderAt > 0)) return 'bad endReminderAt';
  // A new end-reminder time re-arms the one-shot safety push
  if (rec.endReminderAt !== prev.endReminderAt) delete rec.sent.safety;
  return rec;
}

/** Which work reminders are due now: returns occurrence ids (reminder index + day + fire minute). */
export function dueReminders(rec, nowMin) {
  if (!rec.remindersEnabled) return [];
  const due = [];
  rec.reminders.forEach((r, i) => {
    for (const d of r.days) {
      const fire = (((d * 1440 + toMin(r.time) - rec.leadMinutes) % WEEK) + WEEK) % WEEK; // may wrap into the previous day
      const late = (nowMin - fire + WEEK) % WEEK;
      if (late < WINDOW) due.push(`${i}:${d}:${r.time}:${rec.leadMinutes}`);
    }
  });
  return due;
}

const startPayload = (rec) => ({
  title: 'Starting work soon?',
  body: rec.leadMinutes > 0 ? `Your shift starts in ${rec.leadMinutes} min. Tap to start your shift.` : 'Tap to start your shift.',
  tag: 'gig-start', url: APP_URL,
});
const safetyPayload = () => ({ title: 'Still working?', body: 'Your timer is still running. Tap to check it.', tag: 'gig-safety', url: APP_URL });

async function processRecord(key, rec, env, now = Date.now()) {
  const nowMin = weekMinutes(rec.timezone, new Date(now));
  let changed = false, gone = false;
  const send = async (payload, ttl) => {
    const status = await sendPush(rec, payload, env, ttl);
    if (status === 404 || status === 410) gone = true;
    return status >= 200 && status < 300;
  };
  try {
    for (const occ of dueReminders(rec, nowMin)) {
      // Don't resend the same occurrence within 2 hours (cron ticks overlap the 30-min window)
      if (rec.sent[occ] && now - rec.sent[occ] < 2 * 3600e3) continue;
      if (rec.shiftRunning) { rec.sent[occ] = now; changed = true; continue; } // already working: skip
      if (await send(startPayload(rec), 1800)) { rec.sent[occ] = now; changed = true; }
      if (gone) break;
    }
    if (!gone && rec.safetyEnabled && rec.shiftRunning && rec.endReminderAt && now >= rec.endReminderAt && !rec.sent.safety) {
      if (now - rec.endReminderAt > 12 * 3600e3 || (await send(safetyPayload(), 3600))) { rec.sent.safety = now; changed = true; }
    }
  } catch { /* retry on next tick */ }
  // Drop old occurrence marks
  for (const k of Object.keys(rec.sent)) if (k !== 'safety' && now - rec.sent[k] > 2 * 86400e3) { delete rec.sent[k]; changed = true; }
  if (gone) await env.SUBS.delete(key);
  else if (changed) await env.SUBS.put(key, JSON.stringify(rec));
}

async function cron(env) {
  let cursor;
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const { name: key } of page.keys) {
      const rec = await env.SUBS.get(key, 'json');
      if (rec) await processRecord(key, rec, env);
    }
  } while (cursor);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin');
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: ALLOWED_ORIGIN.test(origin || '') ? 204 : 403, headers: cors(origin) });
    if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'gig-push' }, 200, origin);
    // The VAPID public key is public by design; the private key stays a Worker secret.
    if (req.method === 'GET' && url.pathname === '/vapid-public') return json({ key: env.VAPID_PUBLIC || null }, 200, origin);
    if (req.method !== 'POST') return json({ error: 'not found' }, 404, origin);
    if (!origin || !ALLOWED_ORIGIN.test(origin)) return json({ error: 'forbidden' }, 403, null);
    let b;
    try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }
    const endpoint = b?.subscription?.endpoint || b?.endpoint;
    if (!validEndpoint(endpoint)) return json({ error: 'bad endpoint' }, 400, origin);
    const key = await keyFor(endpoint);

    // /subscribe: full save (schedule + shift state). /shift: shift state only.
    if (url.pathname === '/subscribe' || url.pathname === '/shift') {
      const prev = (await env.SUBS.get(key, 'json')) || {};
      if (url.pathname === '/shift') {
        if (!prev.endpoint) return json({ error: 'unknown subscription' }, 404, origin);
        b = { shiftRunning: b.shiftRunning, endReminderAt: b.endReminderAt ?? null };
      }
      const rec = clean(b, prev);
      if (typeof rec === 'string') return json({ error: rec }, 400, origin);
      if (!rec.remindersEnabled && !rec.safetyEnabled) { await env.SUBS.delete(key); return json({ ok: true, removed: true }, 200, origin); }
      await env.SUBS.put(key, JSON.stringify(rec));
      return json({ ok: true }, 200, origin);
    }
    if (url.pathname === '/unsubscribe') { await env.SUBS.delete(key); return json({ ok: true }, 200, origin); }
    if (url.pathname === '/test') {
      // Immediate test push to an already-stored subscription; 1 per 30 s
      const rec = await env.SUBS.get(key, 'json');
      if (!rec) return json({ error: 'unknown subscription' }, 404, origin);
      if (Date.now() - (rec.lastTest || 0) < 30000) return json({ error: 'slow down' }, 429, origin);
      rec.lastTest = Date.now();
      await env.SUBS.put(key, JSON.stringify(rec));
      try {
        const status = await sendPush(rec, b.kind === 'safety' ? safetyPayload() : startPayload(rec), env, 600);
        if (status === 404 || status === 410) await env.SUBS.delete(key);
        return json({ ok: status >= 200 && status < 300, pushStatus: status }, 200, origin);
      } catch { return json({ error: 'send failed' }, 502, origin); }
    }
    return json({ error: 'not found' }, 404, origin);
  },
  async scheduled(_evt, env, ctx) { ctx.waitUntil(cron(env)); },
};
