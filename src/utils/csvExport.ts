/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DayRecord } from '../types';
import { formatDuration } from './calculations';

export function exportRecordsToCSV(records: DayRecord[], currency = '$', distanceUnit = 'miles'): void {
  if (!records || records.length === 0) {
    alert('No records available to export.');
    return;
  }

  // Collect all unique platforms
  const platformSet = new Set<string>();
  records.forEach(r => {
    r.platformEarnings.forEach(p => {
      if (p.name) platformSet.add(p.name);
    });
  });
  const platforms = Array.from(platformSet).sort();

  // CSV Headers
  const headers = [
    'Date',
    'Start Time',
    'End Time',
    'Total Shift Time (HH:MM:SS)',
    'Active Work Time (HH:MM:SS)',
    'Total Hours',
    'Work Hours',
    `Total Distance (${distanceUnit})`,
    `Work Distance (${distanceUnit})`,
    `Total Earnings (${currency})`,
    `Rate Total Time (${currency}/hr)`,
    `Rate Work Time (${currency}/hr)`,
    `Rate Total Distance (${currency}/${distanceUnit === 'km' ? 'km' : 'mi'})`,
    `Rate Work Distance (${currency}/${distanceUnit === 'km' ? 'km' : 'mi'})`,
    ...platforms.map(p => `${p} (${currency})`),
    'Notes',
  ];

  const rows: string[] = [];
  rows.push(headers.map(escapeCSVField).join(','));

  for (const r of records) {
    const startTimeStr = r.startTime ? new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const endTimeStr = r.endTime ? new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const platformAmounts = platforms.map(pName => {
      const found = r.platformEarnings.find(p => p.name === pName);
      return found ? found.amount.toFixed(2) : '0.00';
    });

    const row = [
      r.dateStr,
      startTimeStr,
      endTimeStr,
      formatDuration(r.totalSeconds),
      formatDuration(r.workSeconds),
      (r.totalSeconds / 3600).toFixed(2),
      (r.workSeconds / 3600).toFixed(2),
      r.totalMiles.toFixed(1),
      r.workMiles.toFixed(1),
      r.totalEarnings.toFixed(2),
      r.dollarsPerHourTotal.toFixed(2),
      r.dollarsPerHourWork.toFixed(2),
      r.dollarsPerMileTotal.toFixed(2),
      r.dollarsPerMileWork.toFixed(2),
      ...platformAmounts,
      r.notes || '',
    ];

    rows.push(row.map(escapeCSVField).join(','));
  }

  const csvContent = rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `gig_efficiency_log_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSVField(val: string | number): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}
