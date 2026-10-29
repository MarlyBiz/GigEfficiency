/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Play, 
  Briefcase, 
  Home, 
  Coffee, 
  CheckCircle2, 
  RotateCcw, 
  DollarSign, 
  Clock, 
  Navigation, 
  TrendingUp, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Edit3, 
  Fuel, 
  Sparkles,
  AlertTriangle,
  Gift
} from 'lucide-react';
import { ActiveSession, AppSettings, DayRecord, PlatformSlot, BonusEntry } from '../types';
import { formatCurrency, formatDuration, formatRate, getEffectiveDateString } from '../utils/calculations';
import { getBonusTypeMeta } from '../utils/bonuses';
import { GoalTrackerCard } from './GoalTrackerCard';
import { DayCloseModal } from './DayCloseModal';
import { ManualTimeModal } from './ManualTimeModal';
import { BonusEntryModal } from './BonusEntryModal';
import { NumericInput } from './NumericInput';

interface ActiveShiftTrackerProps {
  session: ActiveSession;
  totalSeconds: number;
  workSeconds: number;
  breakSeconds: number;
  settings: AppSettings;
  onUpdateSession: (updater: (prev: ActiveSession) => ActiveSession) => void;
  onSaveDayRecord: (record: DayRecord) => void;
  onOpenHelp: () => void;
  onUpdateSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
  /** Incremented by the app (Back-home prompt → Stop) to open the End & Save dialog. */
  closeRequest?: number;
  onCloseRequestHandled?: () => void;
}

export const ActiveShiftTracker: React.FC<ActiveShiftTrackerProps> = ({
  session,
  totalSeconds,
  workSeconds,
  breakSeconds,
  settings,
  onUpdateSession,
  onSaveDayRecord,
  onOpenHelp,
  onUpdateSettings,
  closeRequest,
  onCloseRequestHandled,
}) => {
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  useEffect(() => {
    if (closeRequest) {
      setIsCloseModalOpen(true);
      onCloseRequestHandled?.();
    }
  }, [closeRequest]);
  const [isManualTimeModalOpen, setIsManualTimeModalOpen] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [isAddingPlatform, setIsAddingPlatform] = useState(false);

  // Bonus / Quest / Challenge modal state
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [editingBonus, setEditingBonus] = useState<BonusEntry | null>(null);

  // Earnings Calculations: Base Platform + Bonuses & Quests
  const baseEarnings = (session.platformEarnings || []).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const totalBonusEarnings = (session.bonusEarnings || []).reduce(
    (sum, b) => sum + (Number(b.amount) || 0),
    0
  );
  const totalEarnings = baseEarnings + totalBonusEarnings;

  // Calculated Real-Time Metrics
  const totalHours = totalSeconds / 3600;
  const workHours = workSeconds / 3600;

  const dollarsPerHourTotal = totalHours > 0 ? totalEarnings / totalHours : 0;
  const dollarsPerHourWork = workHours > 0 ? totalEarnings / workHours : 0;

  const dollarsPerMileTotal =
    session.totalMiles > 0 ? totalEarnings / session.totalMiles : 0;
  const dollarsPerMileWork =
    session.workMiles > 0 ? totalEarnings / session.workMiles : 0;

  // IRS Mileage write-off value
  const estimatedTaxDeduction =
    (session.totalMiles || 0) * (settings.standardMileageRate || 0.67);

  // --- Session Control Actions ---
  const handleStartDay = () => {
    const now = Date.now();
    onUpdateSession(prev => ({
      ...prev,
      status: 'commuting',
      startDayTimestamp: now,
      startWorkTimestamp: null,
      endDayTimestamp: null,
      workSegments: [],
      breakSegments: [],
    }));
  };

  const handleStartWork = () => {
    const now = Date.now();
    onUpdateSession(prev => {
      // If not started yet, also start day
      const startDay = prev.startDayTimestamp || now;
      const currentWork = prev.workSegments || [];
      return {
        ...prev,
        status: 'working',
        startDayTimestamp: startDay,
        workSegments: [...currentWork, { startTime: now }],
      };
    });
  };

  const handleBreak = () => {
    const now = Date.now();
    onUpdateSession(prev => {
      const currentWork = prev.workSegments || [];
      const currentBreaks = prev.breakSegments || [];
      // Close any active work segment
      const updatedWorkSegments = currentWork.map((seg, idx) =>
        idx === currentWork.length - 1 && !seg.endTime ? { ...seg, endTime: now } : seg
      );
      return {
        ...prev,
        status: 'on_break',
        workSegments: updatedWorkSegments,
        breakSegments: [...currentBreaks, { startTime: now }],
      };
    });
  };

  const handleEndBreakAndResumeWork = () => {
    const now = Date.now();
    onUpdateSession(prev => {
      const currentWork = prev.workSegments || [];
      const currentBreaks = prev.breakSegments || [];
      // Close break segment
      const updatedBreaks = currentBreaks.map((seg, idx) =>
        idx === currentBreaks.length - 1 && !seg.endTime ? { ...seg, endTime: now } : seg
      );
      return {
        ...prev,
        status: 'working',
        breakSegments: updatedBreaks,
        workSegments: [...currentWork, { startTime: now }],
      };
    });
  };

  const handleHeadingHome = () => {
    const now = Date.now();
    onUpdateSession(prev => {
      const currentWork = prev.workSegments || [];
      const currentBreaks = prev.breakSegments || [];
      // Close active work segment
      const updatedWorkSegments = currentWork.map((seg, idx) =>
        idx === currentWork.length - 1 && !seg.endTime ? { ...seg, endTime: now } : seg
      );
      // Close active break segment if on break
      const updatedBreaks = currentBreaks.map((seg, idx) =>
        idx === currentBreaks.length - 1 && !seg.endTime ? { ...seg, endTime: now } : seg
      );
      return {
        ...prev,
        status: 'heading_home',
        workSegments: updatedWorkSegments,
        breakSegments: updatedBreaks,
      };
    });
  };

  const handleResumeWork = () => {
    const now = Date.now();
    onUpdateSession(prev => {
      const currentWork = prev.workSegments || [];
      return {
        ...prev,
        status: 'working',
        workSegments: [...currentWork, { startTime: now }],
      };
    });
  };

  // --- Platform Slot Updates ---
  const handleUpdatePlatformAmount = (id: string, val: number | string) => {
    const num = Math.max(0, typeof val === 'number' ? val : parseFloat(val) || 0);
    onUpdateSession(prev => ({
      ...prev,
      platformEarnings: (prev.platformEarnings || []).map(p =>
        p.id === id ? { ...p, amount: num } : p
      ),
    }));
  };

  const handleAddPlatform = () => {
    if (!newPlatformName.trim()) return;
    const name = newPlatformName.trim();
    const id = name.toLowerCase().replace(/\s+/g, '-') + `-${Date.now()}`;
    onUpdateSession(prev => ({
      ...prev,
      platformEarnings: [...(prev.platformEarnings || []), { id, name, amount: 0 }],
    }));
    setNewPlatformName('');
    setIsAddingPlatform(false);
  };

  const handleDeletePlatform = (id: string) => {
    onUpdateSession(prev => ({
      ...prev,
      platformEarnings: (prev.platformEarnings || []).filter(p => p.id !== id),
    }));
  };

  // Mileage updates
  const handleUpdateMileage = (field: 'totalMiles' | 'workMiles', val: number | string) => {
    const num = Math.max(0, typeof val === 'number' ? val : parseFloat(val) || 0);
    onUpdateSession(prev => ({
      ...prev,
      [field]: num,
    }));
  };

  // --- Bonus & Quest Handlers ---
  const handleOpenAddBonus = () => {
    setEditingBonus(null);
    setIsBonusModalOpen(true);
  };

  const handleEditBonus = (bonus: BonusEntry) => {
    setEditingBonus(bonus);
    setIsBonusModalOpen(true);
  };

  const handleSaveBonus = (bonus: BonusEntry) => {
    onUpdateSession(prev => {
      const existing = prev.bonusEarnings || [];
      const idx = existing.findIndex(b => b.id === bonus.id);
      let updated: BonusEntry[];
      if (idx >= 0) {
        updated = [...existing];
        updated[idx] = bonus;
      } else {
        updated = [...existing, bonus];
      }
      return {
        ...prev,
        bonusEarnings: updated,
      };
    });
  };

  const handleDeleteBonus = (bonusId: string) => {
    onUpdateSession(prev => ({
      ...prev,
      bonusEarnings: (prev.bonusEarnings || []).filter(b => b.id !== bonusId),
    }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Driver Safety Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold">
            Car Safety First: Large high-contrast touch targets. Never use your device while driving!
          </span>
        </div>
        <button
          onClick={() => setIsManualTimeModalOpen(true)}
          className="underline font-bold hover:text-amber-950 dark:hover:text-amber-100 whitespace-nowrap ml-2 cursor-pointer"
        >
          Adjust Time
        </button>
      </div>

      {/* 1. CAR ACTION CONTROLS (LARGE BUTTONS) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              Session Action Center
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Timers persist automatically across browser closes & app restarts
            </p>
          </div>

          <button
            onClick={() => setIsManualTimeModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Time Offsets</span>
          </button>
        </div>

        {/* Dynamic Big Tap Action Buttons based on status */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(session.status === 'not_started' || session.status === 'ended') && (
            <button
              onClick={handleStartDay}
              className="sm:col-span-2 lg:col-span-3 py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-lg sm:text-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-3 active:scale-98 transition-all cursor-pointer"
            >
              <Play className="w-7 h-7 fill-white" />
              <span>{session.status === 'ended' ? 'Start New Day (Leave Home)' : 'Start Day (Leave Home)'}</span>
            </button>
          )}

          {session.status === 'commuting' && (
            <>
              <button
                onClick={handleStartWork}
                className="sm:col-span-2 py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-lg shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-3 active:scale-98 transition-all cursor-pointer"
              >
                <Briefcase className="w-6 h-6" />
                <span>Start Work / First Dispatch</span>
              </button>

              <button
                onClick={handleHeadingHome}
                className="py-5 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-base border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <Home className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span>Headed Home</span>
              </button>
            </>
          )}

          {session.status === 'working' && (
            <>
              <button
                onClick={handleBreak}
                className="py-5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base sm:text-lg shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <Coffee className="w-6 h-6" />
                <span>Take Break (Pause Work)</span>
              </button>

              <button
                onClick={handleHeadingHome}
                className="py-5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-base sm:text-lg shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <Home className="w-6 h-6" />
                <span>Headed Home (Pause Work)</span>
              </button>

              <button
                onClick={() => setIsCloseModalOpen(true)}
                className="py-5 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-base border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>End Day & Save</span>
              </button>
            </>
          )}

          {session.status === 'on_break' && (
            <>
              <button
                onClick={handleEndBreakAndResumeWork}
                className="sm:col-span-2 py-5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-3 active:scale-98 transition-all cursor-pointer"
              >
                <Briefcase className="w-6 h-6" />
                <span>End Break / Resume Work</span>
              </button>

              <button
                onClick={handleHeadingHome}
                className="py-5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-base flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <Home className="w-5 h-5" />
                <span>Headed Home</span>
              </button>
            </>
          )}

          {session.status === 'heading_home' && (
            <>
              <button
                onClick={handleResumeWork}
                className="sm:col-span-2 py-5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-extrabold text-lg shadow-lg shadow-purple-600/25 flex items-center justify-center gap-3 active:scale-98 transition-all cursor-pointer"
              >
                <Briefcase className="w-6 h-6" />
                <span>Got a Trip! (Resume Work)</span>
              </button>

              <button
                onClick={() => setIsCloseModalOpen(true)}
                className="py-5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Arrived Home (End & Save)</span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* 2. REAL-TIME EFFICIENCY DASHBOARD (ALWAYS LIVE) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Grand Earnings */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Grand Earnings</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-1.5">
            {formatCurrency(totalEarnings, settings.currency)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center justify-between gap-1">
            <span>{totalBonusEarnings > 0 ? `Base: ${formatCurrency(baseEarnings, settings.currency)}` : 'Multi-platform sum'}</span>
            {totalBonusEarnings > 0 && (
              <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Gift className="w-3 h-3 text-amber-500" />
                +{formatCurrency(totalBonusEarnings, settings.currency)}
              </span>
            )}
          </div>
        </div>

        {/* Active Work Rate ($/hr) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/40 shadow-sm transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Work $/Hour</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-1.5">
            {formatRate(dollarsPerHourWork, settings.currency, 'hr')}
          </div>
          <div className="text-xs text-emerald-800/80 dark:text-emerald-400/80 mt-1">
            Active dispatch efficiency
          </div>
        </div>

        {/* Total Shift Rate ($/hr) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Total $/Hour</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-700 dark:text-blue-400 mt-1.5">
            {formatRate(dollarsPerHourTotal, settings.currency, 'hr')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            True net return (incl. commute)
          </div>
        </div>

        {/* Rate Per Mile ($/mi) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>$/Mile (Total)</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-purple-700 dark:text-purple-400 mt-1.5">
            {formatRate(dollarsPerMileTotal, settings.currency, 'mi')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {session.totalMiles > 0 ? `${session.totalMiles} total miles` : 'Enter miles below'}
          </div>
        </div>
      </section>

      {/* 3. GOAL PROGRESS TRACKER CARD */}
      <GoalTrackerCard
        currentEarnings={totalEarnings}
        workSeconds={workSeconds}
        totalSeconds={totalSeconds}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />

      {/* 4. DUAL TIMERS PANEL */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Session Timers</span>
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {breakSeconds > 0 ? `Break: ${formatDuration(breakSeconds, true)}` : 'Real timestamp precision'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Work Time Clock */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-500/30">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 block uppercase tracking-wider">
              Active Work Time (HH:MM:SS)
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300 mt-2">
              {formatDuration(workSeconds, true)}
            </div>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-1">
              {(session.workSegments || []).length} active work period{(session.workSegments || []).length === 1 ? '' : 's'}
            </p>
          </div>

          {/* Total Shift Clock */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">
              Total Shift Time (HH:MM:SS)
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white mt-2">
              {formatDuration(totalSeconds, true)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Started from moment you left home
            </p>
          </div>
        </div>
      </section>

      {/* 5. MULTI-PLATFORM EARNINGS SLOTS */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Multi-Platform Earnings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update numbers anytime during your shift
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Grand Total</span>
            <span className="text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
              {formatCurrency(totalEarnings, settings.currency)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(session.platformEarnings || []).map((p, pIdx) => (
            <div
              key={p.id ? `${p.id}-${pIdx}` : `platform-${pIdx}-${p.name}`}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {p.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {totalEarnings > 0 ? `${((p.amount / totalEarnings) * 100).toFixed(0)}% of shift` : 'No earnings'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold font-mono text-slate-500">{settings.currency}</span>
                <NumericInput
                  step="0.01"
                  min={0}
                  value={p.amount}
                  onChange={val => handleUpdatePlatformAmount(p.id, val)}
                  placeholder="0"
                  className="w-24 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white text-right focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleDeletePlatform(p.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Remove platform slot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add custom platform */}
        {isAddingPlatform ? (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newPlatformName}
              onChange={e => setNewPlatformName(e.target.value)}
              placeholder="e.g. Grubhub, Instacart, Spark"
              autoFocus
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleAddPlatform}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              Add Slot
            </button>
            <button
              onClick={() => setIsAddingPlatform(false)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingPlatform(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors pt-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another App / Delivery Platform</span>
          </button>
        )}
      </section>

      {/* 6. PLATFORM BONUSES, QUESTS & CHALLENGES */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Platform Bonuses, Quests & Challenges
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Uber Quests, Lyft Challenges, DoorDash Peak Pay, Streaks & Guarantees
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Running Bonus Total</span>
              <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                +{formatCurrency(totalBonusEarnings, settings.currency)}
              </span>
            </div>

            <button
              onClick={handleOpenAddBonus}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Bonus / Quest</span>
            </button>
          </div>
        </div>

        {/* List of active bonuses or empty state */}
        {(!session.bonusEarnings || session.bonusEarnings.length === 0) ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No promotions or bonuses logged for this shift yet
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-md mx-auto">
                Completed an Uber Quest, Lyft Challenge, DoorDash Peak Pay, or 3-trip streak? Log it here to roll straight into your $/hr and $/mile rates!
              </p>
            </div>
            <button
              onClick={handleOpenAddBonus}
              className="mt-1 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-400 text-xs font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-500" />
              <span>+ Log Promotion / Bonus</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {session.bonusEarnings.map(bonus => {
                const meta = getBonusTypeMeta(bonus.bonusType);
                return (
                  <div
                    key={bonus.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.badgeBg} ${meta.badgeText}`}>
                          {meta.title}
                        </span>
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {bonus.platform}
                        </span>
                      </div>

                      {bonus.notes ? (
                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                          "{bonus.notes}"
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          No notes
                        </p>
                      )}

                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {bonus.dateRangeEnd ? `${bonus.dateStr} – ${bonus.dateRangeEnd}` : bonus.dateStr}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                        +{formatCurrency(bonus.amount, settings.currency)}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditBonus(bonus)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit bonus"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBonus(bonus.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete bonus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleOpenAddBonus}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors pt-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Bonus or Challenge</span>
            </button>
          </div>
        )}
      </section>

      {/* 7. MILEAGE TRACKER & TAX DEDUCTION ESTIMATE */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Fuel className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Shift Mileage & Tax Write-off</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              IRS Standard Deduction rate: {formatCurrency(settings.standardMileageRate, settings.currency)}/mile
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider block">
              Est. Tax Write-Off
            </span>
            <span className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-300">
              {formatCurrency(estimatedTaxDeduction, settings.currency)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Miles */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Total Miles Driven (Odometer / Trip A)
            </label>
            <div className="flex items-center gap-2">
              <NumericInput
                step="0.1"
                min={0}
                value={session.totalMiles}
                onChange={val => handleUpdateMileage('totalMiles', val)}
                placeholder="0"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-500">miles</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              From driveway departure to return
            </p>
          </div>

          {/* Work Miles (Optional) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Active Work Miles (Optional)
            </label>
            <div className="flex items-center gap-2">
              <NumericInput
                step="0.1"
                min={0}
                value={session.workMiles}
                onChange={val => handleUpdateMileage('workMiles', val)}
                placeholder="0"
                className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-500">miles</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Only while transporting passenger or food
            </p>
          </div>
        </div>
      </section>

      {/* Modals */}
      <DayCloseModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        session={session}
        totalSeconds={totalSeconds}
        workSeconds={workSeconds}
        breakSeconds={breakSeconds}
        totalEarnings={totalEarnings}
        dollarsPerHourTotal={dollarsPerHourTotal}
        dollarsPerHourWork={dollarsPerHourWork}
        dollarsPerMileTotal={dollarsPerMileTotal}
        dollarsPerMileWork={dollarsPerMileWork}
        settings={settings}
        onConfirmSave={onSaveDayRecord}
      />

      <ManualTimeModal
        isOpen={isManualTimeModalOpen}
        onClose={() => setIsManualTimeModalOpen(false)}
        session={session}
        onUpdateSession={onUpdateSession}
      />

      <BonusEntryModal
        isOpen={isBonusModalOpen}
        onClose={() => {
          setIsBonusModalOpen(false);
          setEditingBonus(null);
        }}
        initialBonus={editingBonus}
        availablePlatforms={(session.platformEarnings || []).map(p => p.name)}
        currency={settings.currency}
        onSave={handleSaveBonus}
        onDelete={handleDeleteBonus}
      />
    </div>
  );
};
