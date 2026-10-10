import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile, tileCenter } from '../globe/hexTiles';
import { applyFind, DISCOVERY_EVERY, discoveryAt, discoverySentence, LOOKOUT_RINGS, type Discovery, type FindKind, type Yield } from './discoveries';
import { MapState } from './mapping';
import { tilesInRings } from './pathfinding';
import { Units, type World } from './units';

const SEED = 42;
const SAMPLE = 200_000;

describe('discoveries', () => {
  it('hold about one land tile in DISCOVERY_EVERY, the same for the same seed', () => {
    let count = 0;
    const kinds = new Set<FindKind>();
    for (let id = 0; id < SAMPLE; id++) {
      const d = discoveryAt(SEED, id, true);
      if (!d) continue;
      count++;
      d.forEach(k => kinds.add(k));
      expect(d[0]).not.toBe(d[1]);
      expect(discoveryAt(SEED, id, true)).toEqual(d);
    }
    // Binomial: mean SAMPLE / 60 ≈ 3333, standard deviation ≈ 57
    expect(count).toBeGreaterThan(SAMPLE / DISCOVERY_EVERY - 250);
    expect(count).toBeLessThan(SAMPLE / DISCOVERY_EVERY + 250);
    expect([...kinds].sort()).toEqual(['fish', 'lookout', 'ore', 'ruins', 'trail']);
  });

  it('depend on the seed, and only coastal land holds fish', () => {
    const sites = (seed: number) => Array.from({ length: 20_000 }, (_, id) => id).filter(id => discoveryAt(seed, id, false));
    expect(sites(SEED)).not.toEqual(sites(SEED + 1));
    for (const id of sites(SEED)) expect(discoveryAt(SEED, id, false)).not.toContain('fish');
  });

  it('describe both finds in one sentence', () => {
    expect(discoverySentence(['fish', 'ruins'])).toBe('Tiedustelija löysi kalaisan lahden ja vanhan raunion. Valitse niistä toinen.');
  });
});

describe('a chosen find', () => {
  const START = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
  function setup() {
    const map = new MapState();
    const world: World = {
      cost: () => 1,
      isMapped: id => map.isMapped(id),
      hasResource: () => false,
      reveal: ids => { map.reveal(ids); },
      siteScore: id => -tileCenter(id).angleTo(tileCenter(START)),
      cityOf: () => 0,
    };
    const units = new Units(START, world);
    const tile = tilesInRings(START, 6).at(-1)!;
    const d: Discovery = { tile, finder: 1, finds: ['ruins', 'fish'] };
    return { map, world, units, d, bonuses: new Map<number, Yield>() };
  }

  it('adds its bonus to the tile, twice over if found twice', () => {
    const { world, units, d, bonuses } = setup();
    expect(applyFind('fish', d, units, world, bonuses)).toBe('Kalaisat vedet: +2 ruokaa löytöruudulle');
    applyFind('ore', d, units, world, bonuses);
    applyFind('fish', d, units, world, bonuses);
    expect(bonuses.get(d.tile)).toEqual({ food: 4, shield: 2, trade: 0 });
  });

  it('ruins add a scout on the tile, which maps around itself', () => {
    const { map, world, units, d, bonuses } = setup();
    expect(map.isMapped(d.tile)).toBe(false);
    expect(applyFind('ruins', d, units, world, bonuses)).toBe('Vanhat rauniot: Tiedustelija 3 liittyi joukkoon');
    const scout = units.units.at(-1)!;
    expect(units.units).toHaveLength(4);
    expect([scout.kind, scout.tile, scout.mode]).toEqual(['scout', d.tile, 'explore']);
    expect(tilesInRings(d.tile, units.sight).every(id => map.isMapped(id))).toBe(true);
    expect(bonuses.size).toBe(0);
  });

  it('a lookout maps four rings around the tile', () => {
    const { map, world, units, d, bonuses } = setup();
    const ring = tilesInRings(d.tile, LOOKOUT_RINGS);
    expect(ring.some(id => map.isMapped(id))).toBe(true); // the start's sight reaches it
    applyFind('lookout', d, units, world, bonuses);
    expect(ring.every(id => map.isMapped(id))).toBe(true);
  });
});
