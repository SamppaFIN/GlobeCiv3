import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, tileToSphere, type Tile } from './cubeSphere';
import { colorFor, heightRange, octave, octavesFor, octaveSplit, splitNoise, terrainAt, terrainHeight } from './terrain';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
const rand = rng(99);
const randomTile = (level: number): Tile => {
  const n = 2 ** level;
  return { face: Math.floor(rand() * 6), level, x: Math.floor(rand() * n), y: Math.floor(rand() * n) };
};

describe('terrain', () => {
  it('is a deterministic function of seed, point and level', () => {
    const p = new THREE.Vector3(0.3, -0.5, 0.81).normalize();
    for (const level of [0, 8, 17]) {
      expect(terrainAt(p, level, 42)).toEqual(terrainAt(p, level, 42));
      // The radius does not matter; normalising p × 5 may differ from p in the last bit
      expect(terrainAt(p.clone().multiplyScalar(5), level, 42).height).toBeCloseTo(terrainAt(p, level, 42).height, 12);
    }
    // Different seeds give different worlds
    let differ = 0;
    for (let i = 0; i < 50; i++) {
      const q = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      if (terrainHeight(q, 10, 1) !== terrainHeight(q, 10, 2)) differ++;
    }
    expect(differ).toBe(50);
  });

  it('agrees on the shared edge of neighbouring tiles', () => {
    for (let level = 0; level <= MAX_LEVEL; level += 3) {
      for (let t = 0; t < 10; t++) {
        const n = 2 ** level;
        const a = randomTile(level);
        if (a.x === n - 1) a.x--; // keep a right neighbour on the same face
        const b: Tile = { ...a, x: a.x + 1 };
        for (let s = 0; s <= 8; s++) {
          const j = s / 8;
          const pa = tileToSphere(a, 1, j);
          const pb = tileToSphere(b, 0, j);
          expect(pa.distanceTo(pb)).toBeLessThan(1e-12);
          expect(terrainAt(pa, level)).toEqual(terrainAt(pb, level));
        }
      }
    }
  });

  it('keeps a coarse level close to the average of the next level', () => {
    // Height, not colour: colour has hard thresholds (coastline), height is what is averaged.
    // Bound: the mean difference stays under a quarter of the added octave's amplitude.
    const worst: number[] = [];
    for (let level = 0; level <= MAX_LEVEL; level += 1) {
      const tile = randomTile(level);
      let sum = 0;
      const N = 16;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const p = tileToSphere(tile, (i + 0.5) / N, (j + 0.5) / N);
          sum += terrainHeight(p, octavesFor(level + 1)) - terrainHeight(p, octavesFor(level));
        }
      }
      const meanDiff = Math.abs(sum / (N * N));
      const added = octave(octavesFor(level), 0).amp;
      worst.push(meanDiff / added);
      expect(meanDiff).toBeLessThan(0.25 * added);
    }
    console.log('[coarse-vs-fine] mean diff / added amplitude per level: ' + worst.map(w => w.toFixed(3)).join(' '));
  });

  it('takes the climate from latitude (|y|), not from a map row', () => {
    const land = 0.2;
    expect(colorFor(land, 0.0)).toEqual(colorFor(land, 0.5));
    expect(colorFor(land, 0.95)).toEqual([0.95, 0.95, 0.97]);
    // Same |y| on different faces gives the same climate
    const a = new THREE.Vector3(0.1, 0.9, 0.42).normalize();
    const b = new THREE.Vector3(-0.42, 0.9, -0.1).normalize();
    expect(colorFor(land, Math.abs(a.y))).toEqual(colorFor(land, Math.abs(b.y)));
  });

  it('splits per-pixel octaves so float32 is precise enough at every level', () => {
    let worst = 0;
    for (let level = 0; level <= MAX_LEVEL; level++) {
      const tile = randomTile(level);
      const center = tileToSphere(tile, 0.5, 0.5);
      for (let k = level; k < level + 10; k++) {
        const split = octaveSplit(center, k);
        for (let s = 0; s < 10; s++) {
          const p = tileToSphere(tile, rand(), rand());
          const local = p.clone().sub(center);
          const direct = heightRange(p, k, k + 1) / split.amp;
          const viaSplit = splitNoise(split, local);
          worst = Math.max(worst, Math.abs(direct - viaSplit));
        }
      }
    }
    console.log('[split-precision] worst octave value error: ' + worst.toExponential(2));
    expect(worst).toBeLessThan(1e-3);
  });
});
