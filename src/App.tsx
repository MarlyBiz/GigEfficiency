/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ActiveSession, AppSettings, DayRecord, ExpenseRecord } from './types';
import {
  loadActiveSession,
  saveActiveSession,
  loadHistory,
  saveHistory,
  loadSettings,
  saveSettings,
  loadHasOnboarded,
  setHasOnboarded,
  generateSampleData,
  addDayRecord,
  updateDayRecord,
  deleteDayRecord,
  createInitialSession,
  loadExpenses,
  saveExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  generateSampleExpenses,
} from './utils/storage';
import { getSessionTimes } from './utils/calculations';
import { Header } from './components/Header';
import { ActiveShiftTracker } from './components/ActiveShiftTracker';
import { WeekDailyView } from './components/WeekDailyView';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { PeriodSummariesView } from './components/PeriodSummariesView';
import { HistoryView } from './components/HistoryView';
import { ExpensesView } from './components/ExpensesView';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { EditDayModal } from './components/EditDayModal';
import { ExportModal } from './components/ExportModal';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [session, setSession] = useState<ActiveSession>(() => loadActiveSession(settings));
  const [records, setRecords] = useState<DayRecord[]>(() => loadHistory());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => loadExpenses());
  const [activeTab, setActiveTab] = useState<'tracker' | 'week' | 'analytics' | 'history' | 'periods' | 'expenses'>('tracker');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DayRecord | null>(null);
  const [clearedBannerMessage, setClearedBannerMessage] = useState<string | null>(null);

  // Live second ticker for real-time timer progression
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync dark mode class on HTML document root for Tailwind CSS v4 @variant dark
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Sync settings to localStorage
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Sync session to localStorage on change
  useEffect(() => {
    saveActiveSession(session);
  }, [session]);

  // On initial mount: check onboarding state
  useEffect(() => {
    const hasOnboarded = loadHasOnboarded();
    if (!hasOnboarded) {
      setIsOnboardingOpen(true);
      if (records.length === 0) {
        const sampleRecords = generateSampleData(settings);
        setRecords(sampleRecords);
        saveHistory(sampleRecords);
      }
      if (expenses.length === 0) {
        const sampleExpenses = generateSampleExpenses(settings);
        setExpenses(sampleExpenses);
        saveExpenses(sampleExpenses);
      }
      setHasOnboarded(true);
    }
  }, []);

  // Compute live seconds based on timestamp math
  const { totalSeconds, workSeconds, breakSeconds } = getSessionTimes(session, now);

  const handleUpdateSession = (updater: (prev: ActiveSession) => ActiveSession) => {
    setSession(prev => {
      const next = updater(prev);
      saveActiveSession(next);
      return next;
    });
  };

  const handleSaveDayRecord = (record: DayRecord) => {
    const updatedRecords = addDayRecord(record);
    setRecords(updatedRecords);
    const nextSession = createInitialSession(settings);
    setSession(nextSession);
    saveActiveSession(nextSession);
    setActiveTab('week');
  };

  const handleUpdateRecord = (updatedRecord: DayRecord) => {
    const next = updateDayRecord(updatedRecord);
    setRecords(next);
  };

  const handleDeleteRecord = (id: string) => {
    const next = deleteDayRecord(id);
    setRecords(next);
  };

  const handleAddExpense = (exp: ExpenseRecord) => {
    const updated = addExpense(exp);
    setExpenses(updated);
  };

  const handleUpdateExpense = (exp: ExpenseRecord) => {
    const updated = updateExpense(exp);
    setExpenses(updated);
  };

  const handleDeleteExpense = (id: string) => {
    const updated = deleteExpense(id);
    setExpenses(updated);
  };

  const handleLoadSampleData = () => {
    const samples = generateSampleData(settings);
    setRecords(samples);
    saveHistory(samples);

    const sampleExps = generateSampleExpenses(settings);
    setExpenses(sampleExps);
    saveExpenses(sampleExps);
  };

  const handleClearAllData = () => {
    localStorage.removeItem('gig_tracker_history_records');
    saveHistory([]);
    setRecords([]);

    localStorage.removeItem('gig_tracker_expenses');
    saveExpenses([]);
    setExpenses([]);

    localStorage.removeItem('gig_tracker_active_session');
    const freshSession = createInitialSession(settings);
    setSession(freshSession);
    saveActiveSession(freshSession);

    setHasOnboarded(true);
    setClearedBannerMessage('All shift records, expenses, and active timers have been completely purged.');
    setActiveTab('tracker');
  };

  const handleAddNewForDate = (dateStr: string) => {
    const dummyRecord: DayRecord = {
      id: `manual-${dateStr}-${Date.now()}`,
      dateStr,
      startTime: new Date(`${dateStr}T16:00:00`).getTime(),
      endTime: new Date(`${dateStr}T21:00:00`).getTime(),
      totalSeconds: 5 * 3600,
      workSeconds: 4 * 3600,
      totalMiles: 75,
      workMiles: 65,
      platformEarnings: [
        { id: 'uber', name: 'Uber Rides', amount: 95 },
        { id: 'doordash', name: 'DoorDash', amount: 45 },
      ],
      totalEarnings: 140,
      dollarsPerHourTotal: 28.0,
      dollarsPerHourWork: 35.0,
      dollarsPerMileTotal: 1.87,
      dollarsPerMileWork: 2.15,
      notes: '',
      createdAt: Date.now(),
    };
    setEditingRecord(dummyRecord);
  };

  const handleToggleDarkMode = () => {
    setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }));
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors ${
      settings.darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Primary Top Bar & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsOnboardingOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        darkMode={settings.darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        shiftStatus={session.status}
      />

      {/* Cleared Data Notification Banner */}
      {clearedBannerMessage && (
        <div className="bg-emerald-100 dark:bg-emerald-950/90 border-b border-emerald-300 dark:border-emerald-500/40 px-4 py-2.5 text-center text-xs text-emerald-900 dark:text-emerald-300 font-semibold flex items-center justify-center gap-2 animate-in slide-in-from-top duration-200">
          <span>✓ {clearedBannerMessage}</span>
          <button
            onClick={() => setClearedBannerMessage(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white ml-2 text-sm font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'tracker' && (
          <ActiveShiftTracker
            session={session}
            totalSeconds={totalSeconds}
            workSeconds={workSeconds}
            breakSeconds={breakSeconds}
            settings={settings}
            onUpdateSession={handleUpdateSession}
            onSaveDayRecord={handleSaveDayRecord}
            onOpenHelp={() => setIsOnboardingOpen(true)}
            onUpdateSettings={setSettings}
          />
        )}

        {activeTab === 'week' && (
          <WeekDailyView
            records={records}
            settings={settings}
            onSelectRecord={r => setEditingRecord(r)}
            onAddNewForDate={handleAddNewForDate}
            onUpdateSettings={setSettings}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsCharts
            records={records}
            settings={settings}
          />
        )}

        {activeTab === 'periods' && (
          <PeriodSummariesView
            records={records}
            settings={settings}
            onOpenExport={() => setIsExportModalOpen(true)}
            onUpdateSettings={setSettings}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            records={records}
            settings={settings}
            onSelectRecord={r => setEditingRecord(r)}
            onDeleteRecord={handleDeleteRecord}
            onClearAllData={handleClearAllData}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            records={records}
            settings={settings}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}
      </main>

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onLoadSampleData={handleLoadSampleData}
        onClearAllData={handleClearAllData}
        recordsCount={records.length}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <EditDayModal
        record={editingRecord}
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        onSave={handleUpdateRecord}
        onDelete={handleDeleteRecord}
        settings={settings}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        records={records}
        expenses={expenses}
        settings={settings}
      />
    </div>
  );
}
