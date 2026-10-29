/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Clock, Car, TrendingUp, AlertTriangle } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to Gig Efficiency Tracker</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Master your true hourly rate & mileage across multi-apps</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 my-5 text-xs text-slate-600 dark:text-slate-300">
          {/* Concept 1: The Two Key Hourly Rates */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Why Drivers Need Two $/Hour Numbers</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">1. Work $/Hour (Active Rate)</span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Only ticks while you have a passenger or food delivery in the car. Tells you if a hotspot or surge strategy is paying off per active minute.
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">2. Total $/Hour (True Return)</span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Runs continuously from when you leave your house until you pull back into your driveway. Shows your true net hourly compensation after deadhead miles and waiting.
                </p>
              </div>
            </div>
          </div>

          {/* Concept 2: The Action Flow */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Car className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Typical Daily Flow</span>
            </span>

            <div className="space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[11px] shrink-0 font-bold">
                  Step 1
                </span>
                <span>
                  Tap <strong>"Start Day"</strong> as you walk to your car. Your Total Time clock begins running.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono text-[11px] shrink-0 font-bold">
                  Step 2
                </span>
                <span>
                  When you accept your first trip or order, tap <strong>"Start Work"</strong>. Both timers are now running!
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono text-[11px] shrink-0 font-bold">
                  Break
                </span>
                <span>
                  Grabbing food or resting? Tap <strong>"Break"</strong>. It pauses Active Work Time while Total Shift Time keeps running. Tap <strong>"End Break / Resume"</strong> when ready.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 font-mono text-[11px] shrink-0 font-bold">
                  Step 3
                </span>
                <span>
                  Done with dispatches and heading home? Tap <strong>"Headed Home"</strong>. Work time pauses while your commute home continues tracking.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono text-[11px] shrink-0 font-bold">
                  Trip on return?
                </span>
                <span>
                  Tap <strong>"Resume Work"</strong> anytime! Work time is the accurate sum of all active periods.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-mono text-[11px] shrink-0 font-bold">
                  PWA & Offline
                </span>
                <span>
                  Timers use real timestamps stored in localStorage. Even if you close your browser or app completely, time continues tracking accurately and restores on reload.
                </span>
              </div>
            </div>
          </div>

          {/* Safety Reminder */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold block">Safety First</span>
              <span>Never interact with your screen while operating your vehicle. If you forget to tap a button, use the built-in <strong>"Adjust Time"</strong> tool (+15m / -15m) once safely parked.</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
          >
            Got It, Let's Track!
          </button>
        </div>
      </div>
    </div>
  );
};
