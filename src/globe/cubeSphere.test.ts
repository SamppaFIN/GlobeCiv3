import { describe, expect, it } from 'vitest';
import { children, MAX_LEVEL, pointToTile, tileCenter, tileCorners, tileKey, type Tile } from './cubeSphere';

// Deterministic pseudo-random integers so failures are reproducible
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const LEVELS = [0, 5, 10, MAX_LEVEL];

describe('cubeSphere', () => {
  it('maps a tile centre back to the same tile on every face and level', () => {
    const rand = rng(42);
    for (let face = 0; face < 6; face++) {
      for (const level of LEVELS) {
        for (let i = 0; i < 20; i++) {
          const n = 2 ** level;
          const tile: Tile = { face, level, x: Math.floor(rand() * n), y: Math.floor(rand() * n) };
          expect(tileKey(pointToTile(tileCenter(tile), level))).toBe(tileKey(tile));
        }
      }
    }
  });

  it('places tile centres and corners on the unit sphere', () => {
    const tile: Tile = { face: 3, level: 10, x: 517, y: 12 };
    for (const p of [tileCenter(tile), ...tileCorners(tile)]) {
      expect(p.length()).toBeCloseTo(1, 12);
    }
  });

  it('splits a tile into four children that share its outer corners', () => {
    const parent: Tile = { face: 4, level: 7, x: 33, y: 90 };
    const [c00, c10, c01, c11] = children(parent);
    const [p00, p10, p01, p11] = tileCorners(parent);
    expect(tileCorners(c00)[0].distanceTo(p00)).toBeLessThan(1e-12);
    expect(tileCorners(c10)[1].distanceTo(p10)).toBeLessThan(1e-12);
    expect(tileCorners(c01)[2].distanceTo(p01)).toBeLessThan(1e-12);
    expect(tileCorners(c11)[3].distanceTo(p11)).toBeLessThan(1e-12);
    for (const child of [c00, c10, c01, c11]) {
      expect(tileKey(pointToTile(tileCenter(child), parent.level))).toBe(tileKey(parent));
    }
  });

  it('keeps neighbouring tiles on adjacent faces seamless', () => {
    // The right edge of the last column on face 0 (+X) must lie on the cube edge it shares with another face
    const level = 4;
    const n = 2 ** level;
    const edgeTile: Tile = { face: 0, level, x: n - 1, y: 5 };
    const [, p10, , p11] = tileCorners(edgeTile);
    for (const p of [p10, p11]) {
      const ax = Math.abs(p.x), ay = Math.abs(p.y), az = Math.abs(p.z);
      // On a cube edge between +X and a Z face, |x| equals |z| after projection
      expect(Math.abs(ax - Math.max(ay, az))).toBeLessThan(1e-12);
    }
  });
});
