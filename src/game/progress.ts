/**
 * progress.ts — which zoom levels the player has opened (STORY-026).
 *
 * The game starts locked to the city-area level. Mapping UNLOCK_SHARE of the home
 * province opens the province level, and the same share of the home state opens the
 * state level. The planet opens when the home state is held (after the MVP).
 */
export const UNLOCK_SHARE = 0.6;

export interface Progress {
  /** Deepest zoom-out level open to the player: 3 city area, 2 province, 1 state. */
  openLevel: number;
  /** The province or state whose mapping the meter shows now. */
  meter: 'province' | 'state' | 'done';
}

export function startProgress(): Progress {
  return { openLevel: 3, meter: 'province' };
}

/**
 * Update the progress from the mapped shares of the home province and state.
 * Returns the level that just opened, or null.
 */
export function advance(p: Progress, provinceShare: number, stateShare: number): number | null {
  if (p.openLevel === 3 && provinceShare >= UNLOCK_SHARE) {
    p.openLevel = 2;
    p.meter = 'state';
    return 2;
  }
  if (p.openLevel === 2 && stateShare >= UNLOCK_SHARE) {
    p.openLevel = 1;
    p.meter = 'done';
    return 1;
  }
  return null;
}
