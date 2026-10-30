/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The user's app list (settings.defaultPlatforms) and its per-app cutoffs. The same list feeds
 * Edit Shift's "+ Add app". Removing an app here never touches saved shift earnings.
 */
import { AppSettings } from '../types';
import { defaultRuleForApp, normalizeCutoffs } from './workday';

export const COMMON_GIG_APPS = ['Uber Rides', 'Uber Eats', 'DoorDash', 'Lyft', 'Instacart', 'Grubhub', 'Amazon Flex', 'Spark'];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Common apps not already in the list (case-insensitive). */
export function suggestableApps(settings: AppSettings): string[] {
  const have = settings.defaultPlatforms || [];
  return COMMON_GIG_APPS.filter(a => !have.some(h => same(h, a)));
}

/** Add an app with its default cutoff (Uber apps 4:00 AM / Mon 4:00 AM, others midnight / Mon 12:00 AM). */
export function addAppToSettings(settings: AppSettings, rawName: string): AppSettings {
  const name = rawName.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) throw new Error('Enter an app name.');
  const have = settings.defaultPlatforms || [];
  if (have.some(h => same(h, name))) throw new Error(`${name} is already in the list.`);
  const cutoffs = settings.cutoffs || normalizeCutoffs(settings);
  return {
    ...settings,
    defaultPlatforms: [...have, name],
    cutoffs: { ...cutoffs, apps: { ...cutoffs.apps, [name]: defaultRuleForApp(name) } },
  };
}

/** Remove an app from the list and its cutoff rule only. History is not touched. */
export function removeAppFromSettings(settings: AppSettings, name: string): AppSettings {
  const have = settings.defaultPlatforms || [];
  if (have.length <= 1) throw new Error('Keep at least one app.');
  const cutoffs = settings.cutoffs || normalizeCutoffs(settings);
  const apps = { ...cutoffs.apps };
  delete apps[name];
  return { ...settings, defaultPlatforms: have.filter(h => h !== name), cutoffs: { ...cutoffs, apps } };
}
