import { describe, expect, it } from 'vitest';
import { buildHexGrid } from '../globe/hexGrid';
import { Regions } from '../globe/regions';
import { chooseStartCity, landShare, MAX_ABS_Y, MIN_LAND_SHARE } from './start';

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
