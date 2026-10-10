/**
 * start.ts — where a new game begins.
 *
 * The start is a city area on land, away from the poles. The terrain is the
 * world's own (terrain.ts DEFAULT_SEED); the game seed only orders the
 * candidates, so the same seed always starts in the same place.
 */
import { tileCenter, tilesWithin } from '../globe/hexTiles';
import type { Regions } from '../globe/regions';
import { hash, terrainHeight } from '../globe/terrain';

/** Share of a city area's tiles that must be land. */
export const MIN_LAND_SHARE = 0.5;
/** Largest |y| of a start city's centre: about 53° of latitude. */
export const MAX_ABS_Y = 0.8;
/** Octaves for a tile's terrain: a tile is about quadtree level 7, so this goes well below it. */
const TILE_OCTAVES = 12;

/** Tiles of a city area (from the tile table, the one source of tile membership). */
export function cityTiles(regions: Regions, city: number): number[] {
  const table = regions.tileTable();
  return tilesWithin(regions.centers[2][city], regions.inradius[2] * 4, id => table[id] === city);
}

/** Share of a city area's tiles whose centre is at or above sea level. */
export function landShare(regions: Regions, city: number): number {
  const tiles = cityTiles(regions, city);
  let land = 0;
  for (const id of tiles) if (terrainHeight(tileCenter(id), TILE_OCTAVES) >= 0) land++;
  return land / tiles.length;
}

/** The start city area for a game seed. */
export function chooseStartCity(regions: Regions, seed: number): number {
  const count = regions.centers[2].length;
  for (let k = 0; k < 1000; k++) {
    const city = Math.floor((hash(k, 1, 2, seed) * 0.5 + 0.5) * count) % count;
    if (Math.abs(regions.centers[2][city].y) > MAX_ABS_Y) continue;
    if (landShare(regions, city) >= MIN_LAND_SHARE) return city;
  }
  throw new Error(`No start city on land for seed ${seed}`);
}
