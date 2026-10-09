import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GlobeCamera } from './camera';
import { MAX_LEVEL, pointToTile, tileKey, type Tile } from './cubeSphere';
import { TileManager } from './tiles';

const R = 5;
const W = 1280;
const H = 800;

function setup(dist: number) {
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  const rig = new GlobeCamera(R, camera, { minDist: R * 2e-5, maxDist: R * 6, startDist: dist });
  rig.target.set(0.35, 0.42, 0.84).normalize();
  rig.forward.set(0, 1, 0);
  rig.apply();
  const tiles = new TileManager(R);
  tiles.budgetMs = 1e9; // build everything requested in the same frame
  return { camera, rig, tiles };
}

function settle(tiles: TileManager, camera: THREE.PerspectiveCamera) {
  for (let i = 0; i < 200; i++) {
    const s = tiles.update(camera, H, 1 / 60);
    if (s.queue === 0 && s.created === 0) return s;
  }
  throw new Error('tiles did not settle');
}

const keys = (tiles: TileManager) => tiles.drawnTiles().map(tileKey).sort().join(' ');

function isAncestor(a: Tile, b: Tile): boolean {
  if (a.face !== b.face || a.level >= b.level) return false;
  const shift = b.level - a.level;
  return (b.x >> shift) === a.x && (b.y >> shift) === a.y;
}

const DISTANCES = Array.from({ length: 30 }, (_, i) => Math.exp(Math.log(R * 6) + ((Math.log(R * 2e-5) - Math.log(R * 6)) * i) / 29));

describe('TileManager', () => {
  it('keeps the same tiles while the camera stands still', () => {
    for (const d of [R * 3, R * 0.05, R * 1e-3, R * 2e-5]) {
      const { camera, tiles } = setup(d);
      settle(tiles, camera);
      const first = keys(tiles);
      for (let i = 0; i < 60; i++) {
        tiles.update(camera, H, 1 / 60);
        expect(keys(tiles)).toBe(first);
      }
    }
  });

  it('does not flicker when tiles hover around the split threshold', () => {
    // Keep the camera still (so visibility cannot change) and swing only the
    // screen-size scale across the thresholds; only LOD decisions are affected.
    for (const d of DISTANCES) {
      const { camera, tiles } = setup(d);
      settle(tiles, camera);
      const seen: string[] = [];
      for (let i = 0; i < 30; i++) {
        tiles.update(camera, H * (i % 2 ? 1.01 : 0.99), 1 / 60);
        seen.push(keys(tiles));
      }
      // After at most a couple of frames of refinement the drawn set is stable
      expect(new Set(seen.slice(10)).size).toBe(1);
    }
  }, 120_000);

  it('never draws a tile together with its ancestor, and leaves no visible holes', () => {
    for (const d of [R * 3, R * 0.3, R * 0.01, R * 1e-4]) {
      const { camera, rig, tiles } = setup(d);
      settle(tiles, camera);
      const drawn = tiles.drawnTiles();
      for (const a of drawn) for (const b of drawn) expect(isAncestor(a, b)).toBe(false);
      const drawnKeys = new Set(drawn.map(tileKey));
      for (let ix = -0.9; ix <= 0.9; ix += 0.3) {
        for (let iy = -0.9; iy <= 0.9; iy += 0.3) {
          const p = rig.raycast(new THREE.Vector2(ix, iy));
          if (!p) continue;
          const covered = drawn.some(t => drawnKeys.has(tileKey(pointToTile(p, t.level))) && tileKey(pointToTile(p, t.level)) === tileKey(t));
          expect(covered, `hole at ndc ${ix.toFixed(1)},${iy.toFixed(1)} from ${d}`).toBe(true);
        }
      }
    }
  });

  it('keeps the number of drawn tiles bounded from orbit down to level 17', () => {
    const rows: { dist: string; level: number; drawn: number }[] = [];
    for (const d of DISTANCES) {
      const { camera, tiles } = setup(d);
      const s = settle(tiles, camera);
      rows.push({ dist: (d / R).toExponential(1) + 'R', level: s.maxLevel, drawn: s.drawn });
      expect(s.drawn).toBeGreaterThan(0);
      expect(s.drawn).toBeLessThanOrEqual(600);
    }
    expect(rows[rows.length - 1].level).toBe(MAX_LEVEL);
    console.log('[tile-counts] ' + JSON.stringify(rows));
  }, 120_000);
});
