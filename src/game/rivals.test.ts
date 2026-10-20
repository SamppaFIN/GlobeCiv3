import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile, tileCenter } from '../globe/hexTiles';
import { workedYield } from './cities';
import { findPath, tilesInRings } from './pathfinding';
import { buildHexGrid } from '../globe/hexGrid';
import { Regions } from '../globe/regions';
import { MAX_RIVAL_CITIES, Rival, rivalStarts, type RivalWorld } from './rivals';

const START = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
// Plains all round (1/1/0, the centre irrigated), so that a city has food and shields
const yieldOf = (_: number, centre: boolean) => workedYield({ terrain: 'plains', resource: null }, centre);

/** A world where a site is the nearest land four rings or more from every city of the rival. */
function makeWorld(rival: Rival): RivalWorld {
  const far = (t: number) => rival.cities.every(c => tileCenter(c.tile).angleTo(tileCenter(t)) > 0.0105);
  return {
    yieldOf,
    cost: () => 1,
    free: far,
    site: from => tilesInRings(from, 8).find(far) ?? null,
    path: (from, to) => findPath(from, to, () => 1),
  };
}

describe('rival civilizations (STORY-067)', () => {
  it('a capital of its own name, a soldier first, settlers from size 2, then a second soldier and gold', () => {
    const r = new Rival(0);
    const c = r.found(START);
    expect(c).toMatchObject({ name: 'Sariola', capital: true, size: 1 });
    expect(r.nextBuild(c)).toBe('warrior');
    r.units.push({ id: 0, kind: 'warrior', tile: START, path: [], wait: 0, home: c.id, site: null });
    expect(r.nextBuild(c)).toBe('warrior');
    c.size = 2;
    expect(r.nextBuild(c)).toBe('settler');
    for (let k = 1; k < MAX_RIVAL_CITIES; k++) r.found(START + k);
    expect(r.nextBuild(c)).toBe('warrior');
    r.units.push({ id: 1, kind: 'warrior', tile: START, path: [], wait: 0, home: c.id, site: null });
    expect(r.nextBuild(c)).toBe('coinage');
  });

  it('grows and spreads by the player\'s rules: its settlers walk to sites and found cities', () => {
    const r = new Rival(1);
    r.found(START);
    const world = makeWorld(r);
    const founded: string[] = [];
    for (let d = 0; d < 400; d++) for (const e of r.day(world, new Set())) if (e.kind === 'founded') founded.push(e.city.name);
    expect(founded.slice(0, 2)).toEqual(['Kuusela', 'Havumäki']);
    expect(r.cities.length).toBeGreaterThanOrEqual(3);
    expect(r.cities.length).toBeLessThanOrEqual(MAX_RIVAL_CITIES);
    expect(r.units.some(u => u.kind === 'warrior')).toBe(true);
    // The cities stand apart, and the capital grew
    for (const a of r.cities) for (const b of r.cities) if (a !== b) expect(tileCenter(a.tile).angleTo(tileCenter(b.tile))).toBeGreaterThan(0.0105);
    expect(r.cities[0].size).toBeGreaterThan(1);
  });

  it('leaves the tiles the player works, and comes back the same from a save', () => {
    const r = new Rival(2);
    const c = r.found(START);
    c.size = 3;
    const taken = new Set(tilesInRings(START, 1).filter(t => t !== START));
    r.day(makeWorld(r), taken);
    // Its citizens work the second ring, and add their tiles to the taken ones
    expect(taken.size).toBeGreaterThan(6);
    expect(new Rival(2, r.save()).save()).toEqual(r.save());
    expect(new Rival(2, r.save()).name).toBe('Ahtola');
  });

  it('start two or three to a game, two states from home and apart, the same for the same seed', () => {
    const regions = new Regions(buildHexGrid(5, 5).nodes);
    const n = regions.neighbors;
    for (const [seed, home] of [[42, 10], [7, 200], [99, 333]]) {
      const starts = rivalStarts(seed, home, n);
      expect(starts.length).toBeGreaterThanOrEqual(2);
      expect(starts.length).toBeLessThanOrEqual(3);
      for (const s of starts) {
        expect(s === home || n[home].includes(s)).toBe(false);
        expect(n[home].some(m => n[m].includes(s))).toBe(true);
        for (const t of starts) if (t !== s) expect(n[s].includes(t)).toBe(false);
      }
      expect(rivalStarts(seed, home, n)).toEqual(starts);
      // A state of sea is no start
      const sea = new Set(starts.slice(0, 1));
      expect(rivalStarts(seed, home, n, s => !sea.has(s))).not.toContain(starts[0]);
    }
  });
});
