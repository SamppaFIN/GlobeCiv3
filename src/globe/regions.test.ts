import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, tileToSphere, type Tile } from './cubeSphere';
import { buildHexGrid } from './hexGrid';
import { CHILDREN, FIRST_TILE_LEVEL, hierarchyAt, MAX_TILE_REGIONS, nearestAndBorder, Regions, type RegionLevel } from './regions';

const { nodes, edges } = buildHexGrid(5, 5);
const regions = new Regions(nodes);
const states = regions.centers[0];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('Regions: states', () => {
  it('puts every hex centre in its own state', () => {
    states.forEach((c, i) => expect(regions.stateOf(c)).toBe(i));
  });

  it('makes exactly the hex grid edges into shared borders', () => {
    for (const [a, b] of edges) {
      const ca = states[a];
      const cb = states[b];
      const mid = ca.clone().add(cb).normalize();
      const toward = (c: THREE.Vector3) => mid.clone().addScaledVector(c, 1e-6).normalize();
      expect(regions.stateOf(toward(ca))).toBe(a);
      expect(regions.stateOf(toward(cb))).toBe(b);
      // No third state is closer (one expect per edge: 390k expect calls would hit the timeout)
      let closestOther = -Infinity;
      states.forEach((c, k) => {
        if (k !== a && k !== b) closestOther = Math.max(closestOther, mid.dot(c));
      });
      expect(closestOther).toBeLessThan(mid.dot(ca));
    }
  });

  it('gives each tile a state list that finds the true state and border at every level', () => {
    const rand = rng(7);
    for (let level = 0; level <= MAX_LEVEL; level++) {
      for (let t = 0; t < 12; t++) {
        const n = 2 ** level;
        const tile: Tile = { face: Math.floor(rand() * 6), level, x: Math.floor(rand() * n), y: Math.floor(rand() * n) };
        const cand = regions.candidatesForTile(tile);
        expect(cand.length).toBeLessThanOrEqual(MAX_TILE_REGIONS);
        const candCenters = cand.map(i => states[i]);
        for (let s = 0; s < 20; s++) {
          const p = tileToSphere(tile, rand(), rand());
          const exact = nearestAndBorder(p, states);
          const fromCand = nearestAndBorder(p, candCenters);
          expect(cand[fromCand.region]).toBe(exact.region);
          if (exact.border < 0.05) expect(fromCand.border).toBeCloseTo(exact.border, 12);
        }
      }
    }
  });
});

describe('Regions: provinces and city areas', () => {
  it('has 7 provinces per state and 7 city areas per province', () => {
    expect(regions.centers[1]).toHaveLength(states.length * CHILDREN);
    expect(regions.centers[2]).toHaveLength(states.length * CHILDREN * CHILDREN);
  });

  it('is deterministic for a seed and different for another', () => {
    const again = new Regions(nodes);
    const other = new Regions(nodes, 4242);
    expect(again.centers[2].every((c, i) => c.equals(regions.centers[2][i]))).toBe(true);
    expect(other.centers[2].filter((c, i) => !c.equals(regions.centers[2][i])).length).toBeGreaterThan(17000);
  });

  it('nests exactly: every centre lies inside its own parent', () => {
    regions.centers[1].forEach((c, p) => {
      expect(regions.stateOf(c)).toBe(Math.floor(p / CHILDREN));
      expect(regions.provinceOf(c)).toBe(p);
    });
    regions.centers[2].forEach((c, k) => {
      expect(regions.provinceOf(c)).toBe(Math.floor(k / CHILDREN));
      expect(regions.cityOf(c)).toBe(k);
    });
  });

  it('assigns every point to a city area inside its province inside its state', () => {
    const rand = rng(11);
    for (let i = 0; i < 2000; i++) {
      const p = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const s = regions.stateOf(p);
      const prov = regions.provinceOf(p);
      const city = regions.cityOf(p);
      expect(Math.floor(prov / CHILDREN)).toBe(s);
      expect(Math.floor(city / CHILDREN)).toBe(prov);
    }
  });

  it('gives each tile entries that find the true state, province and city area and their borders', () => {
    const rand = rng(23);
    const all = [0, 1, 2].flatMap(level =>
      regions.centers[level].map((center, id) => ({ center, level, id })),
    );
    // Exact hierarchy over all regions, as reference: siblings only
    const exactAt = (p: THREE.Vector3) => {
      const ids = [regions.stateOf(p), regions.provinceOf(p), regions.cityOf(p)];
      const border = ids.map((id, level) => {
        const parent = level === 0 ? -1 : Math.floor(id / CHILDREN);
        const own = regions.centers[level][id];
        const ownD = p.distanceToSquared(own);
        let b = Infinity;
        all.forEach(e => {
          if (e.level !== level || e.id === id) return;
          if (level > 0 && Math.floor(e.id / CHILDREN) !== parent) return;
          b = Math.min(b, (p.distanceToSquared(e.center) - ownD) / (2 * e.center.distanceTo(own)));
        });
        return b;
      });
      return { ids, border };
    };
    const BORDER_LIMIT: Record<RegionLevel, number> = { 0: 0.05, 1: 0.02, 2: 0.008 };
    let maxEntries = 0;
    for (let level = 0; level <= MAX_LEVEL; level++) {
      for (let t = 0; t < 6; t++) {
        const n = 2 ** level;
        const tile: Tile = { face: Math.floor(rand() * 6), level, x: Math.floor(rand() * n), y: Math.floor(rand() * n) };
        const entries = regions.entriesForTile(tile);
        maxEntries = Math.max(maxEntries, entries.length);
        expect(entries.length).toBeLessThanOrEqual(MAX_TILE_REGIONS);
        for (let s = 0; s < 15; s++) {
          const p = tileToSphere(tile, rand(), rand());
          const exact = exactAt(p);
          const hit = hierarchyAt(p, entries);
          for (const lv of [0, 1, 2] as RegionLevel[]) {
            if (level < FIRST_TILE_LEVEL[lv]) continue;
            const e = entries[hit.slots[lv]];
            expect(e.center.equals(regions.centers[lv][exact.ids[lv]]), `level ${lv} region at tile level ${level}`).toBe(true);
            if (exact.border[lv] < BORDER_LIMIT[lv]) expect(hit.border[lv]).toBeCloseTo(exact.border[lv], 12);
          }
        }
      }
    }
    console.log('[region-entries] most entries in a tile: ' + maxEntries);
  }, 120_000);
});
