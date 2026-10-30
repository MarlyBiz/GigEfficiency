/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Fuel, 
  DollarSign, 
  Sparkles, 
  Target, 
  CheckCircle, 
  Edit3, 
  Plus, 
  ArrowUpRight 
} from 'lucide-react';
import { AppSettings, DayRecord } from '../types';
import { formatCurrency, formatDuration, formatRate, formatHM } from '../utils/calculations';
import { NumericInput } from './NumericInput';
import { getWeek, getWorkday, ruleFor, formatClock, WEEKDAYS } from '../utils/workday';
import { mergeDayRecords, withRates } from '../utils/dayStore';

interface WeekDailyViewProps {
  records: DayRecord[];
  settings: AppSettings;
  onSelectRecord: (record: DayRecord) => void;
  onAddNewForDate: (dateStr: string) => void;
  onUpdateSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const WeekDailyView: React.FC<WeekDailyViewProps> = ({
  records,
  settings,
  onSelectRecord,
  onAddNewForDate,
  onUpdateSettings,
}) => {
  const [weekOffset, setWeekOffset] = useState<number>(0);
  // '' = all apps on the default boundaries; otherwise that app's own week/day cutoffs and earnings
  const [weekApp, setWeekApp] = useState<string>('');
  const rule = ruleFor(settings, weekApp || undefined);
  const appNames = [...new Set([...(settings.defaultPlatforms || []), ...records.flatMap(r => (r.platformEarnings || []).map(p => p.name))])];
  const viewRecords = weekApp
    ? records.map(r => withRates({ ...r, platformEarnings: (r.platformEarnings || []).filter(p => p.name === weekApp), bonusEarnings: (r.bonusEarnings || []).filter(b => b.platform === weekApp) }))
        .filter(r => r.totalEarnings > 0)
    : records;
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [customGoalInput, setCustomGoalInput] = useState<string>('');

  // Calculate target week reference date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + weekOffset * 7);

  const weekInfo = getWeek(targetDate.getTime(), rule);

  const weekStartStr = weekInfo.startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const weekEndStr = weekInfo.endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Filter records within the 7 days of this week
  const weekRecords = viewRecords.filter(r => weekInfo.days.includes(r.dateStr));
  const weekEarnings = weekRecords.reduce((sum, r) => sum + r.totalEarnings, 0);
  const weekBonuses = weekRecords.reduce((sum, r) => sum + (r.totalBonusEarnings || 0), 0);
  const weekTotalSeconds = weekRecords.reduce((sum, r) => sum + r.totalSeconds, 0);
  const weekWorkSeconds = weekRecords.reduce((sum, r) => sum + r.workSeconds, 0);
  const weekMiles = weekRecords.reduce((sum, r) => sum + r.totalMiles, 0);
  const weekWorkHours = weekWorkSeconds / 3600;
  const weekTotalHours = weekTotalSeconds / 3600;
  const weekAvgPerHourWork = weekWorkHours > 0 ? weekEarnings / weekWorkHours : 0;
  const weekEstTaxDeduction = weekMiles * (settings.standardMileageRate || 0.67);

  // Weekly Goal Calculation
  const weeklyGoalTarget = settings.goals?.weeklyEarnings || 800;
  const weekGoalPercent = weeklyGoalTarget > 0 ? (weekEarnings / weeklyGoalTarget) * 100 : 0;
  const weekGoalRemaining = Math.max(0, weeklyGoalTarget - weekEarnings);
  const weekGoalIsAchieved = weekEarnings >= weeklyGoalTarget;
  const weekGoalExceeded = Math.max(0, weekEarnings - weeklyGoalTarget);

  // Determine days remaining in the viewed week
  // Current workday by the cutoff (local time, never UTC)
  const todayStr = getWorkday(Date.now(), rule);
  const remainingDaysInWeek = weekInfo.days.filter(d => d >= todayStr).length || 1;
  const dailyNeededPace = weekGoalRemaining > 0 ? weekGoalRemaining / Math.max(1, remainingDaysInWeek) : 0;

  const handleAdjustWeeklyGoal = (delta: number) => {
    if (!onUpdateSettings) return;
    const next = Math.max(50, weeklyGoalTarget + delta);
    onUpdateSettings(prev => ({
      ...prev,
      goals: { ...prev.goals, weeklyEarnings: next },
    }));
  };

  const handleSaveCustomWeeklyGoal = () => {
    const parsed = parseFloat(customGoalInput);
    if (!isNaN(parsed) && parsed > 0 && onUpdateSettings) {
      onUpdateSettings(prev => ({
        ...prev,
        goals: { ...prev.goals, weeklyEarnings: Math.round(parsed) },
      }));
    }
    setIsEditingGoal(false);
  };

  // Build data for each of the 7 days in order
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDaysData = weekInfo.days.map(dStr => {
    const [y, m, d] = dStr.split('-').map(Number);
    const dayDate = new Date(y, m - 1, d, 12, 0, 0);
    const dayName = dayNames[dayDate.getDay()];
    const dayRecords = viewRecords.filter(r => r.dateStr === dStr);
    // Older versions could leave two records on one day: show their combined total
    const dayRecord = dayRecords.length > 1 ? dayRecords.slice(1).reduce(mergeDayRecords, dayRecords[0]) : dayRecords[0] || null;
    const firstRecord = dayRecords[0] ? records.find(r => r.id === dayRecords[0].id) || null : null;

    return {
      dateStr: dStr,
      dayName,
      formattedDate: `${dayDate.getMonth() + 1}/${dayDate.getDate()}`,
      record: dayRecord,
      firstRecord,
      isToday: dStr === todayStr,
      hasWorked: !!dayRecord,
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP HEADER & WEEK CONTROLS */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Weekly Performance
            </span>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <select aria-label="Week for app" value={weekApp} onChange={e => setWeekApp(e.target.value)}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold">
                <option value="">All apps</option>
                {appNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>Week starts {WEEKDAYS[rule.weekStartDay]} {formatClock(rule.weekStartMinutes).replace(' (midnight)', '')}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
              <span>{weekStartStr} – {weekEndStr}</span>
              {weekOffset === 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-500/30">
                  Current Week
                </span>
              )}
            </h2>
          </div>

          {/* Week Pager Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekly Metric Highlights */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
              Weekly Earnings
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
              {formatCurrency(weekEarnings, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {weekRecords.length} shifts logged
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30">
            <div className="text-[11px] text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Avg $/Hr (Work)</span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
              {formatRate(weekAvgPerHourWork, settings.currency, 'hr')}
            </div>
            <div className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-0.5">
              Active job rate
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
              Active Work Hours
            </div>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1">
              {formatHM(weekWorkSeconds)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {formatHM(weekTotalSeconds)} total time
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30">
            <div className="text-[11px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>Tax Deduction</span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-amber-800 dark:text-amber-300 mt-1">
              {formatCurrency(weekEstTaxDeduction, settings.currency)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              IRS Standard ({formatCurrency(settings.standardMileageRate, settings.currency)}/mi)
            </div>
          </div>
        </div>
      </section>

      {/* 2. WEEKLY EARNINGS GOAL TRACKER CARD */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-800">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Weekly Target Goal</span>
                {weekGoalIsAchieved && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                    <CheckCircle className="w-3 h-3" />
                    <span>Goal Met!</span>
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track cumulative weekly earnings against your customized target
              </p>
            </div>
          </div>

          {/* Inline Goal Adjuster */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {isEditingGoal ? (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
                <span className="text-xs font-mono font-bold pl-2 text-slate-600 dark:text-slate-400">{settings.currency}</span>
                <NumericInput
                  min={0}
                  value={customGoalInput}
                  onChange={val => setCustomGoalInput(String(val))}
                  placeholder={String(weeklyGoalTarget)}
                  autoFocus
                  className="w-20 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  onClick={handleSaveCustomWeeklyGoal}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAdjustWeeklyGoal(-50)}
                  className="w-8 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono transition-colors cursor-pointer"
                  title="Decrease goal by $50"
                >
                  -50
                </button>
                <button
                  onClick={() => handleAdjustWeeklyGoal(50)}
                  className="w-8 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono transition-colors cursor-pointer"
                  title="Increase goal by $50"
                >
                  +50
                </button>
                <button
                  onClick={() => {
                    setCustomGoalInput(String(weeklyGoalTarget));
                    setIsEditingGoal(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Edit custom weekly goal"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar & Numerical Pacing */}
        <div className="mt-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                {formatCurrency(weekEarnings, settings.currency)}
              </span>
              <span className="text-sm font-bold font-mono text-slate-500 dark:text-slate-400">
                / {formatCurrency(weeklyGoalTarget, settings.currency)} target
              </span>
              {weekBonuses > 0 && (
                <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                  +{formatCurrency(weekBonuses, settings.currency)} bonus
                </span>
              )}
            </div>
            <span className={`text-base font-extrabold font-mono ${
              weekGoalIsAchieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
            }`}>
              {weekGoalPercent.toFixed(0)}%
            </span>
          </div>

          {/* Progress Bar Track: Noticeably darker slate-200/90 in light mode so it never blends into the light gray background */}
          <div className="relative w-full h-3.5 bg-slate-200/90 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                weekGoalIsAchieved
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : weekGoalPercent >= 75
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                  : 'bg-gradient-to-r from-amber-500 to-teal-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(weekGoalPercent > 0 ? 3 : 0, weekGoalPercent))}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-600 dark:text-slate-400 pt-1">
            <div>
              {weekGoalIsAchieved ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Target achieved! Exceeded goal by {formatCurrency(weekGoalExceeded, settings.currency)}.</span>
                </span>
              ) : (
                <span>
                  Remaining to hit goal: <strong className="font-mono text-slate-900 dark:text-white">{formatCurrency(weekGoalRemaining, settings.currency)}</strong>
                </span>
              )}
            </div>

            <div>
              {!weekGoalIsAchieved && (
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Pace needed: <strong className="font-mono text-emerald-700 dark:text-emerald-400">{formatCurrency(dailyNeededPace, settings.currency)}/day</strong> across remaining {remainingDaysInWeek} day{remainingDaysInWeek > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. SIDE-BY-SIDE 7 DAYS COMPARISON GRID */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
          <span>7 Days Side-by-Side Breakdown</span>
          <span>Click any card to inspect or edit details</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekDaysData.map((day, dayIdx) => (
            <div
              key={day.dateStr ? `${day.dateStr}-${dayIdx}` : `day-${dayIdx}`}
              className={`rounded-2xl border flex flex-col justify-between p-4 transition-all relative ${
                day.isToday
                  ? 'bg-emerald-50/50 dark:bg-slate-900 border-emerald-400 dark:border-emerald-500/60 shadow-md ring-1 ring-emerald-400/30'
                  : day.hasWorked
                  ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 text-slate-500'
              }`}
            >
              {/* Header: Day Name & Date */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">{day.dayName}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-mono">{day.formattedDate}</span>
                  </div>

                  {day.isToday && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 text-white uppercase">
                      Today
                    </span>
                  )}
                </div>

                {/* Body Content */}
                {day.record ? (
                  <div
                    onClick={() => onSelectRecord(day.firstRecord!)}
                    className="mt-3 space-y-2 cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                          Earnings
                        </span>
                        {day.record.totalBonusEarnings && day.record.totalBonusEarnings > 0 ? (
                          <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-800">
                            +${day.record.totalBonusEarnings} bonus
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400 block group-hover:scale-105 transition-transform origin-left">
                        {formatCurrency(day.record.totalEarnings, settings.currency)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Work $/Hr:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatRate(day.record.dollarsPerHourWork, settings.currency, 'hr')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Work Time:</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {formatHM(day.record.workSeconds)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Total Time:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {formatHM(day.record.totalSeconds)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Total $/Mi:</span>
                        <span className="font-mono text-purple-700 dark:text-purple-400 font-semibold">
                          {formatRate(day.record.dollarsPerMileTotal, settings.currency, 'mi')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Miles:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {day.record.totalMiles} mi
                        </span>
                      </div>
                    </div>

                    {/* Platform Pills */}
                    {day.record.platformEarnings && day.record.platformEarnings.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1">
                        {day.record.platformEarnings
                          .filter(p => p.amount > 0)
                          .map((p, pIdx) => (
                            <span
                              key={p.id ? `${p.id}-${pIdx}` : `plat-${p.name}-${pIdx}`}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {p.name.slice(0, 4)}: {formatCurrency(p.amount, settings.currency)}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="my-6 text-center text-xs text-slate-400">
                    <p className="italic">Off day / No shift</p>
                    <button
                      onClick={() => onAddNewForDate(day.dateStr)}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Log Shift</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Footer action if record exists */}
              {day.record && (
                <button
                  onClick={() => onSelectRecord(day.firstRecord!)}
                  className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Edit / View</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
