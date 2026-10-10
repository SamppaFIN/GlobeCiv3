/**
 * discoveries.ts — what scouts find (STORY-027, design 4a).
 *
 * About one land tile in DISCOVERY_EVERY holds a discovery, picked from the game seed.
 * When a scout maps it, the game stops and offers two finds; the player keeps one and
 * the other is lost. The finds and their numbers are this game's own (rule 4), not
 * Civilization I's.
 */
import { hash } from '../globe/terrain';
import { tilesInRings } from './pathfinding';
import type { Units, World } from './units';

/** One land tile in this many holds a discovery. */
export const DISCOVERY_EVERY = 60;
/** Rings a lookout maps around its tile. */
export const LOOKOUT_RINGS = 4;

export type FindKind = 'fish' | 'ruins' | 'ore' | 'trail' | 'lookout';
export interface Yield { food: number; shield: number; trade: number }

export interface FindInfo {
  title: string;
  /** What choosing it does, under the title. */
  effect: string;
  /** The find in the card's sentence: "Tiedustelija löysi lahden ja vanhan raunion." */
  object: string;
  /** The HUD notice after the choice (ruins name the new scout instead). */
  done: string;
  /** Extra yield on the discovery tile. */
  bonus?: Yield;
}

export const FINDS: Record<FindKind, FindInfo> = {
  fish: { title: 'Kalaisat vedet', effect: '+2 ruokaa tälle ruudulle', object: 'kalaisan lahden', done: '+2 ruokaa löytöruudulle', bonus: { food: 2, shield: 0, trade: 0 } },
  ruins: { title: 'Vanhat rauniot', effect: 'Uusi tiedustelija liittyy joukkoon', object: 'vanhan raunion', done: '' },
  ore: { title: 'Malmisuoni', effect: '+2 tuotantoa tälle ruudulle', object: 'malmisuonen', done: '+2 tuotantoa löytöruudulle', bonus: { food: 0, shield: 2, trade: 0 } },
  trail: { title: 'Vanha kauppapolku', effect: '+2 kauppaa tälle ruudulle', object: 'vanhan kauppapolun', done: '+2 kauppaa löytöruudulle', bonus: { food: 0, shield: 0, trade: 2 } },
  lookout: { title: 'Näköalapaikka', effect: 'Kartoittaa ympäristön neljän ruudun säteeltä', object: 'näköalapaikan', done: 'Ympäristö kartoitettu neljän ruudun säteeltä' },
};
const KINDS = Object.keys(FINDS) as FindKind[];
/** Keeps discoveries independent of the terrain and resource hashes. */
const SALT = 0x2f6b1a3;

export interface Discovery {
  tile: number;
  /** Id of the scout that found it. */
  finder: number;
  finds: [FindKind, FindKind];
}

/** The two finds of a land tile, or null if it holds none. Only coastal land holds fish. */
export function discoveryAt(seed: number, tile: number, coastal: boolean): [FindKind, FindKind] | null {
  const u = (k: number) => hash(tile, k, 0, seed ^ SALT) * 0.5 + 0.5;
  if (u(0) >= 1 / DISCOVERY_EVERY) return null;
  const kinds = coastal ? KINDS : KINDS.filter(k => k !== 'fish');
  const a = Math.floor(u(1) * kinds.length) % kinds.length;
  const b = (a + 1 + (Math.floor(u(2) * (kinds.length - 1)) % (kinds.length - 1))) % kinds.length;
  return [kinds[a], kinds[b]];
}

/** The card's sentence about the two finds. */
export function discoverySentence(finds: [FindKind, FindKind]): string {
  return `Tiedustelija löysi ${FINDS[finds[0]].object} ja ${FINDS[finds[1]].object}. Valitse niistä toinen.`;
}

/**
 * Keep one find: a tile bonus is added to the tile, ruins add a scout on the tile and a
 * lookout maps around it. Returns the HUD notice.
 */
export function applyFind(kind: FindKind, d: Discovery, units: Units, world: World, bonuses: Map<number, Yield>): string {
  const info = FINDS[kind];
  if (info.bonus) {
    const b = bonuses.get(d.tile) ?? { food: 0, shield: 0, trade: 0 };
    bonuses.set(d.tile, { food: b.food + info.bonus.food, shield: b.shield + info.bonus.shield, trade: b.trade + info.bonus.trade });
  } else if (kind === 'ruins') {
    return `${info.title}: ${units.recruit(d.tile, world).name} liittyi joukkoon`;
  } else if (kind === 'lookout') {
    world.reveal(tilesInRings(d.tile, LOOKOUT_RINGS));
  }
  return `${info.title}: ${info.done}`;
}
