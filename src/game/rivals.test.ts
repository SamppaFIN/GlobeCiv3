import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile, tileCenter } from '../globe/hexTiles';
import { workedYield } from './cities';
import { findPath, tilesInRings } from './pathfinding';
import { buildHexGrid } from '../globe/hexGrid';
import { Regions } from '../globe/regions';
import { MAX_RIVAL_CITIES, RIVAL_ORDER, Rival, rivalStarts, type RivalWorld } from './rivals';
import { foundCity } from './cities';

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

  it('war (STORY-077): it researches in its own order, and at war its cities nearest the target build the army', () => {
    const r = new Rival(0);
    const c = r.found(START);
    // Trade for science: an ocean-free world of plains has none, so the research waits for a target
    r.day(makeWorld(r), new Set());
    expect(r.research.target).toBe(RIVAL_ORDER[0]);
    r.units.push({ id: 0, kind: 'warrior', tile: START, path: [], wait: 0, home: c.id, site: null });
    // No attacker known: it builds as in peace
    r.enemy = { tile: START + 50, need: 3 };
    expect(r.nextBuild(c)).not.toBe('horseman');
    r.research.known.add('horseback');
    expect(r.bestAttacker()).toBe('horseman');
    expect(r.nextBuild(c)).toBe('horseman');
    r.research.known.add('iron');
    expect(r.nextBuild(c)).toBe('swordsman');
    // Enough of an army, or in peace: as before
    for (let k = 0; k < 3; k++) r.units.push({ id: 10 + k, kind: 'swordsman', tile: START, path: [], wait: 0, home: c.id, site: null });
    expect(r.nextBuild(c)).not.toBe('swordsman');
    expect(r.army()).toHaveLength(3);
  });

  it('its soldiers walk their paths a tile a day', () => {
    const r = new Rival(0);
    r.found(START);
    const to = tilesInRings(START, 2).at(-1)!;
    const full = findPath(START, to, () => 1)!;
    const path = full[0] === START ? full.slice(1) : full;
    r.units.push({ id: 0, kind: 'horseman', tile: START, path: [...path], wait: 0, home: 0, site: null });
    r.day(makeWorld(r), new Set());
    expect(r.units[0].tile).toBe(path[0]);
    r.day(makeWorld(r), new Set());
    expect(r.units[0].tile).toBe(path[1]);
  });

  it('a city lost goes with its units, the others keep their ids as indices; a city gained keeps its name with a citizen fewer', () => {
    const r = new Rival(2);
    const [a, b, c] = [r.found(START), r.found(START + 100), r.found(START + 200)];
    r.units.push({ id: 0, kind: 'warrior', tile: a.tile, path: [], wait: 0, home: 0, site: null }, { id: 1, kind: 'warrior', tile: b.tile, path: [], wait: 0, home: 1, site: null }, { id: 2, kind: 'warrior', tile: c.tile, path: [], wait: 0, home: 2, site: null });
    r.lose(a);
    expect(r.cities.map(x => [x.id, x.name])).toEqual([[0, b.name], [1, c.name]]);
    expect(r.cities[0].capital).toBe(true);
    expect(r.units.map(u => u.home)).toEqual([0, 1]);
    const theirs = foundCity([], START + 300);
    Object.assign(theirs, { name: 'Aamuranta', size: 4, buildings: ['granary'] });
    expect(r.gain(theirs)).toMatchObject({ id: 2, name: 'Aamuranta', size: 3, capital: false, buildings: ['granary'] });
    expect(new Rival(2, r.save()).save()).toEqual(r.save());
  });
});
