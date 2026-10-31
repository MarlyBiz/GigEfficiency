/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Clock, 
  Navigation, 
  Fuel, 
  Sparkles, 
  Layers 
} from 'lucide-react';
import { AppSettings, DayRecord } from '../types';
import { formatCurrency, formatDuration, formatRate, formatHM } from '../utils/calculations';
import { isDayRecord, periodParts, recordKind } from '../utils/periodSummaries';
import { monthKeyForRecord } from '../utils/workday';

/** '2026-10-29' -> '10/29' */
const shortMD = (ds: string) => { const [, m, d] = ds.split('-'); return `${Number(m)}/${Number(d)}`; };

interface AnalyticsChartsProps {
  records: DayRecord[];
  settings: AppSettings;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = React.memo(({ records, settings }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'hourly_rate' | 'weekly_comp' | 'monthly_comp'>('daily');

  // Sort chronological ascending for clean trends
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [records]);

  // Daily records data (last 14 active days)
  // Month summaries count in totals and the monthly chart, never in daily/weekly views
  const sortedDays = useMemo(() => sortedRecords.filter(isDayRecord), [sortedRecords]);
  const last14Days = useMemo(() => {
    return sortedDays.slice(-14);
  }, [sortedDays]);

  // Aggregate weekly data (last 8 weeks)
  const weeklyData = useMemo(() => {
    const map = new Map<string, { label: string; earnings: number; workHours: number; miles: number; count: number }>();
    
    sortedDays.forEach(r => {
      if (!r || !r.dateStr) return;
      // Group by year-week
      const d = new Date(r.dateStr + 'T12:00:00');
      if (isNaN(d.getTime())) return;
      const weekNumber = Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      
      const existing = map.get(key) || { label: `Wk ${weekNumber}`, earnings: 0, workHours: 0, miles: 0, count: 0 };
      existing.earnings += r.totalEarnings || 0;
      existing.workHours += (r.workSeconds || 0) / 3600;
      existing.miles += r.totalMiles || 0;
      existing.count += 1;
      map.set(key, existing);
    });

    return Array.from(map.entries())
      .map(([key, data]) => ({
        key,
        ...data,
        avgPerHour: data.workHours > 0 ? data.earnings / data.workHours : 0,
        avgPerMile: data.miles > 0 ? data.earnings / data.miles : 0,
      }))
      .slice(-8);
  }, [sortedDays]);

  // Aggregate monthly data
  const monthlyData = useMemo(() => {
    const map = new Map<string, { label: string; earnings: number; workHours: number; miles: number; count: number }>();

    periodParts(sortedRecords).forEach(r => {
      if (!r || !r.dateStr) return;
      const ym = monthKeyForRecord(r, settings); // YYYY-MM month period (month start setting)
      const parts = ym.split('-');
      if (parts.length < 2) return;
      const [y, m] = parts;
      const monthIdx = parseInt(m, 10) - 1;
      if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[monthIdx]} '${(y || '').slice(2)}`;

      const existing = map.get(ym) || { label, earnings: 0, workHours: 0, miles: 0, count: 0 };
      existing.earnings += r.totalEarnings || 0;
      existing.workHours += (r.workSeconds || 0) / 3600;
      existing.miles += r.totalMiles || 0;
      existing.count += 1;
      map.set(ym, existing);
    });

    return Array.from(map.entries())
      .map(([key, data]) => ({
        key,
        ...data,
        avgPerHour: data.workHours > 0 ? data.earnings / data.workHours : 0,
        avgPerMile: data.miles > 0 ? data.earnings / data.miles : 0,
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);
  }, [sortedRecords, settings]);

  // Overall Statistics
  const totalGrossEarnings = records.reduce((s, r) => s + r.totalEarnings, 0);
  const totalWorkSeconds = records.reduce((s, r) => s + r.workSeconds, 0);
  const totalMiles = records.reduce((s, r) => s + r.totalMiles, 0);
  const totalWorkHours = totalWorkSeconds / 3600;
  const overallWorkPerHour = totalWorkHours > 0 ? totalGrossEarnings / totalWorkHours : 0;
  const totalTaxDeduction = totalMiles * (settings.standardMileageRate || 0.67);

  // Dynamic max scales
  const maxDailyEarnings = Math.max(100, ...last14Days.map(d => d.totalEarnings));
  const maxHourlyRate = Math.max(40, ...last14Days.map(d => d.dollarsPerHourWork));
  const maxWeeklyEarnings = Math.max(500, ...weeklyData.map(w => w.earnings));
  const maxMonthlyEarnings = Math.max(1500, ...monthlyData.map(m => m.earnings));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. OVERALL LIFETIME METRICS */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Driver Intelligence
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              Efficiency Trends & Comparisons
            </h2>
          </div>

          {/* Chart Tab Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                activeTab === 'daily'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Daily Earnings
            </button>
            <button
              onClick={() => setActiveTab('hourly_rate')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                activeTab === 'hourly_rate'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              $/Hr Trend
            </button>
            <button
              onClick={() => setActiveTab('weekly_comp')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                activeTab === 'weekly_comp'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Weekly Compare
            </button>
            <button
              onClick={() => setActiveTab('monthly_comp')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                activeTab === 'monthly_comp'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Compare
            </button>
          </div>
        </div>

        {/* Rolling Highlights */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Cumulative Gross
            </span>
            <span className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-1 block">
              {formatCurrency(totalGrossEarnings, settings.currency)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {records.filter(isDayRecord).length} shifts recorded
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
              Lifetime $/Hr (Work)
            </span>
            <span className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-1 block">
              {formatRate(overallWorkPerHour, settings.currency, 'hr')}
            </span>
            <span className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-0.5 block">
              {formatHM(totalWorkSeconds)} active work time
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Mileage
            </span>
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 block">
              {totalMiles.toLocaleString()} mi
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {totalMiles > 0 ? formatRate(totalGrossEarnings / totalMiles, settings.currency, 'mi') : '0.00/mi'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
              IRS Write-Off Value
            </span>
            <span className="text-2xl font-extrabold font-mono text-amber-800 dark:text-amber-300 mt-1 block">
              {formatCurrency(totalTaxDeduction, settings.currency)}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Standard deduction
            </span>
          </div>
        </div>
      </section>

      {/* 2. MAIN STATIC VISUALIZATION CANVAS */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        {/* Tab 1: Daily Earnings Trend */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Daily Earnings (Last 14 Shifts)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gross earnings per logged driving day
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                Peak: {formatCurrency(maxDailyEarnings, settings.currency)}
              </span>
            </div>

            {last14Days.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No shift data logged yet. Complete your first day to populate charts.
              </div>
            ) : (
              <div className="pt-6 pb-2">
                <div className="h-64 w-full flex items-end gap-0.5 sm:gap-3 px-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {last14Days.map((d, dIdx) => {
                    const heightPercent = Math.min(100, Math.max(10, (d.totalEarnings / maxDailyEarnings) * 100));
                    return (
                      <div key={d.id ? `${d.id}-${dIdx}` : `daily-${d.dateStr}-${dIdx}`} className="flex-1 min-w-0 flex flex-col items-center gap-2 group">
                        <span className="hidden sm:block text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {formatCurrency(d.totalEarnings, settings.currency)}
                        </span>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-t-md sm:rounded-t-xl h-48 flex items-end p-px sm:p-1">
                          <div
                            className="w-full rounded-sm sm:rounded-lg bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:brightness-110 transition-all shadow-sm"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-mono text-slate-500 whitespace-nowrap ${dIdx % 2 === 1 && last14Days.length > 7 ? 'invisible sm:visible' : ''}`}>
                          {shortMD(d.dateStr)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Hourly Rate Trend ($/hr) */}
        {activeTab === 'hourly_rate' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Active Work Rate Trend ($/Hour)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target benchmark: {formatRate(settings.goals?.hourlyRate || 25, settings.currency, 'hr')}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                Peak: {formatRate(maxHourlyRate, settings.currency, 'hr')}
              </span>
            </div>

            {last14Days.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No shift data available.
              </div>
            ) : (
              <div className="pt-6 pb-2">
                <div className="h-64 w-full flex items-end gap-0.5 sm:gap-3 px-2 border-b border-slate-200 dark:border-slate-800 pb-2 relative">
                  {/* Benchmark horizontal reference line */}
                  <div
                    className="absolute inset-x-0 border-b-2 border-dashed border-emerald-400/60 z-10 pointer-events-none"
                    style={{
                      bottom: `${Math.min(95, ((settings.goals?.hourlyRate || 25) / maxHourlyRate) * 100 * 0.8 + 10)}%`,
                    }}
                  >
                    <span className="absolute right-2 -top-4 text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 px-1 rounded">
                      Goal {formatRate(settings.goals?.hourlyRate || 25, settings.currency, 'hr')}
                    </span>
                  </div>

                  {last14Days.map((d, dIdx) => {
                    const heightPercent = Math.min(100, Math.max(10, (d.dollarsPerHourWork / maxHourlyRate) * 100));
                    const isAboveGoal = d.dollarsPerHourWork >= (settings.goals?.hourlyRate || 25);
                    return (
                      <div key={d.id ? `${d.id}-${dIdx}` : `hourly-${d.dateStr}-${dIdx}`} className="flex-1 min-w-0 flex flex-col items-center gap-2 group z-20">
                        <span className="hidden sm:block text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {formatRate(d.dollarsPerHourWork, settings.currency, 'hr')}
                        </span>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-t-md sm:rounded-t-xl h-48 flex items-end p-px sm:p-1">
                          <div
                            className={`w-full rounded-sm sm:rounded-lg transition-all shadow-sm ${
                              isAboveGoal
                                ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                                : 'bg-gradient-to-t from-blue-600 to-cyan-400'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span className={`text-[9px] sm:text-[10px] font-mono text-slate-500 whitespace-nowrap ${dIdx % 2 === 1 && last14Days.length > 7 ? 'invisible sm:visible' : ''}`}>
                          {shortMD(d.dateStr)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Weekly Totals Comparison */}
        {activeTab === 'weekly_comp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Weekly Totals Comparison (Last 8 Weeks)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compare gross earnings, active hours, and $/hr across consecutive weeks
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                Peak: {formatCurrency(maxWeeklyEarnings, settings.currency)}
              </span>
            </div>

            {weeklyData.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                Log multiple weeks of shifts to view week-over-week comparisons.
              </div>
            ) : (
              <div className="pt-6 pb-2">
                <div className="h-64 w-full flex items-end gap-1 sm:gap-4 px-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {weeklyData.map((w, wIdx) => {
                    const heightPercent = Math.min(100, Math.max(10, (w.earnings / maxWeeklyEarnings) * 100));
                    return (
                      <div key={w.key ? `${w.key}-${wIdx}` : `week-${wIdx}`} className="flex-1 min-w-0 flex flex-col items-center gap-2 group">
                        <div className="hidden sm:block text-[10px] text-center font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                            {formatCurrency(w.earnings, settings.currency)}
                          </span>
                          <span className="text-slate-500">{formatRate(w.avgPerHour, settings.currency, 'hr')}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-t-md sm:rounded-t-xl h-48 flex items-end p-px sm:p-1.5">
                          <div
                            className="w-full rounded-sm sm:rounded-lg bg-gradient-to-t from-purple-600 to-indigo-400 group-hover:brightness-110 transition-all shadow-sm"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-full">
                          {w.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Monthly Totals Comparison */}
        {activeTab === 'monthly_comp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Monthly Comparison (Earnings & Average Rate)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Month-by-month trajectory and efficiency
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                Peak: {formatCurrency(maxMonthlyEarnings, settings.currency)}
              </span>
            </div>

            {monthlyData.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                Log multiple months of shifts to view seasonal trends.
              </div>
            ) : (
              <div className="pt-6 pb-2">
                <div className="h-64 w-full flex items-end gap-1 sm:gap-6 px-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {monthlyData.map((m, mIdx) => {
                    const heightPercent = Math.min(100, Math.max(10, (m.earnings / maxMonthlyEarnings) * 100));
                    return (
                      <div key={m.key ? `${m.key}-${mIdx}` : `month-${mIdx}`} className="flex-1 min-w-0 flex flex-col items-center gap-2 group">
                        <div className="hidden sm:block text-[10px] text-center font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                            {formatCurrency(m.earnings, settings.currency)}
                          </span>
                          <span className="text-slate-500">{formatRate(m.avgPerHour, settings.currency, 'hr')}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-t-md sm:rounded-t-xl h-48 flex items-end p-px sm:p-2">
                          <div
                            className="w-full rounded-sm sm:rounded-lg bg-gradient-to-t from-teal-600 to-emerald-400 group-hover:brightness-110 transition-all shadow-sm"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-full">
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
});
