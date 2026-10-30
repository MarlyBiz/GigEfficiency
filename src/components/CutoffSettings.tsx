/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppSettings, CutoffRule } from '../types';
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

/** Global default + per-app day/week cutoffs (Uber 4:00 AM / Mon 4:00 AM, others midnight). */
export const CutoffSettings: React.FC<{ settings: AppSettings; onChange: (s: AppSettings) => void }> = ({ settings, onChange }) => {
  const cutoffs = settings.cutoffs || normalizeCutoffs(settings);
  const apps = settings.defaultPlatforms || [];
  const [openApp, setOpenApp] = useState<string | null>(null);
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
      <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-1.5">
        <span className="font-bold text-slate-800 dark:text-slate-200 block">Per app (weekly view & closeouts)</span>
        {apps.map(name => {
          const r = ruleFor(settings, name);
          return (
            <div key={name} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2">
              <button type="button" onClick={() => setOpenApp(openApp === name ? null : name)} className="w-full flex justify-between text-left cursor-pointer">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{name}</span>
                <span className="text-slate-500">day {short(r.dayMinutes)} · week {WEEKDAYS[r.weekStartDay]} {short(r.weekStartMinutes)}</span>
              </button>
              {openApp === name && <div className="mt-2"><RuleEditor label={name} rule={r} onChange={v => setApp(name, v)} testId={`cutoff-app-${name}`} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
