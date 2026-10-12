/**
 * raids.ts — bandits raid the cities (STORY-034).
 *
 * Civilization I's barbarians, with the numbers from Freeciv (GPL):
 *  - uprisings begin on turn 60 (common/game.h GAME_DEFAULT_ONSETBARBARIAN, commit 5068ce7b)
 *  - an uprising starts 5 to 8 tiles from the city (server/barbarian.h MIN_UNREST_DIST and
 *    MAX_UNREST_DIST) on land the city's owner knows, and a small civ is spared: it comes
 *    only when a roll of 1 to 30 is at most cities × (rate − 1), with the normal rate 2
 *    (server/barbarian.c try_summon_barbarians, commit 3ac17fea)
 *  - land barbarians are Cavalry, attack 2 (data/civ1/units.ruleset, role "Barbarian")
 *  - every unit has 10 hit points and firepower 10, so one round decides a fight, and the
 *    attacker wins it with probability A / (A + D) (server/unittools.c unit_versus_unit).
 *    The defender gets its terrain's defense_bonus (terrain.ruleset) and +50 % fortified
 *    in a city (effects.ruleset); a soldier is Militia, defense 1, a phalanx 2 (units.ruleset). City
 *    walls give +200 % instead of the fortify bonus (effects.ruleset, STORY-038)
 * One day is one turn. Own simplifications: one band at a time, of one or two bandits
 * (Freeciv: two to four and a leader); bandits move a tile a day like the other units; only
 * soldiers defend; and a band that finds no defender plunders the city and leaves (its food
 * and shields, and a citizen above size 1), where Freeciv's barbarians would take it.
 */
import { hash } from '../globe/terrain';
import { findPath, tilesInRings } from './pathfinding';
import type { Terrain } from './terrainTypes';
import type { RaidsSave } from './save';

export const RAID_ONSET = 60;
const UNREST_MIN = 5;
const UNREST_MAX = 8;
const RATE = 2;
export const BANDIT_ATTACK = 2;
export const SOLDIER_DEFENSE = 1;
const FORTIFIED = 1.5;
const WALLS = 3;
const DEFENSE_BONUS: Partial<Record<Terrain, number>> = { forest: 50, hills: 100, jungle: 50, mountains: 200, swamp: 50 };

/** Keeps raids independent of the other hashes of the seed. */
const SALT = 0x5ab1e;
/** A number in [0, 1) from the seed, the day and k. */
export const raidRoll = (seed: number, day: number, k: number) => Math.min(0.999999, hash(day, k, 0, seed ^ SALT) * 0.5 + 0.5);

/** Whether an uprising comes today against a civ of `cities` cities. */
export function uprising(seed: number, day: number, cities: number): boolean {
  return day >= RAID_ONSET && Math.floor(raidRoll(seed, day, 0) * 30) + 1 <= cities * (RATE - 1);
}

/** A soldier's defence in a city on this terrain: fortified, or behind walls; a phalanx has defense 2. */
export const defencePower = (terrain: Terrain, walls = false, defense = SOLDIER_DEFENSE) => defense * (1 + (DEFENSE_BONUS[terrain] ?? 0) / 100) * (walls ? WALLS : FORTIFIED);

/** The chance that a bandit beats a soldier defending a city on this terrain. */
export const banditWins = (terrain: Terrain, walls = false, defense = SOLDIER_DEFENSE) => BANDIT_ATTACK / (BANDIT_ATTACK + defencePower(terrain, walls, defense));

/** Where an uprising starts: a known land tile 5 to 8 tiles from the city, from a roll in [0, 1). */
export function raidStart(city: number, roll: number, known: (id: number) => boolean, isLand: (id: number) => boolean): number | null {
  const near = new Set(tilesInRings(city, UNREST_MIN - 1));
  const tiles = tilesInRings(city, UNREST_MAX).filter(id => !near.has(id) && known(id) && isLand(id));
  return tiles.length ? tiles[Math.floor(roll * tiles.length)] : null;
}

export interface Bandit { id: number; tile: number; path: number[]; wait: number }
export interface Band { city: number; bandits: Bandit[] }

export interface RaidWorld {
  cost(id: number): number;
  terrainOf(id: number): Terrain;
  /** The city on this tile has walls. */
  walls(city: number): boolean;
  /** Soldiers in the city on this tile, and the best one's defense (STORY-043). */
  defenders(city: number): number;
  defense(city: number): number;
  /** The best of them falls. */
  loseDefender(city: number): void;
  /** The city loses its stores and a citizen. */
  plunder(city: number): void;
  /** A roll in [0, 1) for the k-th fight of the day. */
  roll(k: number): number;
}

export type RaidEvent = 'repelled' | 'won' | 'plundered';

export class Raids {
  band: Band | null = null;
  private nextId = 1;

  /** No band, or a saved game's (STORY-036). */
  constructor(saved?: RaidsSave) {
    if (!saved) return;
    this.band = saved.band;
    this.nextId = saved.nextId;
  }

  save(): RaidsSave {
    return { band: this.band && { city: this.band.city, bandits: this.band.bandits.map(b => ({ ...b, path: [...b.path] })) }, nextId: this.nextId };
  }

  /** A band of `size` bandits sets off from a tile toward a city; false when no way leads there. */
  start(city: number, from: number, size: number, cost: (id: number) => number): boolean {
    const path = findPath(from, city, cost);
    if (!path?.length) return false;
    this.band = { city, bandits: Array.from({ length: size }, () => ({ id: this.nextId++, tile: from, path: [...path], wait: 0 })) };
    return true;
  }

  /**
   * A day of the band: bandits walk toward the city, and one next to it attacks a soldier
   * there. The events of the day, in order.
   */
  day(world: RaidWorld): RaidEvent[] {
    const band = this.band;
    if (!band) return [];
    const events: RaidEvent[] = [];
    for (const b of [...band.bandits]) {
      if (b.wait > 0) { b.wait--; continue; }
      if (b.path.length > 1) {
        b.tile = b.path.shift()!;
        b.wait = world.cost(b.tile) - 1;
        continue;
      }
      if (!world.defenders(band.city)) {
        world.plunder(band.city);
        this.band = null;
        return [...events, 'plundered'];
      }
      if (world.roll(events.length) < banditWins(world.terrainOf(band.city), world.walls(band.city), world.defense(band.city))) {
        world.loseDefender(band.city);
        events.push('won');
      } else {
        band.bandits.splice(band.bandits.indexOf(b), 1);
        events.push('repelled');
      }
    }
    if (!band.bandits.length) this.band = null;
    return events;
  }

  /** Days until the first bandit reaches the city. */
  daysToCity(cost: (id: number) => number): number {
    if (!this.band) return 0;
    return Math.min(...this.band.bandits.map(b => b.wait + b.path.slice(0, -1).reduce((d, id) => d + cost(id), 0) + 1));
  }
}
