/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScheduleCCategory } from '../types';

export interface CategoryMeta {
  id: ScheduleCCategory;
  title: string;
  scheduleCLine: string;
  description: string;
  examples: string[];
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  textColor: string;
  badgeBg: string;
}

export const SCHEDULE_C_CATEGORIES: CategoryMeta[] = [
  {
    id: 'vehicle_car',
    title: 'Vehicle & Car Expenses',
    scheduleCLine: 'Line 9',
    description: 'Gas, fuel, oil changes, maintenance, repairs, tires, car washes, registration, business portion of insurance, depreciation notes.',
    examples: ['Gas / Fuel', 'Oil Change', 'Tires & Alignment', 'Car Wash & Detailing', 'Vehicle Registration', 'Routine Maintenance'],
    color: 'emerald',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/30',
    borderLight: 'border-emerald-200',
    borderDark: 'dark:border-emerald-500/30',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  },
  {
    id: 'platform_fees',
    title: 'Platform Fees & Commissions',
    scheduleCLine: 'Line 10',
    description: 'Uber/Lyft/DoorDash/etc. commissions, service fees, booking fees, driver background checks.',
    examples: ['Uber Service Fee', 'Lyft Platform Fee', 'DoorDash Commission', 'Driver Background Check Fee', 'Instant Cashout Fee'],
    color: 'blue',
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-950/30',
    borderLight: 'border-blue-200',
    borderDark: 'dark:border-blue-500/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    badgeBg: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  },
  {
    id: 'phone_data',
    title: 'Phone & Data (Utilities)',
    scheduleCLine: 'Line 25',
    description: 'Business portion of monthly phone bill, mobile data plan, and hotspot usage for navigation and dispatches.',
    examples: ['50% Monthly Cell Bill', 'Mobile 5G Hotspot Plan', 'Dedicated Dispatch Tablet SIM'],
    color: 'cyan',
    bgLight: 'bg-cyan-50',
    bgDark: 'dark:bg-cyan-950/30',
    borderLight: 'border-cyan-200',
    borderDark: 'dark:border-cyan-500/30',
    textColor: 'text-cyan-700 dark:text-cyan-400',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
  },
  {
    id: 'supplies_gear',
    title: 'Supplies & Gear',
    scheduleCLine: 'Line 22',
    description: 'Insulated bags, phone mounts, chargers, dashcams, hot/cold bags, passenger water/snacks, seat covers, hand sanitizer.',
    examples: ['Thermal Catering Bag', 'Phone Dash Mount', 'Dual Dashcam', 'Heavy Duty Charging Cable', 'Seat Protectors', 'Rider Mints & Water'],
    color: 'amber',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-950/30',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-500/30',
    textColor: 'text-amber-700 dark:text-amber-400',
    badgeBg: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  },
  {
    id: 'tolls_parking',
    title: 'Tolls & Parking',
    scheduleCLine: 'Schedule C (On Top of Mileage)',
    description: 'Business tolls and parking fees only (not parking tickets). IRS allows these on top of standard mileage deductions!',
    examples: ['Express Toll Lane', 'Airport Pickup Staging Parking', 'Downtown Metered Delivery Parking', 'Bridge Toll'],
    color: 'purple',
    bgLight: 'bg-purple-50',
    bgDark: 'dark:bg-purple-950/30',
    borderLight: 'border-purple-200',
    borderDark: 'dark:border-purple-500/30',
    textColor: 'text-purple-700 dark:text-purple-400',
    badgeBg: 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
  },
  {
    id: 'insurance',
    title: 'Insurance',
    scheduleCLine: 'Line 15',
    description: 'Business-related insurance premiums (rideshare endorsement, commercial delivery policy, excess liability).',
    examples: ['Rideshare Gap Endorsement', 'Commercial Auto Policy Rider', 'Excess Umbrella Liability'],
    color: 'rose',
    bgLight: 'bg-rose-50',
    bgDark: 'dark:bg-rose-950/30',
    borderLight: 'border-rose-200',
    borderDark: 'dark:border-rose-500/30',
    textColor: 'text-rose-700 dark:text-rose-400',
    badgeBg: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  },
  {
    id: 'repairs_maintenance',
    title: 'Repairs & Maintenance',
    scheduleCLine: 'Line 21',
    description: 'Non-vehicle business equipment repairs or vehicle maintenance if tracking actual vehicle expenses instead of standard mileage.',
    examples: ['Dashcam Lens Repair', 'Phone Screen Repair for Dispatches', 'Tire Patch & Plug'],
    color: 'indigo',
    bgLight: 'bg-indigo-50',
    bgDark: 'dark:bg-indigo-950/30',
    borderLight: 'border-indigo-200',
    borderDark: 'dark:border-indigo-500/30',
    textColor: 'text-indigo-700 dark:text-indigo-400',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
  },
  {
    id: 'other_expenses',
    title: 'Other Expenses',
    scheduleCLine: 'Line 27',
    description: 'Ordinary and necessary expenses that don’t fit above (tax prep software portion, accounting fees, music streaming for riders).',
    examples: ['TurboTax / CPA Fee Portion', 'Spotify Premium for Passengers', 'Mileage Log Subscription', 'Roadside Assistance (AAA) Portion'],
    color: 'slate',
    bgLight: 'bg-slate-50',
    bgDark: 'dark:bg-slate-900',
    borderLight: 'border-slate-200',
    borderDark: 'dark:border-slate-800',
    textColor: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
  },
];

export function getCategoryMeta(categoryId: ScheduleCCategory): CategoryMeta {
  const found = SCHEDULE_C_CATEGORIES.find(c => c.id === categoryId);
  return found || SCHEDULE_C_CATEGORIES[SCHEDULE_C_CATEGORIES.length - 1];
}
