/**
 * war.ts — campaigns against the city-states (STORY-064; Sami 2026-10-19: attacks come only
 * from the advisors, the Kenraali at the state level). Civilization I's combat with Freeciv's
 * numbers (GPL), as for the bandits (raids.ts):
 *  - attack units (data/civ1/units.ruleset): Cavalry (own name Ratsumies) 20 shields, attack 2,
 *    Horseback Riding; Legion (Miekkamies) 20, attack 3, Iron Working; Chariot (Sotavaunut)
 *    40, attack 4, The Wheel; Catapult (Katapultti) 40, attack 6, Mathematics; all of them
 *    defense 1
 *  - every unit has 10 hit points and firepower 10, so one round decides a fight, and the
 *    attacker wins it with A / (A + D): the defender's defense with its terrain's bonus and
 *    +50 % fortified, or +200 % behind walls (defencePower)
 *  - a city taken loses a citizen, and one of size 1 is destroyed (server/citytools.c
 *    unit_conquer_city, commit 03c46b83)
 * Own: units move a tile a day (move_rate 2 is not used, as for the other units); the army
 * sets off when it can expect to beat the defenders, with one attacker more to take the
 * city (armyNeeded); a city-state's fallen defenders come back one each DEFENDER_RECOVERY_DAYS.
 */
import { hash } from '../globe/terrain';
import { neighbors } from '../globe/hexTiles';
import { defencePower } from './raids';
import type { Terrain } from './terrainTypes';
import type { Unit } from './units';

export type Attacker = 'horseman' | 'swordsman' | 'chariot' | 'catapult';
/** Weakest first. */
export const ATTACKERS: readonly Attacker[] = ['horseman', 'swordsman', 'chariot', 'catapult'];
export const isAttacker = (kind: string): kind is Attacker => (ATTACKERS as readonly string[]).includes(kind);
export const ATTACK: Record<Attacker, number> = { horseman: 2, swordsman: 3, chariot: 4, catapult: 6 };
export const ATTACKER_NAMES: Record<Attacker, string> = { horseman: 'Ratsumies', swordsman: 'Miekkamies', chariot: 'Sotavaunut', catapult: 'Katapultti' };
export const DEFENDER_RECOVERY_DAYS = 10;
/** The most attackers an army waits for. */
export const MAX_ARMY = 10;

/** Keeps the fights independent of the other hashes of the seed. */
const SALT = 0x3a7c0;
/** A number in [0, 1) from the seed, the day and k. */
export const warRoll = (seed: number, day: number, k: number) => Math.min(0.999999, hash(day, k, 1, seed ^ SALT) * 0.5 + 0.5);

/** The chance that an attacker beats a defender fortified in a city on this terrain. */
export const attackWins = (attack: number, terrain: Terrain, walls: boolean, defense: number) => attack / (attack + defencePower(terrain, walls, defense));

/**
 * Attackers an army waits for: those that beat `left` defenders on average when each fight
 * is won with `chance`, and one to take the city; at most MAX_ARMY.
 */
export const armyNeeded = (left: number, chance: number) => Math.min(MAX_ARMY, Math.ceil(left / chance) + 1);

/** A city-state's defenders lost, and the day of the last loss. */
export interface Losses { lost: number; day: number }

/** Defenders a city-state of `full` defenders has on a day after its losses. */
export function defendersLeft(full: number, losses: Losses | undefined, day: number): number {
  if (!losses) return full;
  const back = Math.floor((day - losses.day) / DEFENDER_RECOVERY_DAYS);
  return Math.max(0, full - Math.max(0, losses.lost - back));
}

export interface WarSave { target: number | null; marching: boolean; losses: [number, Losses][]; razed: number[]; routed: number[] }

/** What a campaign needs to know about the world. */
export interface WarWorld {
  /** The target's defenders at full strength, their defense, walls and terrain. */
  defence(tile: number): { full: number; defense: number; walls: boolean; terrain: Terrain };
  /** A path from a tile to another, or null. */
  path(from: number, to: number): number[] | null;
  roll(k: number): number;
  /** An attacker fell. */
  lose(u: Unit): void;
  /** A unit takes the city or destroys it, or scatters a tribe of nomads (STORY-066). */
  take(tile: number, u: Unit): 'taken' | 'razed' | 'routed';
}

export type WarEvent = 'won' | 'lost' | 'taken' | 'razed' | 'routed';

export class War {
  /** The city-state the army is sent against, or null. */
  target: number | null = null;
  /** The army has set off. */
  marching = false;
  readonly losses = new Map<number, Losses>();
  /** City-states destroyed. */
  readonly razed = new Set<number>();
  /** States whose tribe of nomads is scattered (STORY-066). */
  readonly routed = new Set<number>();

  constructor(saved?: WarSave) {
    if (!saved) return;
    this.target = saved.target;
    this.marching = saved.marching;
    for (const [tile, l] of saved.losses) this.losses.set(tile, l);
    for (const tile of saved.razed) this.razed.add(tile);
    for (const state of saved.routed) this.routed.add(state);
  }

  save(): WarSave {
    return { target: this.target, marching: this.marching, losses: [...this.losses], razed: [...this.razed], routed: [...this.routed] };
  }

  setTarget(tile: number | null) {
    if (tile === this.target) return;
    this.target = tile;
    this.marching = false;
  }

  /** Defenders the city-state on a tile has today. */
  left(tile: number, full: number, day: number): number {
    return defendersLeft(full, this.losses.get(tile), day);
  }

  /**
   * A day of the campaign, after the units have walked: once the army has the `need`
   * attackers it marches, and an attacker next to the city, with no steps left, attacks a
   * defender, or takes the city when none is left. The events of the day, in order.
   */
  day(army: readonly Unit[], world: WarWorld, day: number, need: number): WarEvent[] {
    const target = this.target;
    if (target === null) return [];
    const d = world.defence(target);
    if (!this.marching && army.length < need) return [];
    // Setting off, the army leaves the way to its gathering city
    if (!this.marching) for (const u of army) u.path = [];
    this.marching = army.length > 0;
    const size = army.length;
    const events: WarEvent[] = [];
    const around = neighbors(target);
    for (const u of [...army]) {
      if (!around.includes(u.tile)) {
        if (!u.path.length) u.path = world.path(u.tile, target)?.slice(0, -1) ?? [];
        continue;
      }
      if (u.path.length || u.wait > 0) continue;
      const left = this.left(target, d.full, day);
      if (left === 0) {
        const result = world.take(target, u);
        events.push(result);
        if (result === 'razed') this.razed.add(target);
        this.losses.delete(target);
        this.target = null;
        this.marching = false;
        return events;
      }
      if (world.roll(events.length) < attackWins(ATTACK[u.kind as Attacker], d.terrain, d.walls, d.defense)) {
        this.losses.set(target, { lost: d.full - left + 1, day });
        events.push('won');
      } else {
        world.lose(u);
        events.push('lost');
      }
    }
    // The whole army fell: the next one gathers first
    if (events.filter(e => e === 'lost').length === size) this.marching = false;
    return events;
  }
}
