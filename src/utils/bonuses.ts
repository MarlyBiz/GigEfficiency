/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BonusType } from '../types';

export interface BonusTypeMeta {
  id: BonusType;
  title: string;
  defaultPlatform: string;
  description: string;
  exampleNote: string;
  badgeBg: string;
  badgeText: string;
}

export const BONUS_TYPES: BonusTypeMeta[] = [
  {
    id: 'uber_quest',
    title: 'Uber Quest',
    defaultPlatform: 'Uber Rides',
    description: 'Complete a target number of trips within a specific timeframe (e.g. 50 trips for $120).',
    exampleNote: 'Weekend Quest Tier 2: 50 trips for $120',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
  },
  {
    id: 'lyft_challenge',
    title: 'Lyft Ride / Earnings Challenge',
    defaultPlatform: 'Lyft',
    description: 'Tiered ride goal or weekly bonus challenge for Lyft drivers.',
    exampleNote: 'Weekday Ride Challenge: 35 rides for $85',
    badgeBg: 'bg-pink-100 dark:bg-pink-950/80 border-pink-300 dark:border-pink-800',
    badgeText: 'text-pink-800 dark:text-pink-300',
  },
  {
    id: 'doordash_challenge',
    title: 'DoorDash Challenge',
    defaultPlatform: 'DoorDash',
    description: 'Complete target delivery batches during designated days or peak hours.',
    exampleNote: 'Dinner Rush Challenge: 15 deliveries for $40',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800',
    badgeText: 'text-rose-800 dark:text-rose-300',
  },
  {
    id: 'peak_pay_boost',
    title: 'Peak Pay / Turbo / Boost / Surge',
    defaultPlatform: 'DoorDash',
    description: 'High-demand surge, multiplier boost, or hourly turbo guarantee extra payout.',
    exampleNote: 'Downtown Peak Pay (+$3.50/order x 8)',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800',
    badgeText: 'text-amber-800 dark:text-amber-300',
  },
  {
    id: 'streak',
    title: 'Consecutive Trip Streak',
    defaultPlatform: 'Uber Rides',
    description: 'Accept and complete consecutive trips in a row without declining or going offline.',
    exampleNote: '3-in-a-row Streak Bonus: $18.00',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/80 border-blue-300 dark:border-blue-800',
    badgeText: 'text-blue-800 dark:text-blue-300',
  },
  {
    id: 'guarantee',
    title: 'Earnings / New-Driver Guarantee',
    defaultPlatform: 'Uber Rides',
    description: 'Top-up adjustment from the platform making up the difference for a guaranteed threshold.',
    exampleNote: 'First Month 100-trip $1,500 guarantee top-up',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/80 border-purple-300 dark:border-purple-800',
    badgeText: 'text-purple-800 dark:text-purple-300',
  },
  {
    id: 'other_custom',
    title: 'Other / Custom Platform Bonus',
    defaultPlatform: 'General',
    description: 'Any customer referral, cancellation reimbursement, holiday incentive, or custom bonus.',
    exampleNote: 'Driver referral bonus or weather incentive',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
    badgeText: 'text-slate-800 dark:text-slate-300',
  },
];

export function getBonusTypeMeta(type: BonusType): BonusTypeMeta {
  const found = BONUS_TYPES.find(b => b.id === type);
  return found || BONUS_TYPES[BONUS_TYPES.length - 1];
}
