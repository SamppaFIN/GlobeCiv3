/**
 * progress.ts — which zoom levels the player has opened (STORY-026).
 *
 * A new game starts at the city level (STORY-070): the first scout or settler the capital
 * builds opens the city-area level. From there, mapping UNLOCK_SHARE of the home
 * province opens the province level, and the same share of the home state opens the
 * state level. The planet opens when the home state is conquered: a city in each of its
 * seven provinces (STORY-016, conquest.ts).
 */
export const UNLOCK_SHARE = 0.6;

export interface Progress {
  /** Deepest zoom-out level open to the player: 4 the city, 3 city area, 2 province, 1 state, 0 planet. */
  openLevel: number;
  /** What the meter shows now: the city's first units, the mapping of the province or state, the provinces held, or nothing more. */
  meter: 'city' | 'province' | 'state' | 'conquest' | 'done';
}

/** A new game at the city level, or (the old start, ?classic) at the city area. */
export function startProgress(atCity = false): Progress {
  return atCity ? { openLevel: 4, meter: 'city' } : { openLevel: 3, meter: 'province' };
}

/**
 * Update the progress from the mapped shares of the home province and state.
 * Returns the level that just opened, or null.
 */
export function advance(p: Progress, provinceShare: number, stateShare: number, homeConquered = false, firstUnit = false): number | null {
  if (p.openLevel === 4 && firstUnit) {
    p.openLevel = 3;
    p.meter = 'province';
    return 3;
  }
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
