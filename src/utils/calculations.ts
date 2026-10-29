/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActiveSession } from '../types';

export function getSessionTimes(
  session: ActiveSession,
  now: number = Date.now()
): { totalSeconds: number; workSeconds: number; breakSeconds: number } {
  if (!session.startDayTimestamp) {
    return { totalSeconds: 0, workSeconds: 0, breakSeconds: 0 };
  }

  // 1. Total Shift Time
  const endPoint = session.endDayTimestamp || now;
  const rawTotalSec = Math.max(0, Math.floor((endPoint - session.startDayTimestamp) / 1000));
  const totalSeconds = Math.max(0, rawTotalSec + (session.manualAdjustmentSeconds || 0));

  // 2. Active Work Time (sum of all segments)
  let rawWorkSec = 0;
  for (const seg of session.workSegments || []) {
    const segEnd = seg.endTime || (session.status === 'working' ? now : seg.startTime);
    rawWorkSec += Math.max(0, Math.floor((segEnd - seg.startTime) / 1000));
  }
  const workSeconds = Math.max(0, rawWorkSec + (session.manualWorkAdjustmentSeconds || 0));

  // 3. Break Time (sum of break segments)
  let rawBreakSec = 0;
  for (const seg of session.breakSegments || []) {
    const segEnd = seg.endTime || (session.status === 'on_break' ? now : seg.startTime);
    rawBreakSec += Math.max(0, Math.floor((segEnd - seg.startTime) / 1000));
  }
  const breakSeconds = Math.max(0, rawBreakSec);

  return { totalSeconds, workSeconds, breakSeconds };
}

export function formatDuration(seconds: number, includeSeconds: boolean = false): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (includeSeconds) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function formatCurrency(amount: number, currency: string = '$'): string {
  if (isNaN(amount)) return `${currency}0.00`;
  return `${currency}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRate(rate: number, currency: string = '$', unit: string = 'hr'): string {
  if (isNaN(rate) || !isFinite(rate)) return `${currency}0.00/${unit}`;
  return `${currency}${rate.toFixed(2)}/${unit}`;
}

/**
 * Returns date string YYYY-MM-DD shifted by the user's dayCutoffHour (e.g. 4am).
 * If it is 2:00 AM on Oct 29 and cutoff is 4 AM, it still belongs to Oct 28.
 */
export function getEffectiveDateString(timestamp: number, cutoffHour: number = 0): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  
  if (hours < cutoffHour) {
    date.setDate(date.getDate() - 1);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekBoundaries(
  referenceDate: Date,
  weekStartDay: number = 1, // 1 = Monday, 0 = Sunday
  cutoffHour: number = 4
): { startDate: Date; endDate: Date; days: string[] } {
  const d = new Date(referenceDate);
  if (d.getHours() < cutoffHour) {
    d.setDate(d.getDate() - 1);
  }

  const currentDay = d.getDay(); // 0 is Sunday
  let diff = (currentDay - weekStartDay + 7) % 7;
  
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(cutoffHour, 0, 0, 0);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i);
    const y = dayDate.getFullYear();
    const m = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dayNum = String(dayDate.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${dayNum}`);
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(-1);

  return { startDate: start, endDate: end, days };
}
