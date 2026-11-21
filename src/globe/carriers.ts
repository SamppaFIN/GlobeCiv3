/**
 * carriers.ts — the city level's carriers (STORY-101; Sami: "kantajat näkyvät"). Each move of
 * the chains' day (chains.ts: a producer's output to the centre, the centre's goods to a
 * maker or to the site) walks as a carrier from tile to tile over the risen ground, the good
 * in its hands, and arrives within the same day by the game's clock.
 *
 * The carriers only show what the day did: the state is the same with them or without them.
 * The timing and the cap are own.
 */
import type { Good, Move } from '../game/chains';

/** At most this many walk at once (one instanced mesh each for body and load). */
export const MAX_CARRIERS = 24;
/** The part of the day a carrier has walked when it arrives: before the next day's moves. */
export const ARRIVE_AT = 0.85;

/** A carrier's walk: the tiles from where it starts to where it goes, and what it carries. */
export interface Trip { path: number[]; good: Good }

/**
 * The day's trips from its moves: `where` gives a place's tile, `route` the tiles between two
 * (both ends included). A move with no place or way, or past the cap, does not walk.
 */
export function tripsOf(moves: readonly Move[], where: (place: Move['from'] | Move['to']) => number | null, route: (from: number, to: number) => number[] | null): Trip[] {
  const trips: Trip[] = [];
  for (const m of moves) {
    if (trips.length >= MAX_CARRIERS) break;
    const from = where(m.from);
    const to = where(m.to);
    if (from === null || to === null) continue;
    const path = from === to ? [from, to] : route(from, to);
    if (path && path.length >= 2) trips.push({ path, good: m.good });
  }
  return trips;
}

/**
 * Where on its path a carrier is at a part of the day (0 to 1): the leg between path[leg]
 * and path[leg + 1], and how far along it. Each carrier sets off a little after the one
 * before it, so a line of them does not walk as one.
 */
export function along(pathLength: number, dayPart: number, index: number): { leg: number; f: number } {
  const start = Math.min(0.3, index * 0.04);
  const p = Math.max(0, Math.min(1, (dayPart - start) / (ARRIVE_AT - start))) * (pathLength - 1);
  const leg = Math.min(pathLength - 2, Math.floor(p));
  return { leg, f: p - leg };
}
