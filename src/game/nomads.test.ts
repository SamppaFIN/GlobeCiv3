import { describe, expect, it } from 'vitest';
import { tribeBand, tribeCamp, tribeOf, tribeRaids, TRIBE_LEGION_DAY, TRIBE_MOVE_DAYS, TRIBE_ONSET } from './nomads';

const LAND = Array.from({ length: 500 }, (_, k) => 1000 + 3 * k);

describe('nomad tribes (STORY-066)', () => {
  it('a tribe of its own name; its camp stays on the land, moves every 40 days and is the same for the same seed', () => {
    const t = tribeOf(42, 7);
    expect(t.name).toMatch(/^[A-ZÄÖ][a-zäö]+heimo$/);
    expect(tribeOf(42, 7)).toEqual(t);
    const camps = Array.from({ length: 20 }, (_, k) => tribeCamp(42, t, k * TRIBE_MOVE_DAYS, LAND)!);
    expect(camps.every(c => LAND.includes(c))).toBe(true);
    expect(new Set(camps).size).toBeGreaterThan(10);
    // Within a move the camp stays
    const start = Math.ceil(t.phase / TRIBE_MOVE_DAYS) * TRIBE_MOVE_DAYS - t.phase;
    expect(tribeCamp(42, t, start, LAND)).toBe(tribeCamp(42, t, start + TRIBE_MOVE_DAYS - 1, LAND));
    expect(tribeCamp(42, t, 0, [])).toBeNull();
  });

  it('a band of two to four, Cavalry and from day 300 Legion', () => {
    const sizes = new Set(Array.from({ length: 60 }, (_, s) => tribeBand(42, tribeOf(42, s), 0).size));
    expect([...sizes].sort()).toEqual([2, 3, 4]);
    expect(tribeBand(42, tribeOf(42, 1), TRIBE_LEGION_DAY - 1)).toMatchObject({ unit: 'cavalry', attack: 2 });
    expect(tribeBand(42, tribeOf(42, 1), TRIBE_LEGION_DAY)).toMatchObject({ unit: 'legion', attack: 3 });
  });

  it('raids from day 120 on, about once in 60 days', () => {
    const t = tribeOf(42, 3);
    expect(Array.from({ length: TRIBE_ONSET }, (_, d) => tribeRaids(42, t, d)).some(Boolean)).toBe(false);
    const raids = Array.from({ length: 6000 }, (_, d) => tribeRaids(42, t, TRIBE_ONSET + d)).filter(Boolean).length;
    expect(raids).toBeGreaterThan(70);
    expect(raids).toBeLessThan(140);
  });
});
