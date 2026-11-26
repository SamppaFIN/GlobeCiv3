/**
 * state.ts — the game's state: what the day's simulation reads and changes (STORY-095, PLAN-092).
 *
 * The browser's Play adds the view's own state to it (open cards, the selected unit, the HUD).
 * What the save keeps comes from here (save.ts, SaveData), except the derived province and
 * state tiles, worked out anew from the start city.
 *
 * Module state in the browser's main.ts that is not here, and why (PLAN-092, Utu's review):
 * - Derived: worked out again from this state and the seed after a load, the same each time.
 *   The city-states and tribes (nativesOf, natives, tribeLand, rivalScanned and the scan, done
 *   before the day it concerns; those a city stood next to first, shadowed, at each day's start), the
 *   resource kinds found (foundKinds), the era last written in the chronicles (chronicleEra),
 *   and the memos of the generated world (stateLand, stateTilesOf, provinceLand, tilesOfArea,
 *   nameCache, noWay, bordersCache, joinsCache, roadVersion).
 * - Derived from a search, tried again when what it depends on changes: resources no road
 *   reaches (unreachable) and provinces the scouts cannot reach (goalUnreachable).
 * - Notices only, not the game: cities told of their limit (atLimit) or disorder (unrest), the
 *   road a worker is building for (joiningOf, its status text) and a band's chronicle line
 *   (raidTally), the capital's carriers (carrierTrips, shown, changing nothing).
 * - Not yet here, to move with the day's systems (PLAN-092 phase C): the day inside a frame of
 *   several days (tickDay) and the units' sight finding ruins (scouting), which become arguments.
 */
import type { CityAdvisor, PlanetAdvisor, ProvinceAdvisor, StateAdvisor, TownAdvisor } from '../game/advisors';
import type { City } from '../game/cities';
import type { CommandLog } from '../game/commands';
import type { Ties } from '../game/diplomacy';
import type { Yield } from '../game/discoveries';
import type { Government, RevolutionTarget } from '../game/government';
import type { Improvements } from '../game/improvements';
import type { Progress } from '../game/progress';
import type { Raids } from '../game/raids';
import type { Rival } from '../game/rivals';
import type { FirstKind } from '../game/save';
import type { Advance, Research } from '../game/science';
import type { Units } from '../game/units';
import type { War } from '../game/war';
import type { Rich } from '../game/rich';

export interface GameState {
  units: Units;
  /** Tiles of the home province and state, for the meter and the unlocks (derived from the start city). */
  province: number[];
  state: number[];
  progress: Progress;
  /** The province chosen as the state's target (design 7a), or -1. */
  targetProvince: number;
  /** Extra yield on tiles from finds before STORY-052; STORY-028's cities count it. */
  bonuses: Map<number, Yield>;
  /** Finds kept so far. */
  found: number;
  /** Cities in founding order, the capital first (STORY-028). */
  cities: City[];
  /** City sites a scout suggests, the shown one first; every site ever suggested; the day of the last (STORY-032). */
  offers: { tile: number; finder: number }[];
  offered: number[];
  lastOfferDay: number;
  /** A site waiting for the settler the capital is building. */
  pendingSite: number | null;
  /** Irrigation, mines and roads the settlers built (STORY-033). */
  improvements: Improvements;
  /** Bandits on their way to a city, and whether their card waits to be answered (STORY-034). */
  raids: Raids;
  war: War;
  rivals: Rival[];
  raidAlert: boolean;
  /** The treasury: trade comes in as gold, and buildings and buying cost it (STORY-038). */
  gold: number;
  /** Advances known and researched, and the share of trade that becomes gold (STORY-040). */
  research: Research;
  tax: number;
  /** The share of trade that becomes luxury (STORY-046). */
  lux: number;
  /** The government, and the day anarchy ends, or −1 (STORY-047). */
  gov: Government;
  anarchyUntil: number;
  /** The government the anarchy leads to (STORY-125); none in an old save, which ends in Monarchy. */
  revolutionTo?: RevolutionTarget;
  /** The ties with each rival, in the rivals' order (STORY-076). */
  ties: Ties[];
  /** The city level's advisor and what it did lately (STORY-105). */
  townAdvisor: TownAdvisor;
  townLog: Rich[];
  /** The city area's advisor and what it did lately (STORY-049). */
  cityAdvisor: CityAdvisor;
  advisorLog: Rich[];
  /** The province-level advisor and what it did lately (STORY-050). */
  provinceAdvisor: ProvinceAdvisor;
  provinceLog: Rich[];
  /** The state-level advisor, what it did lately, and the days without disorder (STORY-051). */
  stateAdvisor: StateAdvisor;
  stateLog: Rich[];
  calmDays: number;
  /** The planet-level advisor, what it did lately, and the target state, or −1 (STORY-057). */
  planetAdvisor: PlanetAdvisor;
  planetLog: Rich[];
  targetState: number;
  /** What has stopped the game once already (STORY-017). */
  firsts: Set<FirstKind>;
  /** The commands that took effect (STORY-086, rule 7). */
  commands: CommandLog;
  /** A rival's proposal the game stopped for (STORY-076), and the end of the game: the last city fell. */
  treaty: { rival: number; kind: 'alliance' | 'peace' } | null;
  /** Advances gained whose cards wait, the first shown (STORY-118): the game waits for the next study. */
  learned: Advance[];
  over: boolean;
}

/** A card the game stops for until its player answers it: a city site, a raid, a proposal, an advance, or the end. */
export interface Decision {
  /** The player who answers it: one player now, a game of several later (PLAN-092). */
  player: number;
  kind: 'site' | 'raid' | 'treaty' | 'learned' | 'over';
}

/** The decisions waiting, in the order their cards come: no day passes while there are any (STORY-095). */
export function pending(s: GameState): Decision[] {
  const out: Decision[] = [];
  if (s.over) out.push({ player: 0, kind: 'over' });
  if (s.treaty) out.push({ player: 0, kind: 'treaty' });
  if (s.offers.length) out.push({ player: 0, kind: 'site' });
  if (s.raidAlert) out.push({ player: 0, kind: 'raid' });
  if (s.learned.length) out.push({ player: 0, kind: 'learned' });
  return out;
}
