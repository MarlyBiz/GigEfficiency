/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Editable earnings-per-app list: each row has an amount and a remove (x) button, plus
 * "+ Add app" with the platforms from Settings and a custom name. The same app can't be added twice.
 */

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PlatformSlot } from '../types';
import { NumericInput } from './NumericInput';
import { addAppRow, availableApps, removeAppRow } from '../utils/periodSummaries';

const CUSTOM = '__custom__';

export const PlatformRowsEditor: React.FC<{
  rows: PlatformSlot[];
  onChange: (rows: PlatformSlot[]) => void;
  options: string[];
  currency: string;
}> = ({ rows, onChange, options, currency }) => {
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const choices = availableApps(options, rows);

  const setAmount = (id: string, val: number | string) => {
    const n = Math.max(0, typeof val === 'number' ? val : parseFloat(val) || 0);
    onChange(rows.map(r => (r.id === id ? { ...r, amount: n } : r)));
  };

  const add = () => {
    try {
      onChange(addAppRow(rows, choice === CUSTOM ? custom : choice));
      setAdding(false); setChoice(''); setCustom(''); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-1.5" data-testid="app-rows">
      {rows.length === 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">No apps yet. Add the apps you drove for.</p>
      )}
      {rows.map(p => (
        <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{p.name}</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-mono">{currency}</span>
            <NumericInput
              step="0.01"
              min={0}
              value={p.amount}
              onChange={val => setAmount(p.id, val)}
              placeholder="0"
              className="w-24 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs text-right focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              aria-label={`Remove ${p.name}`}
              onClick={() => onChange(removeAppRow(rows, p.id))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="p-2 rounded-xl border border-emerald-300 dark:border-emerald-700/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
          <div className="flex items-center gap-2">
            <select
              aria-label="Choose app"
              value={choice}
              onChange={e => { setChoice(e.target.value); setError(null); }}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            >
              <option value="">Choose an app…</option>
              {choices.map(c => <option key={c} value={c}>{c}</option>)}
              <option value={CUSTOM}>Other (type a name)…</option>
            </select>
            <button type="button" onClick={add} disabled={!choice || (choice === CUSTOM && !custom.trim())}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
              Add
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null); }} aria-label="Cancel adding app"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {choice === CUSTOM && (
            <input type="text" aria-label="Custom app name" placeholder="App name, e.g. Instacart" value={custom} maxLength={40}
              onChange={e => { setCustom(e.target.value); setError(null); }} onKeyDown={e => e.key === 'Enter' && add()}
              className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white" />
          )}
          {error && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{error}</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Add app
        </button>
      )}
    </div>
  );
};
