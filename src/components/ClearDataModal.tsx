/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, X } from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: () => void;
  totalRecordsCount: number;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
  totalRecordsCount,
}) => {
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = confirmInput.trim() === 'DELETE';

  const handleExecuteClear = () => {
    if (!isConfirmed) return;
    onConfirmClear();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border-2 border-rose-500/80 dark:border-rose-600/60 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-900 dark:text-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header with warning icon */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-lg shadow-rose-950/20">
              <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Permanently Delete All Data?</h3>
              <p className="text-xs text-rose-600 dark:text-rose-400/90 font-medium mt-0.5">
                Destructive action • Irreversible
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning details */}
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl space-y-2 text-xs text-rose-900 dark:text-rose-200/90">
          <p className="font-semibold text-rose-700 dark:text-rose-300">
            This permanently deletes all shifts and history ({totalRecordsCount} {totalRecordsCount === 1 ? 'shift' : 'shifts'} logged).
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800 dark:text-rose-200/80">
            <li>All historical day records & earnings will be purged</li>
            <li>All Schedule C expense records and receipts will be cleared</li>
            <li>All mileage and tax write-off logs will be deleted</li>
            <li>Any active shift clock and break timers will be reset to 0</li>
            <li>All views and comparison charts will reset to empty</li>
          </ul>
        </div>

        {/* Confirmation Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Type <span className="font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-900">DELETE</span> to confirm:
          </label>
          <input
            type="text"
            autoFocus
            value={confirmInput}
            onChange={e => setConfirmInput(e.target.value)}
            placeholder="Type DELETE to confirm"
            className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm font-mono tracking-wider text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none transition-colors ${
              isConfirmed
                ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-200 focus:border-rose-400'
                : 'border-slate-300 dark:border-slate-700 focus:border-slate-500'
            }`}
          />
          {confirmInput.length > 0 && !isConfirmed && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              Must be exactly uppercase "DELETE"
            </p>
          )}
          {isConfirmed && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
              <span>✓ Confirmation verified. Proceeding will wipe all data.</span>
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteClear}
            disabled={!isConfirmed}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isConfirmed
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 active:scale-95'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700/50 cursor-not-allowed opacity-60'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Wipe All Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
