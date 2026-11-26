/**
 * culture.ts — the province level's culture and borders (STORY-093, PLAN-090; Sami 2026-11-22).
 *
 * From Freeciv civ2civ3 (github.com/freeciv/freeciv, commit fb460e6, data/civ2civ3 and
 * common/borders.c, GPL-2.0-or-later; only the rules and numbers are borrowed):
 *   - culture: a city's history grows each turn by its buildings' History effects
 *     (effects.ruleset: Palace 1, Temple 1, Library 1, Colosseum 2, Colossus 2, Hanging
 *     Gardens 2, Great Wall 3), with no interest (game.ruleset [culture] history_interest_pml 0);
 *     a turn is a day here, as with the other Freeciv numbers
 *   - the border: a city claims the tiles within radius_sq_city 5 + min(size, 26) × size_effect 1
 *     (game.ruleset [borders], tile_border_source_radius_sq)
 *   - a tile two cities claim goes to the stronger, (size + 2)² / sq_dist
 *     (tile_border_source_strength, tile_border_strength)
 * Own rules: in Freeciv culture moves no border, so culture's part is own, after Civ III's
 * culture borders: every CULTURE_PER_SQ of a city's culture adds 1 to its radius_sq, and a
 * border has BORDER_MAX rings at most. The squared distance of Freeciv's square map becomes
 * rings of the hex sphere by its square root (a fit): size 1 has two rings already, and
 * floor(√(5 + size)) is never less than the city's work area (cities.ts cityRings), so a
 * city's own work area is always its own (Freeciv's radius_sq_city_permanent −3 would let
 * the outer worked tiles go; own simplification while no rival claims a border). Ties go to
 * the lower city id. Borders are worked out from the cities, not kept (rule 3).
 */
import { neighbors } from '../globe/hexTiles';
import type { Building, City } from './cities';

/** Culture a building adds a day (Freeciv civ2civ3 effects.ruleset, History). */
export const HISTORY: Partial<Record<Building, number>> = { temple: 1, library: 1, colosseum: 2, colossus: 2, gardens: 2, greatwall: 3,
  // STORY-121: Great Library 3 and Copernicus' Observatory 3; civ2civ3 has no Oracle, and its
  // Temple of Artemis (2), the wonder of temples there, stands for it (own mapping)
  greatlibrary: 3, observatory: 3, oracle: 2 };
/** The capital's palace (Freeciv civ2civ3 effects.ruleset, History 1 with Palace). */
export const PALACE_HISTORY = 1;
/** Freeciv civ2civ3 game.ruleset [borders]. */
export const RADIUS_SQ_CITY = 5;
export const SIZE_EFFECT = 1;
/** Own (PLAN-090): culture for each step of radius_sq, and the widest border; calibrated by the autopilot. */
export const CULTURE_PER_SQ = 20;
export const BORDER_MAX = 5;

/** A city's culture a day: its palace and buildings. */
export const cultureGain = (c: Pick<City, 'capital' | 'buildings'>) =>
  (c.capital ? PALACE_HISTORY : 0) + c.buildings.reduce((sum, b) => sum + (HISTORY[b] ?? 0), 0);

/** A city's squared border radius: Freeciv's from its size, and own from its culture. */
export const borderRadiusSq = (size: number, culture = 0) =>
  RADIUS_SQ_CITY + Math.min(size, 26) * SIZE_EFFECT + Math.floor(culture / CULTURE_PER_SQ);

/** A city's border in rings of tiles. */
export const borderRings = (size: number, culture = 0) => Math.min(BORDER_MAX, Math.floor(Math.sqrt(borderRadiusSq(size, culture))));

/** A source of a border: a city, whose owner is the player (0) now and rivals later. */
export interface BorderSource {
  id: number;
  tile: number;
  size: number;
  culture: number;
  owner: number;
}

/** Tiles within rings of a tile, each with its ring (0 for the tile itself). */
export function ringsAround(center: number, rings: number): [tile: number, ring: number][] {
  const out: [number, number][] = [[center, 0]];
  const seen = new Set([center]);
  let frontier = [center];
  for (let r = 1; r <= rings; r++) {
    const next: number[] = [];
    for (const id of frontier) for (const n of neighbors(id)) if (!seen.has(n)) { seen.add(n); next.push(n); out.push([n, r]); }
    frontier = next;
  }
  return out;
}

/**
 * Which source each tile of a border belongs to: the stronger, (size + 2)² / ring², the lower
 * id on a tie; a source's own tile is always its own.
 */
export function tileOwner(sources: readonly BorderSource[]): Map<number, BorderSource> {
  const owner = new Map<number, { s: BorderSource; ring: number }>();
  const stronger = (a: BorderSource, ra: number, b: BorderSource, rb: number) => {
    if (ra === 0 || rb === 0) return ra === 0 && (rb !== 0 || a.id < b.id);
    const x = (a.size + 2) ** 2 * rb * rb, y = (b.size + 2) ** 2 * ra * ra;
    return x > y || (x === y && a.id < b.id);
  };
  for (const s of sources) {
    for (const [t, ring] of ringsAround(s.tile, borderRings(s.size, s.culture))) {
      const had = owner.get(t);
      if (!had || stronger(s, ring, had.s, had.ring)) owner.set(t, { s, ring });
    }
  }
  return new Map([...owner].map(([t, o]) => [t, o.s]));
}

/** Land tiles of an owner's border in each province. */
export function provinceCover(owned: ReadonlyMap<number, BorderSource>, owner: number, provinceOf: (tile: number) => number, isLand: (tile: number) => boolean): Map<number, number> {
  const cover = new Map<number, number>();
  for (const [t, s] of owned) {
    if (s.owner !== owner || !isLand(t)) continue;
    const p = provinceOf(t);
    cover.set(p, (cover.get(p) ?? 0) + 1);
  }
  return cover;
}

/** Own (PLAN-090, Sami 2026-11-22): a province is held by a border that covers this much of its land. */
export const HOLD_BY_BORDER = 10;

/** The provinces an owner's border holds. */
export const heldByBorder = (cover: ReadonlyMap<number, number>) => [...cover].filter(([, n]) => n >= HOLD_BY_BORDER).map(([p]) => p).sort((a, b) => a - b);
