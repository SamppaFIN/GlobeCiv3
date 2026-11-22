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
    cities: [{ id: 0, name: 'Aamuranta', tile: START_TILE, capital: true, size: 2, food: 7, shields: 3, build: 'settler', buildings: ['granary'], focus: 'food', entertainers: 1, native: true, placed: { granary: START_TILE + 1 } }],
    offers: [], offered: [START_TILE], lastOfferDay: 9, pendingSite: null,
    improvements: imp.entries(), raids: raids.save(), raidAlert: true,
    war: { target: START_TILE + 2, marching: true, losses: [[START_TILE + 2, { lost: 1, day: 10 }]], razed: [START_TILE + 3], routed: [5] },
    rivals: [{
      id: 1, nextId: 2,
      cities: [{ id: 0, name: 'Mielikkälä', tile: START_TILE + 40, capital: true, size: 2, food: 5, shields: 9, build: 'settler', buildings: [], focus: 'balanced', entertainers: 0 }],
      units: [{ id: 0, kind: 'warrior', tile: START_TILE + 40, path: [], wait: 0, home: 0, site: null }, { id: 1, kind: 'settler', tile: START_TILE + 41, path: [START_TILE + 42], wait: 1, home: 0, site: START_TILE + 43 }],
    }], ties: [{ met: true, state: 'war', attitude: -55, since: 9, lost: 0, offered: -1000, maps: 3 }], gold: 73, research: { known: ['pottery'], target: 'masonry', bulbs: 4, kinds: ['fish', 'horses'] }, tax: 30, lux: 10, gov: 'anarchy', anarchyUntil: 140, townAdvisor: 'roam', cityAdvisor: 'defend', provinceAdvisor: 'settle', stateAdvisor: 'science', planetAdvisor: 'conquer', targetState: 3, firsts: ['site', 'raid'],
    commands: [
      { day: 3, by: 'player', cmd: { kind: 'settle', tile: START_TILE + 5 } },
      { day: 4, by: 'player', cmd: { kind: 'found', tile: START_TILE + 6 } },
      { day: 9, by: 'city', cmd: { kind: 'build', city: START_TILE, build: 'granary' } },
      { day: 10, by: 'player', cmd: { kind: 'move', city: START_TILE, building: 'granary', tile: START_TILE + 1 } },
      { day: 11, by: 'state', cmd: { kind: 'study', target: 'masonry' } },
      { day: 12, by: 'player', cmd: { kind: 'advise', level: 'province', advisor: 'settle' } },
      { day: 13, by: 'state', cmd: { kind: 'buy', city: 7 } },
      // The answers to the cards the game stops for (STORY-095)
      { day: 14, by: 'player', cmd: { kind: 'site', accept: false } },
      { day: 15, by: 'city', cmd: { kind: 'raid', choice: 'buy' } },
      { day: 16, by: 'player', cmd: { kind: 'treaty', accept: true } },
      // The player's other acts (STORY-112), from index 10
      { day: 17, by: 'player', cmd: { kind: 'mode', unit: 0, mode: 'gather' } },
      { day: 17, by: 'player', cmd: { kind: 'task', unit: 1, task: 'improve' } },
      { day: 17, by: 'player', cmd: { kind: 'pick', tile: START_TILE + 7 } },
      { day: 17, by: 'player', cmd: { kind: 'skip' } },
      { day: 18, by: 'player', cmd: { kind: 'flag', tile: START_TILE + 8 } },
      { day: 18, by: 'player', cmd: { kind: 'focus', city: START_TILE, focus: 'production' } },
      { day: 18, by: 'player', cmd: { kind: 'tax', tax: 70 } },
      { day: 18, by: 'player', cmd: { kind: 'lux', lux: 20 } },
      { day: 19, by: 'player', cmd: { kind: 'revolution' } },
      { day: 19, by: 'player', cmd: { kind: 'plan', area: 40, plan: 'settle' } },
      { day: 19, by: 'player', cmd: { kind: 'line', line: 'research' } },
      { day: 19, by: 'player', cmd: { kind: 'aim', state: 7 } },
      { day: 20, by: 'player', cmd: { kind: 'pact', rival: 0, act: 'peace' } },
      { day: 20, by: 'player', cmd: { kind: 'trade', rival: 0, give: 'gold:25', get: 'advance:masonry' } },
    ],
    treaty: { rival: 0, kind: 'peace' },
    calmDays: 12,
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
    expect(broken(s => { s.cities[0].placed = { dragon: START_TILE }; })).toBeNull();
    expect(broken(s => { s.cities[0].placed.granary = -1; })).toBeNull();
    // The production chains (STORY-088)
    expect(broken(s => { s.cities[0].chain = { stock: { gold: 3 }, work: {}, site: null }; })).toBeNull();
    expect(broken(s => { s.cities[0].chain = { stock: { plank: -1 }, work: {}, site: null }; })).toBeNull();
    expect(broken(s => { s.cities[0].chain = { stock: {}, work: { dragon: 1 }, site: null }; })).toBeNull();
    expect(broken(s => { s.cities[0].chain = { stock: {}, work: {}, site: { building: 'temple', planks: 0, stones: 0, days: 0 } }; })).toBeNull();
    // The chronicle (STORY-106)
    expect(broken(s => { s.cities[0].history = [{ kind: 'prophecy', day: 1 }]; })).toBeNull();
    expect(broken(s => { s.cities[0].history = [{ kind: 'built', day: 1, building: 'dragon' }]; })).toBeNull();
    expect(broken(s => { s.cities[0].history = [{ kind: 'grew', day: -1, size: 3 }]; })).toBeNull();
    expect(broken(s => { s.cities[0].history = [{ kind: 'border', day: 1, rings: 6 }]; })).toBeNull();
    expect(broken(s => { s.cities[0].history = [{ kind: 'raid', day: 1, held: true, defender: { id: 1, name: 'x'.repeat(41) }, nomads: false }]; })).toBeNull();
    expect(broken(s => { s.cities[0].history = Array.from({ length: 41 }, () => ({ kind: 'grew', day: 1, size: 3 })); })).toBeNull();
    expect(broken(s => { s.research.kinds = ['unicorns']; })).toBeNull();
    expect(broken(s => { s.ties[0].state = 'truce'; })).toBeNull();
    expect(broken(s => { s.ties[0].attitude = 101; })).toBeNull();
    expect(broken(s => { s.research.target = 'unicorns'; })).toBeNull();
    // The command log (STORY-086)
    expect(broken(s => { s.commands[0].cmd.kind = 'nuke'; })).toBeNull();
    expect(broken(s => { s.commands[0].by = 'rival'; })).toBeNull();
    expect(broken(s => { s.commands[0].cmd.tile = TILE_COUNT; })).toBeNull();
    expect(broken(s => { s.commands[1].cmd.tile = -1; })).toBeNull();
    expect(broken(s => { s.commands[2].cmd.build = 'dragon'; })).toBeNull();
    expect(broken(s => { s.commands[3].cmd.building = 'warrior'; })).toBeNull();
    expect(broken(s => { s.commands[4].cmd.target = 'unicorns'; })).toBeNull();
    expect(broken(s => { s.commands[4].day = -1; })).toBeNull();
    expect(broken(s => { s.commands[5].cmd.advisor = 'war'; })).toBeNull();
    expect(broken(s => { s.commands[5].cmd.level = 'galaxy'; })).toBeNull();
    expect(broken(s => { s.commands = {}; })).toBeNull();
    expect(broken(s => { s.commands[7].cmd.accept = 'yes'; })).toBeNull();
    expect(broken(s => { s.commands[8].cmd.choice = 'flee'; })).toBeNull();
    // The player's other acts (STORY-112): every field checked by its kind
    expect(broken(s => { s.commands[10].cmd.unit = -1; })).toBeNull();
    expect(broken(s => { s.commands[10].cmd.mode = 'sleep'; })).toBeNull();
    expect(broken(s => { s.commands[11].cmd.task = 'rule'; })).toBeNull();
    expect(broken(s => { s.commands[12].cmd.tile = TILE_COUNT; })).toBeNull();
    expect(broken(s => { s.commands[14].cmd.tile = 'here'; })).toBeNull();
    expect(broken(s => { s.commands[15].cmd.focus = 'gold'; })).toBeNull();
    expect(broken(s => { s.commands[16].cmd.tax = 100; })).toBeNull();
    expect(broken(s => { s.commands[17].cmd.lux = 25; })).toBeNull();
    expect(broken(s => { s.commands[19].cmd.area = 362 * 49; })).toBeNull();
    expect(broken(s => { s.commands[19].cmd.plan = 'burn'; })).toBeNull();
    expect(broken(s => { s.commands[20].cmd.line = 'conquer'; })).toBeNull();
    expect(broken(s => { s.commands[21].cmd.state = 362; })).toBeNull();
    expect(broken(s => { s.commands[22].cmd.rival = 1; })).toBeNull();
    expect(broken(s => { s.commands[22].cmd.act = 'surrender'; })).toBeNull();
    expect(broken(s => { s.commands[23].cmd.give = 'gold:1000'; })).toBeNull();
    expect(broken(s => { s.commands[23].cmd.get = 'advance:fire'; })).toBeNull();
    expect(broken(s => { s.commands[10].cmd.unit = 1.5; })).toBeNull();
    expect(broken(s => { s.commands[15].cmd.city = TILE_COUNT; })).toBeNull();
    expect(broken(s => { s.commands[21].cmd.state = -1; })).toBeNull();
    expect(broken(s => { s.commands[22].cmd.rival = -1; })).toBeNull();
    // Only the checked fields are kept
    expect(broken(s => { s.commands[13].cmd.extra = 1; })!.commands![13].cmd).toEqual({ kind: 'skip' });
    // A rival's proposal waiting (STORY-095): one of the rivals, an alliance or peace
    expect(broken(s => { s.treaty.rival = 1; })).toBeNull();
    expect(broken(s => { s.treaty.kind = 'truce'; })).toBeNull();
    expect(broken(s => { delete s.treaty; })!.treaty).toBeUndefined();
    expect(broken(s => { s.treaty = null; })!.treaty).toBeUndefined();
    // The calm days (STORY-095): a count, missing in older saves
    expect(broken(s => { s.calmDays = -1; })).toBeNull();
    expect(broken(s => { s.calmDays = 1.5; })).toBeNull();
    expect('calmDays' in broken(s => { delete s.calmDays; })!).toBe(false);
    // A kind of resource is a study too (STORY-072)
    expect(broken(s => { s.research.target = 'gold'; })?.research.target).toBe('gold');
    expect(validateSave(null, LIMITS)).toBeNull();
    expect(validateSave('{"version":1}', LIMITS)).toBeNull();
    expect(validateSave([], LIMITS)).toBeNull();
  });

  it('a save from before the city level\'s own advisors gets the one its city area\'s advisor stood for (STORY-105)', () => {
    const { data } = playedSave();
    const old: any = JSON.parse(JSON.stringify(data));
    delete old.townAdvisor;
    expect(validateSave(old, LIMITS)).toMatchObject({ townAdvisor: 'build', cityAdvisor: 'defend' });
    // While only the city level was open, the city area's advisor was the city's: the city area has none yet
    old.progress.openLevel = 4;
    expect(validateSave(old, LIMITS)).toMatchObject({ townAdvisor: 'build', cityAdvisor: 'none' });
    expect(validateSave({ ...data, townAdvisor: 'dragon' }, LIMITS)).toBeNull();
  });

  it('a city of chains comes back mid-chain, and a city of a save from before has none (STORY-088)', () => {
    const { data } = playedSave();
    expect(validateSave(data, LIMITS)!.cities[0].chain).toBeUndefined();
    const mid: any = JSON.parse(JSON.stringify(data));
    mid.cities[0].buildings = ['lumberjack', 'sawmill'];
    mid.cities[0].chain = { stock: { log: 1, plank: 2, stone: 0 }, work: { lumberjack: 1 }, site: { building: 'quarry', planks: 1, stones: 0, days: 0 } };
    expect(validateSave(mid, LIMITS)).toEqual(mid);
  });

  it('a worker comes back with its road, and goes on as before (STORY-093)', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    const worker = units.spawn('worker', START_TILE, world, 0);
    worker.job = { tile: START_TILE + 1, kind: 'road', days: 2, left: 2 };
    const { data } = playedSave();
    const withWorker: any = JSON.parse(JSON.stringify({ ...data, units: units.save() }));
    const back = validateSave(withWorker, LIMITS)!;
    expect(back).toEqual(withWorker);
    const again = new Units(START_TILE, world, back.units);
    expect(again.units.find(u => u.kind === 'worker')).toMatchObject({ name: 'Työläinen 1', task: 'improve', home: 0, job: { kind: 'road', left: 2 } });
  });

  it('a city\'s culture comes back, and a save from before has none, so its border starts from the size (STORY-093)', () => {
    const { data } = playedSave();
    expect(validateSave(data, LIMITS)!.cities[0].culture).toBeUndefined();
    const grown: any = JSON.parse(JSON.stringify(data));
    grown.cities[0].culture = 37;
    expect(validateSave(grown, LIMITS)).toEqual(grown);
    for (const bad of [-1, 1.5, '37']) {
      grown.cities[0].culture = bad;
      expect(validateSave(grown, LIMITS)).toBeNull();
    }
  });

  it('a city\'s chronicle comes back as it was, rebuilt field by field, and a save from before has none (STORY-106)', () => {
    const { data } = playedSave();
    expect(validateSave(data, LIMITS)!.cities[0].history).toBeUndefined();
    const told: any = JSON.parse(JSON.stringify(data));
    told.cities[0].history = [
      { kind: 'founded', day: 0, founder: 'Uudisasukas Aino', terrain: 'forest', resource: null, near: { name: 'Kuusela', tile: START_TILE } },
      { kind: 'built', day: 4, building: 'temple' },
      { kind: 'grew', day: 30, size: 3 },
      { kind: 'raid', day: 63, held: true, defender: { id: 5, name: 'Soturi Kalervo' }, nomads: false },
      { kind: 'era', day: 80, era: 'iron' },
      { kind: 'taken', day: 81, from: null },
      { kind: 'early', until: 20, count: 3 },
      { kind: 'border', day: 90, rings: 3 },
    ];
    expect(validateSave(told, LIMITS)).toEqual(told);
    // Extra fields stay behind
    told.cities[0].history[1].script = 'alert(1)';
    expect(validateSave(told, LIMITS)!.cities[0].history![1]).toEqual({ kind: 'built', day: 4, building: 'temple' });
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
    expect(s.war).toEqual({ target: null, marching: false, losses: [], razed: [], routed: [] });
    expect('native' in s.cities[0]).toBe(false);
  });

  it('a save from before the command log (STORY-086) has none, and a command keeps only its own fields', () => {
    const { data } = playedSave();
    const old: any = JSON.parse(JSON.stringify(data));
    delete old.commands;
    expect('commands' in validateSave(old, LIMITS)!).toBe(false);
    const extra: any = JSON.parse(JSON.stringify(data));
    extra.commands[0].cmd.build = 'granary';
    extra.commands[0].note = 'x';
    expect(validateSave(extra, LIMITS)!.commands![0]).toEqual({ day: 3, by: 'player', cmd: { kind: 'settle', tile: START_TILE + 5 } });
  });

  it('what stopped the game once is saved; a save from before (STORY-017) has nothing, and an unknown kind is refused', () => {
    const { data } = playedSave();
    expect(validateSave(JSON.parse(JSON.stringify(data)), LIMITS)!.firsts).toEqual(['site', 'raid']);
    const old: any = JSON.parse(JSON.stringify(data));
    delete old.firsts;
    expect(validateSave(old, LIMITS)!.firsts).toEqual([]);
    const bad: any = JSON.parse(JSON.stringify(data));
    bad.firsts = ['site', 'treaty'];
    expect(validateSave(bad, LIMITS)).toBeNull();
  });

  it('a save from before the level goals (STORY-087) loads, and its place in the old goal chain is dropped', () => {
    const { data } = playedSave();
    const old: any = JSON.parse(JSON.stringify(data));
    old.goal = 7;
    const loaded = validateSave(old, LIMITS)!;
    expect('goal' in loaded).toBe(false);
    expect(loaded.progress).toEqual(data.progress);
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
