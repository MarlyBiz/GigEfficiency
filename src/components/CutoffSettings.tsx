/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AppSettings, CutoffRule } from '../types';
import { addAppToSettings, removeAppFromSettings, suggestableApps } from '../utils/appList';
import { monthKeyForTime, monthPeriodLabel, resolveMonthStart } from '../utils/workday';
import { normalizeCutoffs, ruleFor, minutesToTime, timeToMinutes, formatClock, WEEKDAYS } from '../utils/workday';

const box = 'px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs';
const short = (m: number) => formatClock(m).replace(' (midnight)', '');

const RuleEditor: React.FC<{ label: string; rule: CutoffRule; onChange: (r: CutoffRule) => void; testId: string }> = ({ label, rule, onChange, testId }) => {
  const overrides = rule.weekdayOverrides || {};
  const [showDays, setShowDays] = useState(Object.keys(overrides).length > 0);
  const setOverride = (wd: number, v: string) => {
    const o = { ...overrides };
    if (v === '') delete o[wd]; else o[wd] = timeToMinutes(v);
    onChange({ ...rule, weekdayOverrides: o });
  };
  return (
    <div className="space-y-2" data-testid={testId}>
      <span className="font-bold text-slate-800 dark:text-slate-200 block">{label}</span>
      <label className="flex items-center justify-between gap-2">
        <span className="text-slate-600 dark:text-slate-400">Workday ends (next morning)</span>
        <input type="time" aria-label={`${label} day cutoff`} className={box} value={minutesToTime(rule.dayMinutes)}
          onChange={e => onChange({ ...rule, dayMinutes: timeToMinutes(e.target.value || '00:00') })} />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-600 dark:text-slate-400">Week starts</span>
        <span className="flex gap-1">
          <select aria-label={`${label} week start day`} className={box} value={rule.weekStartDay} onChange={e => onChange({ ...rule, weekStartDay: Number(e.target.value) })}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input type="time" aria-label={`${label} week start time`} className={box} value={minutesToTime(rule.weekStartMinutes)}
            onChange={e => onChange({ ...rule, weekStartMinutes: timeToMinutes(e.target.value || '00:00') })} />
        </span>
      </div>
      <button type="button" onClick={() => setShowDays(v => !v)} className="text-emerald-700 dark:text-emerald-400 font-semibold cursor-pointer">
        {showDays ? 'Hide' : 'Different cutoff on some days'}
      </button>
      {showDays && (
        <div className="grid grid-cols-2 gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex items-center justify-between gap-1">
              <span className="text-slate-600 dark:text-slate-400 w-8">{d}</span>
              <input type="time" aria-label={`${label} ${d} cutoff`} className={`${box} flex-1`} value={overrides[i] !== undefined ? minutesToTime(overrides[i]) : ''}
                onChange={e => setOverride(i, e.target.value)} />
            </label>
          ))}
          <p className="col-span-2 text-[11px] text-slate-500">Blank = same as above ({short(rule.dayMinutes)}). E.g. Fri set to 5:00 AM means Friday's workday runs until Saturday 5:00 AM.</p>
        </div>
      )}
    </div>
  );
};

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** Month start (day 1-28 + time). Default: the 1st at the workday cutoff. */
const MonthStartEditor: React.FC<{ settings: AppSettings; onChange: (s: AppSettings) => void }> = ({ settings, onChange }) => {
  const ms = resolveMonthStart(settings);
  const key = monthKeyForTime(Date.now(), settings);
  return (
    <div className="space-y-1.5" data-testid="month-start">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-600 dark:text-slate-400">Month starts</span>
        <span className="flex gap-1">
          <select aria-label="Month start day" className={box} value={ms.day}
            onChange={e => onChange({ ...settings, monthStart: { ...settings.monthStart, day: Number(e.target.value) } })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{ordinal(d)}</option>)}
          </select>
          <input type="time" aria-label="Month start time" className={box} value={minutesToTime(ms.minutes)}
            onChange={e => onChange({ ...settings, monthStart: { day: ms.day, minutes: timeToMinutes(e.target.value || '00:00') } })} />
        </span>
      </div>
      <p className="text-[11px] text-slate-500" data-testid="month-period">
        This month: {monthPeriodLabel(key, settings)}. Used for monthly totals, goals and closeouts{ms.day > 1 ? `; shifts before the ${ordinal(ms.day)} count toward the previous month` : ''}. Days 29-31 aren't offered because not every month has them.
      </p>
    </div>
  );
};

/** Global default + per-app day/week cutoffs (Uber 4:00 AM / Mon 4:00 AM, others midnight). */
export const CutoffSettings: React.FC<{ settings: AppSettings; onChange: (s: AppSettings) => void }> = ({ settings, onChange }) => {
  const cutoffs = settings.cutoffs || normalizeCutoffs(settings);
  const apps = settings.defaultPlatforms || [];
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const suggestions = suggestableApps(settings);
  const startAdd = () => { setAdding(true); setErr(''); setCustom(''); setChoice(suggestions[0] || '__custom__'); };
  const doAdd = () => {
    try {
      onChange(addAppToSettings(settings, choice === '__custom__' ? custom : choice));
      setAdding(false); setErr('');
    } catch (e: any) { setErr(e.message); }
  };
  const doDelete = (name: string) => {
    try {
      onChange(removeAppFromSettings(settings, name));
      if (openApp === name) setOpenApp(null);
      setConfirmDel(null); setErr('');
    } catch (e: any) { setErr(e.message); setConfirmDel(null); }
  };
  const setDefault = (r: CutoffRule) => onChange({ ...settings, cutoffs: { ...cutoffs, default: r } });
  const setApp = (name: string, r: CutoffRule) => onChange({ ...settings, cutoffs: { ...cutoffs, apps: { ...cutoffs.apps, [name]: r } } });
  return (
    <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3" data-testid="cutoff-settings">
      <div>
        <span className="font-bold text-slate-800 dark:text-slate-200 block">Day & Week Cutoffs</span>
        <p className="text-slate-500 dark:text-slate-400 text-[11px]">
          A workday is named by the day it starts and runs until the cutoff the next morning, so with 4:00 AM, Thursday stays the workday until Friday 4:00 AM.
        </p>
      </div>
      <RuleEditor label="Default (timer & all apps)" rule={cutoffs.default} onChange={setDefault} testId="cutoff-default" />
      <MonthStartEditor settings={settings} onChange={onChange} />
      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1.5">
        <span className="font-bold text-slate-800 dark:text-slate-200 block">Per app (weekly view & closeouts)</span>
        {apps.map(name => {
          const r = ruleFor(settings, name);
          return (
            <div key={name} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2" data-testid="cutoff-app-row">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setOpenApp(openApp === name ? null : name)} className="flex-1 min-w-0 flex justify-between gap-2 text-left cursor-pointer">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{name}</span>
                  <span className="text-slate-500 shrink-0">day {short(r.dayMinutes)} · week {WEEKDAYS[r.weekStartDay]} {short(r.weekStartMinutes)}</span>
                </button>
                <button type="button" aria-label={`Remove ${name}`} onClick={() => { setErr(''); setConfirmDel(name); }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {confirmDel === name && (
                <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1.5" data-testid="confirm-remove-app">
                  <p className="text-[11px] text-rose-900 dark:text-rose-200">Remove {name} from your app list? Saved shifts and earnings for {name} stay in History.</p>
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setConfirmDel(null)} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer">Cancel</button>
                    <button type="button" onClick={() => doDelete(name)} className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer">Remove</button>
                  </div>
                </div>
              )}
              {openApp === name && <div className="mt-2"><RuleEditor label={name} rule={r} onChange={v => setApp(name, v)} testId={`cutoff-app-${name}`} /></div>}
            </div>
          );
        })}
        {adding ? (
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 p-2 space-y-1.5" data-testid="add-app-form">
            <div className="flex gap-1.5">
              <select aria-label="App to add" className={`${box} flex-1 min-w-0`} value={choice} onChange={e => setChoice(e.target.value)}>
                {suggestions.map(a => <option key={a} value={a}>{a}</option>)}
                <option value="__custom__">Other (type a name)…</option>
              </select>
              <button type="button" onClick={doAdd} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">Add</button>
              <button type="button" onClick={() => { setAdding(false); setErr(''); }} aria-label="Cancel adding app" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>
            {choice === '__custom__' && (
              <input aria-label="Custom app name" maxLength={40} placeholder="e.g. Roadie" className={`${box} w-full`} value={custom}
                onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } }} />
            )}
            <p className="text-[11px] text-slate-500">New apps start with a midnight cutoff and weeks from Mon 12:00 AM (Uber apps: 4:00 AM). Also offered in Edit Shift.</p>
          </div>
        ) : (
          <button type="button" onClick={startAdd}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1 cursor-pointer hover:bg-white dark:hover:bg-slate-900">
            <Plus className="w-3.5 h-3.5" /> Add app
          </button>
        )}
        {err && <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
      </div>
    </div>
  );
};
