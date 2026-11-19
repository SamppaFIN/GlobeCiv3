/**
 * progress.ts — which zoom levels the player has opened (STORY-026, STORY-087).
 *
 * A new game starts at the city level (STORY-070). Each level opens the next when its own
 * goal is reached (goals.ts): the city's first scout or settler opens the city area, three
 * cities the province, four of the home state's provinces held the state, and all seven
 * (the home state conquered, STORY-016) the planet. Mapping opened the province and the
 * state until STORY-087; it still leads the scouts and the expeditions.
 */
import { goalCount, levelGoal, type LevelState } from './goals';

/** The share of an area or a province the expeditions aim to map (STORY-026). */
export const UNLOCK_SHARE = 0.6;

export interface Progress {
  /** Deepest zoom-out level open to the player: 4 the city, 3 city area, 2 province, 1 state, 0 planet. */
  openLevel: number;
  /** The stage, which leads the scouts (main.ts): the city's first units, the home province, the home state, its provinces not held, or beyond. */
  meter: 'city' | 'province' | 'state' | 'conquest' | 'done';
}

/** A new game at the city level, or (the old start, ?classic) at the city area. */
export function startProgress(atCity = false): Progress {
  return atCity ? { openLevel: 4, meter: 'city' } : { openLevel: 3, meter: 'province' };
}

/** What the meter shows at each level once it is open. */
const METER: Record<number, Progress['meter']> = { 3: 'province', 2: 'state', 1: 'conquest', 0: 'done' };

/**
 * Open the next level when the deepest open level's goal is reached. Returns the level that
 * just opened, or null. One level at a time: a game ahead of its levels opens the next one
 * on the next call.
 */
export function advance(p: Progress, s: LevelState): number | null {
  const goal = levelGoal(p.openLevel);
  if (!goal || goalCount(goal, s) < goal.need) return null;
  p.openLevel = goal.level - 1;
  p.meter = METER[p.openLevel];
  return p.openLevel;
}
