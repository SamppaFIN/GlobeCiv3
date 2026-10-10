/**
 * terrainTypes.ts — the terrain type, special resource and yield of a hex tile.
 *
 * A tile's type is a function of its centre (rule 3): the same terrain height as the
 * surface (terrain.ts), the latitude, and a separate moisture noise. The thresholds
 * are this game's own; the numbers below are Civilization I's rules.
 *
 * Source of all yields, movement costs and resource bonuses: Freeciv,
 * data/civ1/terrain.ruleset (format_version 50, "Civ1 tile_type data for Freeciv"),
 * https://github.com/freeciv/freeciv/blob/main/data/civ1/terrain.ruleset
 * Names are our own (rule 4).
 */
import { tileCenter, TILE_COUNT } from '../globe/hexTiles';
import { DEFAULT_SEED, hash, heightRange, terrainHeight, type Vec3Like } from '../globe/terrain';

export const TERRAINS = ['ocean', 'arctic', 'desert', 'forest', 'grassland', 'hills', 'jungle', 'mountains', 'plains', 'swamp', 'tundra'] as const;
export type Terrain = (typeof TERRAINS)[number];
export type ResourceKind = 'fish' | 'seals' | 'oasis' | 'game' | 'reindeer' | 'fertile' | 'coal' | 'gems' | 'gold' | 'horses' | 'oil';

export interface Yield {
  food: number;
  shield: number;
  trade: number;
}

export interface TerrainRule extends Yield {
  name: string;
  /** Movement cost in move points. */
  move: number;
  /** The special resource this terrain can carry (one per terrain, as in Civ I). */
  resource: ResourceKind;
}

/** Freeciv civ1 [terrain_*]: food, shield, trade, movement_cost, resources. */
export const TERRAIN_RULES: Record<Terrain, TerrainRule> = {
  ocean: { name: 'Valtameri', food: 1, shield: 0, trade: 2, move: 1, resource: 'fish' },
  arctic: { name: 'Arktinen', food: 0, shield: 0, trade: 0, move: 2, resource: 'seals' },
  desert: { name: 'Aavikko', food: 0, shield: 1, trade: 0, move: 1, resource: 'oasis' },
  forest: { name: 'Metsä', food: 1, shield: 2, trade: 0, move: 2, resource: 'game' },
  grassland: { name: 'Ruohomaa', food: 2, shield: 0, trade: 0, move: 1, resource: 'fertile' },
  hills: { name: 'Kukkulat', food: 1, shield: 0, trade: 0, move: 2, resource: 'coal' },
  jungle: { name: 'Viidakko', food: 1, shield: 0, trade: 0, move: 2, resource: 'gems' },
  mountains: { name: 'Vuoret', food: 0, shield: 1, trade: 0, move: 3, resource: 'gold' },
  plains: { name: 'Tasanko', food: 1, shield: 1, trade: 0, move: 1, resource: 'horses' },
  swamp: { name: 'Suo', food: 1, shield: 0, trade: 0, move: 2, resource: 'oil' },
  // Freeciv's tundra resource is Game; here it is reindeer (Poro), with Game's bonus
  tundra: { name: 'Tundra', food: 1, shield: 0, trade: 0, move: 1, resource: 'reindeer' },
};

/** Freeciv civ1 [resource_*]: bonus food, shield and trade. */
export const RESOURCES: Record<ResourceKind, Yield & { name: string }> = {
  fish: { name: 'Kala', food: 2, shield: 0, trade: 0 },
  seals: { name: 'Hylkeet', food: 2, shield: 0, trade: 0 },
  oasis: { name: 'Keidas', food: 3, shield: 0, trade: 0 },
  game: { name: 'Riista', food: 2, shield: 0, trade: 0 },
  reindeer: { name: 'Poro', food: 2, shield: 0, trade: 0 },
  // Freeciv "Resources" (extra_bonus) on grassland
  fertile: { name: 'Hedelmällinen maa', food: 0, shield: 1, trade: 0 },
  coal: { name: 'Hiili', food: 0, shield: 2, trade: 0 },
  gems: { name: 'Jalokivet', food: 0, shield: 0, trade: 4 },
  gold: { name: 'Kulta', food: 0, shield: 0, trade: 6 },
  horses: { name: 'Hevoset', food: 0, shield: 2, trade: 0 },
  oil: { name: 'Öljy', food: 0, shield: 4, trade: 0 },
};

/** Share of tiles with a special resource (the design handoff's map view uses 0.22). */
export const RESOURCE_RATE = 0.22;
/** Octaves for a tile's height: a tile is about quadtree level 7, so this goes well below it. */
const HEIGHT_OCTAVES = 12;
const MOISTURE_OCTAVES = 5;
/** Octaves 6–8 (wavelengths of about 3 to 0.8 tiles) vary the moisture from tile to tile. */
const DETAIL_OCTAVES: [number, number] = [6, 9];
const DETAIL_AMPLITUDE = 0.5 ** 7 + 0.5 ** 8 + 0.5 ** 9;
const MOISTURE_SEED = DEFAULT_SEED + 7919;
const RESOURCE_SEED = DEFAULT_SEED + 104729;

/** Terrain type at a unit-sphere point (a tile centre). */
export function classifyPoint(p: Vec3Like): Terrain {
  const h = terrainHeight(p, HEIGHT_OCTAVES);
  if (h < 0) return 'ocean';
  // Thresholds from the measured distribution over land (seed 1337): height quantiles
  // q50 0.16, q90 0.40, q97 0.48; |y| q75 0.82, q90 0.90; moisture q25 -0.05, q75 0.25.
  const lat = Math.abs(p.y);
  // Cold grows toward the poles and with altitude
  const cold = lat + Math.max(0, h - 0.25) * 0.6;
  if (cold > 0.93) return 'arctic';
  if (cold > 0.84) return 'tundra';
  if (h >= 0.42) return 'mountains';
  if (h >= 0.32) return 'hills';
  // Broad climate plus a normalised tile-scale term, so terrain mixes as on a Civ map
  const m = heightRange(p, 0, MOISTURE_OCTAVES, MOISTURE_SEED) + 0.18 * (heightRange(p, DETAIL_OCTAVES[0], DETAIL_OCTAVES[1], MOISTURE_SEED + 1) / DETAIL_AMPLITUDE);
  if (h < 0.08 && m > 0.2) return 'swamp';
  if (m > 0.2) return lat < 0.4 ? 'jungle' : 'forest';
  if (m > 0) return 'grassland';
  if (m < -0.15 && lat < 0.6) return 'desert';
  return 'plains';
}

export interface TileInfo {
  terrain: Terrain;
  resource: ResourceKind | null;
}

export function tileInfo(id: number): TileInfo {
  const terrain = classifyPoint(tileCenter(id));
  const special = hash(id, 0, 0, RESOURCE_SEED) * 0.5 + 0.5 < RESOURCE_RATE;
  return { terrain, resource: special ? TERRAIN_RULES[terrain].resource : null };
}

/** Food, shield and trade of a tile: the terrain plus its resource. */
export function tileYield(info: TileInfo): Yield {
  const t = TERRAIN_RULES[info.terrain];
  const r = info.resource ? RESOURCES[info.resource] : { food: 0, shield: 0, trade: 0 };
  return { food: t.food + r.food, shield: t.shield + r.shield, trade: t.trade + r.trade };
}

/** One byte for the shader: terrain index + 1 in the low 4 bits (0: not computed), bit 4 a resource. */
export function tileCode(info: TileInfo): number {
  return (TERRAINS.indexOf(info.terrain) + 1) | (info.resource ? 16 : 0);
}

/** Tile codes computed on demand, a city area at a time (about 62 tiles, well under a millisecond). */
export class TileTypeTable {
  /** Codes by tile id; may be a larger buffer shared with a texture. */
  readonly codes: Uint8Array;
  private readonly done = new Set<number>();

  constructor(codes: Uint8Array = new Uint8Array(TILE_COUNT)) {
    if (codes.length < TILE_COUNT) throw new Error('tile code buffer too small');
    this.codes = codes;
  }

  has(city: number): boolean {
    return this.done.has(city);
  }

  /** Compute the codes of the given tiles of a city area once. */
  fill(city: number, tiles: readonly number[]): void {
    if (this.done.has(city)) return;
    for (const id of tiles) this.fillTile(id);
    this.done.add(city);
  }

  /** Compute one tile's code if missing, keeping the bits above it (bit 5: mapped). */
  fillTile(id: number): void {
    if (this.codes[id] & 15) return;
    this.codes[id] = (this.codes[id] & ~31) | tileCode(tileInfo(id));
  }
}
