/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ShiftState = 
  | 'not_started' 
  | 'commuting' 
  | 'working' 
  | 'on_break' 
  | 'heading_home' 
  | 'ended';

export interface WorkSegment {
  startTime: number;
  endTime?: number;
}

export interface BreakSegment {
  startTime: number;
  endTime?: number;
}

export interface PlatformSlot {
  id: string;
  name: string;
  amount: number;
}

export type BonusType =
  | 'uber_quest'
  | 'lyft_challenge'
  | 'doordash_challenge'
  | 'peak_pay_boost'
  | 'streak'
  | 'guarantee'
  | 'other_custom';

export interface BonusEntry {
  id: string;
  platform: string; // e.g. 'Uber Rides', 'Lyft', 'DoorDash', 'Uber Eats', custom
  bonusType: BonusType;
  amount: number;
  dateStr: string; // YYYY-MM-DD
  dateRangeEnd?: string; // Optional end date for multi-day quests (e.g. Fri-Sun)
  notes?: string; // e.g. "50 trips for $120" or "Weekend Quest tier 2"
  createdAt: number;
}

export interface ActiveSession {
  status: ShiftState;
  startDayTimestamp: number | null;
  startWorkTimestamp: number | null;
  endDayTimestamp: number | null;
  workSegments: WorkSegment[];
  breakSegments: BreakSegment[];
  manualAdjustmentSeconds: number;
  manualWorkAdjustmentSeconds: number;
  platformEarnings: PlatformSlot[];
  bonusEarnings: BonusEntry[];
  totalMiles: number;
  workMiles: number;
  notes: string;
}

/** 'day' = a real shift (default when missing); 'month' / 'year' = catch-up totals for a past period. */
export type RecordKind = 'day' | 'month' | 'year';

export interface DayRecord {
  id: string;
  kind?: RecordKind;
  periodKey?: string; // 'YYYY-MM' for month summaries, 'YYYY' for year summaries
  dateStr: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  totalSeconds: number;
  workSeconds: number;
  totalMiles: number;
  workMiles: number;
  platformEarnings: PlatformSlot[];
  bonusEarnings?: BonusEntry[];
  baseEarnings?: number;
  totalBonusEarnings?: number;
  totalEarnings: number;
  dollarsPerHourTotal: number;
  dollarsPerHourWork: number;
  dollarsPerMileTotal: number;
  dollarsPerMileWork: number;
  notes: string;
  createdAt: number;
}

export interface AppGoals {
  dailyEarnings: number; // e.g. 150 ($/day)
  hourlyRate: number; // e.g. 25 ($/hr active work)
  weeklyEarnings: number; // e.g. 800 ($/wk)
  monthlyEarnings: number; // e.g. 3500 ($/mo)
  yearlyEarnings: number; // e.g. 45000 ($/yr)
  activeTrackerGoal: 'earnings' | 'rate'; // which metric is featured in active shift progress
}

export interface AppSettings {
  dayCutoffHour: number; // 0-23 (e.g., 4 for 4:00 AM cutoff)
  weekStartDay: number; // 0 for Sunday, 1 for Monday
  monthStartDay: number; // 1-31 (e.g., 1 for 1st of month)
  currency: string; // '$', '£', '€', 'C$', etc.
  defaultPlatforms: string[];
  standardMileageRate: number; // e.g., 0.67 for 2024 IRS rate
  darkMode: boolean;
  goals: AppGoals;
}

export type ScheduleCCategory =
  | 'vehicle_car' // Line 9: gas, oil changes, maintenance, repairs, tires, car washes, registration, business insurance portion
  | 'platform_fees' // Line 10: Uber/Lyft/DoorDash/etc. commissions, service fees, booking fees, background checks
  | 'phone_data' // Line 25 Utilities: business portion of phone bill & mobile data plan
  | 'supplies_gear' // Line 22: insulated bags, phone mounts, chargers, dashcams, hot/cold bags, rider snacks/water, seat covers
  | 'tolls_parking' // Tolls & Parking: deductible on top of standard mileage (business tolls & parking fees, not tickets)
  | 'insurance' // Line 15: business-related insurance (rideshare endorsement, commercial policy)
  | 'repairs_maintenance' // Line 21: non-vehicle repairs or vehicle maintenance if tracking actual expenses
  | 'other_expenses'; // Line 27: ordinary & necessary expenses (tax software portion, music subscription for riders)

export interface ExpenseRecord {
  id: string;
  dateStr: string; // YYYY-MM-DD
  amount: number;
  category: ScheduleCCategory;
  platform?: string; // e.g. Uber, DoorDash, Lyft, General
  notes?: string;
  receiptImage?: string; // optional base64 image dataUrl
  receiptNote?: string; // optional receipt number or reference
  createdAt: number;
}

