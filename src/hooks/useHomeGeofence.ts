/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Watches location while a shift is running and the app is open. When the user comes back
 * inside the home radius after having been outside it, calls onArrivedHome() once per return.
 * Location never leaves the device.
 */

import { useEffect, useRef } from 'react';
import { HomeArea, distanceMeters } from '../utils/reminders';

const STATE_KEY = 'gig_tracker_geofence_state_v1';

interface FenceState {
  shiftStart: number; // which shift this state belongs to
  wasOutside: boolean; // been outside the radius since the last prompt
}

function loadState(shiftStart: number): FenceState {
  try {
    const p = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    if (p && p.shiftStart === shiftStart) return { shiftStart, wasOutside: !!p.wasOutside };
  } catch { /* ignore */ }
  return { shiftStart, wasOutside: false };
}
const saveState = (s: FenceState) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

/** Pure decision step (exported for tests). Returns the new state and whether to prompt. */
export function fenceStep(state: FenceState, dist: number, accuracy: number, radius: number): { state: FenceState; prompt: boolean } {
  // Hysteresis: only count "outside" once clearly past the radius (plus GPS error, capped), so jitter at the edge can't re-trigger.
  const margin = Math.min(Math.max(accuracy || 0, 50), 150);
  if (dist > radius + margin) return { state: { ...state, wasOutside: true }, prompt: false };
  if (dist <= radius && state.wasOutside) return { state: { ...state, wasOutside: false }, prompt: true };
  return { state, prompt: false };
}

export function useHomeGeofence(opts: { enabled: boolean; home: HomeArea | null; shiftStart: number | null; onArrivedHome: () => void }) {
  const { enabled, home, shiftStart } = opts;
  const cb = useRef(opts.onArrivedHome);
  cb.current = opts.onArrivedHome;

  useEffect(() => {
    if (!enabled || !home || !shiftStart || !('geolocation' in navigator)) return;
    let state = loadState(shiftStart);
    const id = navigator.geolocation.watchPosition(
      pos => {
        const dist = distanceMeters(pos.coords.latitude, pos.coords.longitude, home.lat, home.lon);
        const step = fenceStep(state, dist, pos.coords.accuracy, home.radius);
        if (step.state !== state) { state = step.state; saveState(state); }
        if (step.prompt) cb.current();
      },
      () => { /* permission denied or unavailable: silently do nothing */ },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 60000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, home?.lat, home?.lon, home?.radius, shiftStart]);
}
