/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Settings section: work reminders (Web Push), end-of-shift safety reminder (Web Push),
 * and the on-device home area used for the "Back home?" prompt.
 * Changes save instantly to their own localStorage key (independent of "Save Settings").
 * Permissions are requested only when a feature is switched on.
 */

import React, { useState } from 'react';
import { Bell, Home, MapPin, Plus, Trash2, ShieldCheck, Send } from 'lucide-react';
import {
  ReminderConfig, WorkReminder, saveReminderConfig, loadReminderConfig, useReminderConfig, parseLeadMinutes,
  ensurePushSubscription, sendTestPush, geocodeAddress, pushSupported,
} from '../utils/reminders';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const card = 'p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2';
const input = 'px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500';
const smallBtn = 'px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50';

/** Accessible on/off switch. */
const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; busy?: boolean }> = ({ on, onChange, label, busy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={busy}
    onClick={() => onChange(!on)}
    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-60 ${on ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

export const RemindersSettings: React.FC = () => {
  const cfg = useReminderConfig();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [leadText, setLeadText] = useState(String(cfg.leadMinutes));
  const [address, setAddress] = useState('');
  const [radiusText, setRadiusText] = useState(String(cfg.home?.radius ?? 300));

  // Merge into the freshest stored config (async permission flows may finish after other edits)
  const update = (patch: Partial<ReminderConfig>) => saveReminderConfig({ ...loadReminderConfig(), ...patch });
  const fail = (e: unknown) => setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });

  /** Turning on a push feature: ask for notification permission + subscribe, then save. */
  const enablePush = async (patch: Partial<ReminderConfig>) => {
    setBusy(true); setMsg(null);
    try {
      await ensurePushSubscription();
      update(patch);
      setMsg({ ok: true, text: 'Notifications are on. Reminders arrive even with the app closed.' });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const updateReminder = (id: string, patch: Partial<WorkReminder>) =>
    update({ reminders: cfg.reminders.map(r => (r.id === id ? { ...r, ...patch } : r)) });

  const addReminder = () =>
    update({ reminders: [...cfg.reminders, { id: Math.random().toString(36).slice(2), days: [1, 2, 3, 4, 5], time: '09:00' }] });

  const radius = () => { const n = Math.round(parseFloat(radiusText)); return n >= 50 && n <= 5000 ? n : 300; };

  /** Location permission is requested here, only when the user taps the button. */
  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) return fail(new Error('Location is not available on this device.'));
    setBusy(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        update({ home: { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Current location', radius: radius() } });
        setMsg({ ok: true, text: `Home area saved on this device (±${Math.round(pos.coords.accuracy)} m). Turn on the switch to use it.` });
        setBusy(false);
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      },
      err => { fail(new Error(err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.')); setBusy(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const findAddress = async () => {
    if (!address.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const hit = await geocodeAddress(address.trim());
      if (!hit) throw new Error('Address not found. Try adding the city or ZIP code.');
      update({ home: { ...hit, radius: radius() } });
      setMsg({ ok: true, text: 'Home area saved on this device. Turn on the switch to use it.' });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  /** Turning on the home prompt: needs a saved home, then asks for location (and notifications, optional). */
  const toggleHome = (on: boolean) => {
    if (!on) return update({ homeEnabled: false });
    if (!cfg.home) return fail(new Error('Set your home area first (current location or address).'));
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => { update({ homeEnabled: true }); setBusy(false); },
      () => { fail(new Error('Location permission is needed for the home prompt.')); setBusy(false); },
      { timeout: 20000 }
    );
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  };

  return (
    <div className="space-y-3" data-testid="reminders-settings">
      <div className="flex items-center gap-2 pt-2">
        <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <span className="font-bold text-slate-900 dark:text-white text-sm">Reminders & Home</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">· saved instantly</span>
      </div>

      {msg && (
        <div className={`p-2.5 rounded-xl text-[11px] font-semibold border ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Work reminders */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 block">Work reminders</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Push notification before your planned start, even with the app closed.</span>
          </div>
          <Toggle label="Work reminders" on={cfg.remindersEnabled} busy={busy}
            onChange={on => (on ? enablePush({ remindersEnabled: true, reminders: cfg.reminders.length ? cfg.reminders : [{ id: 'r1', days: [1, 2, 3, 4, 5], time: '09:00' }] }) : update({ remindersEnabled: false }))} />
        </div>

        {cfg.remindersEnabled && (
          <div className="space-y-2 pt-1">
            {cfg.reminders.map(r => (
              <div key={r.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1">
                  {DAY_LABELS.map((l, d) => {
                    const on = r.days.includes(d);
                    return (
                      <button key={d} type="button" aria-label={DAY_NAMES[d]} aria-pressed={on}
                        onClick={() => updateReminder(r.id, { days: on ? r.days.filter(x => x !== d) : [...r.days, d].sort() })}
                        className={`w-8 h-8 rounded-lg text-[11px] font-bold cursor-pointer ${on ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {l}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-500">Start</label>
                  <input type="time" value={r.time} aria-label="Start time"
                    onChange={e => e.target.value && updateReminder(r.id, { time: e.target.value })} className={input} />
                  <button type="button" aria-label="Delete reminder" onClick={() => update({ reminders: cfg.reminders.filter(x => x.id !== r.id) })}
                    className="ml-auto p-2 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={addReminder} className={smallBtn}><Plus className="w-3.5 h-3.5" />Add reminder</button>
              <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap">
              <label className="text-[11px] text-slate-500">Remind me</label>
              <input type="text" inputMode="numeric" aria-label="Minutes before" value={leadText}
                onChange={e => setLeadText(e.target.value)}
                onBlur={() => { const n = parseLeadMinutes(leadText); setLeadText(String(n)); update({ leadMinutes: n }); }}
                className={`${input} w-16 text-right`} />
              <span className="text-[11px] text-slate-500">min before</span>
              </span>
            </div>
            <button type="button" disabled={busy}
              onClick={async () => { try { await sendTestPush('start'); setMsg({ ok: true, text: 'Test push sent.' }); } catch (e) { fail(e); } }}
              className={smallBtn}><Send className="w-3.5 h-3.5" />Send test push</button>
          </div>
        )}
      </div>

      {/* Safety reminder */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Still-working reminder</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Push if your timer is still running after this time. Only running/stopped is shared, never your location.</span>
          </div>
          <Toggle label="Still-working reminder" on={cfg.safetyEnabled} busy={busy}
            onChange={on => (on ? enablePush({ safetyEnabled: true }) : update({ safetyEnabled: false }))} />
        </div>
        {cfg.safetyEnabled && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500">Remind me if still running after</label>
            <input type="time" aria-label="Shift end time" value={cfg.safetyEndTime}
              onChange={e => e.target.value && update({ safetyEndTime: e.target.value })} className={input} />
          </div>
        )}
      </div>

      {/* Home area (device only) */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"><Home className="w-3.5 h-3.5" />Back-home prompt</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">While the app is open and a shift is running, asks to stop the timer when you get home. Home stays on this device only.</span>
          </div>
          <Toggle label="Back-home prompt" on={cfg.homeEnabled} busy={busy} onChange={toggleHome} />
        </div>
        <div className="text-[11px] text-slate-600 dark:text-slate-300" data-testid="home-label">
          {cfg.home ? <>Home: <span className="font-semibold">{cfg.home.label}</span> · {cfg.home.radius} m</> : 'No home area set yet.'}
        </div>
        <button type="button" disabled={busy} onClick={useCurrentLocation} className={smallBtn}>
          <MapPin className="w-3.5 h-3.5" />Use my current location
        </button>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="or type an address" aria-label="Home address" value={address}
            onChange={e => setAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && findAddress()}
            className={`${input} flex-1 min-w-0 font-sans`} />
          <button type="button" disabled={busy || !address.trim()} onClick={findAddress} className={smallBtn}>Find</button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500">Radius</label>
          <input type="text" inputMode="numeric" aria-label="Home radius in meters" value={radiusText}
            onChange={e => setRadiusText(e.target.value)}
            onBlur={() => { const n = radius(); setRadiusText(String(n)); if (cfg.home) update({ home: { ...cfg.home, radius: n } }); }}
            className={`${input} w-20 text-right`} />
          <span className="text-[11px] text-slate-500">meters</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Address search by <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer" className="underline">Nominatim</a>, data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>.
        </p>
      </div>

      {/* What leaves the device */}
      <div className={card} data-testid="privacy-note">
        <span className="font-bold text-slate-800 dark:text-slate-200 block">What leaves the device</span>
        <ul className="list-disc pl-4 text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
          <li>Sent to the push server: your push subscription, time zone and the reminder schedule (days, times, minutes before, whether a shift is running and its end-reminder time).</li>
          <li>Never leaves the phone: your home location and all shift, earnings, mileage and expense data.</li>
        </ul>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          iPhone/iPad: iOS can limit alerts if the app hasn't been opened for several days, so open it now and then. "Done working?" only works while the app is open.
        </p>
      </div>

      {!pushSupported() && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Push isn't available in this browser. On iPhone/iPad, install the app (Share → Add to Home Screen) and open it from the Home Screen.
        </p>
      )}
    </div>
  );
};
