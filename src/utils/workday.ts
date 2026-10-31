/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workday + week boundaries. A workday is named by the calendar date it starts on and
 * ends at that rule's cutoff the next morning (e.g. Thursday runs until Friday 4:00 AM).
 */
import { AppSettings, CutoffRule, CutoffSettings, DayRecord, MonthStart } from '../types';

export const UBER_RULE: CutoffRule = { dayMinutes: 240, weekStartDay: 1, weekStartMinutes: 240, weekdayOverrides: {} };
export const MIDNIGHT_RULE: CutoffRule = { dayMinutes: 0, weekStartDay: 1, weekStartMinutes: 0, weekdayOverrides: {} };

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const at = (d: Date, minutes: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60);
const clampMin = (v: unknown, def: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n < 1440 ? n : def; };

export const isUberApp = (name: string) => /uber/i.test(name);
export const defaultRuleForApp = (name: string): CutoffRule => (isUberApp(name) ? UBER_RULE : MIDNIGHT_RULE);

export function normalizeRule(r: any, def: CutoffRule): CutoffRule {
  const o: Record<number, number> = {};
  if (r && typeof r.weekdayOverrides === 'object' && r.weekdayOverrides) {
    for (const [k, v] of Object.entries(r.weekdayOverrides)) {
      const wd = Number(k);
      if (wd >= 0 && wd <= 6 && v !== null && v !== undefined && v !== '') o[wd] = clampMin(v, def.dayMinutes);
    }
  }
  const wsd = Number(r?.weekStartDay);
  return {
    dayMinutes: clampMin(r?.dayMinutes, def.dayMinutes),
    weekStartDay: Number.isInteger(wsd) && wsd >= 0 && wsd <= 6 ? wsd : def.weekStartDay,
    weekStartMinutes: clampMin(r?.weekStartMinutes, def.weekStartMinutes),
    weekdayOverrides: o,
  };
}

/** Fill missing cutoff settings from the legacy dayCutoffHour/weekStartDay (no data loss). */
export function normalizeCutoffs(parsed: any): CutoffSettings {
  const legacyHour = Number.isFinite(Number(parsed?.dayCutoffHour)) ? Number(parsed.dayCutoffHour) : 4;
  const legacyWeek = Number.isInteger(Number(parsed?.weekStartDay)) ? Number(parsed.weekStartDay) : 1;
  const legacyDefault: CutoffRule = { dayMinutes: legacyHour * 60, weekStartDay: legacyWeek, weekStartMinutes: legacyHour * 60, weekdayOverrides: {} };
  const c = parsed?.cutoffs;
  const apps: Record<string, CutoffRule> = {};
  if (c && typeof c.apps === 'object' && c.apps) {
    for (const [name, r] of Object.entries(c.apps)) apps[name] = normalizeRule(r, defaultRuleForApp(name));
  }
  return { default: normalizeRule(c?.default, legacyDefault), apps };
}

export function ruleFor(settings: AppSettings, app?: string): CutoffRule {
  const c = settings.cutoffs || normalizeCutoffs(settings);
  if (!app) return c.default;
  return c.apps[app] || defaultRuleForApp(app);
}

/** Cutoff (minutes after midnight, next morning) ending the workday that starts on weekday wd. */
export const dayCutoffFor = (rule: CutoffRule, wd: number) => rule.weekdayOverrides?.[wd] ?? rule.dayMinutes;

/** End instant of the workday named dateStr. */
export function workdayEnd(dateStr: string, rule: CutoffRule): Date {
  const d = fromKey(dateStr);
  return at(addDays(d, 1), dayCutoffFor(rule, d.getDay()));
}

/** Workday (YYYY-MM-DD) a timestamp belongs to. Never a day that hasn't started yet. */
export function getWorkday(ts: number, rule: CutoffRule): string {
  const cal = new Date(ts);
  const prev = dateKey(addDays(cal, -1));
  return ts < workdayEnd(prev, rule).getTime() ? prev : dateKey(cal);
}

export const formatClock = (minutes: number) => {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (minutes === 0) return '12:00 AM (midnight)';
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
export const minutesToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** Week (7 workday dates) containing ts, starting weekStartDay at weekStartMinutes. */
export function getWeek(ts: number, rule: CutoffRule): { startDate: Date; endDate: Date; days: string[] } {
  const cal = new Date(ts);
  let start = at(addDays(cal, -((cal.getDay() - rule.weekStartDay + 7) % 7)), rule.weekStartMinutes);
  if (start.getTime() > ts) start = at(addDays(start, -7), rule.weekStartMinutes);
  const days = Array.from({ length: 7 }, (_, i) => dateKey(addDays(start, i)));
  const endDate = new Date(at(addDays(start, 7), rule.weekStartMinutes).getTime() - 1);
  return { startDate: start, endDate, days };
}

/** The 7 dates of a week starting on startKey. */
export const weekDates = (startKey: string) => Array.from({ length: 7 }, (_, i) => dateKey(addDays(fromKey(startKey), i)));
/** 4th day of the week: whichever month holds it holds at least 4 of the 7 days. */
export const weekMidDate = (startKey: string) => dateKey(addDays(fromKey(startKey), 3));
/** e.g. "Oct 5 – Oct 11" (adds the year when it isn't this year's). */
export function weekRangeLabel(startKey: string, now = new Date()): string {
  const a = fromKey(startKey), b = addDays(a, 6);
  const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(a)} – ${f(b)}${b.getFullYear() !== now.getFullYear() ? `, ${b.getFullYear()}` : ''}`;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const prettyDate = (dateStr: string) =>
  fromKey(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

/* ---------------- Month periods ----------------
 * A month "YYYY-MM" runs from its start day/time (default: the 1st at the workday cutoff) to the
 * same day/time of the next month. Start days are capped at 28 so every month (incl. February in
 * non-leap years) has one. E.g. start = 2nd 4:00 AM: shifts before Nov 2 4:00 AM count toward October.
 */
export function resolveMonthStart(settings: Partial<AppSettings>): Required<MonthStart> {
  const ms = settings?.monthStart;
  const d = Math.round(Number(ms?.day));
  const day = Number.isFinite(d) ? Math.min(28, Math.max(1, d)) : 1;
  const def = (settings?.cutoffs || normalizeCutoffs(settings)).default.dayMinutes;
  return { day, minutes: clampMin(ms?.minutes ?? def, def) };
}

const monthKeyOf = (y: number, m0: number) => { const d = new Date(y, m0, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

/** Start instant of month period `key` (YYYY-MM). */
export function monthPeriodStart(key: string, settings: Partial<AppSettings>): Date {
  const [y, m] = key.split('-').map(Number);
  const { day, minutes } = resolveMonthStart(settings);
  return new Date(y, m - 1, day, Math.floor(minutes / 60), minutes % 60);
}

/** Month period an instant belongs to. */
export function monthKeyForTime(ts: number, settings: Partial<AppSettings>): string {
  const d = new Date(ts);
  const key = monthKeyOf(d.getFullYear(), d.getMonth());
  return ts < monthPeriodStart(key, settings).getTime() ? monthKeyOf(d.getFullYear(), d.getMonth() - 1) : key;
}

/** Month period of a date-only value (expenses): treated as noon that day. */
export function monthKeyForDate(dateStr: string, settings: Partial<AppSettings>): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return monthKeyForTime(new Date(y, m - 1, d, 12).getTime(), settings);
}

/** Month period of a record. Catch-up month summaries stay in their entered month. */
export function monthKeyForRecord(r: DayRecord, settings: Partial<AppSettings>): string {
  if (r.kind === 'month' && r.periodKey) return r.periodKey;
  // Week summaries: a day part counts on its own date; a whole week counts in the month that
  // holds most of its days (= the month of its 4th day, using the month start setting).
  if (r.kind === 'week') return monthKeyForDate(r.attributedDate || weekMidDate(r.periodKey || r.dateStr), settings);
  if (r.kind === 'year') return `${r.periodKey || r.dateStr.slice(0, 4)}-01`;
  if (Number.isFinite(r.startTime) && r.startTime > 0) return monthKeyForTime(r.startTime, settings);
  return monthKeyForDate(r.dateStr, settings);
}

/** Year a record counts in (follows its month period; year summaries keep their year). */
export function yearKeyForRecord(r: DayRecord, settings: Partial<AppSettings>): string {
  if (r.kind === 'year') return r.periodKey || r.dateStr.slice(0, 4);
  return monthKeyForRecord(r, settings).slice(0, 4);
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clock = (d: Date) => { const h = d.getHours(), mi = d.getMinutes(); return `${h % 12 || 12}:${pad(mi)} ${h < 12 ? 'AM' : 'PM'}`; };
/** e.g. "Nov 2 4:00 AM – Dec 2 4:00 AM" */
export function monthPeriodLabel(key: string, settings: Partial<AppSettings>): string {
  const a = monthPeriodStart(key, settings);
  const [y, m] = key.split('-').map(Number);
  const b = monthPeriodStart(monthKeyOf(y, m), settings);
  return `${MON[a.getMonth()]} ${a.getDate()} ${clock(a)} – ${MON[b.getMonth()]} ${b.getDate()} ${clock(b)}`;
}
