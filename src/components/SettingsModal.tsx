/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Target, 
  Trash2, 
  DollarSign, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  RefreshCw, 
  Check 
} from 'lucide-react';
import { AppSettings } from '../types';
import { ClearDataModal } from './ClearDataModal';
import { PWAInstallButton } from './PWAInstallButton';
import { NumericInput } from './NumericInput';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onLoadSampleData: () => void;
  onClearAllData: () => void;
  recordsCount: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onLoadSampleData,
  onClearAllData,
  recordsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'goals' | 'danger'>('general');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateSettings(tempSettings);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto transition-colors">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Settings & Benchmarks</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Customize period cutoffs, currency, and goals</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-2 my-4 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-1.5 rounded-xl transition-all ${
                activeTab === 'general'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              General & Cutoffs
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`flex-1 py-1.5 rounded-xl transition-all ${
                activeTab === 'goals'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Earnings Goals
            </button>
            <button
              onClick={() => setActiveTab('danger')}
              className={`flex-1 py-1.5 rounded-xl transition-all ${
                activeTab === 'danger'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
              }`}
            >
              Data Management
            </button>
          </div>

          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4 text-xs">
              {/* Day Cutoff Hour */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Day Cutoff Time (Uber/Lyft Standard)
                </label>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Commonly set to 4:00 AM so a late-night shift (e.g. 10 PM - 3 AM) counts towards one single day.
                </p>
                <select
                  value={tempSettings.dayCutoffHour}
                  onChange={e => setTempSettings({ ...tempSettings, dayCutoffHour: parseInt(e.target.value, 10) })}
                  className="w-full mt-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value={0}>Midnight (12:00 AM)</option>
                  <option value={3}>3:00 AM</option>
                  <option value={4}>4:00 AM (Recommended)</option>
                  <option value={5}>5:00 AM</option>
                  <option value={6}>6:00 AM</option>
                </select>
              </div>

              {/* Week Start Day */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Week Start Day
                </label>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Choose which day marks the start of each 7-day reporting cycle.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setTempSettings({ ...tempSettings, weekStartDay: 1 })}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                      tempSettings.weekStartDay === 1
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Monday
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempSettings({ ...tempSettings, weekStartDay: 0 })}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer ${
                      tempSettings.weekStartDay === 0
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    Sunday
                  </button>
                </div>
              </div>

              {/* Currency & Tax Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={tempSettings.currency}
                    onChange={e => setTempSettings({ ...tempSettings, currency: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    IRS Rate ($/Mile)
                  </label>
                  <NumericInput
                    step="0.01"
                    min={0}
                    value={tempSettings.standardMileageRate}
                    onChange={val => setTempSettings({ ...tempSettings, standardMileageRate: val })}
                    placeholder="0.67"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Install App Section */}
              <div className="pt-1">
                <PWAInstallButton variant="settings" />
              </div>
            </div>
          )}

          {/* TAB 2: GOALS */}
          {activeTab === 'goals' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-500 dark:text-slate-400">
                Set benchmarks to visualize progress bars in the Active Shift Tracker, 7-Day Week, and Monthly statements.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Daily Earnings Goal ($)
                  </label>
                  <NumericInput
                    min={0}
                    value={tempSettings.goals.dailyEarnings}
                    onChange={val =>
                      setTempSettings({
                        ...tempSettings,
                        goals: { ...tempSettings.goals, dailyEarnings: val },
                      })
                    }
                    placeholder="150"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Hourly Rate Goal ($/hr)
                  </label>
                  <NumericInput
                    step="0.5"
                    min={0}
                    value={tempSettings.goals.hourlyRate}
                    onChange={val =>
                      setTempSettings({
                        ...tempSettings,
                        goals: { ...tempSettings.goals, hourlyRate: val },
                      })
                    }
                    placeholder="25"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Weekly Earnings Target ($)
                  </label>
                  <NumericInput
                    min={0}
                    value={tempSettings.goals.weeklyEarnings}
                    onChange={val =>
                      setTempSettings({
                        ...tempSettings,
                        goals: { ...tempSettings.goals, weeklyEarnings: val },
                      })
                    }
                    placeholder="800"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Monthly Earnings Target ($)
                  </label>
                  <NumericInput
                    min={0}
                    value={tempSettings.goals.monthlyEarnings}
                    onChange={val =>
                      setTempSettings({
                        ...tempSettings,
                        goals: { ...tempSettings.goals, monthlyEarnings: val },
                      })
                    }
                    placeholder="3500"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Yearly Gross Earnings Goal ($)
                  </label>
                  <NumericInput
                    min={0}
                    value={tempSettings.goals.yearlyEarnings}
                    onChange={val =>
                      setTempSettings({
                        ...tempSettings,
                        goals: { ...tempSettings.goals, yearlyEarnings: val },
                      })
                    }
                    placeholder="45000"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DANGER / DATA */}
          {activeTab === 'danger' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Preload Realistic Sample Shifts</span>
                  <span className="text-slate-500 dark:text-slate-400">Instantly populate 14 realistic shifts to test charts and week views.</span>
                </div>
                <button
                  onClick={() => {
                    onLoadSampleData();
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap cursor-pointer"
                >
                  Load Samples
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-rose-700 dark:text-rose-400 block">Wipe All Shift Data</span>
                  <span className="text-rose-600/80 dark:text-rose-300/80">Permanently clears all historical shifts and active session timers.</span>
                </div>
                <button
                  onClick={() => setIsClearModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold whitespace-nowrap shadow-sm cursor-pointer"
                >
                  Clear All Data
                </button>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* Clear Data Modal with required uppercase 'DELETE' verification */}
      <ClearDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirmClear={() => {
          onClearAllData();
          onClose();
        }}
        totalRecordsCount={recordsCount}
      />
    </>
  );
};
