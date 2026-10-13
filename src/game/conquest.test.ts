import { describe, expect, it } from 'vitest';
import { conquest, heldIn } from './conquest';

// State 0 neighbours 1 and 2; state 1 neighbours 0 and 3
const neighbors = [[1, 2], [0, 3], [0], [1]];
const areaIn = (province: number) => province * 7 + 3;

describe('conquest', () => {
  it('a city holds its province; the home state alone is open before a conquest', () => {
    const c = conquest([areaIn(0), areaIn(0), areaIn(5)], 0, neighbors);
    expect([...c.held]).toEqual([0, 5]);
    expect(c.conquered.size).toBe(0);
    expect([...c.open]).toEqual([0]);
    expect(heldIn(c, 0)).toBe(2);
  });

  it('a province without land counts as held (STORY-058)', () => {
    const sea = (p: number) => p !== 5 && p !== 6;
    const c = conquest([0, 1, 2, 3, 4].map(areaIn), 0, neighbors, sea);
    expect(heldIn(c, 0)).toBe(7);
    expect([...c.conquered]).toEqual([0]);
    // Without the cities the land provinces are not held
    expect(heldIn(conquest([], 0, neighbors, sea), 0)).toBe(2);
  });

  it('all seven provinces conquer the state, and its neighbours open', () => {
    const c = conquest([0, 1, 2, 3, 4, 5, 6].map(areaIn), 0, neighbors);
    expect([...c.conquered]).toEqual([0]);
    expect([...c.open].sort()).toEqual([0, 1, 2]);
    expect(heldIn(c, 0)).toBe(7);
    // A conquered neighbour opens its own neighbours too
    const more = conquest([...[0, 1, 2, 3, 4, 5, 6], ...[7, 8, 9, 10, 11, 12, 13]].map(areaIn), 0, neighbors);
    expect([...more.open].sort()).toEqual([0, 1, 2, 3]);
  });
});
