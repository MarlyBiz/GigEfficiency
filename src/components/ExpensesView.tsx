/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  FileDown, 
  DollarSign, 
  Calendar, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Check, 
  AlertCircle, 
  Fuel, 
  CreditCard, 
  Smartphone, 
  Package, 
  Navigation, 
  Shield, 
  Wrench, 
  HelpCircle,
  TrendingUp,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { AppSettings, DayRecord, ExpenseRecord, ScheduleCCategory } from '../types';
import { SCHEDULE_C_CATEGORIES, getCategoryMeta, CategoryMeta } from '../utils/expenses';
import { formatCurrency } from '../utils/calculations';
import { NumericInput } from './NumericInput';

interface ExpensesViewProps {
  expenses: ExpenseRecord[];
  records: DayRecord[];
  settings: AppSettings;
  onAddExpense: (expense: ExpenseRecord) => void;
  onUpdateExpense: (expense: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  records,
  settings,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | '30days' | 'year'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form / Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRecord | null>(null);
  const [receiptLightbox, setReceiptLightbox] = useState<string | null>(null);

  // Form Fields
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const [formData, setFormData] = useState<{
    dateStr: string;
    amount: string;
    category: ScheduleCCategory;
    platform: string;
    notes: string;
    receiptNote: string;
    receiptImage: string;
  }>({
    dateStr: todayDateStr,
    amount: '',
    category: 'vehicle_car',
    platform: 'All Platforms',
    notes: '',
    receiptNote: '',
    receiptImage: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick reset form
  const resetForm = () => {
    setFormData({
      dateStr: new Date().toISOString().slice(0, 10),
      amount: '',
      category: 'vehicle_car',
      platform: 'All Platforms',
      notes: '',
      receiptNote: '',
      receiptImage: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (expense: ExpenseRecord) => {
    setEditingExpense(expense);
    setFormData({
      dateStr: expense.dateStr,
      amount: String(expense.amount),
      category: expense.category,
      platform: expense.platform || 'All Platforms',
      notes: expense.notes || '',
      receiptNote: expense.receiptNote || '',
      receiptImage: expense.receiptImage || '',
    });
  };

  // Image Upload handler (compressed to reasonable max size)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, receiptImage: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (editingExpense) {
      onUpdateExpense({
        ...editingExpense,
        dateStr: formData.dateStr,
        amount: Number(parsedAmount.toFixed(2)),
        category: formData.category,
        platform: formData.platform.trim(),
        notes: formData.notes.trim(),
        receiptNote: formData.receiptNote.trim(),
        receiptImage: formData.receiptImage,
      });
      setEditingExpense(null);
    } else {
      const newExp: ExpenseRecord = {
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        dateStr: formData.dateStr,
        amount: Number(parsedAmount.toFixed(2)),
        category: formData.category,
        platform: formData.platform.trim(),
        notes: formData.notes.trim(),
        receiptNote: formData.receiptNote.trim(),
        receiptImage: formData.receiptImage,
        createdAt: Date.now(),
      };
      onAddExpense(newExp);
      setIsAddModalOpen(false);
    }
    resetForm();
  };

  // Date filtering helper
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYearStr = String(now.getFullYear());
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Category filter
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
        return false;
      }

      // Time filter
      if (timeFilter === 'month' && !exp.dateStr.startsWith(currentYm)) {
        return false;
      }
      if (timeFilter === 'year' && !exp.dateStr.startsWith(currentYearStr)) {
        return false;
      }
      if (timeFilter === '30days' && exp.dateStr < thirtyDaysAgoStr) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inNotes = (exp.notes || '').toLowerCase().includes(q);
        const inPlatform = (exp.platform || '').toLowerCase().includes(q);
        const inReceipt = (exp.receiptNote || '').toLowerCase().includes(q);
        const inCategory = getCategoryMeta(exp.category).title.toLowerCase().includes(q);
        const inDate = exp.dateStr.includes(q);
        if (!inNotes && !inPlatform && !inReceipt && !inCategory && !inDate) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.dateStr.localeCompare(a.dateStr) || b.createdAt - a.createdAt);
  }, [expenses, selectedCategory, timeFilter, searchQuery, currentYm, currentYearStr, thirtyDaysAgoStr]);

  // Aggregate Category Totals (All time or filtered)
  const categoryTotals = useMemo(() => {
    const map = new Map<ScheduleCCategory, number>();
    for (const cat of SCHEDULE_C_CATEGORIES) {
      map.set(cat.id, 0);
    }
    for (const exp of filteredExpenses) {
      const current = map.get(exp.category) || 0;
      map.set(exp.category, current + exp.amount);
    }
    return map;
  }, [filteredExpenses]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const grandLifetimeTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // Lifetime Gross Shift Earnings from history
  const totalShiftGrossEarnings = useMemo(() => {
    return records.reduce((sum, r) => sum + r.totalEarnings, 0);
  }, [records]);

  // Net Driving Cash Profit (Gross - Expenses)
  const netCashProfit = totalShiftGrossEarnings - grandLifetimeTotal;

  // Total Mileage Standard Deduction
  const totalMilesDriven = records.reduce((sum, r) => sum + r.totalMiles, 0);
  const totalStandardMileageDeduction = totalMilesDriven * (settings.standardMileageRate || 0.67);

  // Tolls & Parking total (which is deductible in addition to standard mileage!)
  const tollsParkingTotal = useMemo(() => {
    return expenses.filter(e => e.category === 'tolls_parking').reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  // Export Expenses CSV
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return;

    const headers = ['Date', 'Amount', 'Schedule C Line', 'Category', 'Platform', 'Notes', 'Receipt Note'];
    const rows = filteredExpenses.map(e => {
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
    link.setAttribute('download', `gig_driver_schedule_c_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to render icon for category
  const renderCategoryIcon = (catId: ScheduleCCategory, className: string = 'w-4 h-4') => {
    switch (catId) {
      case 'vehicle_car':
        return <Fuel className={className} />;
      case 'platform_fees':
        return <CreditCard className={className} />;
      case 'phone_data':
        return <Smartphone className={className} />;
      case 'supplies_gear':
        return <Package className={className} />;
      case 'tolls_parking':
        return <Navigation className={className} />;
      case 'insurance':
        return <Shield className={className} />;
      case 'repairs_maintenance':
        return <Wrench className={className} />;
      case 'other_expenses':
      default:
        return <Receipt className={className} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. TOP OVERVIEW & SCHEDULE C SUMMARY */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Tax Deductions & Schedule C
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <span>Gig Driver Expenses</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Categorized according to official IRS Schedule C lines for 1099 independent contractors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredExpenses.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Export filtered expenses to spreadsheet CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>
          </div>
        </div>

        {/* 2. THREE KEY METRIC TILES */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Filtered / Grand Expenses */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Total Logged Expenses</span>
              <Receipt className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-700 dark:text-rose-400">
              {formatCurrency(totalFilteredAmount, settings.currency)}
            </div>
            <p className="text-[11px] text-slate-500">
              {filteredExpenses.length} receipt{filteredExpenses.length === 1 ? '' : 's'} logged {timeFilter !== 'all' ? `(${timeFilter})` : 'all-time'}
            </p>
          </div>

          {/* Net Cash Profit (Earnings minus Expenses) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Net Driver Cash Profit</span>
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${
              netCashProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
            }`}>
              {formatCurrency(netCashProfit, settings.currency)}
            </div>
            <p className="text-[11px] text-slate-500">
              Gross Earnings ({formatCurrency(totalShiftGrossEarnings, settings.currency)}) minus Expenses
            </p>
          </div>

          {/* IRS Deductions Insight Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span>Standard Mileage Deduction</span>
              <span className="font-mono">{formatCurrency(settings.standardMileageRate, settings.currency)}/mi</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
              {formatCurrency(totalStandardMileageDeduction + tollsParkingTotal, settings.currency)}
            </div>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80">
              {totalMilesDriven.toLocaleString()} mi + {formatCurrency(tollsParkingTotal, settings.currency)} tolls/parking allowed on top
            </p>
          </div>
        </div>

        {/* IRS Schedule C Tip */}
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Schedule C Tip:</strong> If using the standard mileage rate (Line 9), vehicle gas & repairs are already covered by the rate, but <strong>Tolls & Parking</strong>, <strong>Platform Fees</strong>, <strong>Supplies/Gear</strong>, and <strong>Phone Data</strong> are <em>100% deductible in addition</em> to mileage!
          </p>
        </div>
      </section>

      {/* 3. RUNNING CATEGORY TOTALS CAROUSEL / GRID */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Running Totals by Schedule C Line
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click any category to filter
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-1">
          {SCHEDULE_C_CATEGORIES.map(cat => {
            const sum = categoryTotals.get(cat.id) || 0;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? `${cat.bgLight} ${cat.bgDark} ${cat.borderLight} ${cat.borderDark} ring-2 ring-emerald-500 shadow-sm`
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`p-1.5 rounded-lg ${cat.bgLight} ${cat.bgDark} ${cat.textColor}`}>
                      {renderCategoryIcon(cat.id, 'w-3.5 h-3.5')}
                    </span>
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {cat.scheduleCLine.split(' ')[0]}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block mt-2 line-clamp-1">
                    {cat.title}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                  <span className={`text-sm font-extrabold font-mono block ${cat.textColor}`}>
                    {formatCurrency(sum, settings.currency)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. EXPENSES CONTROLS (SEARCH, TIME FILTER & CATEGORY TABS) */}
      <section className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes, store name, platform, receipt..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Time Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  timeFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  timeFilter === 'month'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setTimeFilter('30days')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  timeFilter === '30days'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setTimeFilter('year')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  timeFilter === 'year'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {now.getFullYear()} Year
              </button>
            </div>
          </div>

          {/* Active filter reset if any */}
          {(selectedCategory !== 'all' || searchQuery.trim() !== '') && (
            <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
              <span>Active filters:</span>
              {selectedCategory !== 'all' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
                  <span>{getCategoryMeta(selectedCategory as ScheduleCCategory).title}</span>
                  <button onClick={() => setSelectedCategory('all')} className="hover:text-rose-500 cursor-pointer">×</button>
                </span>
              )}
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1">
                  <span>"{searchQuery}"</span>
                  <button onClick={() => setSearchQuery('')} className="hover:text-rose-500 cursor-pointer">×</button>
                </span>
              )}
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setTimeFilter('all');
                }}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold ml-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* 5. EXPENSES LIST */}
        {filteredExpenses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
            <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              No expenses match your search or filter criteria.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Log First Expense</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense, idx) => {
              const meta = getCategoryMeta(expense.category);
              return (
                <div
                  key={expense.id ? `${expense.id}-${idx}` : `expense-${idx}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Category Icon */}
                    <div className={`w-11 h-11 rounded-2xl ${meta.bgLight} ${meta.bgDark} ${meta.textColor} border ${meta.borderLight} ${meta.borderDark} flex items-center justify-center shrink-0`}>
                      {renderCategoryIcon(expense.category, 'w-5 h-5')}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          {meta.title}
                        </span>
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${meta.badgeBg}`}>
                          {meta.scheduleCLine}
                        </span>
                        {expense.platform && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {expense.platform}
                          </span>
                        )}
                      </div>

                      {expense.notes && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {expense.notes}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{expense.dateStr}</span>
                        </span>

                        {expense.receiptNote && (
                          <span className="font-mono text-slate-600 dark:text-slate-400">
                            Ref: {expense.receiptNote}
                          </span>
                        )}

                        {expense.receiptImage && (
                          <button
                            onClick={() => setReceiptLightbox(expense.receiptImage!)}
                            className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>View Receipt Photo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <span className="text-xl sm:text-2xl font-extrabold font-mono text-rose-700 dark:text-rose-400">
                      -{formatCurrency(expense.amount, settings.currency)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(expense)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Edit Expense"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpenseToDelete(expense)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL: ADD / EDIT EXPENSE */}
      {(isAddModalOpen || editingExpense) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 dark:text-slate-100 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingExpense ? 'Edit Expense Record' : 'Log New Schedule C Expense'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    IRS deductible for gig workers & rideshare drivers
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingExpense(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Amount ({settings.currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-500 text-sm">
                      {settings.currency}
                    </span>
                    <NumericInput
                      step="0.01"
                      min={0}
                      required
                      autoFocus
                      placeholder="0"
                      value={formData.amount}
                      onChange={val => setFormData({ ...formData, amount: String(val) })}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dateStr}
                    onChange={e => setFormData({ ...formData, dateStr: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Schedule C Category Selector */}
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  IRS Schedule C Category *
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value as ScheduleCCategory })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:border-emerald-500"
                >
                  {SCHEDULE_C_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title} — ({cat.scheduleCLine})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {getCategoryMeta(formData.category).description}
                </p>
              </div>

              {/* Platform selector */}
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Related App / Platform (Optional)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['All Platforms', 'Uber Rides', 'DoorDash', 'Lyft', 'Uber Eats', 'Instacart'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData({ ...formData, platform: p })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        formData.platform === p
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or custom app name"
                  value={formData.platform}
                  onChange={e => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Description / Notes */}
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Expense Description & Vendor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shell 12 gallons fuel, Best Buy phone mount, Valvoline synthetic"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Receipt Note & Photo Upload */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Receipt Documentation (Optional)
                </span>

                <input
                  type="text"
                  placeholder="Receipt number, invoice # or store reference"
                  value={formData.receiptNote}
                  onChange={e => setFormData({ ...formData, receiptNote: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{formData.receiptImage ? 'Replace Photo' : 'Attach Photo'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {formData.receiptImage && (
                    <div className="flex items-center gap-2">
                      <img
                        src={formData.receiptImage}
                        alt="Receipt preview"
                        className="w-8 h-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700 cursor-pointer"
                        onClick={() => setReceiptLightbox(formData.receiptImage)}
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, receiptImage: '' })}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingExpense(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {editingExpense ? 'Save Changes' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Delete Expense?</h4>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete this expense of{' '}
              <strong className="font-mono text-rose-600 dark:text-rose-400">
                {formatCurrency(expenseToDelete.amount, settings.currency)}
              </strong>{' '}
              ({getCategoryMeta(expenseToDelete.category).title}) on {expenseToDelete.dateStr}?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setExpenseToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteExpense(expenseToDelete.id);
                  setExpenseToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT LIGHTBOX MODAL */}
      {receiptLightbox && (
        <div
          onClick={() => setReceiptLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div className="relative max-w-2xl max-h-[90vh] p-2 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setReceiptLightbox(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={receiptLightbox}
              alt="Receipt full size"
              className="max-h-[85vh] w-auto mx-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
