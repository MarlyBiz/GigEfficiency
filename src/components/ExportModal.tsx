/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { X, FileDown, FileText, CheckCircle2, Calendar, FileSpreadsheet, FileUp, FileJson, ArchiveRestore } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { AppSettings, DayRecord, ExpenseRecord } from '../types';
import { formatCurrency, formatDuration, formatRate, formatHM } from '../utils/calculations';
import { getCategoryMeta } from '../utils/expenses';
import { importShiftsCSV } from '../utils/csvImport';
import { isDayRecord, recordKind } from '../utils/periodSummaries';
import { GigBackup, applyBackup, downloadBackup, parseBackup } from '../utils/backup';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: DayRecord[];
  expenses?: ExpenseRecord[];
  settings: AppSettings;
  onImportRecords?: (records: DayRecord[]) => void;
  /** Called after a JSON backup was restored so the app reloads its state from storage. */
  onBackupRestored?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  records,
  expenses = [],
  settings,
  onImportRecords,
  onBackupRestored,
}) => {
  const [exportType, setExportType] = useState<'csv' | 'pdf_summary' | 'pdf_tax'>('csv');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<GigBackup | null>(null);

  if (!isOpen) return null;

  // --- CSV Export ---
  const handleExportCSV = () => {
    // Month/year catch-up summaries are not daily shifts: they're left out of the shifts CSV
    // (they're kept in the JSON backup) so spreadsheets and the CSV importer see only days.
    const dayRecords = records.filter(isDayRecord);
    if (dayRecords.length === 0) return;

    const headers = [
      'Date',
      'Total Time (hrs)',
      'Work Time (hrs)',
      'Base Earnings',
      'Bonus & Quest Earnings',
      'Total Earnings',
      'Work $/Hr',
      'Total $/Hr',
      'Total Miles',
      'Work Miles',
      '$/Mile Total',
      'IRS Standard Deduction',
      'Platforms Breakdown',
      'Bonuses Breakdown',
      'Notes',
    ];

    const rows = dayRecords.map(r => {
      const totalHrs = (r.totalSeconds / 3600).toFixed(2);
      const workHrs = (r.workSeconds / 3600).toFixed(2);
      const taxDeduction = (r.totalMiles * (settings.standardMileageRate || 0.67)).toFixed(2);
      const baseEarnings = (r.baseEarnings ?? (r.platformEarnings || []).reduce((s, p) => s + (p.amount || 0), 0)).toFixed(2);
      const bonusEarnings = (r.totalBonusEarnings ?? (r.bonusEarnings || []).reduce((s, b) => s + (b.amount || 0), 0)).toFixed(2);
      const platformsStr = (r.platformEarnings || [])
        .map(p => `${p.name}: ${p.amount}`)
        .join('; ');
      const bonusesStr = (r.bonusEarnings || [])
        .map(b => `${b.platform} (${b.bonusType}): ${b.amount}${b.notes ? ` - ${b.notes}` : ''}`)
        .join('; ');

      return [
        `"${r.dateStr}"`,
        totalHrs,
        workHrs,
        baseEarnings,
        bonusEarnings,
        r.totalEarnings.toFixed(2),
        r.dollarsPerHourWork.toFixed(2),
        r.dollarsPerHourTotal.toFixed(2),
        r.totalMiles,
        r.workMiles,
        r.dollarsPerMileTotal.toFixed(2),
        taxDeduction,
        `"${platformsStr}"`,
        `"${bonusesStr}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gig_tracker_shifts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  // --- Shifts CSV Import (reads this app's own shifts CSV exports) ---
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !onImportRecords) return;
    try {
      const { toAdd, duplicates, invalid } = importShiftsCSV(await file.text(), records, settings);
      const skipped = `${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped${invalid ? `, ${invalid} unreadable row${invalid === 1 ? '' : 's'}` : ''}`;
      if (toAdd.length === 0) {
        setImportMessage({ ok: false, text: `Nothing to import (${skipped}).` });
        return;
      }
      if (!window.confirm(`Import ${toAdd.length} day${toAdd.length === 1 ? '' : 's'}?`)) return;
      onImportRecords(toAdd);
      setImportMessage({ ok: true, text: `Imported ${toAdd.length} day${toAdd.length === 1 ? '' : 's'} (${skipped}).` });
    } catch (err) {
      setImportMessage({ ok: false, text: `Import failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  // --- JSON full backup / restore ---
  const handleExportBackup = () => {
    const b = downloadBackup();
    setImportMessage({ ok: true, text: `Backup saved (${b.data.history.length} shifts${b.data.activeSession ? ' + shift in progress' : ''}). Home location is not included.` });
  };

  // Step 1: read + validate the file. Nothing is written until the user picks Replace or Merge.
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPendingBackup(parseBackup(await file.text()));
      setImportMessage(null);
    } catch (err) {
      setPendingBackup(null);
      setImportMessage({ ok: false, text: `Restore failed: ${err instanceof Error ? err.message : String(err)} Nothing was changed.` });
    }
  };

  // Step 2: apply the chosen mode, then let the app reload its state.
  const handleApplyBackup = (mode: 'replace' | 'merge') => {
    if (!pendingBackup) return;
    try {
      const r = applyBackup(pendingBackup, mode);
      setPendingBackup(null);
      onBackupRestored?.();
      setImportMessage({
        ok: true,
        text: mode === 'replace'
          ? `Restored everything from the backup (${r.shiftsAdded} shifts).`
          : `Merged ${r.shiftsAdded} shift${r.shiftsAdded === 1 ? '' : 's'} (${r.duplicates} duplicate${r.duplicates === 1 ? '' : 's'} skipped).`,
      });
    } catch (err) {
      setImportMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  // --- Expenses CSV Export ---
  const handleExportExpensesCSV = () => {
    if (expenses.length === 0) return;

    const headers = ['Date', 'Amount', 'Schedule C Line', 'Category', 'Platform', 'Notes', 'Receipt Note'];
    const rows = expenses.map(e => {
      const meta = getCategoryMeta(e.category);
      return [
        `"${e.dateStr}"`,
        e.amount.toFixed(2),
        `"${meta.scheduleCLine}"`,
        `"${meta.title}"`,
        `"${(e.platform || '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`,
        `"${(e.receiptNote || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gig_tracker_schedule_c_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  // --- PDF Export ---
  const handleExportPDF = (type: 'summary' | 'tax') => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(type === 'tax' ? 'Gig Driver Tax & Mileage Statement' : 'Gig Efficiency Performance Statement', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
    y += 12;

    // Totals
    const totalEarnings = records.reduce((s, r) => s + r.totalEarnings, 0);
    const totalSeconds = records.reduce((s, r) => s + r.totalSeconds, 0);
    const workSeconds = records.reduce((s, r) => s + r.workSeconds, 0);
    const totalMiles = records.reduce((s, r) => s + r.totalMiles, 0);
    const totalTaxDeduction = totalMiles * (settings.standardMileageRate || 0.67);
    const totalWorkHours = workSeconds / 3600;
    const avgWorkRate = totalWorkHours > 0 ? totalEarnings / totalWorkHours : 0;
    const totalExpensesAmount = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalEarnings - totalExpensesAmount;

    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, 196, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text('Summary Overview', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Shifts Logged: ${records.length}`, margin, y);
    doc.text(`Total Gross Earnings: ${formatCurrency(totalEarnings, settings.currency)}`, 110, y);
    y += 5;
    doc.text(`Total Miles Driven: ${totalMiles.toLocaleString()} miles`, margin, y);
    doc.text(`IRS Mileage Deduction: ${formatCurrency(totalTaxDeduction, settings.currency)}`, 110, y);
    y += 5;
    doc.text(`Total Active Work Time: ${formatHM(workSeconds)}`, margin, y);
    doc.text(`Total Logged Expenses: ${formatCurrency(totalExpensesAmount, settings.currency)}`, 110, y);
    y += 5;
    doc.text(`Average Work $/Hr: ${formatRate(avgWorkRate, settings.currency, 'hr')}`, margin, y);
    doc.text(`Net Cash Profit: ${formatCurrency(netProfit, settings.currency)}`, 110, y);
    y += 10;

    doc.line(margin, y, 196, y);
    y += 8;

    // Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Date', margin, y);
    doc.text('Work Time', 45, y);
    doc.text('Total Time', 65, y);
    doc.text('Earnings', 85, y);
    doc.text('Work $/Hr', 110, y);
    doc.text('Miles', 135, y);
    doc.text('Tax Ded.', 160, y);
    y += 4;

    doc.line(margin, y, 196, y);
    y += 5;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    for (const r of records.slice(0, 35)) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const rTax = r.totalMiles * (settings.standardMileageRate || 0.67);
      doc.text(isDayRecord(r) ? r.dateStr : `${r.periodKey} (${recordKind(r)} total)`, margin, y);
      doc.text(formatHM(r.workSeconds), 45, y);
      doc.text(formatHM(r.totalSeconds), 65, y);
      doc.text(formatCurrency(r.totalEarnings, settings.currency), 85, y);
      doc.text(formatRate(r.dollarsPerHourWork, settings.currency, 'hr'), 110, y);
      doc.text(`${r.totalMiles}`, 135, y);
      doc.text(formatCurrency(rTax, settings.currency), 160, y);
      y += 5;
    }

    doc.save(`gig_tracker_${type}_${new Date().toISOString().slice(0, 10)}.pdf`);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto space-y-5 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Shifts & Statements</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">PDF printable statements & spreadsheet CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {downloadSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Document generated and downloaded successfully!</span>
          </div>
        )}

        {importMessage && (
          <div className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-bold border ${importMessage.ok ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span data-testid="import-result">{importMessage.text}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* Option 1: PDF Summary Statement */}
          <div
            onClick={() => handleExportPDF('summary')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  PDF Performance Statement
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Clean printable PDF featuring $/hour, work time, earnings, and platform breakdowns.
                </p>
              </div>
            </div>
            <FileDown className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
          </div>

          {/* Option 2: PDF Tax & Mileage Log */}
          <div
            onClick={() => handleExportPDF('tax')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                  PDF Annual Tax & Mileage Log
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  IRS-compliant log with total miles, dates, standard rate write-offs, and net gross totals.
                </p>
              </div>
            </div>
            <FileDown className="w-5 h-5 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
          </div>

          {/* Option 3: Full Shifts CSV Spreadsheet */}
          <div
            onClick={handleExportCSV}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  Shifts CSV Spreadsheet Export
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Raw Excel / Google Sheets format containing every shift column, notes, and platform slots.
                </p>
              </div>
            </div>
            <FileDown className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
          </div>

          {/* Option 4: Schedule C Expenses CSV Export */}
          <div
            onClick={handleExportExpensesCSV}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">
                  Schedule C Expenses CSV Export
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Itemized Schedule C expense records with Line numbers, receipts, categories, and platforms ({expenses.length} records).
                </p>
              </div>
            </div>
            <FileDown className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
          </div>

          {/* Option 5: Import Shifts CSV (merges into history, skips duplicates) */}
          {onImportRecords && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">
                    Import CSV
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Load a shifts CSV exported from this app. Days already in history are skipped.
                  </p>
                </div>
              </div>
              <FileUp className="w-5 h-5 text-slate-400 group-hover:text-violet-600 transition-colors shrink-0" />
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" data-testid="import-input" onClick={e => e.stopPropagation()} onChange={handleImportFile} />
            </div>
          )}

          {/* Option 6: Full JSON backup (everything except home location and push subscription) */}
          <div
            onClick={handleExportBackup}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                  Export Backup (JSON)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full backup: shifts, shift in progress, expenses, goals, settings and reminders. Home location stays on this phone.
                </p>
              </div>
            </div>
            <FileDown className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors shrink-0" />
          </div>

          {/* Option 7: Restore from JSON backup (validated first, then Replace or Merge) */}
          {onBackupRestored && (
            <div
              onClick={() => backupInputRef.current?.click()}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ArchiveRestore className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    Restore Backup (JSON)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Load a gig-backup file. It's checked first; then choose Replace everything or Merge shifts.
                  </p>
                </div>
              </div>
              <FileUp className="w-5 h-5 text-slate-400 group-hover:text-amber-600 transition-colors shrink-0" />
              <input ref={backupInputRef} type="file" accept=".json,application/json" className="hidden" data-testid="restore-input" onClick={e => e.stopPropagation()} onChange={handleRestoreFile} />
            </div>
          )}

          {/* Restore confirm: shown only after the file passed validation */}
          {pendingBackup && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 space-y-3" data-testid="restore-confirm">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Backup from <strong>{pendingBackup.exportedAt ? new Date(pendingBackup.exportedAt).toLocaleString() : 'unknown date'}</strong>:{' '}
                {pendingBackup.data.history.length} shifts, {pendingBackup.data.expenses.length} expenses
                {pendingBackup.data.activeSession ? ', a shift in progress' : ''}.
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                Replace everything overwrites this device's shifts, expenses, settings, reminders and current shift (your home location is kept).
                Merge shifts only adds shifts that aren't already here.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setPendingBackup(null)} className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer">
                  Cancel
                </button>
                <button onClick={() => handleApplyBackup('merge')} className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                  Merge shifts
                </button>
                <button onClick={() => handleApplyBackup('replace')} className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer">
                  Replace everything
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
