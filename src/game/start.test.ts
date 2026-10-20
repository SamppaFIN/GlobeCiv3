import { describe, expect, it } from 'vitest';
import { buildHexGrid } from '../globe/hexGrid';
import { Regions } from '../globe/regions';
import { chooseStartCity, chooseStartSite, landShare, MAX_ABS_Y, MIN_LAND_SHARE } from './start';

const regions = new Regions(buildHexGrid(5, 5).nodes);

describe('start city', () => {
  it('is the same for the same seed and on land away from the poles', () => {
    const starts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const city = chooseStartCity(regions, seed);
      expect(chooseStartCity(regions, seed)).toBe(city);
      expect(Math.abs(regions.centers[2][city].y)).toBeLessThanOrEqual(MAX_ABS_Y);
      expect(landShare(regions, city)).toBeGreaterThanOrEqual(MIN_LAND_SHARE);
      starts.add(city);
    }
    // Different seeds start in different places
    expect(starts.size).toBeGreaterThan(15);
  }, 60_000);
});

describe('the capital of a new game (STORY-070)', () => {
  it('a good site whose two rings hold three kinds of land and exactly one special resource, the same for the same seed', async () => {
    const { tilesInRings } = await import('./pathfinding');
    const kinds = ['grassland', 'plains', 'forest', 'hills', 'ocean'] as const;
    const look = {
      terrainOf: (t: number) => kinds[t % kinds.length],
      hasResource: (t: number) => t % 29 === 0,
      good: (t: number) => t % 5 !== 4,
    };
    for (const seed of [1, 2, 3]) {
      const site = chooseStartSite(regions, seed, look);
      expect(chooseStartSite(regions, seed, look)).toEqual(site);
      expect(look.good(site.tile)).toBe(true);
      expect(regions.tileTable()[site.tile]).toBe(site.city);
      const near = tilesInRings(site.tile, 2);
      expect(new Set(near.map(look.terrainOf).filter(t => t !== 'ocean')).size).toBeGreaterThanOrEqual(3);
      expect(near.filter(look.hasResource)).toHaveLength(1);
    }
  }, 60_000);
});
