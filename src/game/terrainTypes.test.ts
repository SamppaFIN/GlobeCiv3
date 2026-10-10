import { describe, expect, it } from 'vitest';
import { TILE_COUNT, tileCenter } from '../globe/hexTiles';
import { terrainHeight } from '../globe/terrain';
import { classifyPoint, RESOURCE_RATE, TERRAINS, TERRAIN_RULES, tileCode, tileInfo, TileTypeTable, tileYield, type Terrain } from './terrainTypes';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

// Freeciv data/civ1/terrain.ruleset: terrain food/shield/trade, then the yield with its resource
const SOURCE: Record<Terrain, [number, number, number, number, number, number]> = {
  ocean: [1, 0, 2, 3, 0, 2], // Fish +2 food
  arctic: [0, 0, 0, 2, 0, 0], // Seals +2 food
  desert: [0, 1, 0, 3, 1, 0], // Oasis +3 food
  forest: [1, 2, 0, 3, 2, 0], // Game +2 food
  grassland: [2, 0, 0, 2, 1, 0], // Resources +1 shield
  hills: [1, 0, 0, 1, 2, 0], // Coal +2 shield
  jungle: [1, 0, 0, 1, 0, 4], // Gems +4 trade
  mountains: [0, 1, 0, 0, 1, 6], // Gold +6 trade
  plains: [1, 1, 0, 1, 3, 0], // Horses +2 shield
  swamp: [1, 0, 0, 1, 4, 0], // Oil +4 shield
  tundra: [1, 0, 0, 3, 0, 0], // Game +2 food
};

describe('tile terrain types', () => {
  it('yields what the Civ I ruleset gives, with and without the special resource', () => {
    for (const terrain of TERRAINS) {
      const [f, s, t, rf, rs, rt] = SOURCE[terrain];
      expect(tileYield({ terrain, resource: null })).toEqual({ food: f, shield: s, trade: t });
      expect(tileYield({ terrain, resource: TERRAIN_RULES[terrain].resource })).toEqual({ food: rf, shield: rs, trade: rt });
    }
  });

  it('is a deterministic function of the tile, with every type and about 22 % resources', () => {
    const rand = rng(11);
    const seen = new Set<Terrain>();
    let resources = 0;
    const n = 20000;
    for (let k = 0; k < n; k++) {
      const id = Math.floor(rand() * TILE_COUNT);
      const info = tileInfo(id);
      expect(tileInfo(id)).toEqual(info);
      // Ocean exactly where the surface is below sea level
      expect(info.terrain === 'ocean').toBe(terrainHeight(tileCenter(id), 12) < 0);
      if (info.resource) {
        resources++;
        expect(info.resource).toBe(TERRAIN_RULES[info.terrain].resource);
      }
      seen.add(info.terrain);
    }
    expect([...seen].sort()).toEqual([...TERRAINS].sort());
    expect(resources / n).toBeCloseTo(RESOURCE_RATE, 1);
  }, 30_000);

  it('encodes the terrain and the resource flag in one byte, and fills a city area once', () => {
    expect(tileCode({ terrain: 'ocean', resource: null })).toBe(1);
    expect(tileCode({ terrain: 'tundra', resource: 'reindeer' })).toBe(11 | 16);
    const table = new TileTypeTable();
    table.fill(5, [100, 200]);
    expect(table.has(5)).toBe(true);
    expect(table.codes[100]).toBe(tileCode(tileInfo(100)));
    expect(table.codes[200] & 15).toBe(TERRAINS.indexOf(classifyPoint(tileCenter(200))) + 1);
  });
});
