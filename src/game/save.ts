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
import type { City, Build, Building, Focus } from './cities';
import type { Discovery, FindKind, Yield } from './discoveries';
import type { ImprovementKind } from './improvements';
import type { Bandit } from './raids';
import type { AreaPlan, Mode, SettlerTask, StateLine, Unit, UnitKind } from './units';
import type { Progress } from './progress';
import { ADVANCE_LIST, TAX_RATES, type Advance } from './science';

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
  /** The treasury (STORY-038); a save from before it has the start gold. */
  gold: number;
  /** Advances, research and the tax rate (STORY-040); saves from before have none and half. */
  research: { known: Advance[]; target: Advance | null; bulbs: number };
  tax: number;
  /** The current goal (STORY-041); saves from before start at the first and catch up. */
  goal: number;
}

/** Ranges the save is checked against. */
export interface SaveLimits { tiles: number; cityAreas: number }

const UNIT_KINDS: readonly UnitKind[] = ['scout', 'settler', 'warrior', 'phalanx'];
const MODES: readonly Mode[] = ['explore', 'gather', 'defend'];
const TASKS: readonly SettlerTask[] = ['found', 'improve'];
const PLANS: readonly AreaPlan[] = ['explore', 'settle', 'skip'];
const LINES: readonly StateLine[] = ['expand', 'research', 'defend'];
const FINDS: readonly FindKind[] = ['fish', 'ruins', 'ore', 'trail', 'lookout'];
const BUILDINGS: readonly Building[] = ['granary', 'walls', 'market', 'library'];
const BUILDS: readonly Build[] = ['warrior', 'phalanx', 'settler', ...BUILDINGS, 'coinage'];
const FOCUSES: readonly Focus[] = ['food', 'balanced', 'production'];
/** Freeciv GAME_DEFAULT_GOLD (common/game.h). */
const START_GOLD = 50;
const IMPROVEMENTS: readonly ImprovementKind[] = ['irrigation', 'mine', 'road'];
const METERS: readonly Progress['meter'][] = ['province', 'state', 'done'];
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
    const yieldOf = (v: unknown): Yield => {
      const y = obj(v, 'yield');
      return { food: int(y.food, 'food', -100, 100), shield: int(y.shield, 'shield', -100, 100), trade: int(y.trade, 'trade', -100, 100) };
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
      progress: { openLevel: oneOf(p.openLevel, [1, 2, 3] as const, 'open level'), meter: oneOf(p.meter, METERS, 'meter') },
      targetProvince: int(s.targetProvince, 'target province', -1, limits.cityAreas),
      discoveries: list(s.discoveries, 'discoveries', v => {
        const d = obj(v, 'discovery');
        const finds = list(d.finds, 'finds', f => oneOf(f, FINDS, 'find'), 2);
        if (finds.length !== 2) fail('finds');
        return { tile: tile(d.tile), finder: int(d.finder, 'finder'), finds: [finds[0], finds[1]] as [FindKind, FindKind] };
      }, 1000),
      bonuses: list(s.bonuses, 'bonuses', v => {
        const b = list(v, 'bonus', x => x, 2);
        return [tile(b[0]), yieldOf(b[1])] as [number, Yield];
      }),
      found: int(s.found, 'found'),
      cities: list(s.cities, 'cities', v => {
        const c = obj(v, 'city');
        return {
          id: int(c.id, 'city id', 0, 10_000), name: str(c.name, 'city name'), tile: tile(c.tile), capital: bool(c.capital, 'capital'),
          size: int(c.size, 'size', 1, 1000), food: int(c.food, 'food', 0, MAX_INT), shields: int(c.shields, 'shields', 0, MAX_INT),
          build: oneOf(c.build, BUILDS, 'build'),
          // Saves from before STORY-038 have no buildings; each building is there once
          buildings: c.buildings === undefined ? [] : [...new Set(list(c.buildings, 'buildings', b => oneOf(b, BUILDINGS, 'building'), BUILDINGS.length))],
          // Saves from before STORY-039 have no focus
          focus: c.focus === undefined ? 'balanced' : oneOf(c.focus, FOCUSES, 'focus'),
        };
      }, 10_000),
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
          };
        }),
        nextId: int(r.nextId, 'bandit next id'),
      },
      raidAlert: bool(s.raidAlert, 'raid alert'),
      gold: s.gold === undefined ? START_GOLD : int(s.gold, 'gold'),
      research: s.research === undefined ? { known: [], target: null, bulbs: 0 } : (() => {
        const r = obj(s.research, 'research');
        return {
          known: [...new Set(list(r.known, 'known', a => oneOf(a, ADVANCE_LIST, 'advance'), ADVANCE_LIST.length))],
          target: orNull(r.target, a => oneOf(a, ADVANCE_LIST, 'target')),
          bulbs: int(r.bulbs, 'bulbs'),
        };
      })(),
      tax: s.tax === undefined ? 50 : oneOf(s.tax, TAX_RATES, 'tax'),
      goal: s.goal === undefined ? 0 : int(s.goal, 'goal', 0, 1000),
    };
  } catch (e) {
    if (e instanceof Invalid) return null;
    throw e;
  }
}
