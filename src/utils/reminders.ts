/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Work reminders, end-of-shift safety reminder, and home area.
 *
 * Privacy split:
 *  - Reminder schedule + timezone + shift state (running / end-reminder time) go to the
 *    gig-push Worker so pushes can arrive with the app closed.
 *  - The home area (lat/lon/radius/label) lives ONLY in this device's localStorage and is
 *    never sent to our server.
 */

import { useEffect, useState } from 'react';

export const PUSH_SERVER = 'https://gig-push.marlylabs.app';
const CONFIG_KEY = 'gig_tracker_reminders_v1';
const CHANGE_EVENT = 'gig-reminders-changed';

export interface WorkReminder {
  id: string;
  days: number[]; // 0 = Sunday … 6 = Saturday
  time: string; // "HH:MM" local start time
}

export interface HomeArea {
  lat: number;
  lon: number;
  label: string;
  radius: number; // metres
}

export interface ReminderConfig {
  version: 1;
  remindersEnabled: boolean;
  reminders: WorkReminder[];
  leadMinutes: number;
  safetyEnabled: boolean;
  safetyEndTime: string; // "HH:MM": remind if the shift is still running past this time
  homeEnabled: boolean;
  home: HomeArea | null;
}

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  version: 1,
  remindersEnabled: false,
  reminders: [],
  leadMinutes: 15,
  safetyEnabled: false,
  safetyEndTime: '22:00',
  homeEnabled: false,
  home: null,
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Load config with safe JSON parsing; anything malformed falls back to defaults. */
export function loadReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_REMINDER_CONFIG };
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return { ...DEFAULT_REMINDER_CONFIG };
    const home = p.home && Number.isFinite(p.home.lat) && Number.isFinite(p.home.lon)
      ? { lat: p.home.lat, lon: p.home.lon, label: String(p.home.label || ''), radius: Number(p.home.radius) > 0 ? Number(p.home.radius) : 300 }
      : null;
    return {
      version: 1,
      remindersEnabled: !!p.remindersEnabled,
      reminders: Array.isArray(p.reminders)
        ? p.reminders.filter((r: any) => r && TIME.test(r.time) && Array.isArray(r.days)).map((r: any) => ({
            id: String(r.id || Math.random().toString(36).slice(2)),
            days: r.days.map(Number).filter((d: number) => d >= 0 && d <= 6),
            time: r.time,
          }))
        : [],
      leadMinutes: Number.isFinite(p.leadMinutes) ? p.leadMinutes : 15,
      safetyEnabled: !!p.safetyEnabled,
      safetyEndTime: TIME.test(p.safetyEndTime) ? p.safetyEndTime : '22:00',
      homeEnabled: !!p.homeEnabled && !!home,
      home,
    };
  } catch {
    return { ...DEFAULT_REMINDER_CONFIG };
  }
}

export function saveReminderConfig(cfg: ReminderConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error('Failed to save reminder settings', e);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** React hook: current config, re-rendering whenever it's saved anywhere in the app. */
export function useReminderConfig(): ReminderConfig {
  const [cfg, setCfg] = useState<ReminderConfig>(() => loadReminderConfig());
  useEffect(() => {
    const onChange = () => setCfg(loadReminderConfig());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return cfg;
}

/** Free-typed minutes -> integer 0..720 (empty/garbage -> 15). */
export function parseLeadMinutes(text: string): number {
  const n = Math.round(parseFloat(text));
  return Number.isFinite(n) ? Math.min(720, Math.max(0, n)) : 15;
}

/** Next moment (epoch ms) at local "HH:MM" strictly after `from`. */
export function nextLocalTime(from: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Great-circle distance in metres. */
export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ---------------- Web Push ----------------

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64uToBytes = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};

async function post(path: string, body: unknown) {
  const r = await fetch(PUSH_SERVER + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Server error ${r.status}`);
  return data;
}

/** Existing push subscription, if any (never prompts). */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks for notification permission (only call from a user action) and subscribes to push. */
export async function ensurePushSubscription(): Promise<PushSubscription> {
  if (!pushSupported()) {
    throw new Error('Push notifications are not supported here. On iPhone, add the app to your Home Screen first.');
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.');
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const { key } = await (await fetch(PUSH_SERVER + '/vapid-public')).json();
  if (!key) throw new Error('Push server is not configured.');
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
}

export interface ShiftState {
  shiftRunning: boolean;
  endReminderAt: number | null;
}

/** Sends schedule + timezone + shift state (never the home area). Unsubscribes if both features are off. */
export async function syncPushSchedule(cfg: ReminderConfig, shift: ShiftState, sub?: PushSubscription | null) {
  const s = sub ?? (await getPushSubscription());
  if (!s) return;
  if (!cfg.remindersEnabled && !cfg.safetyEnabled) {
    await post('/unsubscribe', { endpoint: s.endpoint }).catch(() => {});
    await s.unsubscribe().catch(() => {});
    return;
  }
  await post('/subscribe', {
    subscription: s.toJSON(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    remindersEnabled: cfg.remindersEnabled,
    reminders: cfg.reminders.filter(r => r.days.length).map(r => ({ days: r.days, time: r.time })),
    leadMinutes: cfg.leadMinutes,
    safetyEnabled: cfg.safetyEnabled,
    ...shift,
  });
}

/** Shift state only (running flag + end-reminder time). */
export async function syncShiftState(shift: ShiftState) {
  const s = await getPushSubscription();
  if (s) await post('/shift', { endpoint: s.endpoint, ...shift });
}

export async function sendTestPush(kind: 'start' | 'safety' = 'start') {
  const s = await getPushSubscription();
  if (!s) throw new Error('Not subscribed yet.');
  return post('/test', { endpoint: s.endpoint, kind });
}

/** Local (on-device) notification through the service worker, if permission was granted. */
export async function showLocalNotification(title: string, body: string, tag: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', data: { url: '/' } });
    else new Notification(title, { body, tag });
  } catch { /* notifications are best-effort */ }
}

// ---------------- Geocoding (keyless, address stays between device and OSM Nominatim) ----------------

export async function geocodeAddress(q: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Address lookup failed (${r.status})`);
  const [hit] = await r.json();
  return hit ? { lat: +hit.lat, lon: +hit.lon, label: String(hit.display_name || q) } : null;
}
