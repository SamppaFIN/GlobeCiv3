import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { neighbors, pointToTile } from '../globe/hexTiles';
import { foundCity, type City } from './cities';
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
function world(): CommandWorld & { settled: number[]; founded: number[] } {
  const c: City = foundCity([], CENTRE);
  c.buildings = ['temple'];
  placeAll(c, ground);
  const settled: number[] = [];
  const founded: number[] = [];
  return {
    cities: [c],
    research: new Research({ known: [], target: null, bulbs: 0, kinds: [] }),
    kindsFound: ['coal'],
    ground,
    settled,
    founded,
    // Only the marked site can be set out for, as the HUD's button
    found: tile => { if (tile !== FOREST) return false; founded.push(tile); return true; },
    settle: tile => { settled.push(tile); return true; },
  };
}

describe('commands', () => {
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
