/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Target, TrendingUp, DollarSign, Clock, Sparkles, CheckCircle, ChevronRight, Edit3 } from 'lucide-react';
import { AppSettings } from '../types';
import { formatCurrency, formatRate, formatHM } from '../utils/calculations';
import { NumericInput } from './NumericInput';

interface GoalTrackerCardProps {
  currentEarnings: number;
  workSeconds: number;
  totalSeconds: number;
  settings: AppSettings;
  onUpdateSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
  /** This workday's target when set during the shift (Settings default stays as is). */
  dayGoal?: number;
  isDayGoal?: boolean;
  onSetDayGoal?: (amount: number | null) => void;
}

export const GoalTrackerCard: React.FC<GoalTrackerCardProps> = ({
  currentEarnings,
  workSeconds,
  totalSeconds,
  settings,
  onUpdateSettings,
  dayGoal,
  isDayGoal = false,
  onSetDayGoal,
}) => {
  const [activeTab, setActiveTab] = useState<'earnings' | 'rate'>(
    settings.goals?.activeTrackerGoal || 'earnings'
  );
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoalValue, setTempGoalValue] = useState<string>('');

  const defaultDailyGoal = settings.goals?.dailyEarnings || 150;
  const dailyGoal = dayGoal && dayGoal > 0 ? dayGoal : defaultDailyGoal;
  const hourlyRateGoal = settings.goals?.hourlyRate || 25;

  const workHours = workSeconds / 3600;
  const currentWorkRate = workHours > 0 ? currentEarnings / workHours : 0;

  // Earnings Progress Calculations
  const earningsProgressPercent = dailyGoal > 0 ? Math.min(100, (currentEarnings / dailyGoal) * 100) : 0;
  const earningsRemaining = Math.max(0, dailyGoal - currentEarnings);
  const isDailyGoalAchieved = currentEarnings >= dailyGoal;
  const dailySurplus = Math.max(0, currentEarnings - dailyGoal);

  // Remaining work hours estimated at current active pace
  const estimatedHoursRemaining =
    currentWorkRate > 0 && earningsRemaining > 0
      ? formatHM(earningsRemaining / currentWorkRate, { unit: 'hours' })
      : null;

  // Hourly Rate Progress Calculations
  const rateProgressPercent = hourlyRateGoal > 0 ? Math.min(100, (currentWorkRate / hourlyRateGoal) * 100) : 0;
  const isRateGoalAchieved = currentWorkRate >= hourlyRateGoal && workHours >= 0.25;

  const handleGoalAdjustment = (delta: number) => {
    if (!onUpdateSettings) return;
    if (activeTab === 'rate') {
      const next = Math.max(5, hourlyRateGoal + delta);
      onUpdateSettings(prev => ({
        ...prev,
        goals: { ...prev.goals, hourlyRate: next },
      }));
    }
  };

  const handleSaveCustomGoal = () => {
    const parsed = parseFloat(tempGoalValue);
    if (!isNaN(parsed) && parsed > 0) {
      if (activeTab === 'earnings') {
        // Day-only: sets this workday's goal; Settings default is not touched
        onSetDayGoal?.(Number(parsed.toFixed(2)));
      } else if (onUpdateSettings) {
        onUpdateSettings(prev => ({
          ...prev,
          goals: { ...prev.goals, hourlyRate: Number(parsed.toFixed(2)) },
        }));
      }
    }
    setIsEditingGoal(false);
  };

  const handleTabSwitch = (tab: 'earnings' | 'rate') => {
    setActiveTab(tab);
    setIsEditingGoal(false);
    if (onUpdateSettings) {
      onUpdateSettings(prev => ({
        ...prev,
        goals: { ...prev.goals, activeTrackerGoal: tab },
      }));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors relative overflow-hidden">
      {/* Top Bar with Goal Selector Tabs and Adjuster */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-800">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Shift Target Goal</span>
              {(isDailyGoalAchieved && activeTab === 'earnings') || (isRateGoalAchieved && activeTab === 'rate') ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                  <CheckCircle className="w-3 h-3" />
                  <span>Target Hit!</span>
                </span>
              ) : null}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live pacing against your session benchmarks
            </p>
          </div>
        </div>

        {/* Toggle between Daily Earnings Goal & Hourly Rate Goal */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => handleTabSwitch('earnings')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'earnings'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Daily Target</span>
            </button>
            <button
              onClick={() => handleTabSwitch('rate')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'rate'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>$/Hr Pace</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Goal Progress Content */}
      {activeTab === 'earnings' ? (
        <div className="mt-4 space-y-3">
          {/* Numbers Header */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                {formatCurrency(currentEarnings, settings.currency)}
              </span>
              <span className="text-sm font-semibold font-mono text-slate-500 dark:text-slate-400">
                / {formatCurrency(dailyGoal, settings.currency)} goal
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-base font-extrabold font-mono ${
                isDailyGoalAchieved ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
              }`}>
                {earningsProgressPercent.toFixed(0)}%
              </span>

              {/* Inline target modifier */}
              <div className="flex items-center gap-1 pl-1">
                {isEditingGoal ? (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                    <span className="text-xs font-mono font-bold pl-2 text-slate-600 dark:text-slate-400">{settings.currency}</span>
                    <NumericInput
                      min={0}
                      step="any"
                      aria-label="Goal for today"
                      value={tempGoalValue}
                      onChange={val => setTempGoalValue(String(val))}
                      placeholder={String(dailyGoal)}
                      autoFocus
                      className="w-16 px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      onClick={handleSaveCustomGoal}
                      className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      aria-label="Edit today's goal"
                      onClick={() => {
                        setTempGoalValue(String(dailyGoal));
                        setIsEditingGoal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Set a goal for today only"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isDayGoal && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400" data-testid="day-goal-note">
              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold">Today only</span>
              <span>Default {formatCurrency(defaultDailyGoal, settings.currency)}</span>
              <button onClick={() => { onSetDayGoal?.(null); setIsEditingGoal(false); }} className="underline hover:text-slate-800 dark:hover:text-white" data-testid="reset-day-goal">
                Reset to default
              </button>
            </div>
          )}

          {/* Progress Bar Track: Noticeably darker slate-200/90 in light mode so it never blends into the light gray background */}
          <div className="relative w-full h-4 bg-slate-200/90 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isDailyGoalAchieved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm'
                  : earningsProgressPercent >= 75
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                  : 'bg-gradient-to-r from-amber-500 to-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(earningsProgressPercent > 0 ? 3 : 0, earningsProgressPercent))}%` }}
            />
          </div>

          {/* Pacing Details & Celebratory Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
            <div>
              {isDailyGoalAchieved ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Goal Achieved! You are {formatCurrency(dailySurplus, settings.currency)} over target today.</span>
                </span>
              ) : (
                <span>
                  Remaining needed: <strong className="font-mono text-slate-900 dark:text-white">{formatCurrency(earningsRemaining, settings.currency)}</strong>
                </span>
              )}
            </div>

            <div>
              {!isDailyGoalAchieved && estimatedHoursRemaining && (
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  ~{estimatedHoursRemaining} remaining at current work pace ({formatRate(currentWorkRate, settings.currency, 'hr')})
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Hourly Rate Goal View */
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                {formatRate(currentWorkRate, settings.currency, 'hr')}
              </span>
              <span className="text-sm font-semibold font-mono text-slate-500 dark:text-slate-400">
                / {formatRate(hourlyRateGoal, settings.currency, 'hr')} target
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-base font-extrabold font-mono ${
                isRateGoalAchieved ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
              }`}>
                {rateProgressPercent.toFixed(0)}%
              </span>

              {/* Inline rate adjuster */}
              <div className="flex items-center gap-1 pl-1">
                {isEditingGoal ? (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                    <span className="text-xs font-mono font-bold pl-2 text-slate-600 dark:text-slate-400">{settings.currency}</span>
                    <NumericInput
                      step="1"
                      min={0}
                      value={tempGoalValue}
                      onChange={val => setTempGoalValue(String(val))}
                      placeholder={String(hourlyRateGoal)}
                      autoFocus
                      className="w-16 px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      onClick={handleSaveCustomGoal}
                      className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleGoalAdjustment(-2)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono transition-colors"
                      title="Decrease target rate by $2/hr"
                    >
                      -2
                    </button>
                    <button
                      onClick={() => handleGoalAdjustment(2)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono transition-colors"
                      title="Increase target rate by $2/hr"
                    >
                      +2
                    </button>
                    <button
                      onClick={() => {
                        setTempGoalValue(String(hourlyRateGoal));
                        setIsEditingGoal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit custom rate target"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="relative w-full h-4 bg-slate-200/90 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isRateGoalAchieved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm'
                  : rateProgressPercent >= 80
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                  : 'bg-gradient-to-r from-amber-500 to-teal-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(rateProgressPercent > 0 ? 3 : 0, rateProgressPercent))}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
            <div>
              {workHours < 0.25 ? (
                <span className="text-slate-500 italic">Rate stabilizes after 15+ minutes of active work time</span>
              ) : isRateGoalAchieved ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Target Rate Beat! Active jobs are yielding high returns.</span>
                </span>
              ) : (
                <span>
                  Gap to target: <strong className="font-mono text-slate-900 dark:text-white">{formatRate(Math.max(0, hourlyRateGoal - currentWorkRate), settings.currency, 'hr')}</strong>
                </span>
              )}
            </div>

            <div className="text-slate-500 dark:text-slate-400 text-[11px]">
              Active Work Hours: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatHM(workSeconds)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
