/**
 * units.ts — the player's units and what they do each day.
 *
 * Units act on their own (the approved autonomous play): the player sets a scout's
 * mode and a flag, and picks the settler's city site. Each day a unit takes the next
 * step of its path; entering a tile with movement cost c takes c days. Scouts map
 * the tiles within two rings of where they stand.
 *
 *   Tutki (explore)   to the flag if there is one, else to the nearest unmapped tile
 *   Kerää (gather)    to the nearest mapped resource tile and back to the camp
 *   Puolusta (defend) back to the camp, and stay
 *
 * A settler sent to its site founds a city there (STORY-028); cities add soldiers and
 * settlers. Soldiers stay in their city. A settler set to Kehitä improves the land around
 * its city: it walks to the most worthwhile job and works it for the job's days (STORY-033).
 */
import { findPath, nearestTile, tilesInRings } from './pathfinding';
import { compassIndex } from './names';
import { IMPROVEMENT_NAMES, type ImprovementKind, type Job } from './improvements';
import type { UnitsSave } from './save';
import { tileCenter } from '../globe/hexTiles';

export type UnitKind = 'scout' | 'settler' | 'warrior' | 'phalanx';
export type Mode = 'explore' | 'gather' | 'defend';
export const MODE_NAMES: Record<Mode, string> = { explore: 'Tutki', gather: 'Kerää', defend: 'Puolusta' };
/** Rings a scout maps around itself (the state line Tutkimus adds one). */
export const SIGHT = 2;

/** A settler founds a city (Asuta) or improves land (Kehitä). */
export type SettlerTask = 'found' | 'improve';
export const TASK_NAMES: Record<SettlerTask, string> = { found: 'Asuta', improve: 'Kehitä' };

/** A city area's emphasis at the province level (design 6a). */
export type AreaPlan = 'explore' | 'settle' | 'skip';
export const AREA_PLAN_NAMES: Record<AreaPlan, string> = { explore: 'Tutki', settle: 'Asuta', skip: 'Ohita' };
/** The state line at the state level (design 7a). */
export type StateLine = 'expand' | 'research' | 'defend';
export const STATE_LINE_NAMES: Record<StateLine, string> = { expand: 'Laajentuminen', research: 'Tutkimus', defend: 'Puolustus' };

export interface Unit {
  id: number;
  kind: UnitKind;
  name: string;
  tile: number;
  mode: Mode;
  /** Tiles still to walk, the next first. */
  path: number[];
  /** Days left before the next step. */
  wait: number;
  /** A gatherer on its way back with a load. */
  carrying: boolean;
  /** Loads brought to the camp. */
  gathered: number;
  /** The city that built and supports the unit; the starting units have none, as in Freeciv. */
  home: number | null;
  /** A settler's task, and the improvement it is on with the days of work left. */
  task: SettlerTask;
  job: (Job & { left: number }) | null;
}

/** What units need to know about the world. */
export interface World {
  /** Days to enter a tile; Infinity where a land unit cannot go. */
  cost(id: number): number;
  isMapped(id: number): boolean;
  hasResource(id: number): boolean;
  /** Map tiles (the fog lifts). */
  reveal(ids: number[]): void;
  /** Score of a city site, higher is better. */
  siteScore(id: number): number;
  /** City area of a tile (its province is ⌊id / 7⌋). */
  cityOf(id: number): number;
  /** A settler's next job improving land, or null (STORY-033). */
  nextJob?(u: Unit): Job | null;
  /** A settler finished an improvement. */
  improve?(tile: number, kind: ImprovementKind): void;
}

export class Units {
  readonly units: Unit[] = [];
  /** The settler's camp: where defenders stay and gatherers bring loads. */
  camp: number;
  /** The player's exploration flag, or null. */
  flag: number | null = null;
  /** City sites around the camp, best first, and the chosen one. */
  sites: number[] = [];
  site = 0;
  /** The settler is walking to the site to found a city there. */
  founding = false;
  /** City areas' emphasis; areas not listed are explored. */
  readonly areaPlans = new Map<number, AreaPlan>();
  /** The state line: Tutkimus widens sight, Laajentuminen the search for sites, Puolustus keeps scouts home. */
  stateLine: StateLine = 'research';
  /** The province Vartija keeps the scouts in the home province (STORY-050); set each day, not saved. */
  keepHome = false;
  /** The home province: Puolustus keeps exploring scouts inside it. */
  homeProvince = -1;
  private nextId = 0;

  /** A new game's units at the landing tile, or a saved game's as they were (STORY-036). */
  constructor(landing: number, world: World, saved?: UnitsSave) {
    if (saved) {
      this.units.push(...saved.units);
      this.camp = saved.camp;
      this.flag = saved.flag;
      this.sites = saved.sites;
      this.site = saved.site;
      this.founding = saved.founding;
      for (const [area, plan] of saved.areaPlans) this.areaPlans.set(area, plan);
      this.stateLine = saved.stateLine;
      this.homeProvince = saved.homeProvince;
      this.nextId = saved.nextId;
      return;
    }
    this.camp = landing;
    this.homeProvince = Math.floor(world.cityOf(landing) / 7);
    const land = tilesInRings(landing, 1).filter(id => id !== landing && Number.isFinite(world.cost(id)));
    this.add('settler', 'Uudisasukas', landing);
    this.add('scout', 'Tiedustelija 1', land[0] ?? landing);
    this.add('scout', 'Tiedustelija 2', land[Math.floor(land.length / 2)] ?? landing);
    this.findSites(world);
    for (const u of this.units) if (u.kind === 'scout') world.reveal(tilesInRings(u.tile, this.sight));
  }

  /** Everything the constructor restores, copied. */
  save(): UnitsSave {
    return {
      units: this.units.map(u => ({ ...u, path: [...u.path], job: u.job && { ...u.job } })),
      camp: this.camp, flag: this.flag, sites: [...this.sites], site: this.site, founding: this.founding,
      areaPlans: [...this.areaPlans], stateLine: this.stateLine, homeProvince: this.homeProvince, nextId: this.nextId,
    };
  }

  get sight(): number {
    return SIGHT + (this.stateLine === 'research' ? 1 : 0);
  }

  /**
   * Candidate city sites around the camp, best first: within three rings (four with the
   * state line Laajentuminen), with the best site of every area marked Asuta in front.
   */
  findSites(world: World) {
    const rings = this.stateLine === 'expand' ? 4 : 3;
    const settler = this.settler;
    if (!settler) {
      this.sites = [];
      this.site = 0;
      return;
    }
    const scored = tilesInRings(settler.tile, rings)
      .filter(id => Number.isFinite(world.cost(id)))
      .map(id => [world.siteScore(id), id] as const)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])
      .map(([, id]) => id);
    const settle = scored.filter(id => this.areaPlans.get(world.cityOf(id)) === 'settle');
    this.sites = [...settle.slice(0, 1), ...scored.filter(id => id !== settle[0])];
    this.site = 0;
  }

  setAreaPlan(city: number, plan: AreaPlan, world: World) {
    if (plan === 'explore') this.areaPlans.delete(city);
    else this.areaPlans.set(city, plan);
    for (const u of this.units) if (u.kind === 'scout' && u.mode === 'explore') u.path = [];
    if (!this.founding) this.findSites(world);
  }

  setStateLine(line: StateLine, world: World) {
    this.stateLine = line;
    for (const u of this.units) if (u.kind === 'scout' && u.mode === 'explore') u.path = [];
    if (!this.founding) this.findSites(world);
  }

  /** Send the exploring scouts toward a tile (an expedition or a target province). */
  sendTo(tile: number, world: World) {
    if (!Number.isFinite(world.cost(tile))) return false;
    this.flag = tile;
    for (const u of this.units) if (u.kind === 'scout' && u.mode === 'explore') u.path = [];
    return true;
  }

  /** A new scout joins on a tile (a find, STORY-027) and maps around itself. */
  recruit(tile: number, world: World): Unit {
    return this.spawn('scout', tile, world);
  }

  /** A new unit on a tile: a find's scout, or a city's soldier or settler (STORY-028). */
  spawn(kind: UnitKind, tile: number, world: World, home: number | null = null): Unit {
    const n = this.units.filter(u => u.kind === kind).length + 1;
    const name = kind === 'scout' ? `Tiedustelija ${n}` : kind === 'warrior' ? `Soturi ${n}` : kind === 'phalanx' ? `Falangi ${n}` : n === 1 ? 'Uudisasukas' : `Uudisasukas ${n}`;
    this.add(kind, name, tile);
    const u = this.units[this.units.length - 1];
    u.home = home;
    if (kind === 'scout') world.reveal(tilesInRings(tile, this.sight));
    if (kind === 'warrior' || kind === 'phalanx') u.mode = 'defend';
    if (kind === 'settler' && this.settler === u) this.findSites(world);
    return u;
  }

  /** A unit its city cannot pay for leaves (Freeciv's missing upkeep). */
  disband(u: Unit, world: World) {
    const wasActive = u === this.settler;
    this.units.splice(this.units.indexOf(u), 1);
    if (wasActive) {
      this.founding = false;
      this.findSites(world);
    }
  }

  /** The player marks a city site: the tile, or the nearest land to it. */
  setSite(tile: number, world: World): boolean {
    const cost = (id: number) => world.cost(id);
    const land = Number.isFinite(cost(tile)) ? tile : nearestTile(tile, () => 1, id => Number.isFinite(cost(id)));
    if (land === null || !this.settler) return false;
    this.sites = [land, ...this.sites.filter(id => id !== land)];
    this.site = 0;
    this.founding = false;
    this.settler.path = [];
    return true;
  }

  private add(kind: UnitKind, name: string, tile: number) {
    this.units.push({ id: this.nextId++, kind, name, tile, mode: 'explore', path: [], wait: 0, carrying: false, gathered: 0, home: null, task: 'found', job: null });
  }

  /** The settler whose site is chosen: the first set to found cities, if any. */
  get settler(): Unit | undefined {
    return this.units.find(u => u.kind === 'settler' && u.task === 'found');
  }

  setMode(unit: Unit, mode: Mode) {
    unit.mode = mode;
    unit.path = [];
    unit.carrying = false;
  }

  /** The chosen city site, or null if no land is near. */
  currentSite(): number | null {
    return this.sites.length ? this.sites[this.site % this.sites.length] : null;
  }

  nextSite() {
    if (this.sites.length) this.site = (this.site + 1) % this.sites.length;
    this.founding = false;
    if (this.settler) this.settler.path = [];
  }

  /** A settler founds cities or improves land; the change drops the work it is on. */
  setTask(u: Unit, task: SettlerTask, world: World) {
    if (u === this.settler && task === 'improve') this.founding = false;
    u.task = task;
    u.job = null;
    u.path = [];
    if (!this.founding) this.findSites(world);
  }

  /** Send the settler to the chosen site. */
  found(world: World) {
    const site = this.currentSite();
    const settler = this.settler;
    if (site === null || !settler) return;
    settler.task = 'found';
    settler.job = null;
    this.founding = true;
    settler.path = findPath(settler.tile, site, id => world.cost(id)) ?? [];
  }

  /** Days of walking along a path. */
  static days(path: number[], world: World): number {
    return path.reduce((sum, id) => sum + world.cost(id), 0);
  }

  /** One day: every unit acts. Returns the tiles where cities were founded. */
  day(world: World): number[] {
    const founded: number[] = [];
    for (const u of this.units) {
      if (u.wait > 0) { u.wait--; continue; }
      if (u.kind === 'settler' && u.task === 'improve' && this.work(u, world)) continue;
      if (!u.path.length && u.kind === 'scout') u.path = this.plan(u, world);
      const next = u.path[0];
      if (next === undefined || !Number.isFinite(world.cost(next))) { u.path = []; continue; }
      u.path.shift();
      u.tile = next;
      u.wait = world.cost(next) - 1;
      if (u.kind === 'scout') {
        world.reveal(tilesInRings(u.tile, this.sight));
        if (u.tile === this.flag) this.flag = null;
        if (u.mode === 'gather') this.atGatherStop(u);
      }
      if (u.kind === 'settler' && u.task === 'found' && !u.path.length) this.camp = u.tile;
    }
    // The founding settler at its site becomes the city
    const settler = this.settler;
    if (this.founding && settler && !settler.path.length && settler.wait === 0 && settler.tile === this.currentSite()) {
      this.units.splice(this.units.indexOf(settler), 1);
      founded.push(settler.tile);
      this.founding = false;
      this.findSites(world);
    }
    return founded;
  }

  /**
   * A day of an improving settler: take the next job and walk to it, or work it. Returns
   * true when the day was spent working or idle (false: it walks a step).
   */
  private work(u: Unit, world: World): boolean {
    if (!u.job) {
      const job = world.nextJob?.(u) ?? null;
      if (!job) return true;
      u.path = u.tile === job.tile ? [] : findPath(u.tile, job.tile, id => world.cost(id)) ?? [];
      if (u.tile !== job.tile && !u.path.length) return true;
      u.job = { ...job, left: job.days };
    }
    if (u.path.length) return false;
    if (--u.job.left > 0) return true;
    world.improve?.(u.job.tile, u.job.kind);
    u.job = null;
    return true;
  }

  private atGatherStop(u: Unit) {
    if (!u.carrying && !u.path.length && u.tile !== this.camp) u.carrying = true;
    else if (u.carrying && u.tile === this.camp) {
      u.carrying = false;
      u.gathered++;
    }
  }

  /** A scout's next path for its mode. */
  private plan(u: Unit, world: World): number[] {
    const cost = (id: number) => world.cost(id);
    const to = (target: number | null) => (target === null || target === u.tile ? [] : findPath(u.tile, target, cost) ?? []);
    if (u.mode === 'defend') return to(this.camp);
    if (u.mode === 'gather') {
      if (u.carrying) return to(this.camp);
      return to(nearestTile(u.tile, cost, id => world.isMapped(id) && world.hasResource(id) && id !== this.camp && Number.isFinite(cost(id))));
    }
    if (this.flag !== null) {
      const path = to(this.flag);
      if (path.length) return path;
      this.flag = null;
    }
    // Unmapped land, not in areas marked Ohita, and inside the home province with Puolustus or the province Vartija
    const allowed = (id: number) => {
      const city = world.cityOf(id);
      return this.areaPlans.get(city) !== 'skip' && ((this.stateLine !== 'defend' && !this.keepHome) || Math.floor(city / 7) === this.homeProvince);
    };
    return to(nearestTile(u.tile, cost, id => !world.isMapped(id) && Number.isFinite(cost(id)) && allowed(id)));
  }
}

const COMPASS = ['pohjoista', 'koillista', 'itää', 'kaakkoa', 'etelää', 'lounasta', 'länttä', 'luodetta'];

/** Compass direction from one tile to another, in the partitive ("kohti koillista"). */
export function directionName(from: number, to: number): string {
  return COMPASS[compassIndex(tileCenter(from), tileCenter(to))];
}

/** Status line under a unit's name (design 2b). */
export function unitStatus(units: Units, u: Unit, world: World, terrainName: (id: number) => string): string {
  if (u.kind === 'warrior' || u.kind === 'phalanx') return 'Puolustaa kaupunkia';
  if (u.kind === 'settler' && u.task === 'improve') {
    if (!u.job) return 'Kehittää · ei työtä lähellä';
    const name = IMPROVEMENT_NAMES[u.job.kind].toLowerCase();
    return u.path.length ? `Kehittää · kohti: ${name}` : `Kehittää · ${name}, ${u.job.left} pv`;
  }
  if (u.kind === 'settler' && u !== units.settler) return 'Odottaa · seuraava uudisasukas';
  if (u.kind === 'settler') {
    const site = units.currentSite();
    if (site === null) return 'Ei maata lähellä';
    if (units.founding && !u.path.length && u.tile === site) return 'Perillä · kaupunki perustetaan';
    const path = u.tile === site ? [] : findPath(u.tile, site, id => world.cost(id)) ?? [];
    return `Kaupungin paikka: ${terrainName(site).toLowerCase()}, ${Units.days(path, world)} pv`;
  }
  const goal = u.path.at(-1);
  if (u.mode === 'defend') return u.tile === units.camp ? 'Puolustaa · leiri' : 'Puolustaa · palaa leiriin';
  if (u.mode === 'gather') {
    if (u.carrying) return 'Kerää · palaa leiriin';
    return goal === undefined ? 'Kerää · ei resursseja lähellä' : `Kerää · kohti resurssia · tuotu ${u.gathered}`;
  }
  if (goal !== undefined && goal === units.flag) return 'Tutkii · kohti lippua';
  return goal === undefined ? 'Tutkii · lepää' : `Tutkii · kohti ${directionName(u.tile, goal)}`;
}
