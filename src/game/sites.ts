/**
 * sites.ts — scouts suggest city sites (STORY-032, Sami 2026-10-11).
 *
 * A mapped land tile is a good site when its score (food twice, shields and trade within
 * two rings, as the settler weighs sites) is in the top quarter of land tiles and the best
 * within its two rings, and it lies clear of the cities and sites already chosen. The top
 * quarter was measured over 3 000 land tiles of the planet: median 61, top quarter from
 * 75, top tenth from 83, best 112.
 */
import { tilesInRings } from './pathfinding';

/** Score from which a site is good (the top quarter of land tiles). */
export const GOOD_SITE = 75;
/** Rings kept between a suggested site and cities or other sites (cities work two rings). */
export const SITE_SPACING = 4;
/** Days between two suggestions, so they do not nag. */
export const OFFER_EVERY_DAYS = 10;

/**
 * Whether a tile is a good city site: land, a score of GOOD_SITE or more, no better land
 * within two rings, and no city or chosen site within SITE_SPACING − 1 rings.
 */
export function goodSite(tile: number, score: (id: number) => number, isLand: (id: number) => boolean, taken: readonly number[]): boolean {
  if (!isLand(tile)) return false;
  const s = score(tile);
  if (s < GOOD_SITE) return false;
  if (tilesInRings(tile, 2).some(id => id !== tile && isLand(id) && score(id) > s)) return false;
  const near = new Set(tilesInRings(tile, SITE_SPACING - 1));
  return !taken.some(t => near.has(t));
}
