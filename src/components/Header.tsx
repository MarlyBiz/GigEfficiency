/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Clock, 
  CalendarDays, 
  BarChart3, 
  FolderArchive, 
  History, 
  BrainCircuit, 
  Settings, 
  FileDown, 
  Sun, 
  Moon, 
  HelpCircle,
  Zap,
  Receipt
} from 'lucide-react';
import { ShiftState } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: 'tracker' | 'week' | 'analytics' | 'history' | 'periods' | 'expenses';
  setActiveTab: (tab: 'tracker' | 'week' | 'analytics' | 'history' | 'periods' | 'expenses') => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenExport?: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  shiftStatus?: ShiftState;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  onOpenHelp,
  onOpenExport,
  darkMode,
  onToggleDarkMode,
  shiftStatus = 'not_started',
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
                  Gig Efficiency Tracker
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                  Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                Multi-App $/Hour & Mileage Optimizer
              </p>
            </div>

            {/* Shift Status Badge */}
            {shiftStatus !== 'not_started' && shiftStatus !== 'ended' && (
              <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ml-2 ${
                shiftStatus === 'working'
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 animate-pulse'
                  : shiftStatus === 'on_break'
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                  : shiftStatus === 'heading_home'
                  ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-500/40'
                  : 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {shiftStatus === 'working'
                  ? 'Working (Earning)'
                  : shiftStatus === 'on_break'
                  ? 'On Break (Paused)'
                  : shiftStatus === 'heading_home'
                  ? 'Heading Home'
                  : 'Commuting to Hotspot'}
              </span>
            )}
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('tracker')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'tracker'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Live Shift</span>
            </button>

            <button
              onClick={() => setActiveTab('week')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'week'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>7-Day Week</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Charts</span>
            </button>

            <button
              onClick={() => setActiveTab('periods')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'periods'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>Closeouts & Tax</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'expenses'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Expenses</span>
            </button>
          </nav>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            <PWAInstallButton variant="compact" />

            {/* Help / Guide */}
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
              title="Driver Guide & Flow"
              aria-label="Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* Export PDF / CSV */}
            {onOpenExport && (
              <button
                onClick={onOpenExport}
                className="px-3 py-1.5 rounded-xl text-emerald-800 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                title="Export Statements (PDF & CSV)"
                aria-label="Export Statements"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
              title="Settings & Goals"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Sub-Navigation Bar */}
      <div className="lg:hidden flex items-center justify-between overflow-x-auto px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('tracker')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'tracker' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Live Shift</span>
        </button>

        <button
          onClick={() => setActiveTab('week')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'week' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>7-Day Week</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'analytics' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Charts</span>
        </button>

        <button
          onClick={() => setActiveTab('periods')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'periods' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5" />
          <span>Closeouts</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'expenses' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Expenses</span>
        </button>
      </div>
    </header>
  );
};
