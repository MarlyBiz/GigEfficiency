/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FolderArchive, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Target, 
  CheckCircle, 
  Sparkles, 
  Fuel, 
  Clock, 
  Edit3 
} from 'lucide-react';
import { AppSettings, DayRecord } from '../types';
import { formatCurrency, formatDuration, formatRate, formatHM } from '../utils/calculations';
import { isDayRecord, recordKind } from '../utils/periodSummaries';

interface PeriodSummariesViewProps {
  records: DayRecord[];
  settings: AppSettings;
  onOpenExport?: () => void;
  onUpdateSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const PeriodSummariesView: React.FC<PeriodSummariesViewProps> = ({
  records,
  settings,
  onOpenExport,
  onUpdateSettings,
}) => {
  const [periodType, setPeriodType] = useState<'monthly' | 'yearly' | 'weekly'>('monthly');

  // Yearly Aggregation
  const yearlyData = useMemo(() => {
    const map = new Map<string, { year: string; records: DayRecord[] }>();
    (records || []).forEach(r => {
      if (!r || !r.dateStr) return;
      const y = r.dateStr.slice(0, 4);
      if (!y) return;
      const existing = map.get(y) || { year: y, records: [] };
      existing.records.push(r);
      map.set(y, existing);
    });

    return Array.from(map.values()).map(item => {
      const totalEarnings = item.records.reduce((s, r) => s + (r.totalEarnings || 0), 0);
      const totalSeconds = item.records.reduce((s, r) => s + (r.totalSeconds || 0), 0);
      const workSeconds = item.records.reduce((s, r) => s + (r.workSeconds || 0), 0);
      const totalMiles = item.records.reduce((s, r) => s + (r.totalMiles || 0), 0);
      const workHours = workSeconds / 3600;
      const totalHours = totalSeconds / 3600;

      return {
        period: item.year,
        shiftsCount: item.records.filter(isDayRecord).length,
        totalEarnings,
        workHours,
        totalHours,
        avgPerHourWork: workHours > 0 ? totalEarnings / workHours : 0,
        avgPerHourTotal: totalHours > 0 ? totalEarnings / totalHours : 0,
        totalMiles,
        dollarsPerMile: totalMiles > 0 ? totalEarnings / totalMiles : 0,
        taxDeduction: totalMiles * (settings.standardMileageRate || 0.67),
      };
    }).sort((a, b) => b.period.localeCompare(a.period));
  }, [records, settings.standardMileageRate]);

  // Monthly Aggregation
  const monthlyData = useMemo(() => {
    const map = new Map<string, { ym: string; records: DayRecord[] }>();
    (records || []).forEach(r => {
      if (!r || !r.dateStr) return;
      if (recordKind(r) === 'year') return; // year summaries only count in yearly totals
      const ym = r.dateStr.slice(0, 7); // YYYY-MM
      if (!ym) return;
      const existing = map.get(ym) || { ym, records: [] };
      existing.records.push(r);
      map.set(ym, existing);
    });

    return Array.from(map.values()).map(item => {
      const totalEarnings = item.records.reduce((s, r) => s + (r.totalEarnings || 0), 0);
      const totalSeconds = item.records.reduce((s, r) => s + (r.totalSeconds || 0), 0);
      const workSeconds = item.records.reduce((s, r) => s + (r.workSeconds || 0), 0);
      const totalMiles = item.records.reduce((s, r) => s + (r.totalMiles || 0), 0);
      const workHours = workSeconds / 3600;
      const totalHours = totalSeconds / 3600;

      const parts = item.ym.split('-');
      const y = parts[0] || '';
      const m = parts[1] || '1';
      const monthIdx = parseInt(m, 10) - 1;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = (monthIdx >= 0 && monthIdx <= 11) ? monthNames[monthIdx] : 'Month';
      const label = `${monthName} ${y}`;

      return {
        period: label,
        rawKey: item.ym,
        shiftsCount: item.records.filter(isDayRecord).length,
        totalEarnings,
        workHours,
        totalHours,
        avgPerHourWork: workHours > 0 ? totalEarnings / workHours : 0,
        avgPerHourTotal: totalHours > 0 ? totalEarnings / totalHours : 0,
        totalMiles,
        dollarsPerMile: totalMiles > 0 ? totalEarnings / totalMiles : 0,
        taxDeduction: totalMiles * (settings.standardMileageRate || 0.67),
      };
    }).sort((a, b) => b.rawKey.localeCompare(a.rawKey));
  }, [records, settings.standardMileageRate]);

  // Current year & month progress
  const currentYearStr = String(new Date().getFullYear());
  const currentYearData = yearlyData.find(y => y.period === currentYearStr);
  const currentYearGross = currentYearData?.totalEarnings || 0;
  const yearlyGoal = settings.goals?.yearlyEarnings || 45000;
  const yearlyGoalPercent = yearlyGoal > 0 ? (currentYearGross / yearlyGoal) * 100 : 0;
  const isYearlyAchieved = currentYearGross >= yearlyGoal;

  const currentMonthData = monthlyData[0];
  const currentMonthGross = currentMonthData?.totalEarnings || 0;
  const monthlyGoal = settings.goals?.monthlyEarnings || 3500;
  const monthlyGoalPercent = monthlyGoal > 0 ? (currentMonthGross / monthlyGoal) * 100 : 0;
  const isMonthlyAchieved = currentMonthGross >= monthlyGoal;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP HEADER & PERIOD SWITCHER */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Statements & Tax Records
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              Period Closeouts & Summaries
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setPeriodType('monthly')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  periodType === 'monthly'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly Statements
              </button>
              <button
                onClick={() => setPeriodType('yearly')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  periodType === 'yearly'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Yearly Tax Totals
              </button>
            </div>

            {onOpenExport && (
              <button
                onClick={onOpenExport}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Goal Milestone Card */}
        {periodType === 'yearly' ? (
          <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Annual Gross Goal ({currentYearStr}): {formatCurrency(yearlyGoal, settings.currency)}</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {yearlyGoalPercent.toFixed(1)}% Completed
              </span>
            </div>

            {/* Darker progress bar track so it doesn't blend into background */}
            <div className="relative w-full h-3 bg-slate-200/90 dark:bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{ width: `${Math.min(100, yearlyGoalPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Earned: {formatCurrency(currentYearGross, settings.currency)}</span>
              <span>Remaining: {formatCurrency(Math.max(0, yearlyGoal - currentYearGross), settings.currency)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Monthly Target: {formatCurrency(monthlyGoal, settings.currency)}</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {monthlyGoalPercent.toFixed(1)}% Completed
              </span>
            </div>

            <div className="relative w-full h-3 bg-slate-200/90 dark:bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{ width: `${Math.min(100, monthlyGoalPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Current Month: {formatCurrency(currentMonthGross, settings.currency)}</span>
              <span>Remaining: {formatCurrency(Math.max(0, monthlyGoal - currentMonthGross), settings.currency)}</span>
            </div>
          </div>
        )}
      </section>

      {/* 2. STATEMENTS TABLE WITH VISIBLE HORIZONTAL SCROLLBAR */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          {periodType === 'monthly' ? 'Monthly Statements Breakdown' : 'Annual Tax Records'}
        </h3>

        {/* Responsive Table with horizontal scrollbar that will use the darker theme bar */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-right">Shifts</th>
                <th className="py-3.5 px-4 text-right">Gross Earnings</th>
                <th className="py-3.5 px-4 text-right">Work Hours</th>
                <th className="py-3.5 px-4 text-right">Work $/Hr</th>
                <th className="py-3.5 px-4 text-right">Total Hours</th>
                <th className="py-3.5 px-4 text-right">Total $/Hr</th>
                <th className="py-3.5 px-4 text-right">Miles</th>
                <th className="py-3.5 px-4 text-right">$/Mile</th>
                <th className="py-3.5 px-4 text-right">IRS Tax Deduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {(periodType === 'monthly' ? monthlyData : yearlyData).map((row, idx) => (
                <tr
                  key={`row-${row.period || idx}-${idx}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-900 dark:text-white">
                    {row.period}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-400">
                    {row.shiftsCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(row.totalEarnings, settings.currency)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300">
                    {formatHM(row.workHours, { unit: 'hours' })}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-700 dark:text-emerald-300">
                    {formatRate(row.avgPerHourWork, settings.currency, 'hr')}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-400">
                    {formatHM(row.totalHours, { unit: 'hours' })}
                  </td>
                  <td className="py-3.5 px-4 text-right text-blue-700 dark:text-blue-400">
                    {formatRate(row.avgPerHourTotal, settings.currency, 'hr')}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300">
                    {row.totalMiles.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right text-purple-700 dark:text-purple-400">
                    {formatRate(row.dollarsPerMile, settings.currency, 'mi')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-amber-700 dark:text-amber-400">
                    {formatCurrency(row.taxDeduction, settings.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
