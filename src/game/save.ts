/**
 * save.ts — the saved game (STORY-036): what the player changed, never what the seed
 * generates (rule 3). Terrain, discoveries and regions come back from the seed; the save
 * holds the day, the mapped tiles, the units, the cities, the improvements and the rest
 * of the play state.
 *
 * A save is not trusted (security rule 5): validateSave() builds a new object from
 * checked fields only, every tile and id in range, every name from its list; anything
 * else makes the whole save invalid. Nothing in it is ever run as code.
 */
import { SPEEDS, type Speed } from './clock';
import { ATTACKERS, type Losses, type WarSave } from './war';
import { RIVALS, type RivalSave, type RivalUnit } from './rivals';
import { RESOURCE_BUILDING_LIST, type City, type Build, type Building, type Focus } from './cities';
import { CHAIN_BUILDINGS, GOODS, type ChainState } from './chains';
import { HISTORY_KINDS, HISTORY_MAX, type HistoryEvent } from './history';
import type { Discovery, Yield } from './discoveries';
import type { ImprovementKind } from './improvements';
import type { Bandit } from './raids';
import type { AreaPlan, Mode, SettlerTask, StateLine, Unit, UnitKind } from './units';
import type { Progress } from './progress';
import { ADVANCE_LIST, LUX_RATES, RESOURCE_KINDS, TAX_RATES, type Advance, type Study } from './science';
import type { Relation, Ties } from './diplomacy';
import { TERRAINS, type ResourceKind } from './terrainTypes';
import { ERAS } from './persons';
import { GOVERNMENT_LIST, type Government } from './government';
import { ADVISOR_LEVELS, CITY_ADVISOR_LIST, PLANET_ADVISOR_LIST, PROVINCE_ADVISOR_LIST, STATE_ADVISOR_LIST, TOWN_ADVISOR_LIST, TOWN_OF_CITY, type CityAdvisor, type PlanetAdvisor, type ProvinceAdvisor, type StateAdvisor, type TownAdvisor } from './advisors';
import { ACTORS, COMMAND_KINDS, RAID_CHOICES, type Command, type Logged } from './commands';

export const SAVE_VERSION = 1;

export interface UnitsSave {
  units: Unit[];
  camp: number;
  flag: number | null;
  sites: number[];
  site: number;
  founding: boolean;
  areaPlans: [number, AreaPlan][];
  stateLine: StateLine;
  homeProvince: number;
  nextId: number;
}

export interface RaidsSave {
  band: { city: number; bandits: Bandit[] } | null;
  nextId: number;
}

/** What stops the game the first time only (STORY-017): a city site, bandits and a nomads' attack. */
export const FIRST_KINDS = ['site', 'raid', 'tribe'] as const;
export type FirstKind = (typeof FIRST_KINDS)[number];

export interface SaveData {
  version: number;
  /** Wall time of the save (ms since 1970), for the start screen. */
  savedAt: number;
  seed: number;
  startCity: number;
  day: number;
  speed: Speed;
  /** Paused by the player: the game goes on paused. */
  paused: boolean;
  /** Mapped tiles, ascending. */
  mapped: number[];
  units: UnitsSave;
  selected: number;
  progress: Progress;
  targetProvince: number;
  discoveries: Discovery[];
  bonuses: [number, Yield][];
  found: number;
  cities: City[];
  offers: { tile: number; finder: number }[];
  offered: number[];
  /** The day of the last site offer, or null before the first. */
  lastOfferDay: number | null;
  pendingSite: number | null;
  improvements: [number, ImprovementKind[]][];
  raids: RaidsSave;
  raidAlert: boolean;
  /** The campaign against the city-states (STORY-064); saves from before have none. */
  war: WarSave;
  /** The rival civilizations (STORY-068); saves from before have none, and the rivals start anew. */
  rivals?: RivalSave[];
  /** The treasury (STORY-038); a save from before it has the start gold. */
  gold: number;
  /** Advances, research and the tax rate (STORY-040); saves from before have none and half. */
  research: { known: Advance[]; target: Study | null; bulbs: number; kinds?: ResourceKind[] };
  /** The ties with each rival (STORY-076); saves from before have none. */
  ties?: Ties[];
  tax: number;
  /** The luxury rate (STORY-046); saves from before have none. */
  lux: number;
  /** The government, and the day anarchy ends, or −1 (STORY-047); saves from before are under Despotism. */
  gov: Government;
  anarchyUntil: number;
  /** The city level's advisor (STORY-105); a save from before gets the one its city area's advisor stands for. */
  townAdvisor: TownAdvisor;
  /** The city area's advisor (STORY-049); saves from before have none. */
  cityAdvisor: CityAdvisor;
  /** The province-level advisor (STORY-050); saves from before have none. */
  provinceAdvisor: ProvinceAdvisor;
  /** The state-level advisor (STORY-051); saves from before have none. */
  stateAdvisor: StateAdvisor;
  /** The planet-level advisor and the target state, or −1 (STORY-057); saves from before have none. */
  planetAdvisor: PlanetAdvisor;
  /** What has already stopped the game once (STORY-017): later ones are notices. Missing in older saves. */
  firsts?: FirstKind[];
  targetState: number;
  /** The commands that took effect (STORY-086); saves from before have none. */
  commands?: Logged[];
  /** A rival's proposal the game stopped for (STORY-095); saves from before have none. */
  treaty?: { rival: number; kind: 'alliance' | 'peace' };
}

/** Ranges the save is checked against. */
export interface SaveLimits { tiles: number; cityAreas: number }

const UNIT_KINDS: readonly UnitKind[] = ['scout', 'settler', 'worker', 'warrior', 'phalanx', ...ATTACKERS];
const MODES: readonly Mode[] = ['explore', 'gather', 'defend'];
const TASKS: readonly SettlerTask[] = ['found', 'improve'];
const PLANS: readonly AreaPlan[] = ['explore', 'settle', 'skip'];
const LINES: readonly StateLine[] = ['expand', 'research', 'defend'];
const BUILDINGS: readonly Building[] = ['granary', 'walls', 'market', 'library', 'temple', 'aqueduct', 'colosseum', 'colossus', 'gardens', 'greatwall', 'fishery', 'sawmill', 'quarry', 'field', 'lumberjack', 'mill', 'bakery', ...RESOURCE_BUILDING_LIST];
const BUILDS: readonly Build[] = ['warrior', 'phalanx', 'settler', 'scout', 'worker', ...ATTACKERS, ...BUILDINGS, 'coinage'];
const FOCUSES: readonly Focus[] = ['food', 'balanced', 'production'];
const RIVAL_UNITS: readonly RivalUnit['kind'][] = ['settler', 'warrior', ...ATTACKERS];
/** Freeciv GAME_DEFAULT_GOLD (common/game.h). */
const START_GOLD = 50;
const IMPROVEMENTS: readonly ImprovementKind[] = ['irrigation', 'mine', 'road'];
const METERS: readonly Progress['meter'][] = ['city', 'province', 'state', 'conquest', 'done'];
/** Bounds on list lengths and numbers, far above anything a game reaches. */
const MAX_LIST = 100_000;
const MAX_INT = 1e9;

class Invalid extends Error {}
const fail = (what: string): never => { throw new Invalid(what); };

const obj = (v: unknown, what: string): Record<string, unknown> =>
  (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(what));
const int = (v: unknown, what: string, min = 0, max = MAX_INT): number =>
  (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail(what));
const bool = (v: unknown, what: string): boolean => (typeof v === 'boolean' ? v : fail(what));
const str = (v: unknown, what: string, max = 40): string => (typeof v === 'string' && v.length <= max ? v : fail(what));
const oneOf = <T extends string | number>(v: unknown, list: readonly T[], what: string): T => (list.includes(v as T) ? (v as T) : fail(what));
const list = <T>(v: unknown, what: string, item: (x: unknown, i: number) => T, max = MAX_LIST): T[] =>
  // Array.from visits holes too, as undefined, so a sparse list fails instead of keeping holes
  (Array.isArray(v) && v.length <= max ? Array.from(v as unknown[], item) : fail(what));
const orNull = <T>(v: unknown, item: (x: unknown) => T): T | null => (v === null ? null : item(v));

/**
 * The save, checked and copied, or null if any part of it is invalid. Built field by
 * field: no property of the input object is kept as it came.
 */
export function validateSave(raw: unknown, limits: SaveLimits): SaveData | null {
  try {
    const s = obj(raw, 'save');
    if (s.version !== SAVE_VERSION) return fail('version');
    const tile = (v: unknown) => int(v, 'tile', 0, limits.tiles - 1);
    const tiles = (v: unknown, max?: number) => list(v, 'tiles', tile, max);
    // A command is rebuilt from its checked fields only, by its kind (STORY-086)
    const commandOf = (v: unknown): Command => {
      const c = obj(v, 'command');
      const kind = oneOf(c.kind, COMMAND_KINDS, 'command kind');
      switch (kind) {
        case 'found':
        case 'settle': return { kind, tile: tile(c.tile) };
        case 'build': return { kind, city: tile(c.city), build: oneOf(c.build, BUILDS, 'build') };
        case 'move': return { kind, city: tile(c.city), building: oneOf(c.building, BUILDINGS, 'building'), tile: tile(c.tile) };
        case 'study': return { kind, target: oneOf(c.target, [...ADVANCE_LIST, ...RESOURCE_KINDS] as const, 'study') };
        case 'buy': return { kind, city: tile(c.city) };
        case 'target': return { kind, province: int(c.province, 'province', 0, Math.ceil(limits.cityAreas / 7) - 1) };
        case 'site':
        case 'treaty': return { kind, accept: bool(c.accept, 'accept') };
        case 'raid': return { kind, choice: oneOf(c.choice, RAID_CHOICES, 'raid choice') };
        case 'advise': {
          const level = oneOf(c.level, ADVISOR_LEVELS, 'advisor level');
          const list: readonly string[] = { town: TOWN_ADVISOR_LIST, city: CITY_ADVISOR_LIST, province: PROVINCE_ADVISOR_LIST, state: STATE_ADVISOR_LIST, planet: PLANET_ADVISOR_LIST }[level];
          return { kind, level, advisor: oneOf(c.advisor, list, 'advisor') };
        }
      }
    };
    const yieldOf = (v: unknown): Yield => {
      const y = obj(v, 'yield');
      return { food: int(y.food, 'food', -100, 100), shield: int(y.shield, 'shield', -100, 100), trade: int(y.trade, 'trade', -100, 100) };
    };
    // A campaign and research, the player's or a rival's (STORY-077)
    const warOf = (v: unknown): WarSave => {
      const w = obj(v, 'war');
      return {
        target: orNull(w.target, tile),
        marching: bool(w.marching, 'marching'),
        losses: list(w.losses, 'losses', x => {
          const e = list(x, 'loss', y => y, 2);
          const l = obj(e[1], 'loss');
          return [tile(e[0]), { lost: int(l.lost, 'lost', 0, 1000), day: int(l.day, 'loss day') }] as [number, Losses];
        }, 10_000),
        razed: tiles(w.razed, 10_000),
        // Saves from before STORY-066 have no tribes scattered
        routed: w.routed === undefined ? [] : list(w.routed, 'routed', x => int(x, 'routed state', 0, Math.ceil(limits.cityAreas / 49)), 1000),
      };
    };
    const researchOf = (v: unknown) => {
      const r = obj(v, 'research');
      return {
        known: [...new Set(list(r.known, 'known', a => oneOf(a, ADVANCE_LIST, 'advance'), ADVANCE_LIST.length))],
        target: orNull(r.target, a => oneOf(a, [...ADVANCE_LIST, ...RESOURCE_KINDS] as const, 'target')),
        // The kinds of resource known (STORY-072); a save from before knows them all
        ...(r.kinds === undefined ? {} : { kinds: [...new Set(list(r.kinds, 'kinds', k => oneOf(k, RESOURCE_KINDS, 'kind'), RESOURCE_KINDS.length))] }),
        bulbs: int(r.bulbs, 'bulbs'),
      };
    };
    // A city's production chains (STORY-088): its stock, each building's days of work and its site
    const chain = (v: unknown): ChainState => {
      const x = obj(v, 'chain');
      const site = orNull(x.site, w => {
        const y = obj(w, 'site');
        return { building: oneOf(y.building, CHAIN_BUILDINGS, 'site building'), planks: int(y.planks, 'site planks', 0, 10), stones: int(y.stones, 'site stones', 0, 10), days: int(y.days, 'site days', 0, 10) };
      });
      return {
        stock: Object.fromEntries(Object.entries(obj(x.stock, 'stock')).map(([g, n]) => [oneOf(g, GOODS, 'good'), int(n, 'goods', 0, 1_000_000)])),
        work: Object.fromEntries(Object.entries(obj(x.work, 'work')).map(([b, n]) => [oneOf(b, CHAIN_BUILDINGS, 'chain building'), int(n, 'work days', 0, 10)])),
        site,
      };
    };
    // A city's chronicle (STORY-106): each event rebuilt from its checked fields, by its kind
    const day = (v: unknown) => int(v, 'history day', 0, MAX_INT);
    const eventOf = (v: unknown): HistoryEvent => {
      const e = obj(v, 'history event');
      const kind = oneOf(e.kind, HISTORY_KINDS, 'history kind');
      switch (kind) {
        case 'founded': {
          const near = orNull(e.near, w => { const n = obj(w, 'near'); return { name: str(n.name, 'near name'), tile: tile(n.tile) }; });
          return { kind, day: day(e.day), founder: orNull(e.founder, f => str(f, 'founder')), terrain: oneOf(e.terrain, TERRAINS, 'terrain'), resource: orNull(e.resource, r => str(r, 'resource')), near };
        }
        case 'built': return { kind, day: day(e.day), building: oneOf(e.building, BUILDINGS, 'history building') };
        case 'grew': return { kind, day: day(e.day), size: int(e.size, 'history size', 1, 1000) };
        case 'raid': {
          const defender = orNull(e.defender, w => { const d = obj(w, 'defender'); return { id: int(d.id, 'defender id', 0, MAX_INT), name: str(d.name, 'defender name') }; });
          return { kind, day: day(e.day), held: bool(e.held, 'held'), defender, nomads: bool(e.nomads, 'nomads') };
        }
        case 'era': return { kind, day: day(e.day), era: oneOf(e.era, ERAS, 'era') };
        case 'taken': return { kind, day: day(e.day), from: orNull(e.from, f => str(f, 'taken from')) };
        case 'early': return { kind, until: day(e.until), count: int(e.count, 'early count', 2, MAX_INT) };
        case 'border': return { kind, day: day(e.day), rings: int(e.rings, 'border rings', 1, 5) };
      }
    };
    // The player's cities and the rivals' (STORY-068)
    const city = (v: unknown): City => {
      const c = obj(v, 'city');
      return {
        id: int(c.id, 'city id', 0, 10_000), name: str(c.name, 'city name'), tile: tile(c.tile), capital: bool(c.capital, 'capital'),
        size: int(c.size, 'size', 1, 1000), food: int(c.food, 'food', 0, MAX_INT), shields: int(c.shields, 'shields', 0, MAX_INT),
        build: oneOf(c.build, BUILDS, 'build'),
        // Saves from before STORY-038 have no buildings; each building is there once
        buildings: c.buildings === undefined ? [] : [...new Set(list(c.buildings, 'buildings', b => oneOf(b, BUILDINGS, 'building'), BUILDINGS.length))],
        // Saves from before STORY-039 have no focus
        focus: c.focus === undefined ? 'balanced' : oneOf(c.focus, FOCUSES, 'focus'),
        entertainers: c.entertainers === undefined ? 0 : int(c.entertainers, 'entertainers', 0, 1000),
        ...(c.native === undefined ? {} : { native: bool(c.native, 'native') }),
        // Where the buildings stand (STORY-071); the bonuses follow from it when the game goes on
        ...(c.placed === undefined ? {} : { placed: Object.fromEntries(Object.entries(obj(c.placed, 'placed')).map(([b, t]) => [oneOf(b, BUILDINGS, 'placed building'), tile(t)])) }),
        // The production chains (STORY-088): a city without them keeps the old rules
        ...(c.chain === undefined ? {} : { chain: chain(c.chain) }),
        // The chronicle (STORY-106): a save from before has none, and tells what is known
        ...(c.history === undefined ? {} : { history: list(c.history, 'history', eventOf, HISTORY_MAX) }),
        // Culture (STORY-093): a save from before has none, and the border starts from the size
        ...(c.culture === undefined ? {} : { culture: int(c.culture, 'culture', 0, MAX_INT) }),
      };
    };

    const u = obj(s.units, 'units');
    const units: UnitsSave = {
      units: list(u.units, 'unit list', v => {
        const x = obj(v, 'unit');
        const job = orNull(x.job, j => {
          const o = obj(j, 'job');
          return { tile: tile(o.tile), kind: oneOf(o.kind, IMPROVEMENTS, 'job kind'), days: int(o.days, 'days', 0, 100), left: int(o.left, 'left', 0, 100) };
        });
        return {
          id: int(x.id, 'unit id'), kind: oneOf(x.kind, UNIT_KINDS, 'unit kind'), name: str(x.name, 'unit name'),
          tile: tile(x.tile), mode: oneOf(x.mode, MODES, 'mode'), path: tiles(x.path, 10_000), wait: int(x.wait, 'wait', 0, 100),
          carrying: bool(x.carrying, 'carrying'), gathered: int(x.gathered, 'gathered'),
          home: orNull(x.home, h => int(h, 'home', 0, limits.cityAreas)), task: oneOf(x.task, TASKS, 'task'), job,
        };
      }, 10_000),
      camp: tile(u.camp),
      flag: orNull(u.flag, tile),
      sites: tiles(u.sites, 1000),
      site: int(u.site, 'site', 0, 1000),
      founding: bool(u.founding, 'founding'),
      areaPlans: list(u.areaPlans, 'plans', v => {
        const p = list(v, 'plan', x => x, 2);
        return [int(p[0], 'plan area', 0, limits.cityAreas - 1), oneOf(p[1], PLANS, 'plan')] as [number, AreaPlan];
      }),
      stateLine: oneOf(u.stateLine, LINES, 'state line'),
      homeProvince: int(u.homeProvince, 'home province', -1, limits.cityAreas),
      nextId: int(u.nextId, 'next id'),
    };

    const p = obj(s.progress, 'progress');
    const r = obj(s.raids, 'raids');
    const openLevel = oneOf(p.openLevel, [0, 1, 2, 3, 4] as const, 'open level');
    // Before STORY-105 the city area's advisor ran the city level too: the city level's advisor is
    // the one it stands for, and while only the city level is open the city area has none yet
    const cityAdvisor = s.cityAdvisor === undefined ? 'none' : oneOf(s.cityAdvisor, CITY_ADVISOR_LIST, 'cityAdvisor');
    const townAdvisor = s.townAdvisor === undefined ? TOWN_OF_CITY[cityAdvisor] : oneOf(s.townAdvisor, TOWN_ADVISOR_LIST, 'townAdvisor');
    return {
      version: SAVE_VERSION,
      savedAt: int(s.savedAt, 'saved at', 0, 1e14),
      seed: int(s.seed, 'seed', 0, 2 ** 32),
      startCity: int(s.startCity, 'start city', 0, limits.cityAreas - 1),
      day: int(s.day, 'day'),
      speed: oneOf(s.speed, SPEEDS, 'speed'),
      paused: bool(s.paused, 'paused'),
      mapped: tiles(s.mapped, limits.tiles),
      units,
      selected: int(s.selected, 'selected', 0, 10_000),
      // Before STORY-016 the state level ended the meter: it goes on with the provinces held
      progress: { openLevel, meter: p.openLevel === 1 && p.meter === 'done' ? 'conquest' : oneOf(p.meter, METERS, 'meter') },
      targetProvince: int(s.targetProvince, 'target province', -1, limits.cityAreas),
      // Finds waiting in a save from before STORY-052 open as ruins on load; their old choices are not read
      discoveries: list(s.discoveries, 'discoveries', v => {
        const d = obj(v, 'discovery');
        return { tile: tile(d.tile), finder: int(d.finder, 'finder') };
      }, 1000),
      bonuses: list(s.bonuses, 'bonuses', v => {
        const b = list(v, 'bonus', x => x, 2);
        return [tile(b[0]), yieldOf(b[1])] as [number, Yield];
      }),
      found: int(s.found, 'found'),
      cities: list(s.cities, 'cities', city, 10_000),
      rivals: s.rivals === undefined ? undefined : list(s.rivals, 'rivals', v => {
        const x = obj(v, 'rival');
        return {
          id: int(x.id, 'rival id', 0, RIVALS.length - 1),
          cities: list(x.cities, 'rival cities', city, 1000),
          units: list(x.units, 'rival units', w => {
            const o = obj(w, 'rival unit');
            return {
              id: int(o.id, 'rival unit id'), kind: oneOf(o.kind, RIVAL_UNITS, 'rival unit kind'), tile: tile(o.tile), path: tiles(o.path, 10_000),
              wait: int(o.wait, 'rival unit wait', 0, 100), home: int(o.home, 'rival unit home', 0, 10_000), site: orNull(o.site, tile),
            };
          }, 10_000),
          nextId: int(x.nextId, 'rival next id'),
          // Research and a campaign (STORY-077); a save from before has none
          ...(x.research === undefined ? {} : { research: researchOf(x.research) }),
          ...(x.war === undefined ? {} : { war: warOf(x.war) }),
        };
      }, RIVALS.length),
      offers: list(s.offers, 'offers', v => {
        const o = obj(v, 'offer');
        return { tile: tile(o.tile), finder: int(o.finder, 'finder') };
      }, 1000),
      offered: tiles(s.offered),
      lastOfferDay: orNull(s.lastOfferDay, v => int(v, 'last offer')),
      pendingSite: orNull(s.pendingSite, tile),
      improvements: list(s.improvements, 'improvements', v => {
        const e = list(v, 'improvement', x => x, 2);
        return [tile(e[0]), list(e[1], 'kinds', k => oneOf(k, IMPROVEMENTS, 'kind'), 3)] as [number, ImprovementKind[]];
      }),
      raids: {
        band: orNull(r.band, v => {
          const b = obj(v, 'band');
          return {
            city: tile(b.city),
            bandits: list(b.bandits, 'bandits', x => {
              const o = obj(x, 'bandit');
              return { id: int(o.id, 'bandit id'), tile: tile(o.tile), path: tiles(o.path, 10_000), wait: int(o.wait, 'bandit wait', 0, 100) };
            }, 100),
            // A band of nomads (STORY-066)
            ...(b.attack === undefined ? {} : { attack: int(b.attack, 'band attack', 1, 100) }),
            ...(b.tribe === undefined ? {} : { tribe: str(b.tribe, 'band tribe') }),
          };
        }),
        nextId: int(r.nextId, 'bandit next id'),
      },
      raidAlert: bool(s.raidAlert, 'raid alert'),
      war: s.war === undefined ? { target: null, marching: false, losses: [], razed: [], routed: [] } : warOf(s.war),
      ...(s.ties === undefined ? {} : {
        ties: list(s.ties, 'ties', v => {
          const t = obj(v, 'tie');
          return {
            met: bool(t.met, 'met'), state: oneOf(t.state, ['peace', 'war', 'alliance'] as readonly Relation[], 'relation'),
            attitude: int(t.attitude, 'attitude', -100, 100), since: int(t.since, 'since', 0, MAX_INT), lost: int(t.lost, 'lost', 0, 1000),
            offered: int(t.offered, 'offered', -1000, MAX_INT),
            // Saves from before STORY-078 have traded no maps
            maps: t.maps === undefined ? -1000 : int(t.maps, 'maps', -1000, MAX_INT),
          };
        }, 10),
      }),
      gold: s.gold === undefined ? START_GOLD : int(s.gold, 'gold'),
      research: s.research === undefined ? { known: [], target: null, bulbs: 0 } : researchOf(s.research),
      tax: s.tax === undefined ? 50 : oneOf(s.tax, TAX_RATES, 'tax'),
      lux: s.lux === undefined ? 0 : oneOf(s.lux, LUX_RATES, 'lux'),
      gov: s.gov === undefined ? 'despotism' : oneOf(s.gov, GOVERNMENT_LIST, 'gov'),
      anarchyUntil: s.anarchyUntil === undefined ? -1 : int(s.anarchyUntil, 'anarchyUntil', -1),
      townAdvisor,
      cityAdvisor: s.townAdvisor === undefined && openLevel === 4 ? 'none' : cityAdvisor,
      provinceAdvisor: s.provinceAdvisor === undefined ? 'none' : oneOf(s.provinceAdvisor, PROVINCE_ADVISOR_LIST, 'provinceAdvisor'),
      stateAdvisor: s.stateAdvisor === undefined ? 'none' : oneOf(s.stateAdvisor, STATE_ADVISOR_LIST, 'stateAdvisor'),
      planetAdvisor: s.planetAdvisor === undefined ? 'none' : oneOf(s.planetAdvisor, PLANET_ADVISOR_LIST, 'planetAdvisor'),
      firsts: s.firsts === undefined ? [] : list(s.firsts, 'firsts', v => oneOf(v, FIRST_KINDS, 'first'), FIRST_KINDS.length),
      targetState: s.targetState === undefined ? -1 : int(s.targetState, 'target state', -1, Math.ceil(limits.cityAreas / 49)),
      ...(s.treaty === undefined || s.treaty === null ? {} : (t => ({
        treaty: { rival: int(t.rival, 'treaty rival', 0, Array.isArray(s.rivals) ? s.rivals.length - 1 : -1), kind: oneOf(t.kind, ['alliance', 'peace'] as const, 'treaty kind') },
      }))(obj(s.treaty, 'treaty'))),
      ...(s.commands === undefined ? {} : {
        commands: list(s.commands, 'commands', v => {
          const e = obj(v, 'logged');
          return { day: int(e.day, 'command day'), by: oneOf(e.by, ACTORS, 'actor'), cmd: commandOf(e.cmd) };
        }),
      }),
    };
  } catch (e) {
    if (e instanceof Invalid) return null;
    throw e;
  }
}
