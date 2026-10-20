/**
 * rivals.ts — rival civilizations (STORY-067; Sami 2026-10-19: rivals further off that grow by
 * the same rules as the player and meet the player's borders later). Each starts in a state
 * two steps from home with its capital on the best site there, and its cities grow and build
 * by the player's Freeciv rules (cities.ts). Own AI, as Freeciv's is far beyond this game:
 * a soldier first, then settlers while it has fewer than MAX_RIVAL_CITIES cities and the city
 * is of size 2 or more, a second soldier, then gold; no research, no mood, Despotism
 * throughout, and the player's cities pick their tiles first. The names are from the Kalevala
 * (rule 4: no Civilization names).
 *
 * War (STORY-077): a rival researches with half its trade, in its own order, and at war with
 * the player (diplomacy.ts) the two cities nearest the target build the best attacker it
 * knows until the army is big enough; the army marches as the player's does (war.ts).
 */
import { hash } from '../globe/terrain';
import { tileCenter } from '../globe/hexTiles';
import { cityDay, cityScience, cityYield, shortfall, workedTiles, type Build, type City, type YieldOf } from './cities';
import { NEEDS, Research, type Advance } from './science';
import { ATTACKERS, War, isAttacker, type Attacker, type WarSave } from './war';

export const MAX_RIVAL_CITIES = 8;
/** What a rival researches, in turn (own): the attackers' advances early. */
export const RIVAL_ORDER: readonly Advance[] = ['bronze', 'horseback', 'alphabet', 'masonry', 'wheel', 'iron', 'pottery', 'ceremonial', 'mathematics', 'currency', 'writing', 'law', 'monarchy', 'construction', 'mapmaking'];
/** A rival's share of trade that becomes science (own: the player's start rate). */
const RIVAL_TAX = 50;

const SALT = 0x41a3;
const roll = (seed: number, a: number, b: number) => Math.min(0.999999, hash(a, b, 13, seed ^ SALT) * 0.5 + 0.5);

/**
 * The rivals' start states: two or three of the states two steps from home (not home, not its
 * neighbours) that have land, none next to another, chosen by the seed.
 */
export function rivalStarts(seed: number, home: number, neighbors: readonly (readonly number[])[], hasLand: (state: number) => boolean = () => true): number[] {
  const near = new Set([home, ...neighbors[home]]);
  const ring = [...new Set(neighbors[home].flatMap(n => neighbors[n]))].filter(s => !near.has(s) && hasLand(s)).sort((a, b) => a - b);
  const order = ring.map(s => [roll(seed, s, 0), s] as const).sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  const want = 2 + (roll(seed, home, 1) < 0.5 ? 1 : 0);
  const chosen: number[] = [];
  for (const s of order) {
    if (chosen.length >= Math.min(want, RIVALS.length)) break;
    if (chosen.some(c => neighbors[c].includes(s))) continue;
    chosen.push(s);
  }
  return chosen;
}

/** The rivals, each with its own colour (oklch L, C, h) for its houses and labels. */
export const RIVALS = [
  { name: 'Pohjola', color: [0.7, 0.13, 255], cities: ['Sariola', 'Pimentola', 'Kylmälä', 'Routaniemi', 'Pakkasvaara', 'Hallaranta', 'Lumikoski', 'Jäämeri'] },
  { name: 'Tapiola', color: [0.7, 0.15, 340], cities: ['Mielikkälä', 'Kuusela', 'Havumäki', 'Sammalkorpi', 'Ilvesvaara', 'Metsola', 'Kuusamo', 'Petäjälä'] },
  { name: 'Ahtola', color: [0.75, 0.11, 195], cities: ['Vellamola', 'Aaltoranta', 'Kaislala', 'Ulapanniemi', 'Saukkosalmi', 'Hauenkita', 'Merisuu', 'Kuohula'] },
] as const;

export interface RivalUnit {
  id: number;
  kind: 'settler' | 'warrior' | Attacker;
  tile: number;
  path: number[];
  wait: number;
  /** The city that supports it. */
  home: number;
  /** A settler's site, or null until it has one. */
  site: number | null;
}

export interface RivalSave { id: number; cities: City[]; units: RivalUnit[]; nextId: number; research?: ConstructorParameters<typeof Research>[0]; war?: WarSave }

/** What a rival needs to know about the world. */
export interface RivalWorld {
  yieldOf: YieldOf;
  /** Days to enter a tile on land; Infinity at sea. */
  cost(id: number): number;
  /** The best site for a settler from a tile, or null when there is none. */
  site(from: number): number | null;
  /** A city may still be founded on a tile. */
  free(tile: number): boolean;
  path(from: number, to: number): number[] | null;
}

export type RivalEvent = { kind: 'founded' | 'grew'; city: City };

export class Rival {
  readonly cities: City[] = [];
  readonly units: RivalUnit[] = [];
  private nextId = 0;
  readonly id: number;
  /** Its advances (STORY-077); it knows every kind of resource. */
  readonly research: Research;
  /** Its campaign against the player's city when at war (STORY-077). */
  readonly war: War;
  /** The player's city its army is for, and how many attackers it needs; null in peace. */
  enemy: { tile: number; need: number } | null = null;

  constructor(id: number, saved?: RivalSave) {
    this.id = id;
    this.research = new Research(saved?.research);
    this.war = new War(saved?.war);
    if (!saved) return;
    this.cities.push(...saved.cities);
    this.units.push(...saved.units);
    this.nextId = saved.nextId;
  }

  /** The strongest attacker it knows, or null. */
  bestAttacker(): Attacker | null {
    return [...ATTACKERS].reverse().find(k => this.research.known.has(NEEDS[k]!)) ?? null;
  }

  /** Its attackers. */
  army(): RivalUnit[] {
    return this.units.filter(u => isAttacker(u.kind));
  }

  /** The two cities nearest to a tile: they build the army. */
  armyCities(tile: number): City[] {
    const at = tileCenter(tile);
    return this.cities.map(c => [tileCenter(c.tile).angleTo(at), c] as const).sort((a, b) => a[0] - b[0]).slice(0, 2).map(([, c]) => c);
  }

  /** A city lost (STORY-077): its units go, and the other cities keep their ids as indices. */
  lose(c: City): void {
    const i = this.cities.indexOf(c);
    if (i < 0) return;
    this.cities.splice(i, 1);
    for (const u of this.units.filter(x => x.home === c.id)) this.units.splice(this.units.indexOf(u), 1);
    for (const u of this.units) if (u.home > c.id) u.home--;
    this.cities.forEach((x, k) => { x.id = k; });
    if (c.capital && this.cities.length) this.cities[0].capital = true;
  }

  /** A city of the player's taken (STORY-077): it keeps its name, a citizen fewer, and starts its builds anew. */
  gain(c: City): City {
    const city: City = { id: this.cities.length, name: c.name, tile: c.tile, capital: false, size: Math.max(1, c.size - 1), food: 0, shields: 0, build: 'warrior', buildings: [...c.buildings], focus: 'balanced' };
    this.cities.push(city);
    return city;
  }

  get name(): string {
    return RIVALS[this.id].name;
  }

  save(): RivalSave {
    return { id: this.id, cities: this.cities.map(c => ({ ...c, buildings: [...c.buildings] })), units: this.units.map(u => ({ ...u, path: [...u.path] })), nextId: this.nextId, research: this.research.save(), war: this.war.save() };
  }

  /** A city on a tile, the capital first, named from the rival's list. */
  found(tile: number): City {
    const names = RIVALS[this.id].cities;
    const k = this.cities.length;
    const city: City = {
      id: k, name: names[k % names.length] + (k >= names.length ? ` ${Math.floor(k / names.length) + 1}` : ''), tile,
      capital: k === 0, size: 1, food: 0, shields: 0, build: 'warrior', buildings: [], focus: 'balanced',
    };
    this.cities.push(city);
    return city;
  }

  /** What a city builds next: a soldier first, settlers to spread, a second soldier, then gold. */
  nextBuild(c: City): Build {
    const soldiers = this.units.filter(u => u.kind === 'warrior' && u.home === c.id).length;
    if (soldiers === 0) return 'warrior';
    // At war the cities nearest the target build its army first (STORY-077)
    const attacker = this.bestAttacker();
    if (this.enemy && attacker && !this.war.marching && this.army().length < this.enemy.need && this.armyCities(this.enemy.tile).includes(c)) return attacker;
    const settlers = this.units.filter(u => u.kind === 'settler').length;
    if (this.cities.length + settlers < MAX_RIVAL_CITIES && c.size >= 2) return 'settler';
    return soldiers < 2 ? 'warrior' : 'coinage';
  }

  /**
   * A day: each city, after the tiles in `taken`, grows and builds (a unit it cannot pay for
   * leaves first, as for the player), and settlers walk to their sites and found cities.
   */
  day(world: RivalWorld, taken: Set<number>): RivalEvent[] {
    const events: RivalEvent[] = [];
    let science = 0;
    for (const c of this.cities) {
      const own = this.units.filter(u => u.home === c.id);
      const support = { units: own.length, settlers: own.filter(u => u.kind === 'settler').length };
      const y = cityYield(c, world.yieldOf, taken, support, 'despotism');
      if (shortfall(c, y, support)) this.units.splice(this.units.indexOf(own[own.length - 1]), 1);
      for (const t of workedTiles(c, world.yieldOf, taken)) taken.add(t);
      const size = c.size;
      c.build = this.nextBuild(c);
      const done = cityDay(c, y);
      if (done === 'warrior' || done === 'settler' || (done && isAttacker(done))) this.units.push({ id: this.nextId++, kind: done, tile: c.tile, path: [], wait: 0, home: c.id, site: null });
      if (c.size > size) events.push({ kind: 'grew', city: c });
      science += cityScience(c, y, RIVAL_TAX);
    }
    // Research in its own order (STORY-077)
    if (this.research.target === null) this.research.target = RIVAL_ORDER.find(a => this.research.available().includes(a)) ?? null;
    this.research.add(science);
    // Soldiers on the march walk their paths, a tile at a time (STORY-077)
    for (const u of this.units) {
      if (u.kind === 'settler') continue;
      if (u.wait > 0) { u.wait--; continue; }
      if (!u.path.length) continue;
      u.tile = u.path.shift()!;
      u.wait = world.cost(u.tile) - 1;
    }
    for (const u of [...this.units]) {
      if (u.kind !== 'settler') continue;
      if (u.wait > 0) { u.wait--; continue; }
      if (u.site === null || !world.free(u.site)) {
        u.site = world.site(u.tile);
        u.path = u.site === null || u.site === u.tile ? [] : world.path(u.tile, u.site) ?? [];
        if (u.site !== null && u.site !== u.tile && !u.path.length) u.site = null;
        if (u.site === null) continue;
      }
      if (u.path.length) {
        u.tile = u.path.shift()!;
        u.wait = world.cost(u.tile) - 1;
        continue;
      }
      this.units.splice(this.units.indexOf(u), 1);
      events.push({ kind: 'founded', city: this.found(u.tile) });
    }
    return events;
  }
}
