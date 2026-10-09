import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, tileToSphere, type Tile } from './cubeSphere';
import { buildHexGrid } from './hexGrid';
import { MAX_TILE_REGIONS, nearestAndBorder, Regions } from './regions';

const { nodes, edges } = buildHexGrid(5, 5);
const regions = new Regions(nodes);

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('Regions', () => {
  it('puts every hex centre in its own region', () => {
    regions.centers.forEach((c, i) => expect(regions.regionOf(c)).toBe(i));
  });

  it('makes exactly the hex grid edges into shared borders', () => {
    for (const [a, b] of edges) {
      const ca = regions.centers[a];
      const cb = regions.centers[b];
      const mid = ca.clone().add(cb).normalize();
      // Just off the midpoint on either side lies in the respective region
      const toward = (c: THREE.Vector3) => mid.clone().addScaledVector(c, 1e-6).normalize();
      expect(regions.regionOf(toward(ca))).toBe(a);
      expect(regions.regionOf(toward(cb))).toBe(b);
      // No third region is closer at the midpoint, so the border between a and b exists there
      const own = mid.dot(ca);
      regions.centers.forEach((c, k) => {
        if (k !== a && k !== b) expect(mid.dot(c)).toBeLessThan(own);
      });
    }
  });

  it('gives each tile a candidate list that finds the true region and border at every level', () => {
    const rand = rng(7);
    const all = regions.centers;
    for (let level = 0; level <= MAX_LEVEL; level++) {
      for (let t = 0; t < 12; t++) {
        const n = 2 ** level;
        const tile: Tile = { face: Math.floor(rand() * 6), level, x: Math.floor(rand() * n), y: Math.floor(rand() * n) };
        const cand = regions.candidatesForTile(tile);
        expect(cand.length).toBeLessThanOrEqual(MAX_TILE_REGIONS);
        const candCenters = cand.map(i => all[i]);
        for (let s = 0; s < 20; s++) {
          const p = tileToSphere(tile, rand(), rand());
          const exact = nearestAndBorder(p, all);
          const fromCand = nearestAndBorder(p, candCenters);
          expect(cand[fromCand.region]).toBe(exact.region);
          // The nearest border must be among the candidates wherever a border could be drawn
          if (exact.border < 0.05) expect(fromCand.border).toBeCloseTo(exact.border, 12);
        }
      }
    }
  });
});
