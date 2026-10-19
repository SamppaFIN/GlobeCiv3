import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { neighbors, pointToTile } from '../globe/hexTiles';
import { findPath, tilesInRings } from './pathfinding';
import type { Unit } from './units';
import { armyNeeded, attackWins, defendersLeft, MAX_ARMY, War, type WarWorld } from './war';

const CITY = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());

const attacker = (id: number, tile: number): Unit => ({ id, kind: 'swordsman', name: `Miekkamies ${id}`, tile, mode: 'defend', path: [], wait: 0, carrying: false, gathered: 0, home: 0, task: 'found', job: null });

/** A world with a city of `full` defenders, rolls from a list, and a log of what befell it. */
function makeWorld(full: number, rolls: number[], army: Unit[], size = 3): WarWorld & { fallen: number; taken: number } {
  return {
    fallen: 0,
    taken: 0,
    defence: () => ({ full, defense: 1, walls: false, terrain: 'grassland' }),
    path: (from, to) => findPath(from, to, () => 1),
    roll: () => rolls.shift() ?? 0.5,
    lose(u) { army.splice(army.indexOf(u), 1); this.fallen++; },
    take(_, u) { u.tile = CITY; this.taken++; return size > 1 ? 'taken' : 'razed'; },
  };
}

/** Walk the army a day as Units.day does: a step for each unit with a path. */
const walk = (army: Unit[]) => { for (const u of army) if (u.path.length) u.tile = u.path.shift()!; };

describe('campaigns (Freeciv civ1 combat)', () => {
  it('an attacker wins by A / (A + D): a sword of 3 against a fortified soldier on grass, a phalanx behind walls on hills', () => {
    expect(attackWins(3, 'grassland', false, 1)).toBeCloseTo(3 / 4.5);
    expect(attackWins(4, 'grassland', false, 1)).toBeCloseTo(4 / 5.5);
    expect(attackWins(3, 'hills', true, 2)).toBeCloseTo(3 / 15);
  });

  it('fallen defenders come back one each ten days', () => {
    expect(defendersLeft(3, undefined, 50)).toBe(3);
    expect(defendersLeft(3, { lost: 2, day: 50 }, 50)).toBe(1);
    expect(defendersLeft(3, { lost: 2, day: 50 }, 60)).toBe(2);
    expect(defendersLeft(3, { lost: 2, day: 50 }, 90)).toBe(3);
    expect(defendersLeft(2, { lost: 3, day: 0 }, 5)).toBe(0);
  });

  it('an army is big enough to beat the defenders by the odds, with one more to take the city', () => {
    expect(armyNeeded(0, 0.5)).toBe(1);
    expect(armyNeeded(1, 2 / 3)).toBe(3);
    expect(armyNeeded(2, 1)).toBe(3);
    expect(armyNeeded(3, 0.25)).toBe(MAX_ARMY);
  });

  it('the army waits until it is big enough, marches, beats the defenders and takes the city', () => {
    const far = tilesInRings(CITY, 4).find(t => !tilesInRings(CITY, 3).includes(t))!;
    const army = [attacker(1, far), attacker(2, far)];
    const war = new War();
    war.setTarget(CITY);
    const world = makeWorld(2, [0.1, 0.1, 0.1], army);
    // Three attackers wanted
    expect(war.day(army, world, 100, 3)).toEqual([]);
    expect(war.marching).toBe(false);
    // One still on its way to the gathering city turns to the target as the army sets off
    army.push({ ...attacker(3, far), path: [far, far, far] });
    const events: string[] = [...war.day(army, world, 100, 3)];
    expect(war.marching).toBe(true);
    expect(neighbors(CITY)).toContain(army[2].path.at(-1));
    walk(army);
    for (let d = 101; d < 120 && war.target !== null; d++) {
      events.push(...war.day(army, world, d, 3));
      walk(army);
    }
    expect(war.marching).toBe(false);
    expect(events).toEqual(['won', 'won', 'taken']);
    expect(world.taken).toBe(1);
    expect(war.target).toBeNull();
    expect(army.every(u => u.tile === CITY || neighbors(CITY).includes(u.tile))).toBe(true);
  });

  it('a fallen army stops the march, and a city of size 1 is destroyed', () => {
    const next = neighbors(CITY)[0];
    const army = [attacker(1, next)];
    const war = new War();
    war.setTarget(CITY);
    army.push(attacker(2, next));
    const world = makeWorld(1, [0.9, 0.9], army);
    expect(war.day(army, world, 10, 2)).toEqual(['lost', 'lost']);
    expect(army.length).toBe(0);
    expect(war.marching).toBe(false);
    const again = [attacker(3, next), attacker(4, next)];
    const small = makeWorld(1, [0.1], again, 1);
    expect(war.day(again, small, 11, 2)).toEqual(['won', 'razed']);
    expect(war.razed.has(CITY)).toBe(true);
    expect(new War(war.save()).razed.has(CITY)).toBe(true);
  });

  it('a tribe of nomads (STORY-066) is scattered, not taken, and stays so in the save', () => {
    const next = neighbors(CITY)[0];
    const army = [attacker(1, next), attacker(2, next)];
    const war = new War();
    war.setTarget(CITY);
    const world: WarWorld = { ...makeWorld(1, [0.1], army), take: () => 'routed' };
    expect(war.day(army, world, 5, 2)).toEqual(['won', 'routed']);
    expect([war.target, war.marching, war.razed.size]).toEqual([null, false, 0]);
    war.routed.add(9);
    expect(new War(war.save()).routed.has(9)).toBe(true);
  });
});
