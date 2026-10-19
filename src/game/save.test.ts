import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile, tileCenter, TILE_COUNT } from '../globe/hexTiles';
import { Improvements } from './improvements';
import { MapState } from './mapping';
import { Raids } from './raids';
import { SAVE_VERSION, validateSave, type SaveData } from './save';
import { Units, type World } from './units';

const LIMITS = { tiles: TILE_COUNT, cityAreas: 17738 };
const START = new THREE.Vector3(0.4, 0.3, 0.866).normalize();
const START_TILE = pointToTile(START);

/** A test world as in units.test: land everywhere but a "sea" east of the start. */
function makeWorld(map = new MapState()): World {
  return {
    cost: id => (tileCenter(id).x > 0.43 && tileCenter(id).y > 0.25 ? Infinity : 1),
    isMapped: id => map.isMapped(id),
    hasResource: () => false,
    reveal: ids => { map.reveal(ids); },
    siteScore: id => -tileCenter(id).angleTo(START),
    cityOf: id => Math.floor((tileCenter(id).y + 1) * 200),
  };
}

/** A save of a game played for some days, through JSON as it is stored. */
function playedSave(): { data: SaveData; units: Units; map: MapState } {
  const map = new MapState();
  const world = makeWorld(map);
  const units = new Units(START_TILE, world);
  for (let d = 0; d < 12; d++) units.day(world);
  const raids = new Raids();
  raids.start(START_TILE, units.units[1].tile, 2, () => 1);
  const imp = new Improvements();
  imp.add(START_TILE + 1, 'road');
  imp.add(START_TILE + 1, 'irrigation');
  const data: SaveData = {
    version: SAVE_VERSION, savedAt: 1_760_000_000_000, seed: 42, startCity: 1234, day: 12, speed: 4, paused: false,
    mapped: [...map.mapped.keys()].filter(i => map.mapped[i]), units: units.save(), selected: 1,
    progress: { openLevel: 3, meter: 'province' }, targetProvince: -1,
    discoveries: [{ tile: START_TILE, finder: 1 }], bonuses: [[START_TILE, { food: 2, shield: 0, trade: 0 }]], found: 1,
    cities: [{ id: 0, name: 'Aamuranta', tile: START_TILE, capital: true, size: 2, food: 7, shields: 3, build: 'settler', buildings: ['granary'], focus: 'food', entertainers: 1, native: true }],
    offers: [], offered: [START_TILE], lastOfferDay: 9, pendingSite: null,
    improvements: imp.entries(), raids: raids.save(), raidAlert: true,
    war: { target: START_TILE + 2, marching: true, losses: [[START_TILE + 2, { lost: 1, day: 10 }]], razed: [START_TILE + 3] }, gold: 73, research: { known: ['pottery'], target: 'masonry', bulbs: 4 }, tax: 30, goal: 3, lux: 10, gov: 'anarchy', anarchyUntil: 140, cityAdvisor: 'defend', provinceAdvisor: 'settle', stateAdvisor: 'science', planetAdvisor: 'conquer', targetState: 3,
  };
  return { data: JSON.parse(JSON.stringify(data)), units, map };
}

describe('saved game (STORY-036)', () => {
  it('comes back as it was saved', () => {
    const { data } = playedSave();
    expect(validateSave(data, LIMITS)).toEqual(data);
  });

  it('a find waiting in a save from before STORY-052 loads without its old choices', () => {
    const { data } = playedSave();
    const old = JSON.parse(JSON.stringify(data));
    old.discoveries[0].finds = ['fish', 'ruins'];
    expect(validateSave(old, LIMITS)!.discoveries).toEqual([{ tile: START_TILE, finder: 1 }]);
  });

  it('restored units, raids and improvements go on exactly as the originals', () => {
    const { data, units, map } = playedSave();
    const restored = new Units(START_TILE, makeWorld(map), validateSave(data, LIMITS)!.units);
    expect(restored.save()).toEqual(units.save());
    // Ten more days of both, each on its own copy of the map
    const mapA = new MapState(), mapB = new MapState();
    for (const id of data.mapped) { mapA.reveal([id]); mapB.reveal([id]); }
    const a = makeWorld(mapA), b = makeWorld(mapB);
    for (let d = 0; d < 10; d++) { units.day(a); restored.day(b); }
    expect(restored.save()).toEqual(units.save());
    expect(new Raids(data.raids).save()).toEqual(data.raids);
    expect(Improvements.from(data.improvements).entries()).toEqual(data.improvements);
  });

  it('is refused when any part is out of range, of the wrong kind or from another version', () => {
    const { data } = playedSave();
    const broken = (change: (s: any) => void) => {
      const s = JSON.parse(JSON.stringify(data));
      change(s);
      return validateSave(s, LIMITS);
    };
    expect(broken(s => { s.version = 2; })).toBeNull();
    expect(broken(s => { s.mapped.push(TILE_COUNT); })).toBeNull();
    expect(broken(s => { s.units.units[0].kind = 'dragon'; })).toBeNull();
    expect(broken(s => { s.units.units[0].tile = -1; })).toBeNull();
    expect(broken(s => { s.units.units[0].name = 'x'.repeat(41); })).toBeNull();
    expect(broken(s => { s.cities[0].size = 0; })).toBeNull();
    expect(broken(s => { s.cities[0].food = '7'; })).toBeNull();
    expect(broken(s => { s.day = 1.5; })).toBeNull();
    expect(broken(s => { s.speed = 3; })).toBeNull();
    expect(broken(s => { s.improvements[0][1] = ['bridge']; })).toBeNull();
    expect(broken(s => { s.raids.band.bandits[0].path = [1, , 3]; })).toBeNull();
    expect(broken(s => { delete s.units; })).toBeNull();
    expect(broken(s => { s.war.losses[0][1].lost = -1; })).toBeNull();
    expect(broken(s => { s.cities[0].native = 'yes'; })).toBeNull();
    expect(validateSave(null, LIMITS)).toBeNull();
    expect(validateSave('{"version":1}', LIMITS)).toBeNull();
    expect(validateSave([], LIMITS)).toBeNull();
  });

  it('a save from before gold and buildings (STORY-038) gets the start gold and no buildings', () => {
    const { data } = playedSave();
    const old: any = JSON.parse(JSON.stringify(data));
    delete old.gold;
    delete old.cities[0].buildings;
    const s = validateSave(old, LIMITS)!;
    expect([s.gold, s.cities[0].buildings]).toEqual([50, []]);
  });

  it('a save from before the campaigns (STORY-064) has none', () => {
    const { data } = playedSave();
    const old: any = JSON.parse(JSON.stringify(data));
    delete old.war;
    delete old.cities[0].native;
    const s = validateSave(old, LIMITS)!;
    expect(s.war).toEqual({ target: null, marching: false, losses: [], razed: [] });
    expect('native' in s.cities[0]).toBe(false);
  });

  it('keeps no property it did not check, and touches no prototype', () => {
    const { data } = playedSave();
    const raw = JSON.parse(JSON.stringify(data).replace('{"version"', '{"__proto__":{"polluted":true},"extra":"x","version"'));
    raw.cities[0].onclick = 'alert(1)';
    const s = validateSave(raw, LIMITS)!;
    expect(s).toEqual(data);
    expect('extra' in s || 'onclick' in s.cities[0]).toBe(false);
    expect(({} as any).polluted).toBeUndefined();
  });
});
