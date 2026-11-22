/**
 * state.ts — the game's state: what the day's simulation reads and changes (STORY-095, PLAN-092).
 *
 * The browser's Play adds the view's own state to it (open cards, the selected unit, the HUD).
 * What the save keeps comes from here (save.ts, SaveData), except the derived province and
 * state tiles, worked out anew from the start city.
 *
 * Module state in the browser's main.ts that is not here, and why (PLAN-092, Utu's review):
 * - Derived: worked out again from this state and the seed after a load, the same each time.
 *   The city-states and tribes (nativesOf, natives, tribeLand, rivalScanned and the scan), the
 *   resource kinds found (foundKinds), the era last written in the chronicles (chronicleEra),
 *   and the memos of the generated world (stateLand, stateTilesOf, provinceLand, tilesOfArea,
 *   nameCache, noWay, bordersCache, joinsCache, roadVersion).
 * - Derived from a search, tried again when what it depends on changes: resources no road
 *   reaches (unreachable) and provinces the scouts cannot reach (goalUnreachable).
 * - Notices only, not the game: cities told of their limit (atLimit) or disorder (unrest), the
 *   road a worker is building for (joiningOf, its status text) and a band's chronicle line
 *   (raidTally), the capital's carriers (carrierTrips, shown, changing nothing).
 * - Not yet here, to move with the day's systems (PLAN-092 phases B and C): the card a rival's
 *   proposal waits on (treaty) and the end of the game (over), and the day inside a frame of
 *   several days (tickDay) and the units' sight finding ruins (scouting), which become arguments.
 */
import type { CityAdvisor, PlanetAdvisor, ProvinceAdvisor, StateAdvisor, TownAdvisor } from '../game/advisors';
import type { City } from '../game/cities';
import type { CommandLog } from '../game/commands';
import type { Ties } from '../game/diplomacy';
import type { Yield } from '../game/discoveries';
import type { Government } from '../game/government';
import type { Improvements } from '../game/improvements';
import type { Progress } from '../game/progress';
import type { Raids } from '../game/raids';
import type { Rival } from '../game/rivals';
import type { FirstKind } from '../game/save';
import type { Research } from '../game/science';
import type { Units } from '../game/units';
import type { War } from '../game/war';
import type { Rich } from '../ui/richText';

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
}
