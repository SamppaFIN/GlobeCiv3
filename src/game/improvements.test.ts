import { describe, expect, it } from 'vitest';
import { bestJob, improvementYield, Improvements, workDays } from './improvements';
import type { Terrain } from './terrainTypes';

describe('terrain improvements (Freeciv civ1)', () => {
  it('add the source table yields and take its days', () => {
    expect(improvementYield('irrigation', 'grassland')).toEqual({ food: 1, shield: 0, trade: 0 });
    expect(improvementYield('mine', 'hills')).toEqual({ food: 0, shield: 3, trade: 0 });
    expect(improvementYield('road', 'plains')).toEqual({ food: 0, shield: 0, trade: 1 });
    expect(improvementYield('road', 'forest')).toEqual({ food: 0, shield: 0, trade: 0 });
    expect([workDays('irrigation', 'plains'), workDays('irrigation', 'hills'), workDays('mine', 'mountains'), workDays('road', 'mountains')]).toEqual([5, 10, 10, 6]);
  });

  it('irrigate only beside water or irrigated land, where the terrain allows', () => {
    const imp = new Improvements();
    const water = (id: number) => id === 99;
    expect(imp.canBuild(1, 'irrigation', 'grassland', [2, 3], water)).toBe(false);
    expect(imp.canBuild(1, 'irrigation', 'grassland', [2, 99], water)).toBe(true);
    imp.add(1, 'irrigation');
    // Irrigated land carries the water on
    expect(imp.canBuild(4, 'irrigation', 'plains', [1], water)).toBe(true);
    expect(imp.canBuild(5, 'irrigation', 'forest', [99], water)).toBe(false);
    expect(imp.canBuild(1, 'irrigation', 'grassland', [99], water)).toBe(false);
  });

  it('a mine and irrigation replace each other; a road stays', () => {
    const imp = new Improvements();
    imp.add(7, 'irrigation');
    imp.add(7, 'road');
    imp.add(7, 'mine');
    expect([imp.has(7, 'irrigation'), imp.has(7, 'mine'), imp.has(7, 'road')]).toEqual([false, true, true]);
    expect(imp.yieldOf(7, 'hills')).toEqual({ food: 0, shield: 3, trade: 0 });
    imp.add(7, 'irrigation');
    expect(imp.yieldOf(7, 'hills')).toEqual({ food: 1, shield: 0, trade: 0 });
    expect(imp.entries()).toEqual([[7, ['irrigation', 'road']]]);
  });

  it('the best job brings the most per day of work, food counted twice', () => {
    const terrain: Record<number, Terrain> = { 1: 'hills', 2: 'grassland', 3: 'forest' };
    const water = (id: number) => id === 9;
    const near = (id: number) => (id === 2 ? [9] : [3]);
    const imp = new Improvements();
    // Grassland irrigation 2/5, grassland road 1/2, hills mine 3/10: the road wins
    expect(bestJob([1, 2, 3], imp, id => terrain[id], near, water)).toEqual({ tile: 2, kind: 'road', days: 2 });
    imp.add(2, 'road');
    expect(bestJob([1, 2, 3], imp, id => terrain[id], near, water)).toEqual({ tile: 2, kind: 'irrigation', days: 5 });
    imp.add(2, 'irrigation');
    expect(bestJob([1, 2, 3], imp, id => terrain[id], near, water)).toEqual({ tile: 1, kind: 'mine', days: 10 });
    imp.add(1, 'mine');
    expect(bestJob([1, 2, 3], imp, id => terrain[id], near, water)).toBeNull();
  });

  it('a job never replaces a mine with irrigation or irrigation with a mine', () => {
    const water = (id: number) => id === 9;
    const imp = new Improvements();
    imp.add(1, 'mine');
    imp.add(2, 'irrigation');
    expect(bestJob([1, 2], imp, () => 'hills', () => [9], water)).toBeNull();
  });
});
