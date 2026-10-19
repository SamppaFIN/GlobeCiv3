import { describe, expect, it } from 'vitest';
import { nativeCities, nativeName, nativeStrength, NATIVE_MAX_SIZE } from './cityStates';

// A strip of land tiles 0..199 with scores; tiles closer than 10 apart are "near"
const land = Array.from({ length: 200 }, (_, tile) => ({ tile, score: 60 + (tile % 37) }));
const near = (a: number, b: number) => Math.abs(a - b) < 10;

describe('city-states (STORY-063)', () => {
  it('2 to 4 a state on good land, apart, the same for the same seed', () => {
    for (let state = 0; state < 40; state++) {
      const cs = nativeCities(42, state, land, near);
      expect(cs.length).toBeGreaterThanOrEqual(2);
      expect(cs.length).toBeLessThanOrEqual(4);
      for (const a of cs) for (const b of cs) if (a !== b) expect(near(a.tile, b.tile)).toBe(false);
      // Good land: within the top scores (60 to 96), shuffled a little by the seed
      for (const c of cs) expect(land[c.tile].score).toBeGreaterThan(80);
      expect(nativeCities(42, state, land, near)).toEqual(cs);
    }
    expect(nativeCities(42, 3, land, near)).not.toEqual(nativeCities(43, 3, land, near));
  });

  it('own names, mostly different', () => {
    const names = new Set(Array.from({ length: 60 }, (_, s) => nativeName(42, s, 0)));
    expect(names.size).toBeGreaterThan(45);
    expect(nativeName(42, 5, 1)).toMatch(/^[A-ZÄÖ][a-zäö]+$/);
  });

  it('grow with the days to size 8; defenders follow the size, phalanxes from day 200, walls from size 5', () => {
    const c = { tile: 1, state: 0, name: 'Testi', phase: 0 };
    expect(nativeStrength(c, 0)).toEqual({ size: 1, defenders: 1, defender: 'warrior', walls: false });
    expect(nativeStrength(c, 240)).toEqual({ size: 5, defenders: 2, defender: 'phalanx', walls: true });
    expect(nativeStrength(c, 100_000).size).toBe(NATIVE_MAX_SIZE);
  });
});
