/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActiveSession, AppGoals, AppSettings, DayRecord, ExpenseRecord } from '../types';
import { getEffectiveDateString } from './calculations';
import { normalizeCutoffs } from './workday';

export const DEFAULT_GOALS: AppGoals = {
  dailyEarnings: 150,
  hourlyRate: 25,
  weeklyEarnings: 800,
  monthlyEarnings: 3500,
  yearlyEarnings: 45000,
  activeTrackerGoal: 'earnings',
};

export const DEFAULT_SETTINGS: AppSettings = {
  dayCutoffHour: 4, // 4:00 AM cutoff common for rideshare/delivery
  weekStartDay: 1, // Monday
  monthStartDay: 1,
  currency: '$',
  defaultPlatforms: ['Uber Rides', 'DoorDash', 'Lyft', 'Uber Eats'],
  standardMileageRate: 0.67, // 2024 IRS standard rate
  darkMode: false, // Default to light mode (user requested light gray background)
  goals: DEFAULT_GOALS,
  cutoffs: normalizeCutoffs({ dayCutoffHour: 4, weekStartDay: 1 }),
};

/** Keep the legacy hour/week fields in step with the default cutoff rule. */
export function withCutoffs(s: AppSettings): AppSettings {
  const cutoffs = normalizeCutoffs(s);
  return { ...s, cutoffs, dayCutoffHour: Math.floor(cutoffs.default.dayMinutes / 60), weekStartDay: cutoffs.default.weekStartDay };
}

export const STORAGE_KEYS = {
  ACTIVE_SESSION: 'gig_tracker_active_session',
  HISTORY: 'gig_tracker_history_records',
  SETTINGS: 'gig_tracker_settings',
  ONBOARDED: 'gig_tracker_has_onboarded', // welcome seen & dismissed for good (finished or "Don't show again")
  SAMPLES_SEEDED: 'gig_tracker_samples_seeded',
  EXPENSES: 'gig_tracker_expenses',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    return withCutoffs({
      ...DEFAULT_SETTINGS,
      ...parsed,
      cutoffs: parsed.cutoffs,
      defaultPlatforms: Array.isArray(parsed.defaultPlatforms) && parsed.defaultPlatforms.length > 0
        ? parsed.defaultPlatforms
        : DEFAULT_SETTINGS.defaultPlatforms,
      goals: {
        ...DEFAULT_GOALS,
        ...(parsed.goals || {}),
      },
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage', e);
  }
}

export function createInitialSession(settings?: AppSettings): ActiveSession {
  const safePlatforms = Array.isArray(settings?.defaultPlatforms) && settings.defaultPlatforms.length > 0
    ? settings.defaultPlatforms
    : ['Uber Rides', 'DoorDash', 'Lyft', 'Uber Eats'];

  return {
    status: 'not_started',
    startDayTimestamp: null,
    startWorkTimestamp: null,
    endDayTimestamp: null,
    workSegments: [],
    breakSegments: [],
    manualAdjustmentSeconds: 0,
    manualWorkAdjustmentSeconds: 0,
    cashTips: 0,
    platformEarnings: safePlatforms.map((name, idx) => ({
      id: `${String(name).toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}-${idx}`,
      name: String(name),
      amount: 0,
    })),
    bonusEarnings: [],
    totalMiles: 0,
    workMiles: 0,
    notes: '',
  };
}

export function loadActiveSession(settings: AppSettings): ActiveSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (!raw) return createInitialSession(settings);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createInitialSession(settings);

    const initial = createInitialSession(settings);
    return {
      ...initial,
      ...parsed,
      status: parsed.status || 'not_started',
      workSegments: Array.isArray(parsed.workSegments) ? parsed.workSegments : [],
      breakSegments: Array.isArray(parsed.breakSegments) ? parsed.breakSegments : [],
      platformEarnings: Array.isArray(parsed.platformEarnings) && parsed.platformEarnings.length > 0
        ? parsed.platformEarnings.map((p: any, idx: number) => ({
            id: p?.id && p.id !== 'slot' ? String(p.id) : `slot-${idx}-${Date.now()}-${Math.random()}`,
            name: p?.name || 'Platform',
            amount: Number(p?.amount) || 0,
          }))
        : initial.platformEarnings,
      bonusEarnings: Array.isArray(parsed.bonusEarnings)
        ? parsed.bonusEarnings.map((b: any, idx: number) => ({
            id: b?.id ? String(b.id) : `bonus-${idx}-${Date.now()}-${Math.random()}`,
            platform: b?.platform || 'Uber Rides',
            bonusType: b?.bonusType || 'uber_quest',
            amount: Number(b?.amount) || 0,
            dateStr: b?.dateStr || new Date().toISOString().slice(0, 10),
            dateRangeEnd: b?.dateRangeEnd || '',
            notes: b?.notes || '',
            createdAt: Number(b?.createdAt) || Date.now(),
          }))
        : [],
      totalMiles: Number(parsed.totalMiles) || 0,
      workMiles: Number(parsed.workMiles) || 0,
      notes: parsed.notes || '',
    };
  } catch {
    return createInitialSession(settings);
  }
}

export function saveActiveSession(session: ActiveSession): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save session to localStorage', e);
  }
}

export function loadHistory(): DayRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: any, rIdx: number) => {
      const platformEarnings = Array.isArray(r?.platformEarnings)
        ? r.platformEarnings.map((p: any, pIdx: number) => ({
            id: p?.id && p.id !== 'slot' ? `${p.id}-${pIdx}` : `slot-${pIdx}-${Math.random()}`,
            name: p?.name || 'Platform',
            amount: Number(p?.amount) || 0,
          }))
        : [];

      const bonusEarnings = Array.isArray(r?.bonusEarnings)
        ? r.bonusEarnings.map((b: any, bIdx: number) => ({
            id: b?.id ? String(b.id) : `bonus-hist-${bIdx}-${Date.now()}-${Math.random()}`,
            platform: b?.platform || 'Uber Rides',
            bonusType: b?.bonusType || 'other_custom',
            amount: Number(b?.amount) || 0,
            dateStr: b?.dateStr || r?.dateStr || new Date().toISOString().slice(0, 10),
            dateRangeEnd: b?.dateRangeEnd || '',
            notes: b?.notes || '',
            createdAt: Number(b?.createdAt) || Date.now(),
          }))
        : [];

      const baseEarnings = platformEarnings.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const totalBonusEarnings = bonusEarnings.reduce((s: number, b: any) => s + (b.amount || 0), 0);
      const cashTips = Math.max(0, Number(r?.cashTips) || 0); // older records: 0
      const totalEarnings = Number(r?.totalEarnings) || (baseEarnings + totalBonusEarnings + cashTips);

      // Catch-up summaries keep their kind + period; anything else is a normal day
      const kind = r?.kind === 'month' || r?.kind === 'year' ? r.kind : undefined;
      return {
        id: r?.id ? String(r.id) : `shift-${Date.now()}-${rIdx}-${Math.random()}`,
        ...(kind ? { kind, periodKey: String(r.periodKey || '') } : {}),
        dateStr: r?.dateStr || new Date().toISOString().slice(0, 10),
        startTime: Number(r?.startTime) || Date.now(),
        endTime: Number(r?.endTime) || Date.now(),
        totalSeconds: Number(r?.totalSeconds) || 0,
        workSeconds: Number(r?.workSeconds) || 0,
        totalMiles: Number(r?.totalMiles) || 0,
        workMiles: Number(r?.workMiles) || 0,
        platformEarnings,
        bonusEarnings,
        baseEarnings,
        totalBonusEarnings,
        cashTips,
        totalEarnings,
        dollarsPerHourTotal: Number(r?.dollarsPerHourTotal) || 0,
        dollarsPerHourWork: Number(r?.dollarsPerHourWork) || 0,
        dollarsPerMileTotal: Number(r?.dollarsPerMileTotal) || 0,
        dollarsPerMileWork: Number(r?.dollarsPerMileWork) || 0,
        notes: r?.notes || '',
        createdAt: Number(r?.createdAt) || Date.now(),
        ...(Array.isArray(r?.mergedFrom) ? { mergedFrom: r.mergedFrom.map(String) } : {}),
      };
    });
  } catch {
    return [];
  }
}

export function saveHistory(records: DayRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save history to localStorage', e);
  }
}

export function loadHasOnboarded(): boolean {
  return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';
}

export function setHasOnboarded(value: boolean): void {
  localStorage.setItem(STORAGE_KEYS.ONBOARDED, String(value));
}

/** Sample data is only ever seeded once, even if the welcome keeps showing on later launches. */
export function loadSamplesSeeded(): boolean {
  return localStorage.getItem(STORAGE_KEYS.SAMPLES_SEEDED) === 'true';
}

export function setSamplesSeeded(): void {
  localStorage.setItem(STORAGE_KEYS.SAMPLES_SEEDED, 'true');
}

export function addDayRecord(record: DayRecord): DayRecord[] {
  const current = loadHistory();
  // If an existing record for the same ID exists, update it; otherwise prepend
  const existingIdx = current.findIndex(r => r.id === record.id);
  let updated: DayRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = record;
  } else {
    updated = [record, ...current];
  }
  saveHistory(updated);
  return updated;
}

export function updateDayRecord(record: DayRecord): DayRecord[] {
  const current = loadHistory();
  const updated = current.map(r => (r.id === record.id ? record : r));
  saveHistory(updated);
  return updated;
}

export function deleteDayRecord(id: string): DayRecord[] {
  const current = loadHistory();
  const updated = current.filter(r => r.id !== id);
  saveHistory(updated);
  return updated;
}

/**
 * Generates 14 realistic sample gig driver shifts for initial exploration
 */
export function generateSampleData(settings: AppSettings): DayRecord[] {
  const records: DayRecord[] = [];
  const baseTime = Date.now();
  const DAY_MS = 24 * 3600 * 1000;

  const sampleDays = [
    { daysAgo: 1, totalHours: 6.5, workHours: 5.2, totalMiles: 110, workMiles: 92, uber: 112, doordash: 68, notes: 'Great dinner surge & tips' },
    { daysAgo: 2, totalHours: 5.0, workHours: 4.1, totalMiles: 85, workMiles: 74, uber: 82, doordash: 44, notes: 'Rainy afternoon airport runs' },
    { daysAgo: 3, totalHours: 7.2, workHours: 5.8, totalMiles: 130, workMiles: 108, uber: 134, doordash: 75, notes: 'Friday night bar rush' },
    { daysAgo: 4, totalHours: 8.0, workHours: 6.5, totalMiles: 145, workMiles: 122, uber: 165, doordash: 90, notes: 'Saturday all-day double shift' },
    { daysAgo: 5, totalHours: 4.5, workHours: 3.5, totalMiles: 70, workMiles: 58, uber: 68, doordash: 42, notes: 'Sunday evening football rush' },
    { daysAgo: 6, totalHours: 3.8, workHours: 2.9, totalMiles: 60, workMiles: 48, uber: 55, doordash: 32, notes: 'Slow Monday lunch' },
    { daysAgo: 8, totalHours: 5.8, workHours: 4.7, totalMiles: 95, workMiles: 80, uber: 98, doordash: 52, notes: 'Midweek airport queue' },
    { daysAgo: 9, totalHours: 6.2, workHours: 5.0, totalMiles: 105, workMiles: 88, uber: 104, doordash: 61, notes: 'Steady trips' },
    { daysAgo: 10, totalHours: 7.5, workHours: 6.1, totalMiles: 138, workMiles: 115, uber: 148, doordash: 82, notes: 'High surge evening' },
    { daysAgo: 11, totalHours: 8.5, workHours: 7.0, totalMiles: 160, workMiles: 135, uber: 185, doordash: 95, notes: 'Concert event downtown' },
    { daysAgo: 12, totalHours: 5.2, workHours: 4.0, totalMiles: 88, workMiles: 72, uber: 86, doordash: 45, notes: 'Afternoon dispatches' },
    { daysAgo: 14, totalHours: 6.0, workHours: 4.8, totalMiles: 102, workMiles: 85, uber: 108, doordash: 54, notes: 'Solid delivery stacking' },
  ];

  for (const s of sampleDays) {
    const shiftStartTime = baseTime - s.daysAgo * DAY_MS + 14 * 3600 * 1000;
    const dateStr = getEffectiveDateString(shiftStartTime, settings.dayCutoffHour);
    const totalSeconds = Math.round(s.totalHours * 3600);
    const workSeconds = Math.round(s.workHours * 3600);
    const shiftEndTime = shiftStartTime + totalSeconds * 1000;
    const totalEarnings = s.uber + s.doordash;

    records.push({
      id: `sample-${dateStr}-${s.daysAgo}`,
      dateStr,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      totalSeconds,
      workSeconds,
      totalMiles: s.totalMiles,
      workMiles: s.workMiles,
      platformEarnings: [
        { id: `sample-${dateStr}-${s.daysAgo}-uber`, name: 'Uber Rides', amount: s.uber },
        { id: `sample-${dateStr}-${s.daysAgo}-doordash`, name: 'DoorDash', amount: s.doordash },
      ],
      totalEarnings,
      dollarsPerHourTotal: Number((totalEarnings / s.totalHours).toFixed(2)),
      dollarsPerHourWork: Number((totalEarnings / s.workHours).toFixed(2)),
      dollarsPerMileTotal: Number((totalEarnings / s.totalMiles).toFixed(2)),
      dollarsPerMileWork: Number((totalEarnings / s.workMiles).toFixed(2)),
      notes: s.notes,
      createdAt: shiftStartTime,
    });
  }

  return records;
}

export function loadExpenses(): ExpenseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: any, idx: number) => ({
      id: e?.id ? String(e.id) : `exp-${Date.now()}-${idx}-${Math.random()}`,
      dateStr: e?.dateStr || new Date().toISOString().slice(0, 10),
      amount: Number(e?.amount) || 0,
      category: e?.category || 'other_expenses',
      platform: e?.platform || '',
      notes: e?.notes || '',
      receiptImage: e?.receiptImage || '',
      receiptNote: e?.receiptNote || '',
      createdAt: Number(e?.createdAt) || Date.now(),
    }));
  } catch {
    return [];
  }
}

export function saveExpenses(expenses: ExpenseRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  } catch (e) {
    console.error('Failed to save expenses to localStorage', e);
  }
}

export function addExpense(expense: ExpenseRecord): ExpenseRecord[] {
  const current = loadExpenses();
  const existingIdx = current.findIndex(e => e.id === expense.id);
  let updated: ExpenseRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = expense;
  } else {
    updated = [expense, ...current];
  }
  saveExpenses(updated);
  return updated;
}

export function updateExpense(expense: ExpenseRecord): ExpenseRecord[] {
  const current = loadExpenses();
  const updated = current.map(e => (e.id === expense.id ? expense : e));
  saveExpenses(updated);
  return updated;
}

export function deleteExpense(id: string): ExpenseRecord[] {
  const current = loadExpenses();
  const updated = current.filter(e => e.id !== id);
  saveExpenses(updated);
  return updated;
}

export function generateSampleExpenses(settings: AppSettings): ExpenseRecord[] {
  const baseTime = Date.now();
  const DAY_MS = 24 * 3600 * 1000;
  return [
    {
      id: 'sample-exp-1',
      dateStr: getEffectiveDateString(baseTime - 1 * DAY_MS, settings.dayCutoffHour),
      amount: 48.50,
      category: 'vehicle_car',
      platform: 'All Platforms',
      notes: 'Full tank regular unleaded (Shell)',
      receiptNote: 'Shell Pump #4',
      createdAt: baseTime - 1 * DAY_MS,
    },
    {
      id: 'sample-exp-2',
      dateStr: getEffectiveDateString(baseTime - 3 * DAY_MS, settings.dayCutoffHour),
      amount: 8.75,
      category: 'tolls_parking',
      platform: 'Uber Rides',
      notes: 'Express toll lane to airport dispatch',
      receiptNote: 'FastTrak Toll',
      createdAt: baseTime - 3 * DAY_MS,
    },
    {
      id: 'sample-exp-3',
      dateStr: getEffectiveDateString(baseTime - 4 * DAY_MS, settings.dayCutoffHour),
      amount: 32.99,
      category: 'supplies_gear',
      platform: 'DoorDash',
      notes: 'Commercial insulated thermal catering hot/cold bag',
      receiptNote: 'Amazon Order #114-88',
      createdAt: baseTime - 4 * DAY_MS,
    },
    {
      id: 'sample-exp-4',
      dateStr: getEffectiveDateString(baseTime - 6 * DAY_MS, settings.dayCutoffHour),
      amount: 45.00,
      category: 'phone_data',
      platform: 'All Platforms',
      notes: '50% business portion of unlimited mobile hotspot & 5G plan',
      receiptNote: 'Verizon Monthly Bill',
      createdAt: baseTime - 6 * DAY_MS,
    },
    {
      id: 'sample-exp-5',
      dateStr: getEffectiveDateString(baseTime - 8 * DAY_MS, settings.dayCutoffHour),
      amount: 62.40,
      category: 'vehicle_car',
      platform: 'All Platforms',
      notes: 'Full synthetic oil change & 21-point multi-inspection',
      receiptNote: 'Valvoline Instant Oil',
      createdAt: baseTime - 8 * DAY_MS,
    },
    {
      id: 'sample-exp-6',
      dateStr: getEffectiveDateString(baseTime - 10 * DAY_MS, settings.dayCutoffHour),
      amount: 35.00,
      category: 'insurance',
      platform: 'Uber / Lyft',
      notes: 'Monthly rideshare gap endorsement policy',
      receiptNote: 'Geico Commercial Endorsement',
      createdAt: baseTime - 10 * DAY_MS,
    },
    {
      id: 'sample-exp-7',
      dateStr: getEffectiveDateString(baseTime - 12 * DAY_MS, settings.dayCutoffHour),
      amount: 14.50,
      category: 'platform_fees',
      platform: 'Uber Rides',
      notes: 'Annual driver background check verification fee',
      receiptNote: 'Checkr / Uber statement',
      createdAt: baseTime - 12 * DAY_MS,
    },
    {
      id: 'sample-exp-8',
      dateStr: getEffectiveDateString(baseTime - 14 * DAY_MS, settings.dayCutoffHour),
      amount: 19.99,
      category: 'supplies_gear',
      platform: 'General',
      notes: 'MagSafe wireless car charger phone mount',
      receiptNote: 'Best Buy #401',
      createdAt: baseTime - 14 * DAY_MS,
    },
  ];
}
