/**
 * cityStates.ts — native city-states in the states beyond home (STORY-063; Sami 2026-10-19:
 * opponents in the neighbouring states, city-states first). Own rules, as Civilization I has
 * none: 2 to 4 cities a state on good land, from the seed. A city-state does not found new
 * cities; it grows with the days to size 8, and its defenders follow its size. All of it is a
 * function of the seed and the day (rule 3), so only a capture is the player's state.
 */
import { hash } from '../globe/terrain';

export interface NativeCity {
  tile: number;
  state: number;
  name: string;
  /** Day offset of its growth, so the cities of a state do not grow in step. */
  phase: number;
}

/** Tiles kept between two city-states (rings), and between a city-state and a new city. */
export const NATIVE_SPACING = 6;
export const NATIVE_CLEARANCE = 4;
/** Days for a city-state to grow a size; it stops at NATIVE_MAX_SIZE. */
export const NATIVE_GROWTH_DAYS = 60;
export const NATIVE_MAX_SIZE = 8;
/** From this day on the defenders are phalanxes (own: Bronze Working spreads). */
export const NATIVE_PHALANX_DAY = 200;

const SALT = 0x5c17a7e;
const roll = (seed: number, a: number, b: number) => hash(a, b, 7, seed ^ SALT) * 0.5 + 0.5;

const FRONT = ['Kau', 'Var', 'Hal', 'Sär', 'Ilm', 'Tor', 'Lou', 'Vel', 'Ruo', 'Suv', 'Hon', 'Myr', 'Pal', 'Ves', 'Kor', 'Til'];
const BACK = ['kola', 'vala', 'linna', 'mäki', 'harju', 'saari', 'lahti', 'koski', 'vaara', 'niemi', 'järvi', 'ranta'];

/** An own name from the seed, the state and the city's number in it. */
export function nativeName(seed: number, state: number, k: number): string {
  const r = Math.floor(roll(seed, state, k + 100) * FRONT.length * BACK.length);
  return FRONT[r % FRONT.length] + BACK[Math.floor(r / FRONT.length) % BACK.length];
}

/**
 * The city-states of a state: from its land tiles with their site scores, the best ones a
 * little shuffled by the seed, NATIVE_SPACING apart. `near(a, b)` tells two tiles closer than
 * that.
 */
export function nativeCities(seed: number, state: number, land: readonly { tile: number; score: number }[], near: (a: number, b: number) => boolean): NativeCity[] {
  const want = 2 + Math.min(2, Math.floor(roll(seed, state, 0) * 3));
  const ranked = land
    .map(l => ({ tile: l.tile, rank: l.score + 12 * roll(seed, l.tile, 1) }))
    .sort((a, b) => b.rank - a.rank || a.tile - b.tile);
  const chosen: number[] = [];
  for (const c of ranked) {
    if (chosen.length >= want) break;
    if (chosen.some(t => near(t, c.tile))) continue;
    chosen.push(c.tile);
  }
  return chosen.map((tile, k) => ({ tile, state, name: nativeName(seed, state, k), phase: Math.floor(roll(seed, tile, 2) * NATIVE_GROWTH_DAYS) }));
}

/** A city-state's size, defenders and walls on a day. */
export function nativeStrength(c: NativeCity, day: number): { size: number; defenders: number; defender: 'warrior' | 'phalanx'; walls: boolean } {
  const size = Math.min(NATIVE_MAX_SIZE, 1 + Math.floor((day + c.phase) / NATIVE_GROWTH_DAYS));
  return { size, defenders: 1 + Math.floor(size / 3), defender: day >= NATIVE_PHALANX_DAY ? 'phalanx' : 'warrior', walls: size >= 5 };
}
