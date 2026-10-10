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
 */
import { tileCenter } from '../globe/hexTiles';
import { findPath, nearestTile, tilesInRings } from './pathfinding';

export type UnitKind = 'scout' | 'settler';
export type Mode = 'explore' | 'gather' | 'defend';
export const MODE_NAMES: Record<Mode, string> = { explore: 'Tutki', gather: 'Kerää', defend: 'Puolusta' };
/** Rings a scout maps around itself. */
export const SIGHT = 2;

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
  /** The settler is walking to the site to found the city (STORY-028 founds it). */
  founding = false;

  constructor(landing: number, world: World) {
    this.camp = landing;
    const land = tilesInRings(landing, 1).filter(id => id !== landing && Number.isFinite(world.cost(id)));
    this.add('settler', 'Uudisasukas', landing);
    this.add('scout', 'Tiedustelija 1', land[0] ?? landing);
    this.add('scout', 'Tiedustelija 2', land[Math.floor(land.length / 2)] ?? landing);
    // Candidate sites within three rings, best first
    this.sites = tilesInRings(landing, 3)
      .filter(id => Number.isFinite(world.cost(id)))
      .map(id => [world.siteScore(id), id] as const)
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])
      .map(([, id]) => id);
    for (const u of this.units) if (u.kind === 'scout') world.reveal(tilesInRings(u.tile, SIGHT));
  }

  private add(kind: UnitKind, name: string, tile: number) {
    this.units.push({ id: this.units.length, kind, name, tile, mode: 'explore', path: [], wait: 0, carrying: false, gathered: 0 });
  }

  get settler(): Unit {
    return this.units.find(u => u.kind === 'settler')!;
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
    this.settler.path = [];
  }

  /** Send the settler to the chosen site. */
  found(world: World) {
    const site = this.currentSite();
    if (site === null) return;
    this.founding = true;
    this.settler.path = findPath(this.settler.tile, site, id => world.cost(id)) ?? [];
  }

  /** Days of walking along a path. */
  static days(path: number[], world: World): number {
    return path.reduce((sum, id) => sum + world.cost(id), 0);
  }

  /** One day: every unit acts. */
  day(world: World) {
    for (const u of this.units) {
      if (u.wait > 0) { u.wait--; continue; }
      if (!u.path.length && u.kind === 'scout') u.path = this.plan(u, world);
      const next = u.path[0];
      if (next === undefined || !Number.isFinite(world.cost(next))) { u.path = []; continue; }
      u.path.shift();
      u.tile = next;
      u.wait = world.cost(next) - 1;
      if (u.kind === 'scout') {
        world.reveal(tilesInRings(u.tile, SIGHT));
        if (u.tile === this.flag) this.flag = null;
        if (u.mode === 'gather') this.atGatherStop(u);
      }
      if (u.kind === 'settler' && !u.path.length) this.camp = u.tile;
    }
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
    return to(nearestTile(u.tile, cost, id => !world.isMapped(id) && Number.isFinite(cost(id))));
  }
}

const COMPASS = ['pohjoista', 'koillista', 'itää', 'kaakkoa', 'etelää', 'lounasta', 'länttä', 'luodetta'];

/** Compass direction from one tile to another, in the partitive ("kohti koillista"). */
export function directionName(from: number, to: number): string {
  const a = tileCenter(from);
  const b = tileCenter(to);
  // East and north in the tangent plane at a
  const north = a.clone().multiplyScalar(-a.y).setY(a.y * -a.y + 1).normalize();
  const east = north.clone().cross(a).normalize();
  const d = b.sub(a);
  const angle = Math.atan2(d.dot(east), d.dot(north)); // clockwise from north
  return COMPASS[(Math.round((angle / (2 * Math.PI)) * 8) + 8) % 8];
}

/** Status line under a unit's name (design 2b). */
export function unitStatus(units: Units, u: Unit, world: World, terrainName: (id: number) => string): string {
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
