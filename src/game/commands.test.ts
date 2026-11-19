import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { type AdvisorLevel, CITY_ADVISOR_LIST, PLANET_ADVISOR_LIST, PROVINCE_ADVISOR_LIST, STATE_ADVISOR_LIST } from './advisors';
import { neighbors, pointToTile } from '../globe/hexTiles';
import { buy, buyCost, foundCity, type City } from './cities';
import { CommandLog, execute, type Command, type CommandWorld } from './commands';
import { placeAll } from './placement';
import { tilesInRings } from './pathfinding';
import { Research } from './science';
import type { Terrain } from './terrainTypes';

// The placement test's ground: a grassland city with a hill, a mountain, a forest and the sea
const CENTRE = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const ring1 = neighbors(CENTRE);
const ring2 = tilesInRings(CENTRE, 2).filter(t => t !== CENTRE && !ring1.includes(t));
const [HILL, MOUNTAIN, FOREST, LOW] = ring1;
const SEA = ring2.find(t => neighbors(t).includes(LOW))!;
const terrains = new Map<number, Terrain>([[HILL, 'hills'], [MOUNTAIN, 'mountains'], [FOREST, 'forest'], [SEA, 'ocean']]);
const heights = new Map<number, number>([[CENTRE, 0.2], [HILL, 0.7], [MOUNTAIN, 1.8], [FOREST, 0.25], [LOW, 0.05]]);
const ground = { terrainOf: (t: number) => terrains.get(t) ?? 'grassland', heightOf: (t: number) => heights.get(t) ?? 0.2 };

/** A fresh game state: one city with a temple, research from scratch, coal found on the map. */
function world(): CommandWorld & { settled: number[]; founded: number[]; advisors: Record<string, string>; gold: number } {
  const c: City = foundCity([], CENTRE);
  c.buildings = ['temple'];
  placeAll(c, ground);
  const settled: number[] = [];
  const founded: number[] = [];
  const advisors: Record<string, string> = { city: 'none', province: 'none', state: 'none', planet: 'none' };
  const w: CommandWorld & { settled: number[]; founded: number[]; advisors: Record<string, string>; gold: number } = {
    gold: 100,
    cities: [c],
    research: new Research({ known: [], target: null, bulbs: 0, kinds: [] }),
    kindsFound: ['coal'],
    ground,
    settled,
    founded,
    advisors,
    advise: (level: AdvisorLevel, advisor: string) => { if (!({ city: CITY_ADVISOR_LIST, province: PROVINCE_ADVISOR_LIST, state: STATE_ADVISOR_LIST, planet: PLANET_ADVISOR_LIST }[level] as readonly string[]).includes(advisor)) return false; advisors[level] = advisor; return true; },
    // Only the marked site can be set out for, as the HUD's button
    found: (tile: number) => { if (tile !== FOREST) return false; founded.push(tile); return true; },
    settle: (tile: number) => { settled.push(tile); return true; },
    // As the game's: the price comes out of the treasury (STORY-098)
    buy: (tile: number) => {
      const city = w.cities.find(x => x.tile === tile);
      const price = city ? buy(city, w.gold) : null;
      if (price === null) return false;
      w.gold -= price;
      return true;
    },
  };
  return w;
}

describe('commands', () => {
  it('an advisor is one of its level\'s, or none (STORY-096)', () => {
    const w = world();
    expect(execute({ kind: 'advise', level: 'city', advisor: 'growth' }, w)).toBe(true);
    expect(execute({ kind: 'advise', level: 'state', advisor: 'growth' }, w)).toBe(false);
    expect(execute({ kind: 'advise', level: 'state', advisor: 'war' }, w)).toBe(true);
    expect(execute({ kind: 'advise', level: 'city', advisor: 'none' }, w)).toBe(true);
    expect(w.advisors).toEqual({ city: 'none', province: 'none', state: 'war', planet: 'none' });
  });

  it('buying pays what the build lacks, and a city with nothing to buy buys nothing (STORY-098)', () => {
    const w = world();
    const c = w.cities[0];
    const price = buyCost(c);
    expect(price).toBeGreaterThan(0);
    expect(execute({ kind: 'buy', city: c.tile }, w)).toBe(true);
    expect(w.gold).toBe(100 - price);
    expect(execute({ kind: 'buy', city: c.tile }, w)).toBe(false);
    expect(execute({ kind: 'buy', city: FOREST }, w)).toBe(false);
    expect(w.gold).toBe(100 - price);
  });

  it('a build needs its advance, as the city card asks', () => {
    const w = world();
    expect(execute({ kind: 'build', city: CENTRE, build: 'settler' }, w)).toBe(true);
    expect(w.cities[0].build).toBe('settler');
    expect(execute({ kind: 'build', city: CENTRE, build: 'granary' }, w)).toBe(false);
    expect(w.cities[0].build).toBe('settler');
    w.research.known.add('pottery');
    expect(execute({ kind: 'build', city: CENTRE, build: 'granary' }, w)).toBe(true);
    expect(execute({ kind: 'build', city: HILL, build: 'warrior' }, w)).toBe(false);
  });

  it('a study must be open: a kind once found, an advance once its needs are known', () => {
    const w = world();
    expect(execute({ kind: 'study', target: 'coal' }, w)).toBe(true);
    expect(w.research.target).toBe('coal');
    expect(execute({ kind: 'study', target: 'gold' }, w)).toBe(false);
    expect(execute({ kind: 'study', target: 'currency' }, w)).toBe(false);
    expect(w.research.target).toBe('coal');
  });

  it('a building moves only where it may stand', () => {
    const w = world();
    expect(execute({ kind: 'move', city: CENTRE, building: 'temple', tile: SEA }, w)).toBe(false);
    expect(execute({ kind: 'move', city: CENTRE, building: 'temple', tile: LOW }, w)).toBe(true);
    expect(w.cities[0].placed?.temple).toBe(LOW);
    expect(execute({ kind: 'move', city: CENTRE, building: 'market', tile: HILL }, w)).toBe(false);
  });

  it('founding and settling are the game\'s own: the command hands the tile over', () => {
    const w = world();
    expect(execute({ kind: 'settle', tile: MOUNTAIN }, w)).toBe(true);
    expect(execute({ kind: 'found', tile: HILL }, w)).toBe(false);
    expect(execute({ kind: 'found', tile: FOREST }, w)).toBe(true);
    expect([w.settled, w.founded]).toEqual([[MOUNTAIN], [FOREST]]);
  });

  it('the same commands on the same start give the same state (rule 7)', () => {
    const cmds: Command[] = [
      { kind: 'found', tile: FOREST },
      { kind: 'study', target: 'coal' },
      { kind: 'build', city: CENTRE, build: 'granary' },
      { kind: 'move', city: CENTRE, building: 'temple', tile: HILL },
      { kind: 'build', city: CENTRE, build: 'settler' },
      { kind: 'settle', tile: FOREST },
      { kind: 'move', city: CENTRE, building: 'temple', tile: LOW },
    ];
    const play = () => {
      const w = world();
      const log = new CommandLog();
      cmds.forEach((cmd, day) => { if (execute(cmd, w)) log.record(day, 'player', cmd); });
      return { cities: w.cities, research: w.research.save(), settled: w.settled, founded: w.founded, log: log.save() };
    };
    const a = play();
    expect(play()).toEqual(a);
    // The granary needs pottery, so that command changed nothing and is not in the log
    expect(a.log.map(e => e.cmd.kind)).toEqual(['found', 'study', 'move', 'build', 'settle', 'move']);
    expect(a.cities[0]).toMatchObject({ build: 'settler', placed: { temple: LOW } });
  });

  it('the log keeps its own copies', () => {
    const cmd: Command = { kind: 'settle', tile: HILL };
    const log = new CommandLog();
    log.record(3, 'city', cmd);
    (cmd as { tile: number }).tile = SEA;
    const saved = log.save();
    expect(saved).toEqual([{ day: 3, by: 'city', cmd: { kind: 'settle', tile: HILL } }]);
    (saved[0].cmd as { tile: number }).tile = SEA;
    expect(new CommandLog(log.save()).entries[0].cmd).toEqual({ kind: 'settle', tile: HILL });
  });
});
