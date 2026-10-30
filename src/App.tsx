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
import { SummaryEditorModal } from './components/SummaryEditorModal';
import { emptyDayRecord, isDayRecord, isSummaryRecord, recordKind } from './utils/periodSummaries';
import { BackHomePrompt } from './components/BackHomePrompt';
import { useHomeGeofence } from './hooks/useHomeGeofence';
import { useReminderConfig, syncPushSchedule, nextLocalTime, showLocalNotification } from './utils/reminders';

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
  const [editingIsNew, setEditingIsNew] = useState(false);
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

  // --- Reminders & home area ---
  const reminderCfg = useReminderConfig();
  const shiftRunning = session.status !== 'not_started' && session.status !== 'ended' && !!session.startDayTimestamp;
  const [isBackHomeOpen, setIsBackHomeOpen] = useState(false);
  const [closeRequest, setCloseRequest] = useState(0); // bump to open the End & Save dialog in the tracker

  // Tell the push server only the schedule + shift state (running, end-reminder time). Debounced.
  const endReminderAt = shiftRunning && reminderCfg.safetyEnabled
    ? nextLocalTime(session.startDayTimestamp as number, reminderCfg.safetyEndTime)
    : null;
  useEffect(() => {
    const t = setTimeout(() => {
      syncPushSchedule(reminderCfg, { shiftRunning, endReminderAt }).catch(err => console.warn('Push sync failed', err));
    }, 800);
    return () => clearTimeout(t);
  }, [reminderCfg, shiftRunning, endReminderAt]);

  // Watch location only while a shift runs and the app is open; prompt once per return home.
  useHomeGeofence({
    enabled: reminderCfg.homeEnabled && shiftRunning,
    home: reminderCfg.home,
    shiftStart: session.startDayTimestamp,
    onArrivedHome: () => {
      setIsBackHomeOpen(true);
      showLocalNotification('Back home, done working?', 'Stop the timer?', 'gig-home');
    },
  });

  // "Stop": end work time now (like Headed Home) and open the existing End & Save dialog.
  const handleBackHomeStop = () => {
    setIsBackHomeOpen(false);
    const t = Date.now();
    handleUpdateSession(prev => ({
      ...prev,
      status: 'heading_home',
      workSegments: (prev.workSegments || []).map((seg, i, a) => (i === a.length - 1 && !seg.endTime ? { ...seg, endTime: t } : seg)),
      breakSegments: (prev.breakSegments || []).map((seg, i, a) => (i === a.length - 1 && !seg.endTime ? { ...seg, endTime: t } : seg)),
    }));
    setActiveTab('tracker');
    setCloseRequest(n => n + 1);
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

  // Merge records imported from CSV (already de-duplicated) into history
  const handleImportRecords = (imported: DayRecord[]) => {
    const next = [...imported.sort((a, b) => b.startTime - a.startTime), ...loadHistory()];
    saveHistory(next);
    setRecords(next);
  };

  // After a JSON backup restore: re-read everything from storage
  const handleBackupRestored = () => {
    const nextSettings = loadSettings();
    setSettings(nextSettings);
    setRecords(loadHistory());
    setExpenses(loadExpenses());
    setSession(loadActiveSession(nextSettings));
    window.dispatchEvent(new Event('gig-reminders-changed'));
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

  // New past day: empty record, no apps pre-chosen; the user picks apps and the date in the editor
  const handleAddNewForDate = (dateStr: string) => {
    setEditingIsNew(true);
    setEditingRecord(emptyDayRecord(dateStr));
  };

  // Today's local date (YYYY-MM-DD) as the starting date for "Add past day"
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // Save from the day editor: updates an existing day or adds a new one
  const handleUpsertRecord = (rec: DayRecord) => {
    setRecords(addDayRecord(rec));
  };

  // Month/year catch-up summaries
  const [summaryEditor, setSummaryEditor] = useState<{ record: DayRecord | null } | null>(null);
  const handleSaveSummary = (rec: DayRecord, removeIds: string[]) => {
    const rest = loadHistory().filter(r => r.id !== rec.id && !removeIds.includes(r.id));
    const next = [rec, ...rest];
    saveHistory(next);
    setRecords(next);
  };
  const handleSelectHistoryRecord = (r: DayRecord) => {
    if (isSummaryRecord(r)) setSummaryEditor({ record: r });
    else { setEditingIsNew(false); setEditingRecord(r); }
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
            closeRequest={closeRequest}
            onCloseRequestHandled={() => setCloseRequest(0)}
          />
        )}

        {activeTab === 'week' && (
          <WeekDailyView
            records={records.filter(isDayRecord)}
            settings={settings}
            onSelectRecord={r => { setEditingIsNew(false); setEditingRecord(r); }}
            onAddNewForDate={handleAddNewForDate}
            onUpdateSettings={setSettings}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsCharts
            records={records.filter(r => recordKind(r) !== 'year')}
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
            onSelectRecord={handleSelectHistoryRecord}
            onDeleteRecord={handleDeleteRecord}
            onClearAllData={handleClearAllData}
            onAddPastDay={() => handleAddNewForDate(todayStr())}
            onCatchUp={() => setSummaryEditor({ record: null })}
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
        key={editingRecord?.id || 'no-record'}
        record={editingRecord}
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        onSave={handleUpsertRecord}
        onDelete={handleDeleteRecord}
        settings={settings}
        isNew={editingIsNew}
      />

      {summaryEditor && (
        <SummaryEditorModal
          key={summaryEditor.record?.id || 'new-summary'}
          record={summaryEditor.record}
          records={records}
          settings={settings}
          onSave={handleSaveSummary}
          onDelete={handleDeleteRecord}
          onClose={() => setSummaryEditor(null)}
        />
      )}

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        records={records}
        expenses={expenses}
        settings={settings}
        onImportRecords={handleImportRecords}
        onBackupRestored={handleBackupRestored}
      />

      <BackHomePrompt isOpen={isBackHomeOpen} onStop={handleBackHomeStop} onKeepGoing={() => setIsBackHomeOpen(false)} />
    </div>
  );
}
