/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, TrendingUp, CalendarClock, Play, ShieldCheck, Bell, ChevronLeft, ChevronRight } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  /** dontShowAgain: true when finished or the box is ticked; false = show again next launch */
  onClose: (dontShowAgain: boolean) => void;
}

const STEPS: { icon: React.ElementType; title: string; points: string[] }[] = [
  {
    icon: TrendingUp,
    title: 'Your real pay per hour',
    points: [
      'Track every gig shift across Uber, Lyft, DoorDash and any app you add.',
      'Active time (on a trip or order) is kept apart from total time (door to door).',
      'See earnings per app, work $/hr vs total $/hr, $/mile, and progress toward your goals.',
    ],
  },
  {
    icon: CalendarClock,
    title: 'How workdays are counted',
    points: [
      'A workday runs until the cutoff, 4:00 AM by default. A 1 AM drive still counts for the day before.',
      'Each app can have its own day and week cutoffs (Settings › General & Cutoffs), so totals match your pay statements.',
      'Start again later on the same workday and it continues that day. It never overwrites it.',
    ],
  },
  {
    icon: Play,
    title: 'Start and stop the timer',
    points: [
      'Tap Start Day when you leave home, Start Work at your first dispatch, and Take Break when you pause.',
      'Timers keep counting if you close the app or lock your phone.',
      'Tap End Day & Save when you get home, enter what each app paid, then save.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Your data stays on your phone',
    points: [
      'Shifts, earnings and expenses are saved only in this browser on this device. No account is needed.',
      'Use Export to make a JSON backup (restore it any time) or a CSV / PDF statement.',
      'Back up before you clear your browser data or switch phones.',
    ],
  },
  {
    icon: Bell,
    title: 'Reminders and install',
    points: [
      'Optional reminders (Settings) can nudge you to start work, and a still-working reminder checks in on long days.',
      'Install the app for one-tap access: use the Install button, or on iPhone tap Share › Add to Home Screen.',
      'You can reopen this guide from Settings › Show welcome again.',
    ],
  },
];

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  if (!isOpen) return null;

  const last = step === STEPS.length - 1;
  const { icon: Icon, title, points } = STEPS[step];
  const close = (finished = false) => { setStep(0); onClose(finished || dontShow); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-label="Welcome" data-testid="welcome-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Welcome · {step + 1} of {STEPS.length}
            </span>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <span>{title}</span>
            </h3>
          </div>
          <button onClick={() => close()} aria-label="Close welcome"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="my-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
          {points.map(pt => (
            <li key={pt} className="flex gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-center gap-1.5 mb-4" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-emerald-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`} />
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-4 cursor-pointer">
          <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} className="w-4 h-4 accent-emerald-600" aria-label="Don't show again" />
          <span>Don’t show again</span>
        </label>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button onClick={() => close()} className="px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold cursor-pointer">
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button onClick={() => (last ? close(true) : setStep(s => s + 1))}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-lg shadow-emerald-600/25 cursor-pointer">
              {last ? 'Get started' : <>Next <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
