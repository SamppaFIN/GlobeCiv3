import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile } from '../globe/hexTiles';
import { cityRings } from './cities';
import { BORDER_MAX, borderRings, cultureGain, heldByBorder, HOLD_BY_BORDER, provinceCover, ringsAround, tileOwner, type BorderSource } from './culture';
import { tilesInRings } from './pathfinding';

const A = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const source = (id: number, tile: number, size: number, culture = 0, owner = 0): BorderSource => ({ id, tile, size, culture, owner });

describe('culture (Freeciv civ2civ3 History)', () => {
  it('comes from the palace and the buildings', () => {
    expect(cultureGain({ capital: false, buildings: [] })).toBe(0);
    expect(cultureGain({ capital: true, buildings: [] })).toBe(1);
    expect(cultureGain({ capital: true, buildings: ['temple', 'library', 'colosseum', 'granary'] })).toBe(5);
    expect(cultureGain({ capital: false, buildings: ['colossus', 'gardens', 'greatwall'] })).toBe(7);
  });
});

describe('borders', () => {
  it('grow from radius_sq 5 + size, and a ring for culture, up to five rings', () => {
    expect([1, 3, 4, 10, 11, 19, 20].map(s => borderRings(s))).toEqual([2, 2, 3, 3, 4, 4, 5]);
    // 20 culture adds one to radius_sq: size 3 has 8, with 20 culture 9, three rings
    expect(borderRings(3, 19)).toBe(2);
    expect(borderRings(3, 20)).toBe(3);
    expect(borderRings(1, 10_000)).toBe(BORDER_MAX);
  });

  it('always hold the work area', () => {
    for (let size = 1; size <= 30; size++) expect(borderRings(size)).toBeGreaterThanOrEqual(cityRings(size));
  });

  it('list the tiles with their ring', () => {
    const r = ringsAround(A, 3);
    expect(new Set(r.map(([t]) => t))).toEqual(new Set(tilesInRings(A, 3)));
    expect(r[0]).toEqual([A, 0]);
    expect(r.filter(([, ring]) => ring === 1)).toHaveLength(6);
  });

  it('give a tile two cities claim to the stronger, then the lower id', () => {
    const ring = ringsAround(A, 6);
    const far = ring.find(([, r]) => r === 4)![0];
    // A size 1 city has two rings; a size 9 city four tiles away has three: no overlap at size 1
    const small = source(0, A, 1), big = source(1, far, 9);
    const owned = tileOwner([small, big]);
    expect(owned.get(A)).toBe(small);
    expect(owned.get(far)).toBe(big);
    // Between them, two from each: the bigger wins, (9+2)² / 4 > (1+2)² / 4
    const between = ringsAround(A, 2).filter(([t, r]) => r === 2 && ringsAround(far, 2).some(([u, q]) => u === t && q === 2));
    expect(between.length).toBeGreaterThan(0);
    for (const [t] of between) expect(owned.get(t)).toBe(big);
    // Equal cities: the lower id
    const tie = tileOwner([source(5, A, 9), source(2, far, 9)]);
    for (const [t] of between) expect(tie.get(t)!.id).toBe(2);
  });

  it('count the land they cover in each province, and hold a province from ten tiles', () => {
    const owned = tileOwner([source(0, A, 20)]);
    expect(owned.size).toBe(91);
    const cover = provinceCover(owned, 0, t => (t % 2 === 0 ? 1 : 2), () => true);
    expect([...cover.values()].reduce((a, b) => a + b, 0)).toBe(91);
    expect(provinceCover(owned, 1, () => 0, () => true).size).toBe(0);
    expect(heldByBorder(new Map([[3, HOLD_BY_BORDER], [4, HOLD_BY_BORDER - 1], [1, 40]]))).toEqual([1, 3]);
  });
});
