/**
 * discoveries.ts — ruins the scouts find (STORY-027; STORY-052, Sami 2026-10-13: "Raunioita
 * tulee liikaa .. joko insta resursseja, muitakin yksiköitä, teknologiaa, ja harvoin uusia
 * tutkimusmatkoja. Älä anna käyttäjän valita").
 *
 * About one land tile in DISCOVERY_EVERY holds ruins, picked from the game seed (own number;
 * it was 60). A scout that maps them opens them at once, and the game goes on. What they hold
 * follows Freeciv's huts (data/default/default.lua _deflua_hut_enter_callback, GPL, commit
 * b6156f2e2d: random 0–13), without the barbarians, the city and the map, and with a new
 * scout in the barbarians' place:
 *   25 gold 1/11, 50 gold 3/11, 100 gold 1/11, an advance 3/11, a soldier 2/11, a scout 1/11
 * An advance or a soldier that cannot be had is 25 gold (_deflua_hut_consolation_prize).
 */
import { hash } from '../globe/terrain';

/** One land tile in this many holds ruins. */
export const DISCOVERY_EVERY = 180;
/** Freeciv's consolation prize. */
export const CONSOLATION_GOLD = 25;

export type RuinKind = 'gold25' | 'gold50' | 'gold100' | 'advance' | 'soldier' | 'scout';
export interface Yield { food: number; shield: number; trade: number }

/** Gold in ruins of each gold kind. */
export const RUIN_GOLD: Partial<Record<RuinKind, number>> = { gold25: 25, gold50: 50, gold100: 100 };

/** A find waiting from a save before STORY-052: it opens as ruins on load. */
export interface Discovery {
  tile: number;
  /** Id of the scout that found it. */
  finder: number;
}

/** Keeps ruins independent of the terrain and resource hashes. */
const SALT = 0x2f6b1a3;
const roll = (seed: number, tile: number, k: number) => hash(tile, k, 0, seed ^ SALT) * 0.5 + 0.5;

/** Whether a land tile holds ruins. */
export const isRuin = (seed: number, tile: number) => roll(seed, tile, 0) < 1 / DISCOVERY_EVERY;

/** What ruins hold, and a share of 0–1 that picks the advance among those possible. */
export function ruinAt(seed: number, tile: number): { kind: RuinKind; pick: number } {
  const r = Math.min(10, Math.floor(roll(seed, tile, 1) * 11));
  const kind: RuinKind = r === 0 ? 'gold25' : r <= 3 ? 'gold50' : r === 4 ? 'gold100' : r <= 7 ? 'advance' : r <= 9 ? 'soldier' : 'scout';
  return { kind, pick: roll(seed, tile, 2) };
}
