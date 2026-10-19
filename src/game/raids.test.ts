import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile } from '../globe/hexTiles';
import { tilesInRings } from './pathfinding';
import { banditWins, defencePower, raidStart, Raids, RAID_ONSET, uprising, type RaidWorld } from './raids';

const CITY = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const land = () => 1;

/** A raid world with soldiers in the city, rolls from a list, and a log of what befell it. */
function makeWorld(soldiers: number, rolls: number[]): RaidWorld & { soldiers: number; plundered: number } {
  return {
    soldiers,
    plundered: 0,
    cost: land,
    terrainOf: () => 'grassland',
    walls: () => false,
    defense: () => 1,
    defenders() { return this.soldiers; },
    loseDefender() { this.soldiers--; },
    plunder() { this.plundered++; },
    roll: () => rolls.shift() ?? 0.5,
  };
}

/** Run days until the band is gone; the events in order. */
function runOut(raids: Raids, world: RaidWorld): string[] {
  const events: string[] = [];
  for (let d = 0; d < 40 && raids.band; d++) events.push(...raids.day(world));
  return events;
}

describe('raids (Freeciv civ1 barbarians)', () => {
  it('a bandit beats a fortified soldier by attack 2 against defence 1 × terrain × 1.5', () => {
    expect([defencePower('grassland'), defencePower('forest'), defencePower('hills'), defencePower('mountains')]).toEqual([1.5, 2.25, 3, 4.5]);
    expect(banditWins('grassland')).toBeCloseTo(2 / 3.5);
    expect(banditWins('hills')).toBeCloseTo(0.4);
    // Walls: +200 % instead of the fortify bonus
    expect([defencePower('grassland', true), defencePower('hills', true)]).toEqual([3, 6]);
    expect(banditWins('grassland', true)).toBeCloseTo(0.4);
    // A phalanx (defense 2, STORY-043) holds twice as well
    expect(defencePower('hills', false, 2)).toBe(6);
    expect(banditWins('grassland', false, 2)).toBeCloseTo(0.4);
  });

  it('come from day 60 on, about one day in 30 per city', () => {
    const days = (cities: number) => Array.from({ length: 3000 }, (_, i) => i + RAID_ONSET).filter(d => uprising(42, d, cities)).length;
    expect(Array.from({ length: RAID_ONSET }, (_, d) => uprising(42, d, 5)).some(Boolean)).toBe(false);
    expect(days(1)).toBeGreaterThan(70);
    expect(days(1)).toBeLessThan(130);
    expect(days(3)).toBeGreaterThan(250);
    expect(days(3)).toBeLessThan(350);
  });

  it('start 5 to 8 tiles from the city on known land, the same tile for the same roll', () => {
    const known = new Set(tilesInRings(CITY, 6));
    const isLand = (id: number) => id % 3 !== 0;
    const near = new Set(tilesInRings(CITY, 4));
    for (const roll of [0, 0.37, 0.99]) {
      const tile = raidStart(CITY, roll, id => known.has(id), isLand)!;
      expect(known.has(tile) && !near.has(tile) && isLand(tile)).toBe(true);
      expect(raidStart(CITY, roll, id => known.has(id), isLand)).toBe(tile);
    }
    expect(raidStart(CITY, 0.5, id => near.has(id), isLand)).toBeNull();
  });

  it('walk to the city a tile a day, and attack when next to it', () => {
    const raids = new Raids();
    const from = raidStart(CITY, 0.5, () => true, () => true)!;
    expect(raids.start(CITY, from, 1, land)).toBe(true);
    const steps = raids.band!.bandits[0].path.length;
    expect(steps).toBeGreaterThanOrEqual(5);
    expect(raids.daysToCity(land)).toBe(steps);
    const world = makeWorld(1, [0.99]);
    const events: string[] = [];
    for (let d = 1; d < steps; d++) events.push(...raids.day(world));
    // Next to the city now: no fight yet
    expect(events).toEqual([]);
    expect(raids.band!.bandits[0].path).toEqual([CITY]);
    // A roll above the bandit's chance: the soldier wins, and the band is gone
    expect(raids.day(world)).toEqual(['repelled']);
    expect([raids.band, world.soldiers]).toEqual([null, 1]);
  });

  it('a won fight costs the city a soldier; with none left the band plunders it and leaves', () => {
    const raids = new Raids();
    raids.start(CITY, raidStart(CITY, 0.2, () => true, () => true)!, 2, land);
    // Every roll below the chance: the bandits win both fights, then plunder
    const world = makeWorld(2, [0, 0, 0, 0]);
    expect(runOut(raids, world)).toEqual(['won', 'won', 'plundered']);
    expect([world.soldiers, world.plundered, raids.band]).toEqual([0, 1, null]);
  });

  it('no way to the city, no band', () => {
    const raids = new Raids();
    const from = raidStart(CITY, 0.5, () => true, () => true)!;
    expect(raids.start(CITY, from, 1, id => (id === CITY ? Infinity : 1))).toBe(false);
    expect(raids.band).toBeNull();
  });

  it('nomads (STORY-066) fight with their own attack and keep their tribe in the save', () => {
    // A roll of 0.6: over a bandit's 2 / 3.5 against a soldier on grass, under a Legion's 3 / 4.5
    expect(banditWins('grassland', false, 1, 3)).toBeCloseTo(3 / 4.5);
    const fight = (nomads?: { attack: number; tribe: string }) => {
      const raids = new Raids();
      raids.start(CITY, raidStart(CITY, 0.5, () => true, () => true)!, 1, land, nomads);
      const world = makeWorld(1, Array(40).fill(0.6));
      return { events: runOut(raids, world), saved: raids };
    };
    expect(fight().events).toEqual(['repelled']);
    expect(fight({ attack: 3, tribe: 'Susiheimo' }).events).toEqual(['won', 'plundered']);
    const raids = new Raids();
    raids.start(CITY, raidStart(CITY, 0.5, () => true, () => true)!, 2, land, { attack: 3, tribe: 'Susiheimo' });
    expect(new Raids(raids.save()).band).toMatchObject({ attack: 3, tribe: 'Susiheimo' });
  });
});
