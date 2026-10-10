import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFogTexture, FOG_FACE, FOG_WIDTH, fogTexel, paintMapped } from '../globe/fogMap';
import { neighbors, TILE_COUNT, tileCenter } from '../globe/hexTiles';
import { MapState, withNeighbors } from './mapping';

describe('mapping', () => {
  it('keeps a mapped tile mapped and reports only new tiles', () => {
    const map = new MapState();
    const first = withNeighbors(1000);
    expect(first).toHaveLength(7);
    expect(map.reveal(first)).toEqual(first);
    expect(map.count).toBe(7);
    // Revealing again (and overlapping) maps only the new ones
    const more = [...neighbors(first[1]), 1000];
    const fresh = map.reveal(more);
    expect(fresh.every(id => !first.includes(id))).toBe(true);
    expect(map.count).toBe(7 + fresh.length);
    for (const id of [...first, ...more]) expect(map.isMapped(id)).toBe(true);
    expect(map.share(first)).toBe(1);
    expect(map.share([1000, 5])).toBe(0.5);
  });
});

describe('fog map', () => {
  it('puts every direction on a texel of its own cube face', () => {
    let s = 9;
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let k = 0; k < 2000; k++) {
      const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5);
      const t = fogTexel(v.x, v.y, v.z);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(FOG_WIDTH * FOG_FACE);
      // The column tells the face: the axis of the largest component
      const face = Math.floor((t % FOG_WIDTH) / FOG_FACE);
      const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
      const axis = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
      expect(Math.floor(face / 2)).toBe(axis);
      // Scaling the direction does not move it
      expect(fogTexel(v.x * 3, v.y * 3, v.z * 3)).toBe(t);
    }
  });

  it('paints a mapped tile over its footprint and leaves the rest fogged', () => {
    const data = createFogTexture().image.data as Uint8Array;
    const id = Math.floor(TILE_COUNT / 3);
    paintMapped(data, [id]);
    const c = tileCenter(id);
    expect(data[fogTexel(c.x, c.y, c.z)]).toBe(255);
    // A tile ten steps away is still fogged
    let far = id;
    for (let k = 0; k < 10; k++) far = neighbors(far).reduce((best, nb) => (tileCenter(nb).distanceTo(c) > tileCenter(best).distanceTo(c) ? nb : best));
    const f = tileCenter(far);
    expect(data[fogTexel(f.x, f.y, f.z)]).toBe(0);
    expect(data.reduce((sum, v) => sum + (v ? 1 : 0), 0)).toBeLessThanOrEqual(7);
  });
});
