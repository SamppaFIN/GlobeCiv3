import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildHexGrid } from './hexGrid';
import { CORNERS, FACES, FREQUENCY as F, latticeToTile, NEIGHBOR_OFFSETS, neighbors, pointToTile, TILE_COUNT, tileCenter, tileCities, tileIdAt, tilesWithin, tileToLattice } from './hexTiles';
import { CHILDREN, Regions } from './regions';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
const randomDir = (rand: () => number) => {
  // Uniform on the sphere
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), z);
};
/** Mean angle between neighbouring tile centres: the icosahedron edge angle over F. */
const SPACING = Math.acos(1 / Math.sqrt(5)) / F;

describe('hex tile grid', () => {
  it('numbers every lattice point of every face with exactly 10F² + 2 canonical ids', () => {
    expect(TILE_COUNT).toBe(10 * F * F + 2);
    const seen = new Uint8Array(TILE_COUNT);
    for (let f = 0; f < 20; f++) {
      for (let i = 0; i <= F; i++) {
        for (let j = 0; i + j <= F; j++) {
          const id = latticeToTile(f, i, j, F - i - j);
          if (id < 0 || id >= TILE_COUNT) throw new Error(`id ${id} out of range`);
          seen[id] = 1;
        }
      }
    }
    expect(seen.reduce((a, b) => a + b, 0)).toBe(TILE_COUNT);
  });

  it('maps ids to lattice points and back, including edges and corners', () => {
    const rand = rng(1);
    const ids = [...Array(12).keys(), 12, 13, 12 + 30 * (F - 1) - 1, 12 + 30 * (F - 1), TILE_COUNT - 1];
    for (let k = 0; k < 5000; k++) ids.push(Math.floor(rand() * TILE_COUNT));
    for (const id of ids) {
      const places = tileToLattice(id);
      expect(places.length === 1 || places.length === 2 || places.length === 5).toBe(true);
      for (const { face, ijk } of places) {
        expect(ijk[0] + ijk[1] + ijk[2]).toBe(F);
        expect(latticeToTile(face, ...ijk)).toBe(id);
        // Shared points give the same centre from every face
        const [a, b, c] = FACES[face];
        const p = new THREE.Vector3().addScaledVector(CORNERS[a], ijk[0]).addScaledVector(CORNERS[b], ijk[1]).addScaledVector(CORNERS[c], ijk[2]).normalize();
        expect(p.distanceTo(tileCenter(id))).toBeLessThan(1e-12);
      }
    }
  });

  it('finds the tile of its own centre and of points near it on every face', () => {
    const rand = rng(2);
    let checked = 0;
    for (let k = 0; k < 20000; k++) {
      const id = k < 12 ? k : Math.floor(rand() * TILE_COUNT);
      const c = tileCenter(id);
      expect(pointToTile(c)).toBe(id);
      // A point a fifth of a spacing away still belongs to the tile
      const off = randomDir(rand).cross(c).normalize().multiplyScalar(Math.tan(SPACING * 0.2));
      if (pointToTile(c.clone().add(off))) checked++;
      expect(pointToTile(c.clone().add(off).normalize())).toBe(id);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('puts every point within one spacing of its tile centre', () => {
    const rand = rng(3);
    let worst = 0;
    for (let k = 0; k < 20000; k++) {
      const p = randomDir(rand);
      worst = Math.max(worst, p.angleTo(tileCenter(pointToTile(p))));
    }
    expect(worst).toBeLessThan(SPACING);
  });

  it('gives 12 pentagons with 5 neighbours and symmetric hexagons with 6', () => {
    for (let c = 0; c < 12; c++) expect(neighbors(c).length).toBe(5);
    const rand = rng(4);
    for (let k = 0; k < 5000; k++) {
      const id = 12 + Math.floor(rand() * (TILE_COUNT - 12));
      const ns = neighbors(id);
      expect(ns.length).toBe(6);
      for (const n of ns) {
        expect(neighbors(n)).toContain(id);
        expect(tileCenter(n).angleTo(tileCenter(id))).toBeLessThan(SPACING * 1.4);
      }
    }
  });

  it('has a tile centre on every state centre (same icosahedron, F = 6 × 55)', () => {
    const { nodes } = buildHexGrid(5, 5);
    for (const n of nodes) {
      const dir = n.position.clone().normalize();
      // hexGrid rounds positions to 0.001 of a radius-5 globe
      expect(tileCenter(pointToTile(dir)).angleTo(dir)).toBeLessThan(5e-4);
    }
  });
});

describe('neighbours across face edges', () => {
  it('finds every neighbour by unfolding a step outside the face, as the shader does', () => {
    const rand = rng(6);
    const ids = [...Array(12).keys()];
    // Edge tiles and interior tiles next to an edge, where neighbours lie in another face
    for (let k = 0; k < 3000; k++) ids.push(12 + Math.floor(rand() * 30 * (F - 1)));
    for (let k = 0; k < 2000; k++) {
      const fi = Math.floor(rand() * 20);
      const j = 1 + Math.floor(rand() * (F - 2));
      ids.push(latticeToTile(fi, 1, j, F - 1 - j));
    }
    for (const id of ids) {
      const all = new Set<number>();
      const expected = neighbors(id).sort((a, b) => a - b);
      for (const { face, ijk } of tileToLattice(id)) {
        const found = new Set<number>();
        for (const [di, dj, dk] of NEIGHBOR_OFFSETS) {
          const n = tileIdAt(face, [ijk[0] + di, ijk[1] + dj, ijk[2] + dk]);
          if (n >= 0) { found.add(n); all.add(n); }
        }
        // From one face a pentagon reaches 4 of its 5 neighbours; the fifth lies two faces away
        if (id >= 12) expect([...found].sort((a, b) => a - b)).toEqual(expected);
        else for (const n of found) expect(expected).toContain(n);
      }
      expect([...all].sort((a, b) => a - b)).toEqual(expected);
    }
  });
});

describe('city areas as sets of tiles', () => {
  const regions = new Regions(buildHexGrid(5, 5).nodes);
  const cities = regions.centers[2];

  it('tabulates the city area of every tile as Regions.cityOf of its centre', () => {
    const t0 = performance.now();
    const table = tileCities(regions);
    console.log('[tile-cities] ' + TILE_COUNT + ' tiles in ' + (performance.now() - t0).toFixed(0) + ' ms');
    const rand = rng(8);
    // Where a centre lies exactly on a border, the two may pick different sides
    let ties = 0;
    for (let k = 0; k < 30000; k++) {
      const id = k < 12 ? k : Math.floor(rand() * TILE_COUNT);
      const c = tileCenter(id);
      const a = table[id];
      const b = regions.cityOf(c);
      if (a === b) continue;
      ties++;
      const level = Math.floor(a / 49) !== Math.floor(b / 49) ? 0 : Math.floor(a / 7) !== Math.floor(b / 7) ? 1 : 2;
      const div = [49, 7, 1][level];
      const centres = regions.centers[level];
      expect(Math.abs(c.dot(centres[Math.floor(a / div)]) - c.dot(centres[Math.floor(b / div)]))).toBeLessThan(1e-12);
    }
    expect(ties).toBeLessThan(30);
  });

  it('has about 61 tiles per city area, and every tile in its city is nested in its province', () => {
    const rand = rng(5);
    const counts: number[] = [];
    for (let k = 0; k < 300; k++) {
      const city = Math.floor(rand() * cities.length);
      const tiles = tilesWithin(cities[city], regions.inradius[2] * 4, (_, c) => regions.cityOf(c) === city);
      for (const id of tiles) expect(Math.floor(regions.cityOf(tileCenter(id)) / CHILDREN)).toBe(regions.provinceOf(tileCenter(id)));
      counts.push(tiles.length);
    }
    counts.sort((a, b) => a - b);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    console.log(`[tiles-per-city] min ${counts[0]} p10 ${counts[30]} median ${counts[150]} p90 ${counts[270]} max ${counts.at(-1)} mean ${mean.toFixed(1)}`);
    // Equal-area layout (regionLayout.ts): measured min 34, p10 54, median 62, p90 68, max 90
    expect(mean).toBeGreaterThan(58);
    expect(mean).toBeLessThan(65);
    expect(counts[30]).toBeGreaterThanOrEqual(50);
    expect(counts[270]).toBeLessThanOrEqual(72);
    expect(counts[0]).toBeGreaterThan(25);
  });
});
