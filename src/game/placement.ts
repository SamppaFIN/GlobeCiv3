/**
 * placement.ts — where a city's buildings stand at the city level (STORY-071; Sami
 * 2026-10-20, own rules: Civ I has no placement). Each building stands on a tile of the
 * city's two rings. The governor puts it on the best free tile, and the player may move it.
 *
 * - Steep ground holds nothing: no building on mountains but the quarry.
 * - A resource building (STORY-073) stands on a tile of its kind in the city's area, the
 *   fish harbour on a shore next to the fish.
 * - The terrain buildings stand on their terrain, the fishery on a shore.
 * - Height gives a bonus. Up means higher than the centre, and low means level with it or
 *   lower. Up, a temple calms one more citizen and a library brings +1 science a day. Low, a
 *   field and a granary bring +1 food and a market +1 trade a day. A quarry on a mountain
 *   brings +1 shield more.
 */
import { neighbors } from '../globe/hexTiles';
import { tilesInRings } from './pathfinding';
import { cityRings, RESOURCE_BUILDINGS, TERRAIN_BUILDINGS, isResourceBuilding, isTerrainBuilding, type Building, type City } from './cities';
import type { ResourceKind, Terrain } from './terrainTypes';

/** The ground: its terrain, and its height at the city level in tile spacings. */
export interface Ground {
  terrainOf(tile: number): Terrain;
  heightOf(tile: number): number;
  /** The tile's special resource as the people know it (STORY-073). */
  resourceOf?(tile: number): ResourceKind | null;
}

/** Rings round the centre where buildings stand. */
export const PLACE_RINGS = 2;
/** Buildings a tile has room for. */
export const ROOM = 2;
/** How much higher than the centre "up" is, in tile spacings. */
export const HIGHER = 0.1;

/** Where each building does best, and what it gives there. */
export const BEST: Partial<Record<Building, { at: 'up' | 'low' | 'mountains'; gives: string }>> = {
  temple: { at: 'up', gives: '+1 tyytyväinen' },
  library: { at: 'up', gives: '+1 tiede päivässä' },
  field: { at: 'low', gives: '+1 ruoka päivässä' },
  granary: { at: 'low', gives: '+1 ruoka päivässä' },
  market: { at: 'low', gives: '+1 kauppa päivässä' },
  quarry: { at: 'mountains', gives: '+1 tuotanto päivässä' },
};

/** Buildings that stand on a tile; walls and the great wall ring the city instead. */
export const standsOnTile = (b: Building) => b !== 'walls' && b !== 'greatwall';

/** Whether a tile is higher than the city's centre. */
export const isUp = (city: City, tile: number, g: Ground) => g.heightOf(tile) >= g.heightOf(city.tile) + HIGHER;

/** Whether a building may stand on a tile of the city: land in its rings, not steep, its terrain. */
export function fits(city: City, b: Building, tile: number, g: Ground): boolean {
  if (tile === city.tile) return false;
  if (isResourceBuilding(b)) {
    if (!tilesInRings(city.tile, cityRings(city.size)).includes(tile)) return false;
    const kind = RESOURCE_BUILDINGS[b].kind;
    if (kind === 'fish') return g.terrainOf(tile) !== 'ocean' && neighbors(tile).some(n => g.resourceOf?.(n) === 'fish');
    return g.resourceOf?.(tile) === kind;
  }
  if (!tilesInRings(city.tile, PLACE_RINGS).includes(tile)) return false;
  const t = g.terrainOf(tile);
  if (t === 'ocean' || (t === 'mountains' && b !== 'quarry')) return false;
  if (b === 'fishery') return neighbors(tile).some(n => g.terrainOf(n) === 'ocean');
  return !isTerrainBuilding(b) || (TERRAIN_BUILDINGS[b] as readonly Terrain[]).includes(t);
}

/** Whether a building on a tile stands where it does best. */
export function isBest(city: City, b: Building, tile: number, g: Ground): boolean {
  const best = BEST[b];
  if (!best) return false;
  if (best.at === 'mountains') return g.terrainOf(tile) === 'mountains';
  return isUp(city, tile, g) === (best.at === 'up');
}

/** Buildings standing on a tile, but one. */
const on = (city: City, tile: number, but?: Building) =>
  Object.entries(city.placed ?? {}).filter(([b, t]) => t === tile && b !== but).length;

/** Tiles a building may move to, nearest the centre first, with whether each is its best. */
export function spots(city: City, b: Building, g: Ground): { tile: number; best: boolean }[] {
  return tilesInRings(city.tile, isResourceBuilding(b) ? Math.max(PLACE_RINGS, cityRings(city.size)) : PLACE_RINGS)
    .filter(t => fits(city, b, t, g) && on(city, t, b) < ROOM)
    .map(t => ({ tile: t, best: isBest(city, b, t, g) }));
}

/** The governor's tile for a building: its best ground first, then nearest the centre. */
export function bestTile(city: City, b: Building, g: Ground): number | null {
  const all = spots(city, b, g);
  return (all.find(s => s.best) ?? all[0])?.tile ?? null;
}

/**
 * Give every placed building of the city a tile and forget the ones it no longer has (sold,
 * or a save from before STORY-071); then mark the ones on their best ground.
 */
export function placeAll(city: City, g: Ground): void {
  const tiles: Partial<Record<Building, number>> = {};
  for (const b of city.buildings) if (standsOnTile(b) && city.placed?.[b] !== undefined && fits(city, b, city.placed[b]!, g)) tiles[b] = city.placed[b];
  city.placed = tiles;
  for (const b of city.buildings) {
    if (!standsOnTile(b) || tiles[b] !== undefined) continue;
    const t = bestTile(city, b, g);
    if (t !== null) tiles[b] = t;
  }
  city.best = city.buildings.filter(b => tiles[b] !== undefined && isBest(city, b, tiles[b]!, g));
}

/** The player moves a building to another tile. Returns false when it may not stand there. */
export function move(city: City, b: Building, tile: number, g: Ground): boolean {
  if (!city.buildings.includes(b) || !standsOnTile(b) || !spots(city, b, g).some(s => s.tile === tile)) return false;
  city.placed = { ...city.placed, [b]: tile };
  placeAll(city, g);
  return true;
}
