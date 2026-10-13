/**
 * progress.ts — which zoom levels the player has opened (STORY-026).
 *
 * The game starts locked to the city-area level. Mapping UNLOCK_SHARE of the home
 * province opens the province level, and the same share of the home state opens the
 * state level. The planet opens when the home state is conquered: a city in each of its
 * seven provinces (STORY-016, conquest.ts).
 */
export const UNLOCK_SHARE = 0.6;

export interface Progress {
  /** Deepest zoom-out level open to the player: 3 city area, 2 province, 1 state, 0 planet. */
  openLevel: number;
  /** What the meter shows now: the mapping of the province or state, the provinces held, or nothing more. */
  meter: 'province' | 'state' | 'conquest' | 'done';
}

export function startProgress(): Progress {
  return { openLevel: 3, meter: 'province' };
}

/**
 * Update the progress from the mapped shares of the home province and state.
 * Returns the level that just opened, or null.
 */
export function advance(p: Progress, provinceShare: number, stateShare: number, homeConquered = false): number | null {
  if (p.openLevel === 3 && provinceShare >= UNLOCK_SHARE) {
    p.openLevel = 2;
    p.meter = 'state';
    return 2;
  }
  if (p.openLevel === 2 && stateShare >= UNLOCK_SHARE) {
    p.openLevel = 1;
    p.meter = 'conquest';
    return 1;
  }
  if (p.openLevel === 1 && homeConquered) {
    p.openLevel = 0;
    p.meter = 'done';
    return 0;
  }
  return null;
}
