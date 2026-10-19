/**
 * nomads.ts — tribes of nomads in the states next to the player's (STORY-066; Sami
 * 2026-10-19: opponents of all three kinds). Freeciv's barbarians with its numbers (GPL):
 *  - a band is two to four (server/barbarian.c try_summon_barbarians, as in raids.ts) of
 *    Cavalry, attack 2 (role "Barbarian"), and from TRIBE_LEGION_DAY on of Legion, attack 3
 *    (role "BarbarianBuild"), both defense 1 (data/civ1/units.ruleset)
 *  - a tribe beaten pays the ransom, 100 gold (common/game.h RS_DEFAULT_RANSOM_GOLD)
 * Own: one tribe a state; its camp moves to other land of the state each TRIBE_MOVE_DAYS, and
 * from TRIBE_ONSET on it sends its band at the nearest city within TRIBE_REACH tiles about
 * once in TRIBE_RAID_DAYS. All of it is a function of the seed and the day (rule 3): only a
 * tribe beaten is the player's state.
 */
import { hash } from '../globe/terrain';

export const TRIBE_MOVE_DAYS = 40;
export const TRIBE_RAID_DAYS = 60;
export const TRIBE_REACH = 12;
export const TRIBE_ONSET = 120;
export const TRIBE_LEGION_DAY = 300;
export const RANSOM_GOLD = 100;

export interface Tribe { state: number; name: string; phase: number }

const SALT = 0x70a3d;
const roll = (seed: number, a: number, b: number) => Math.min(0.999999, hash(a, b, 11, seed ^ SALT) * 0.5 + 0.5);

const ANIMALS = ['Haukka', 'Susi', 'Karhu', 'Ilves', 'Kotka', 'Hirvi', 'Korppi', 'Ahma', 'Kettu', 'Joutsen', 'Peura', 'Näätä'];

/** The tribe of a state: an own name, and the day offset of its moves. */
export function tribeOf(seed: number, state: number): Tribe {
  return { state, name: `${ANIMALS[Math.floor(roll(seed, state, 0) * ANIMALS.length)]}heimo`, phase: Math.floor(roll(seed, state, 1) * TRIBE_MOVE_DAYS) };
}

/** The camp of a tribe on a day: one of its state's land tiles, another every TRIBE_MOVE_DAYS. */
export function tribeCamp(seed: number, tribe: Tribe, day: number, land: readonly number[]): number | null {
  if (!land.length) return null;
  const epoch = Math.floor((day + tribe.phase) / TRIBE_MOVE_DAYS);
  return land[Math.floor(roll(seed, tribe.state * 7919 + epoch, 2) * land.length)];
}

/** The tribe's band on a day: two to four, Cavalry and later Legion. */
export function tribeBand(seed: number, tribe: Tribe, day: number): { size: number; unit: 'cavalry' | 'legion'; attack: number } {
  const size = 2 + Math.floor(roll(seed, tribe.state, 3) * 3);
  return day >= TRIBE_LEGION_DAY ? { size, unit: 'legion', attack: 3 } : { size, unit: 'cavalry', attack: 2 };
}

/** Whether the tribe sets off on a raid today. */
export function tribeRaids(seed: number, tribe: Tribe, day: number): boolean {
  return day >= TRIBE_ONSET && roll(seed, tribe.state * 104729 + day, 4) < 1 / TRIBE_RAID_DAYS;
}
