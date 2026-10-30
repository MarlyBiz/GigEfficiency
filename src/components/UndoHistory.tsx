/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { loadUndo, UndoSnapshot } from '../utils/dayStore';
import { formatCurrency, formatHM } from '../utils/calculations';
import { prettyDate } from '../utils/workday';

/** Last 10 day changes; Restore puts that day back the way it was before the change. */
export const UndoHistory: React.FC<{ currency: string; onRestore: (s: UndoSnapshot) => void }> = ({ currency, onRestore }) => {
  const [list, setList] = useState<UndoSnapshot[]>(() => loadUndo());
  useEffect(() => {
    const f = () => setList(loadUndo());
    window.addEventListener('gig-undo-changed', f);
    return () => window.removeEventListener('gig-undo-changed', f);
  }, []);
  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2" data-testid="undo-history">
      <span className="font-bold text-slate-900 dark:text-white block">Undo history / Restore</span>
      <p className="text-slate-500 dark:text-slate-400">Before every change to a day, the previous version is kept here (last 10, on this phone only).</p>
      {list.length === 0 ? <p className="text-slate-500">No changes yet.</p> : list.map(s => {
        const secs = s.before.reduce((a, r) => a + (r.totalSeconds || 0), 0);
        const money = s.before.reduce((a, r) => a + (r.totalEarnings || 0), 0);
        return (
          <div key={s.id} className="flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 pt-2">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">{prettyDate(s.dateStr)} · {s.label}</span>
              <span className="text-slate-500">{new Date(s.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · before: {s.before.length ? `${formatHM(secs)}, ${formatCurrency(money, currency)}` : 'no data'}</span>
            </div>
            <button onClick={() => { if (window.confirm(`Restore ${prettyDate(s.dateStr)} to how it was before "${s.label}"?`)) onRestore(s); }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">Restore</button>
          </div>
        );
      })}
    </div>
  );
};
