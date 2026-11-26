/**
 * game.ts — the day's simulation (STORY-095, PLAN-092 phase C): the units, the cities, the
 * chronicles, the rivals, diplomacy and war, the raids, the city-states and tribes, and the
 * advisors, moved here from the browser's main.ts as they were.
 *
 * It holds one game at a time: bind() gives it the world (the regions, the tile types and the
 * map), the clock whose day it reads, the game's seed and the events the view draws, and
 * setPlay() the game's state. Nothing here draws or touches the page (the importtest in
 * src/sim/boundary.test.ts watches it); Three.js is used for its vector maths only.
 */
/**
 * globe/main.ts — Three.js 3D globe with hex grid.
 * Minimal working version for T-GC3-001.
 */
import * as THREE from 'three';
import { groundHeight } from '../game/relief';
import { bestTile, placeAll, spots, type Ground } from '../game/placement';
import { execute, type Actor, type Command, type CommandWorld, type FirstScope, type PactAct, type RaidChoice } from '../game/commands';
import { accepts, attitudeWord, newTies, rivalMove, setState, tiesDay, BORDER_TILES } from '../game/diplomacy';
import { acceptsTrade, factor, MAPS_EVERY, TRADE_ATTITUDE, TRADE_GOLD, tradeId, worth, type TradeItem } from '../game/trade';
import { neighbors, pointToTile, tileCenter } from '../globe/hexTiles';
import { Regions } from '../globe/regions';
import { hash, heightRange } from '../globe/terrain';
import { cityTiles } from '../game/start';
import { TileTypeTable } from '../game/terrainTypes';
import { MapState } from '../game/mapping';
import { findPath, nearestTile, tilesInRings } from '../game/pathfinding';
import { borderRings, cultureGain, heldByBorder, provinceCover, tileOwner, type BorderSource } from '../game/culture';
import { connectedKinds, connectedShields, roadNetwork, strategicTiles, unconnected, type StrategicKind, type StrategicTile } from '../game/connection';
import { FAIR_SITE, feedsCity, goodSite, OFFER_EVERY_DAYS, QUIET_DAYS, SITE_SPACING } from '../game/sites';
import { ADVANCES, LUX_RATES, NEEDS, RESOURCE_KINDS, isKind, opensFrom, studyName, type Advance, type Study, type LuxRate, type TaxRate } from '../game/science';
import { GOVERNMENTS, REVOLUTION_TO, revolutionDays, type RevolutionTarget } from '../game/government';
import { conquest, heldIn, type Conquest } from '../game/conquest';
import { nativeCities, nativeStrength, NATIVE_CLEARANCE, NATIVE_SPACING, type NativeCity } from '../game/cityStates';
import { Rival, rivalStarts, type RivalUnit, type RivalWorld } from '../game/rivals';
import { RANSOM_GOLD, tribeBand, tribeCamp, tribeOf, tribeRaids, TRIBE_REACH, type Tribe } from '../game/nomads';
import { armyNeeded, attackWins, ATTACK, ATTACKERS, MAX_ARMY, isAttacker, warRoll, type WarEvent, type WarWorld } from '../game/war';
import { ADVISOR_LEVELS, chainAdvice, PLANET_ADVISOR_LIST, planetTarget, townAdvice, TOWN_ADVISOR_LIST, type AdvisorLevel, type PlanetAdvisor, type TownAdvisor } from '../game/advisors';
import { personOf, type Era } from '../game/persons';
import { eraOf } from '../game/eras';
import { CITY_ADVISOR_LIST, PROVINCE_ADVISOR_LIST, STATE_ADVISOR_LIST, STATE_PLANS, cityAdvice, expeditionTarget, provinceGoalTarget, exploreTarget, luxuryStep, nextAdvance, provinceBuild, settleAreas, type CityAdvisor, type ProvinceAdvisor, type StateAdvisor } from '../game/advisors';
import { advanceRef, buildRef, resourceRef } from '../game/codex';
import { city as cityRef, unit as unitRef, type Rich, type Segment } from '../game/rich';
import { marksPassed, record } from '../game/history';
import { defenseBonus, goldBonus, goodsBonus, scienceBonus, settleBonus, sightBonus, yieldBonus, type ActiveBonuses } from '../game/bonuses';
import { TERRAINS, TERRAIN_RULES, RESOURCES, type ResourceKind, type Terrain } from '../game/terrainTypes';
import { directionName, travel, type AreaPlan, type Mode, type SettlerTask, type StateLine, type Unit, type World } from '../game/units';
import { bestJob, IMPROVEMENT_NAMES, workDays, type Job } from '../game/improvements';
import { defenseOf, holdChance, raidRoll, raidStart, uprising, type RaidEvent, type RaidWorld } from '../game/raids';
import { type FirstKind } from '../game/save';
import { type GameState } from '../sim/state';
import { advance, UNLOCK_SHARE } from '../game/progress';
import { goalCount, levelGoal, type LevelState } from '../game/goals';
import { pending } from './state';
import { areaName, directionFrom, distinctNames, landscapeOf, MIDDLE, provinceName, stateName, type RegionName } from '../game/names';
import { CONSOLATION_GOLD, RUIN_GOLD, isRuin, ruinAt, type Yield } from '../game/discoveries';
import { buildDay, chainOpen, CHAIN_ONLY, eat, isChainBuilding, newChain, readySettlements, settlementDone, settlementStart, settlementSteps, startSite, workDay } from '../game/chains';
import { cityLuxury, cityMood, type Faith, isWonder, sizeLimit, SIZE_LIMIT, withMood, BUILDS, isSoldier, buy, buyCost, daysToBuild, cityDay, cityGold, cityRings, cityScience, cityYield, foundCity, granary, isBuilding, payUpkeep, shortfall, workedTiles, workedYield, CITY_RINGS, isTerrainBuilding, TERRAIN_BUILDINGS, type TerrainBuilding, isResourceBuilding, KNOWN_REWARD_GOLD, RESOURCE_BUILDINGS, type ResourceBuilding, type Build, type Building, BUILDINGS, type City, type CityYield, type Support } from '../game/cities';

import type { MomentKind, SimEvents } from './events';
import { TILE_COUNT } from '../globe/hexTiles';
import { SAVE_VERSION, type SaveData } from '../game/save';
import { Units } from '../game/units';
import { startProgress } from '../game/progress';
import { Improvements } from '../game/improvements';
import { Raids } from '../game/raids';
import { War } from '../game/war';
import { RIVALS } from '../game/rivals';
import { Research } from '../game/science';
import { CommandLog } from '../game/commands';

// ─── The game being simulated ─────────────────────
/** The game's state; the browser's Play adds the view's own to the same object. */
export let play: GameState | null = null;
/** The game's seed and start, and the old start's rules (?classic, the mechanics' tests). */
export let game: { seed: number; startCity: number; capital?: number } | null = null;
export let classic = false;
/** The day: the browser's clock, or a run's. */
export let clock: { day: number } = { day: 1 };
/** The world: the regions, the tile types worked out as needed, and what is mapped. */
export let regions: Regions;
export let tileTypes: TileTypeTable;
export let mapState: MapState;
let view: SimEvents;

/** Give the simulation its world, clock and events, once before any game. */
export function bind(w: { regions: Regions; tileTypes: TileTypeTable; mapState: MapState; clock: { day: number }; events: SimEvents; classic: boolean }) {
  ({ regions, tileTypes, mapState, clock, classic } = w);
  view = w.events;
}
/** The game played now, and its seed and start; null between games. */
export function setGame(g: typeof game) { game = g; }
export function setPlay(p: GameState | null) { play = p; }
/** A moment's glow, through the events. */
const moment = (kind: MomentKind, tile: number | null) => view.moment(kind, tile);



// ─── Resources and their study (STORY-072) ───────
// Sami 2026-10-20: the people study a special resource and then see the others on the map;
// finds bring new studies, and resources open advances (science.ts). A kind not known shows as
// an unknown marker and yields nothing.

/** Kinds of special resource on the mapped tiles of this game. */
export const foundKinds = new Set<ResourceKind>();
/** A tile's special resource from its code, known or not (the code is filled once it is mapped). */
export function kindAt(t: number): ResourceKind | null {
  const code = tileTypes.codes[t];
  return code & 16 ? TERRAIN_RULES[TERRAINS[(code & 15) - 1]].resource : null;
}
/** Whether the people know a kind: it shows and yields. Outside a game every kind shows. */
export function knownKind(k: ResourceKind): boolean {
  return play?.research.kinds.has(k) ?? true;
}
/** The known kinds as a bit per terrain, for the shader. */
export function kindMask(): number {
  return TERRAINS.reduce((m, t, i) => (knownKind(TERRAIN_RULES[t].resource) ? m | (1 << i) : m), 0);
}
/** Kinds on freshly mapped tiles: one not known yet becomes a study. */
function noteKinds(ids: Iterable<number>) {
  for (const id of ids) {
    const k = kindAt(id);
    if (!k || foundKinds.has(k)) continue;
    foundKinds.add(k);
    if (play && !play.research.kinds.has(k)) view.notice(`Löytö: ${studyName(k).toLowerCase()} · uusi tutkimuskohde`);
  }
}

/** Map tiles: their terrain, the mapped bit and the coarse fog map, uploaded at once. */
export function reveal(ids: Iterable<number>): number[] {
  const fresh = mapState.reveal(ids);
  if (!fresh.length) return fresh;
  const codes = tileTypes.codes;
  for (const id of fresh) {
    tileTypes.fillTile(id);
    codes[id] |= 32;
  }
  noteKinds(fresh);
  view.revealed(fresh);
  return fresh;
}

export const terrainOf = (id: number): Terrain => {
  tileTypes.fillTile(id);
  return TERRAINS[(tileTypes.codes[id] & 15) - 1];
};
/** True while the units take their day: tiles mapped then may hold discoveries. */
export let scouting = false;
/** The day being simulated inside a frame that runs several days, for the command log. */
export let tickDay: number | null = null;
/** Tests of the clock and the units turn ruins off (they change gold, units and advances). */
export let discoveriesOn = true;
/** Site offers stop the game too; tests of other things turn them off with discoveries. */
export let siteOffersOn = true;
/** Raids as well (STORY-034). */
export let raidsOn = true;
/** An advance's card stops the game (STORY-118); tests of other things turn it off with discoveries. */
export let advanceCardsOn = true;
/**
 * Coastal sea: ocean next to land. With Kartanteko units go there at a day a tile (STORY-059;
 * Freeciv civ1 units.ruleset Trireme: Map Making, move_rate 3, flag CoastStrict). Own
 * simplification: no ship is built, as the units move by themselves.
 */
export const coastal = (id: number) => terrainOf(id) === 'ocean' && neighbors(id).some(n => terrainOf(n) !== 'ocean');
export const canSail = () => play?.research.known.has('mapmaking') ?? false;

/** A tile's part of a site score: its food twice, shields and trade. */
function siteValue(t: number) {
  const rule = TERRAIN_RULES[terrainOf(t)];
  const res = tileTypes.codes[t] & 16 ? RESOURCES[rule.resource] : NO_YIELD;
  return 2 * (rule.food + res.food) + rule.shield + res.shield + rule.trade + res.trade;
}

export const world: World = {
  cost: id => (terrainOf(id) === 'ocean' ? Infinity : TERRAIN_RULES[terrainOf(id)].move),
  travel: id => (terrainOf(id) !== 'ocean' ? TERRAIN_RULES[terrainOf(id)].move : canSail() && coastal(id) ? 1 : Infinity),
  isMapped: id => mapState.isMapped(id),
  hasResource: id => (tileTypes.codes[id] & 16) !== 0,
  reveal: ids => {
    const fresh = reveal(ids);
    if (scouting) noteDiscoveries(fresh);
  },
  cityOf: id => regions.tileTable()[id],
  // A city site is as good as the food, shields and trade within two rings (food counts twice);
  // one that cannot feed its first citizen is no site (STORY-065)
  siteScore: id => (feedsCity(id, (t, centre) => terrainYield(t, centre).food) ? tilesInRings(id, 2).reduce((sum, t) => sum + siteValue(t), 0) : 0),
  // A worker joins strategic resources first (STORY-093), then improves land as a settler does
  nextJob: u => (u.kind === 'worker' && play ? workerJob(u) ?? nextJob(u) : nextJob(u)),
  joining: u => (u.job?.kind === 'road' && joiningOf.has(u.id) ? RESOURCES[joiningOf.get(u.id)!].name : null),
  improve: (tile, kind) => {
    if (!play) return;
    play.improvements.add(tile, kind);
    if (kind === 'road') roadVersion++;
    moment('improve', tile);
    view.notice(`${IMPROVEMENT_NAMES[kind]} valmis · ${TERRAIN_RULES[terrainOf(tile)].name.toLowerCase()}`);
  },
};

// ─── Cities (STORY-028) ───────────────────────────
// The settler sent to its site founds a city. A city works its centre and one tile per
// citizen, grows and builds; what it builds joins the units.

export const NO_YIELD: Yield = { food: 0, shield: 0, trade: 0 };

/** A tile's food, shields and trade from its terrain and resource alone, as the centre or worked: the same in every game of a seed. */
function terrainYield(id: number, centre: boolean) {
  const terrain = terrainOf(id);
  return workedYield({ terrain, resource: tileTypes.codes[id] & 16 ? TERRAIN_RULES[terrain].resource : null }, centre);
}

/** terrainYield as the people know it (STORY-072): a resource of a kind not studied gives nothing. */
function knownYield(id: number, centre: boolean) {
  const terrain = terrainOf(id);
  const k = kindAt(id);
  return workedYield({ terrain, resource: k && knownKind(k) ? k : null }, centre);
}

/** A worked tile's food, shields and trade: terrain, known resource, an irrigated centre and improvements (Freeciv civ1), plus finds. */
export function yieldOf(id: number, centre: boolean) {
  const terrain = terrainOf(id);
  const y = knownYield(id, centre);
  const b = play?.bonuses.get(id) ?? NO_YIELD;
  const imp = play?.improvements.yieldOf(id, terrain) ?? NO_YIELD;
  // The centre's irrigation and road are counted already
  return { food: y.food + b.food + (centre ? 0 : imp.food), shield: y.shield + b.shield + imp.shield, trade: y.trade + b.trade + (centre ? 0 : imp.trade) };
}

/** Units a city built and still supports; a caravan costs nothing (Freeciv civ1 units.ruleset Caravan uk_shield 0, STORY-121). */
export function supportOf(c: City): Support {
  const units = play ? play.units.units.filter(u => u.home === c.id && u.kind !== 'caravan') : [];
  return { units: units.length, settlers: units.filter(u => u.kind === 'settler').length };
}

/** Yields of the cities in founding order; a tile is worked by the first city that takes it. */
export function cityYields(): CityYield[] {
  if (!play) return [];
  const taken = new Set<number>();
  const active = activeBonuses();
  return play.cities.map(c => {
    const y = withBonus(cityYield(c, yieldOf, taken, supportOf(c), play!.gov), c, active);
    for (const t of workedTiles(c, yieldOf, taken)) taken.add(t);
    return withMood(y, moodOf(c, y));
  });
}

/** A city's mood: its soldiers calm citizens (STORY-044); the gardens make one happy (STORY-045); under the Republic its units away make them unhappy (STORY-125). */
export const moodOf = (c: City, y: CityYield) =>
  cityMood(c, soldiersIn(c.tile).length, play?.cities.length ?? 1, faith(), cityLuxury(c, y, rates().tax, rates().lux), play?.gov, awayOf(c));

/**
 * A city's units able to attack that stand outside a city: under the Republic each makes one of
 * its citizens unhappy (STORY-125; Freeciv civ1 has borders off, so common/unit.c
 * unit_being_aggressive is any attacking unit not in a city). None counts under the others.
 */
export function awayOf(c: City): number {
  if (!play || !GOVERNMENTS[play.gov].awayUnhappy) return 0;
  const cities = new Set(play.cities.map(x => x.tile));
  return play.units.units.filter(u => u.home === c.id && (isSoldier(u.kind) || isAttacker(u.kind)) && !cities.has(u.tile)).length;
}
/** The tax and luxury rates in force: in anarchy all trade is luxury (STORY-047). */
export const rates = () => (!play ? { tax: 50, lux: 0 } : play.gov === 'anarchy' ? { tax: 0, lux: 100 } : { tax: play.tax, lux: play.lux });
/** A wonder is in one of the cities (STORY-045). */
export const hasWonder = (w: Build) => play?.cities.some(c => c.buildings.includes(w as never)) ?? false;
/** What every city's mood feels from the player's wonders and advances (STORY-121). */
const faith = (): Faith => ({ gardens: hasWonder('gardens'), oracle: hasWonder('oracle'), mysticism: play?.research.known.has('mysticism') ?? false });
/** A city's walls, or the Great Wall's in every city. */
export const hasWalls = (c: City) => c.buildings.includes('walls') || hasWonder('greatwall');
/** Cities told that they need an aqueduct to grow. */
const atLimit = new Set<number>();
/** Cities in disorder on the last day, for the notices when it starts and ends. */
const unrest = new Set<number>();

/** Tiles each city works (or would, with `extra` citizens), in founding order; a tile is worked by the first city that takes it. */
export function workedByCity(extra = 0): number[][] {
  const taken = new Set<number>();
  return play ? play.cities.map(c => {
    const worked = workedTiles({ ...c, size: c.size + extra }, yieldOf, taken);
    for (const t of worked) taken.add(t);
    return worked;
  }) : [];
}

/**
 * A settler's next improvement (STORY-033): for its own city, or the nearest one, the most
 * worthwhile on a tile the city works, else on the two it works next as it grows. Not on the
 * centre, and not where another settler is working.
 */
function nextJob(u: Unit) {
  if (!play || !play.cities.length) return null;
  const at = tileCenter(u.tile);
  const nearest = play.cities.reduce((a, b) => (tileCenter(b.tile).angleTo(at) < tileCenter(a.tile).angleTo(at) ? b : a));
  const city = play.cities.find(c => c.id === u.home) ?? nearest;
  const busy = new Set(play.units.units.flatMap(o => (o !== u && o.job ? [o.job.tile] : [])));
  const jobIn = (tiles: number[]) => bestJob(tiles.filter(t => t !== city.tile && !busy.has(t)), play!.improvements, terrainOf, neighbors, id => terrainOf(id) === 'ocean', play!.research.known.has('bridges'));
  const i = play.cities.indexOf(city);
  return jobIn(workedByCity()[i]) ?? jobIn(workedByCity(2)[i]);
}

export function foundAt(tile: number, founder: string | null = null) {
  if (!play) return;
  const city = foundCity(play.cities, tile);
  // A city founded in the city area of a new game starts as a settlement (STORY-091, Sami
  // 2026-11-22): its base and a chain of food stand at once where the governor puts them, at
  // size 1 as in Freeciv, and the city level's advisor keeps its chains going
  if (play.cities.length > 1 && !classic && play.cities.some(c => c.chain)) {
    city.chain = newChain();
    city.buildings.push(...settlementStart(b => spots(city, b, ground).length > 0));
    placeAll(city, ground);
  }
  chronicleFounding(city, founder);
  moment('city', tile);
  reveal(tilesInRings(tile, CITY_RINGS));
  // The first city opens its card; later ones are told, and their card waits for a tap (STORY-108, PLAYTEST-002)
  if (play.cities.length === 1) view.firstCity(city);
  else view.notice(['Uusi kaupunki: ', cityRef(city.tile, city.name)]);
}

/**
 * The bonuses of the levels' active advisors (STORY-107): the person of this era in each chosen
 * role. The own hand has none.
 */
export function activeBonuses(): ActiveBonuses {
  const out: ActiveBonuses = {};
  if (!play) return out;
  for (const level of ADVISOR_LEVELS) {
    const id = chosenAdvisor(level);
    const person = id === 'none' ? null : personOf(level, id, eraNow());
    if (person) out[level] = person.bonus;
  }
  return out;
}

/** A city's yield with its level's advisor's bonus: the capital the city level's, the others the city area's. */
function withBonus(y: CityYield, c: City, active: ActiveBonuses): CityYield {
  const b = yieldBonus(active, c.capital);
  // The strategic kinds joined by road in the city's province (STORY-093)
  const joined = joinedShields(c);
  return { ...y, food: y.food + b.food, shield: y.shield + b.shield + joined, trade: y.trade + b.trade, surplus: y.surplus + b.food };
}

/** The day an event goes into the chronicle: the day being played, in a frame of several. */
const today = () => tickDay ?? clock.day;

/**
 * The founding in the city's chronicle (STORY-106): its founder, its land, the special resource
 * known there, and the nearest city of the player's.
 */
function chronicleFounding(city: City, founder: string | null) {
  const p = play!;
  const terrain = terrainOf(city.tile);
  const found = tileTypes.codes[city.tile] & 16 ? TERRAIN_RULES[terrain].resource : null;
  const at = tileCenter(city.tile);
  const near = p.cities.filter(c => c !== city).reduce<City | null>((best, c) => (!best || tileCenter(c.tile).distanceTo(at) < tileCenter(best.tile).distanceTo(at) ? c : best), null);
  record(city, { kind: 'founded', day: today(), founder, terrain, resource: found && knownKind(found) ? RESOURCES[found].name : null, near: near && { name: near.name, tile: near.tile } });
}

/** The era turned (STORY-106): every city writes it down. Null until the game's first day. */
let chronicleEra: Era | null = null;
export function chronicleEraDay() {
  const era = eraNow();
  if (chronicleEra !== null && era !== chronicleEra) for (const c of play!.cities) record(c, { kind: 'era', day: today(), era });
  chronicleEra = era;
}

/**
 * Each day a city takes the fewest citizens off the tiles as entertainers that keeps it out of
 * disorder, as Freeciv's city governor does (STORY-061: in a long game the empire size put
 * more and more cities in disorder, which makes no shields, gold or science). If none helps,
 * all work.
 */
function arrangeEntertainers() {
  const p = play!;
  const active = activeBonuses();
  const taken = new Set<number>();
  for (const c of p.cities) {
    let best = 0;
    for (let e = 0; e <= c.size; e++) {
      c.entertainers = e;
      const y = withBonus(cityYield(c, yieldOf, taken, supportOf(c), p.gov), c, active);
      if (!moodOf(c, y).disorder) { best = e; break; }
    }
    c.entertainers = best;
    for (const t of workedTiles(c, yieldOf, taken)) taken.add(t);
  }
}

/**
 * A day of a city of chains (STORY-088), in a fixed order: the people eat the meals the day's
 * yield counted, the buildings work, and the site takes its materials and its builders' day.
 */

function chainDay(c: City, citizens: number) {
  const s = c.chain!;
  eat(s, citizens);
  const built = c.buildings.filter(isChainBuilding);
  // Where the site stands, before it may finish today
  const siteTile = s.site ? (c.placed?.[s.site.building] ?? bestTile(c, s.site.building, ground)) : null;
  const work = workDay(s, built, built.filter(b => c.best?.includes(b)), c.capital ? goodsBonus(activeBonuses()) : 0);
  const { done, moves } = buildDay(s);
  // Each move walks from tile to tile: the centre is the city's tile, a building its own. Only
  // the city whose level is shown walks them (STORY-091: more cities than the capital have chains)
  view.carriers(c, [...work, ...moves], siteTile);
  if (!done) return;
  c.buildings.push(done);
  record(c, { kind: 'built', day: today(), building: done });
  moment('city', c.tile);
  view.notice([cityRef(c.tile, c.name), ' rakensi: ', buildRef(done)]);
}

/** A day of every city: units it cannot pay for leave first (newest first), then it grows and builds. */
export function cityDays() {
  if (!play) return;
  // The day anarchy ends, the revolution's government begins (STORY-047; STORY-125: its target,
  // Monarchy in an old save)
  if (play.gov === 'anarchy' && clock.day >= play.anarchyUntil) {
    play.gov = play.revolutionTo ?? 'monarchy';
    play.anarchyUntil = -1;
    play.revolutionTo = undefined;
    view.notice(`Anarkia päättyi: ${GOVERNMENTS[play.gov].name} on hallitusmuoto`);
    if (play.cities[0]) moment('unlock', play.cities[0].tile);
  }
  arrangeEntertainers();
  let yields = cityYields();
  // Disorder starts or ends
  play.cities.forEach((c, i) => {
    if (yields[i].disorder && !unrest.has(c.id)) {
      unrest.add(c.id);
      view.notice(`Levottomuuksia: ${c.name} · tyytymättömät pysäyttivät kaupungin`);
      moment('raid', c.tile);
    } else if (!yields[i].disorder && unrest.delete(c.id)) {
      view.notice(`${c.name} rauhoittui`);
    }
  });
  play.cities.forEach((c, i) => {
    for (let short = shortfall(c, yields[i], supportOf(c)); short; short = shortfall(c, yields[i], supportOf(c))) {
      // A caravan costs no upkeep (uk_shield 0), so cutting it would not help (review by Utu)
      const own = play!.units.units.filter(u => u.home === c.id && u.kind !== 'caravan' && (short === 'shield' || u.kind === 'settler'));
      play!.units.disband(own[own.length - 1], world);
      yields = cityYields();
    }
    const size = c.size;
    const rings = borderRings(c.size, c.culture ?? 0);
    const done = cityDay(c, yields[i], settleBonus(activeBonuses()));
    // The chains' day (STORY-088): today's meals, which the yield counted, then the goods and the site
    if (c.chain) chainDay(c, size);
    // Culture gathers all game; the border it widens is the province level's, and told there (STORY-093)
    c.culture = (c.culture ?? 0) + cultureGain(c);
    const wider = borderRings(c.size, c.culture);
    if (provinceStage() && wider > rings) {
      record(c, { kind: 'border', day: today(), rings: wider });
      view.notice([cityRef(c.tile, c.name), ` laajensi rajojaan: ${wider} ruudun päähän`]);
      moment('city', c.tile);
    }
    // A full box at the size limit: said once (STORY-054)
    if (c.size >= sizeLimit(c) && c.food >= granary(c.size) && !atLimit.has(c.id)) {
      atLimit.add(c.id);
      view.notice(`${c.name} tarvitsee vesijohdon kasvaakseen yli koon ${SIZE_LIMIT}`);
    }
    // Trade comes in as gold, and the buildings' upkeep goes out (STORY-038)
    const paid = payUpkeep(c, play!.gold + cityGold(c, yields[i], rates().tax, rates().lux));
    play!.gold = paid.treasury;
    if (paid.sold.length) view.notice(`Kulta loppui: ${c.name} myi ${paid.sold.map(b => BUILDS[b].name.toLowerCase()).join(' ja ')}`);
    if (c.size > size) {
      // Sizes 3, 5 and 8 go into the chronicle, the first time (STORY-106)
      for (const m of marksPassed(size, c.size)) if (!c.history?.some(e => e.kind === 'grew' && e.size === m)) record(c, { kind: 'grew', day: today(), size: m });
      view.notice([cityRef(c.tile, c.name), ` kasvoi kokoon ${c.size}${cityRings(c.size) > cityRings(size) ? ', ja sen alue laajeni' : ''}`]);
      moment('city', c.tile);
    }
    if (!done) return;
    if (isBuilding(done)) {
      moment(isWonder(done) ? 'unlock' : 'city', c.tile);
      record(c, { kind: 'built', day: today(), building: done });
    }
    // A unit is named, a building a building (STORY-102, STORY-103)
    const made = !isBuilding(done) && (isSoldier(done) || isAttacker(done) || done === 'settler' || done === 'scout' || done === 'worker' || done === 'caravan') ? play!.units.spawn(done, c.tile, world, c.id) : null;
    view.notice([cityRef(c.tile, c.name), ` rakensi${isWonder(done) ? ' ihmeen' : ''}: `, made ? unitRef(made.id, made.name) : buildRef(done)]);
    if (isResourceBuilding(done)) rewardOf(c, done);
    if (c.first === done) delete c.first;
    // The settler of a waiting site is one: the city goes on to gold, and its advisor orders
    // more if it wants them (STORY-113, own rule; Utu's review: else every city that built one
    // kept building them)
    if (done === 'settler' && play!.pendingSite !== null) c.build = 'coinage';
  });
  // The governor puts new buildings on their best ground, and the bonuses follow (STORY-071)
  for (const c of play.cities) placeAll(c, ground);
  // The cities' science; an advance learned opens what needs it (STORY-040)
  // The state's advisor adds gold to the treasury (STORY-107)
  if (play.cities.length) play.gold += goldBonus(activeBonuses());
  const learned = play.research.add(peopleStudy() + scienceBonus(activeBonuses()) + play.cities.reduce((sum, c, i) => sum + cityScience(c, yields[i], rates().tax, rates().lux), 0));
  if (learned && isKind(learned)) {
    const opens = opensFrom(learned).map(a => ADVANCES[a].name);
    view.notice(`Tutkittu: ${studyName(learned).toLowerCase()} on ${RESOURCES[learned].name} · näkyy kartalla ja tuottaa${opens.length ? ` · ${opens.join(' ja ')} avautui tutkittavaksi` : ''}`);
    if (play.cities[0]) moment('unlock', play.cities[0].tile);
  } else if (learned) {
    const opens = (Object.keys(NEEDS) as Build[]).filter(b => NEEDS[b] === learned).map(b => BUILDS[b].name);
    view.notice(['Keksintö: ', advanceRef(learned), `${learned === 'mapmaking' ? ' · yksiköt kulkevat rannikkovesillä' : ''}${opens.length ? ` · ${opens.join(', ')} avautui` : ''}`]);
    if (play.cities[0]) moment('unlock', play.cities[0].tile);
    gained(learned);
  }
  // With nothing chosen the people study a kind found and not known (STORY-072, own); not
  // while an advance's card waits, as its player chooses (STORY-118)
  if (play.research.target === null && !play.learned.length) {
    const kind = play.research.available(foundKinds).find(isKind);
    if (kind && dispatch({ kind: 'study', target: kind }, 'people')) {
      view.notice(['Kansa tutkii: ', resourceRef(kind, knownKind(kind), true)]);
    }
  }
  // A suggested site waiting for a settler gets the first free one
  const free = idleSettler();
  if (free && play.pendingSite !== null) {
    sendSettler(free, play.pendingSite);
    play.pendingSite = null;
    view.notice([unitRef(free.id, free.name), ' lähti kaupunkipaikalle']);
  } else if (play.pendingSite !== null && !free && spareSettlers() === 0) {
    // The waiting site keeps a settler coming (STORY-060): a soldier against bandits, an
    // advisor or the player may have changed the build, and the site would wait for ever.
    // A city that cannot give a citizen builds it for ever, too (STORY-113). A settler built
    // for it waits while another walks to its site, and none more is ordered (Utu's review:
    // else a settler more was ordered every day it walked)
    const builder = settlerBuilder(play.pendingSite);
    if (builder && !play.cities.some(c => c.build === 'settler' && (c === builder || canGiveCitizen(c)))) builder.build = 'settler';
  }
  // The best known sites come daily too, not only with freshly mapped land
  noteSiteOffer([]);
}

// ─── City sites and labels (STORY-032) ────────────
// A scout that maps a good site (sites.ts) suggests building a city there; the card stops
// the game like a discovery. Cities have their names on the map.

/** Scout nearest to a tile: the one that found it. */
function finderOf(tile: number): number {
  const at = tileCenter(tile);
  let finder = 0, best = Infinity;
  for (const u of play!.units.units) {
    const a = u.kind === 'scout' ? tileCenter(u.tile).angleTo(at) : Infinity;
    if (a < best) { best = a; finder = u.id; }
  }
  return finder;
}

/** A settler free to go: the active one, unless it is already on its way to found a city; with none, one improving land. */
export function idleSettler(): Unit | null {
  if (!play) return null;
  const active = play.units.settler;
  if (active) return play.units.founding ? null : active;
  return play.units.units.find(u => u.kind === 'settler') ?? null;
}

/** Send a free settler to found a city on a site; it stops improving land. */
function sendSettler(settler: Unit, tile: number) {
  play!.units.setTask(settler, 'found', world);
  play!.units.setSite(tile, world);
  play!.units.found(world);
}

function noteSiteOffer(fresh: number[]) {
  if (!play || !siteOffersOn || cityStage() || play.offers.length || clock.day - play.lastOfferDay < OFFER_EVERY_DAYS) return;
  // Only when the city could be built: a free settler, or a city to build one (one waiting site at a time)
  if (play.pendingSite !== null || (!idleSettler() && !play.cities.length)) return;
  const site = play.units.settler ? play.units.currentSite() : null;
  const taken = [...play.cities.map(c => c.tile), ...play.offered, ...(site !== null ? [site] : []), ...(play.pendingSite !== null ? [play.pendingSite] : [])];
  const isLand = (id: number) => Number.isFinite(world.cost(id));
  // Good sites come from freshly mapped land; after a quiet while, or in the conquest, the best known one.
  // The province advisors aim at the province level's goal too: the nearest province not held (STORY-111)
  const quiet = play.cities.length > 0 && clock.day - play.lastOfferDay >= QUIET_DAYS;
  const aiming = play.progress.meter === 'conquest' || (play.progress.meter === 'state' && play.provinceAdvisor !== 'none');
  const tile = fresh.find(id => play!.units.isOpen(id, world) && goodSite(id, world.siteScore, isLand, taken) && !nearForeign(id))
    ?? (aiming ? provinceSite(taken) ?? (quiet ? nearbySite(taken) : undefined) : quiet ? nearbySite(taken) : undefined);
  if (tile === undefined) return;
  play.offered.push(tile);
  play.lastOfferDay = clock.day;
  // The first site stops the game with its card (STORY-017). Later ones a governor takes itself,
  // and the player's own hand gets the card each time: a notice alone left the site unfound and the
  // settler waiting, eating its city's food (PLAYTEST-002). The Asuttaja takes each through its card
  if (!firstTime('site') && play.provinceAdvisor !== 'settle' && play.cityAdvisor !== 'none') {
    moment('find', tile);
    const name = nameOf(2, regions.tileTable()[tile]).name;
    if (dispatch({ kind: 'settle', tile }, 'city')) advise(`uusi kaupunkipaikka: ${name}`);
    return;
  }
  play.offers.push({ tile, finder: finderOf(tile) });
}

/** Whether this kind of event stops the game now: the first time only in a new game, always in the old start (STORY-017). */
function firstTime(kind: FirstKind): boolean {
  if (classic) return true;
  if (play!.firsts.has(kind)) return false;
  play!.firsts.add(kind);
  return true;
}

/**
 * During the conquest: the best mapped site of the nearest home-state province without a city
 * (STORY-060). Good sites come from freshly mapped land only, and a province mapped before, or
 * one without land in the top quarter, would otherwise never get a city.
 */
function provinceSite(taken: readonly number[]): number | undefined {
  const p = play!;
  const won = conquestNow();
  const from = tileCenter(p.cities[0]?.tile ?? p.units.camp);
  const provinces = Array.from({ length: 7 }, (_, k) => homeState() * 7 + k)
    .filter(pr => !won.held.has(pr))
    .sort((a, b) => from.angleTo(regions.centers[1][a]) - from.angleTo(regions.centers[1][b]));
  const near = new Set(taken.flatMap(t => tilesInRings(t, SITE_SPACING - 1)));
  for (const pr of provinces) {
    let best: number | undefined, top = -Infinity;
    for (let a = pr * 7; a < pr * 7 + 7; a++) {
      if (!tilesOfArea.has(a)) tilesOfArea.set(a, cityTiles(regions, a));
      for (const t of tilesOfArea.get(a)!) {
        if (!mapState.isMapped(t) || !Number.isFinite(world.cost(t)) || near.has(t) || nearForeign(t)) continue;
        const s = world.siteScore(t);
        if (s > top) { top = s; best = t; }
      }
    }
    if (best !== undefined) return best;
  }
  return undefined;
}

/**
 * The best mapped site within twelve rings of the capital, of the median score at least
 * (STORY-060: the scouts may map far and poor land for a long while, and the cities stopped).
 */
function nearbySite(taken: readonly number[]): number | undefined {
  const p = play!;
  const near = new Set(taken.flatMap(t => tilesInRings(t, SITE_SPACING - 1)));
  let best: number | undefined, top = FAIR_SITE - 1;
  for (const t of tilesInRings(p.cities[0].tile, 12)) {
    if (!mapState.isMapped(t) || !Number.isFinite(world.cost(t)) || near.has(t) || !p.units.isOpen(t, world) || nearForeign(t)) continue;
    const s = world.siteScore(t);
    if (s > top) { top = s; best = t; }
  }
  return best;
}

/** The answer to the site the game stopped for (the site command): settle it, or keep it for later. */
function answerSite(accept: boolean): boolean {
  if (!play) return false;
  const o = play.offers.shift();
  if (!o) return false;
  if (accept) settleAt(o.tile);
  return true;
}

/** A city on a site: a free settler goes there, or the capital builds one for it (the settle command). */
function settleAt(tile: number): boolean {
  if (!play) return false;
  const settler = idleSettler();
  if (settler) {
    sendSettler(settler, tile);
    view.notice([unitRef(settler.id, settler.name), ' lähti perustamaan kaupunkia']);
    return true;
  }
  // A settler waiting while another walks to its site comes here next (STORY-113); with none
  // waiting, one is built, as the site card promises
  if (spareSettlers() > 0) {
    play.pendingSite = tile;
    view.notice('Kaupunkipaikka odottaa: uudisasukas lähtee sinne, kun edellinen on perillä');
    return true;
  }
  const builder = settlerBuilder(tile);
  if (!builder) return false;
  builder.build = 'settler';
  play.pendingSite = tile;
  view.notice([cityRef(builder.tile, builder.name), ' rakentaa uudisasukkaan kaupunkipaikalle']);
  return true;
}

/** Settlers not on their way to a site: each takes a waiting site once the one walking is there (STORY-113). */
const spareSettlers = () => play!.units.units.filter(u => u.kind === 'settler').length - (play!.units.founding ? 1 : 0);

/** A settler takes a citizen (Freeciv civ1 pop_cost 1), so a city of size 1 waits to grow before it is built. */
const canGiveCitizen = (c: City) => c.size > BUILDS.settler.pop;

/**
 * The city that builds the settler of a waiting site (STORY-113, own rule): the capital, as
 * before, when it can give a citizen; else the city nearest the site that can; else the capital,
 * to grow first. Under a production focus the capital may stay at size 1 for good.
 */
function settlerBuilder(site: number): City | null {
  const cities = play!.cities;
  if (!cities.length || canGiveCitizen(cities[0])) return cities[0] ?? null;
  const at = tileCenter(site);
  const able = cities.filter(canGiveCitizen);
  return able.length ? able.reduce((a, b) => (tileCenter(b.tile).angleTo(at) < tileCenter(a.tile).angleTo(at) ? b : a)) : cities[0];
}

/** The selected settler sets out for its marked site (the found command). */
function foundSite(tile: number): boolean {
  if (!play || !play.units.settler || play.units.currentSite() !== tile) return false;
  play.units.found(world);
  return true;
}

/** The realm aims at a province of an open state (STORY-111). */
function targetAt(province: number): boolean {
  if (!play || province < 0 || province >= regions.centers[1].length || !conquestNow().open.has(Math.floor(province / 7))) return false;
  play.targetProvince = province;
  return true;
}

/** Every act of the player and the advisors goes through here and into the log (STORY-086, rule 7). */
/** What the commands act on (STORY-086). */
const commandWorld = (): CommandWorld => ({
  cities: play!.cities, research: play!.research, kindsFound: foundKinds, ground, settle: settleAt, found: foundSite, advise: setAdvisor, buy: buyAt, target: targetAt, answerSite, answerRaid, answerTreaty, answerLearned,
  setMode: modeOf, setTask: taskOf, help: helpAt, pickSite, skipSite, sendTo: tile => play!.units.sendTo(tile, world), setTax, setLux, revolution: startRevolution, setPlan, setLine, aim: aimAt, pact: pactWith, trade: tradeWith,
});
export function dispatch(cmd: Command, by: Actor): boolean {
  if (!play) return false;
  // The player acts at a day's edge, as when a day took one frame (STORY-117)
  if (by === 'player') finishDay();
  const done = execute(cmd, commandWorld());
  if (done) play.commands.record(tickDay ?? clock.day, by, cmd);
  // The player's own build in a city ends a building put first there (STORY-118, Utu's review)
  if (done && by === 'player' && cmd.kind === 'build') {
    const c = play.cities.find(x => x.tile === cmd.city);
    if (c && c.first !== cmd.build) delete c.first;
  }
  return done;
}

// ─── The player's acts (STORY-112) ────────────────
// What the HUD, the cards and the panels do, each as a command: the same rules as the buttons
// had in the view (main.ts), and false where nothing changes, so that it stays out of the log.

const unitById = (id: number) => play!.units.units.find(u => u.id === id);

function modeOf(unit: number, mode: Mode): boolean {
  const u = unitById(unit);
  if (!u) return false;
  play!.units.setMode(u, mode);
  return true;
}

/** Only a settler founds cities or improves land; a worker keeps to its roads (STORY-093). */
function taskOf(unit: number, task: SettlerTask): boolean {
  const u = unitById(unit);
  if (!u || u.kind !== 'settler') return false;
  play!.units.setTask(u, task, world);
  return true;
}

const pickSite = (tile: number) => play!.units.setSite(tile, world);

// ─── Caravans (STORY-121) ─────────────────────────
// Freeciv civ1 units.ruleset Caravan (commit 04852fb): 50 shields, no citizen, uk_shield 0,
// defense 1, NonMil and HelpWonder. A caravan takes its shields to a city of the player's
// that builds a wonder: on arrival the wonder gets them, up to its cost (own: Freeciv keeps the
// shields over it), and the caravan is gone. One that arrives where no wonder is built waits
// there (own) until one is begun or it is sent elsewhere. Trade routes are not in the game.

/** Shields a caravan brings: its build cost (Freeciv unit_shield_value). */
export const CARAVAN_SHIELDS = BUILDS.caravan.cost;

/** A city of the player's building a wonder still short of shields. */
const wonderShort = (c: City) => isWonder(c.build) && c.shields < BUILDS[c.build].cost;

/** The cities a caravan could take its shields to, the nearest first. */
export function wonderCities(u: Unit): City[] {
  const at = tileCenter(u.tile);
  return play!.cities.filter(wonderShort).sort((a, b) => at.angleTo(tileCenter(a.tile)) - at.angleTo(tileCenter(b.tile)));
}

/**
 * A caravan free to be sent: none sent yet, or its city gave up its wonder or finished it while
 * it walked or waited (review by Utu: it waits there, but may be sent to another wonder).
 */
export function caravanFree(u: Unit): boolean {
  if (u.kind !== 'caravan') return false;
  if (u.to === undefined) return true;
  const c = play!.cities.find(x => x.tile === u.to);
  return !c || !wonderShort(c);
}

function helpAt(unit: number, city: number): boolean {
  const u = unitById(unit);
  const c = play!.cities.find(x => x.tile === city);
  if (!u || u.kind !== 'caravan' || !c || !wonderShort(c) || u.to === city) return false;
  const path = u.tile === city ? [] : findPath(u.tile, city, id => travel(world, id));
  if (!path) return false;
  u.to = city;
  u.path = path;
  return true;
}

/**
 * The state's advisor's caravans (own, STORY-121): while the capital builds a wonder, the other
 * cities that have nothing better to build than gold build caravans for it, no more than it
 * still needs, and a city whose caravan is no longer needed goes back to gold.
 */
function caravanBuild(c: City, available: Build[], wanted: Build | null): Build | null {
  const p = play!;
  const capital = p.cities[0];
  if (p.stateAdvisor === 'none' || !capital || c === capital || !available.includes('caravan')) return null;
  const now = wanted ?? c.build;
  if (now !== 'coinage' && now !== 'caravan') return null;
  // The shields still short, less what is on its way, waiting or being built elsewhere
  const coming = p.units.units.filter(u => u.kind === 'caravan' && (u.to === capital.tile || caravanFree(u))).length
    + p.cities.filter(x => x !== c && x.build === 'caravan').length;
  const needed = wonderShort(capital) && BUILDS[capital.build].cost - capital.shields - CARAVAN_SHIELDS * coming > 0;
  return needed ? 'caravan' : c.build === 'caravan' ? 'coinage' : null;
}

/** The caravans at their cities give their shields (after the units' day). */
function caravansDay() {
  const p = play!;
  for (const u of p.units.units.filter(x => x.kind === 'caravan' && x.to !== undefined)) {
    const c = p.cities.find(x => x.tile === u.to);
    if (!c) { delete u.to; continue; }
    if (u.tile !== u.to) {
      // A way shut on the road: walked anew, or the caravan stops where it is
      if (!u.path.length) {
        const path = findPath(u.tile, c.tile, id => travel(world, id));
        if (path) u.path = path;
        else delete u.to;
      }
      continue;
    }
    if (!wonderShort(c)) continue;
    const before = c.shields;
    c.shields = Math.min(BUILDS[c.build].cost, c.shields + CARAVAN_SHIELDS);
    p.units.disband(u, world);
    view.notice([unitRef(u.id, u.name), ` toi ${c.shields - before} tuotantoa ihmeeseen `, buildRef(c.build), ' · ', cityRef(c.tile, c.name)]);
    moment('unlock', c.tile);
  }
}

function skipSite(): boolean {
  play!.units.nextSite();
  return true;
}

// The same rate again changes nothing, and stays out of the log (Utu's review)
function setTax(tax: TaxRate): boolean {
  if (play!.tax === tax) return false;
  play!.tax = tax;
  return true;
}

function setLux(lux: LuxRate): boolean {
  if (play!.lux === lux) return false;
  play!.lux = lux;
  return true;
}

function setPlan(area: number, plan: AreaPlan): boolean {
  if (area < 0 || area >= regions.centers[2].length) return false;
  play!.units.setAreaPlan(area, plan, world);
  return true;
}

function setLine(line: StateLine): boolean {
  play!.units.setStateLine(line, world);
  return true;
}

/** The planet level's target: an open state not yet conquered (STORY-057). */
function aimAt(state: number): boolean {
  const won = conquestNow();
  if (play!.targetState === state || !won.open.has(state) || won.conquered.has(state)) return false;
  setTargetState(state, null);
  return true;
}

/** What the player does with a rival met (STORY-076): declare war, break the alliance, or propose one or peace. */
function pactWith(k: number, act: PactAct): boolean {
  const p = play!;
  const r = p.rivals[k];
  const t = p.ties[k];
  if (!r || !t?.met) return false;
  if (act === 'war' && t.state === 'peace') {
    setState(t, 'war', clock.day, true);
    view.notice(`Julistitte sodan: ${r.name}`);
    return true;
  }
  if (act === 'break' && t.state === 'alliance') {
    setState(t, 'peace', clock.day, true);
    view.notice(`Liitto purettu: ${r.name}`);
    return true;
  }
  if ((act === 'alliance' && t.state === 'peace') || (act === 'peace' && t.state === 'war')) {
    if (accepts(t, clock.day, act)) {
      setState(t, act, clock.day);
      view.notice(`${r.name} hyväksyi ${act === 'alliance' ? 'liiton' : 'rauhan'}`);
      return true;
    }
    // Refused: nothing changes, so nothing goes into the log
    view.notice(`${r.name} kieltäytyi · asenne ${attitudeWord(t.attitude)}`);
  }
  return false;
}

// ─── Trades (STORY-078) ────────────────────────────
// Sami 2026-10-20: maps, advances and kinds of resource are traded, and the rival weighs a
// trade by its worth and its attitude (trade.ts). Maps once in MAPS_EVERY days each way.

export interface TradeOption { id: string; item: TradeItem; name: string }

/** What the player may give a rival and get from it now, each with its id and name. */
export function tradeItems(k: number): { give: TradeOption[]; get: TradeOption[] } {
  const p = play!;
  const r = p.rivals[k];
  const maps = clock.day - p.ties[k].maps >= MAPS_EVERY;
  const option = (item: TradeItem, name: string): TradeOption => ({ id: tradeId(item), item, name });
  const nothing = option({ kind: 'nothing' }, 'Ei mitään');
  const advances = (from: Research, to: Research) => [...from.known].filter(a => !to.known.has(a)).map(a => option({ kind: 'advance', id: a }, `Keksintö: ${ADVANCES[a].name}`));
  return {
    give: [
      nothing,
      ...(maps ? [option({ kind: 'maps' }, 'Kartat')] : []),
      ...advances(p.research, r.research),
      ...TRADE_GOLD.filter(n => n <= p.gold).map(n => option({ kind: 'gold', amount: n }, `${n} kultaa`)),
    ],
    get: [
      nothing,
      ...(maps ? [option({ kind: 'maps' }, `Kartat: ${r.name}n kaupunkien ympäristö`)] : []),
      ...advances(r.research, p.research),
      // The rivals know every kind; one the player does not know yet keeps its unknown name
      ...RESOURCE_KINDS.filter(kd => !p.research.kinds.has(kd) && r.research.kinds.has(kd)).map(kd => option({ kind: 'resource', id: kd }, `Resurssilaji: ${studyName(kd)}`)),
    ],
  };
}

/** A trade weighed (the first item, nothing, for an id not offered now): what the rival gets and gives, as worth to each, and whether it accepts. */
export function weighTrade(k: number, giveId: string, getId: string) {
  const p = play!;
  const r = p.rivals[k];
  const t = p.ties[k];
  const items = tradeItems(k);
  const give = items.give.find(x => x.id === giveId) ?? items.give[0];
  const get = items.get.find(x => x.id === getId) ?? items.get[0];
  const got = worth(give.item, r.research.known.size);
  const given = worth(get.item, p.research.known.size);
  return { items, give, get, got, given, ok: acceptsTrade(t.attitude, t.state, got, given), f: factor(t.attitude, t.state) };
}

/** The player offers a trade: accepted, both sides get their part and the attitude rises. */
function tradeWith(k: number, giveId: string, getId: string): boolean {
  const p = play!;
  const r = p.rivals[k];
  const t = p.ties[k];
  if (!r || !t?.met) return false;
  const w = weighTrade(k, giveId, getId);
  // Only what the card offers now
  if (w.give.id !== giveId || w.get.id !== getId) return false;
  if (!w.ok) {
    view.notice(`${r.name} kieltäytyi vaihdosta`);
    return false;
  }
  const take = (item: TradeItem, toPlayer: boolean) => {
    if (item.kind === 'maps') {
      t.maps = clock.day;
      if (toPlayer) for (const c of r.cities) reveal(tilesInRings(c.tile, 3));
    } else if (item.kind === 'advance') {
      if (toPlayer) {
        p.research.known.add(item.id);
        if (p.research.target === item.id) p.research.target = null;
        gained(item.id);
      } else r.research.known.add(item.id);
    } else if (item.kind === 'resource' && toPlayer) {
      p.research.kinds.add(item.id);
      if (p.research.target === item.id) p.research.target = null;
    } else if (item.kind === 'gold' && !toPlayer) p.gold -= item.amount;
  };
  take(w.give.item, false);
  take(w.get.item, true);
  t.attitude = Math.min(100, t.attitude + TRADE_ATTITUDE);
  view.notice(`Vaihto: ${r.name} · annoit ${w.give.name.toLowerCase()}, sait ${w.get.name.toLowerCase()}`);
  return true;
}

/** Buy what the city on the tile builds, out of the treasury (STORY-038; a command, STORY-098). */
function buyAt(tile: number): boolean {
  const p = play!;
  const c = p.cities.find(x => x.tile === tile);
  const price = c ? buy(c, p.gold) : null;
  if (price === null) return false;
  p.gold -= price;
  return true;
}

// ─── City-states (STORY-063) ──────────────────────
// The states next to the player's (home and conquered) hold 2 to 4 native cities each, from
// the seed (cityStates.ts; Sami: only in the neighbouring states). A state's are found once,
// its land scored a few milliseconds a frame; they show once mapped.
export const nativesOf = new Map<number, NativeCity[]>();
export const natives: NativeCity[] = [];
const nativeCenters: THREE.Vector3[] = [];
export const TILE_ANGLE = Math.acos(1 / Math.sqrt(5)) / 330;
/** Relief noise of the city level at a point of the unit sphere, about −1 to 1. */
export const cityDetail = (p: THREE.Vector3) => heightRange(p, 9, 11) / (0.5 ** 10 + 0.5 ** 11);
/** The city level's ground, for where buildings stand and do best (STORY-071). */
export const ground: Ground = {
  terrainOf: t => terrainOf(t),
  heightOf: t => groundHeight(terrainOf(t), cityDetail(tileCenter(t))),
  // A known kind of resource on the tile, for the resource buildings (STORY-073)
  resourceOf: t => {
    terrainOf(t);
    const k = kindAt(t);
    return k && knownKind(k) ? k : null;
  },
};

// ─── Rival civilizations (STORY-068) ──────────────
// Two or three rivals start two states from home (rivals.ts): their capitals come from the
// scan of their start states, and their cities grow and spread by the player's rules.
export let rivalStartStates: number[] = [];
/** Start states scanned for a capital this session, found or not. */
const rivalScanned = new Set<number>();

/** Where a rival may found a city: land outside the player's states, clear of every city and city-state. */
function siteContext() {
  const p = play!;
  return {
    realm: new Set([homeState(), ...conquestNow().conquered]),
    cities: [...p.cities, ...p.rivals.flatMap(r => r.cities)].map(c => tileCenter(c.tile)),
  };
}
function freeForRival(tile: number, ctx: ReturnType<typeof siteContext>): boolean {
  if (!Number.isFinite(world.cost(tile)) || ctx.realm.has(Math.floor(world.cityOf(tile) / 49)) || nearNative(tile)) return false;
  const at = tileCenter(tile);
  return !ctx.cities.some(c => c.angleTo(at) < (SITE_SPACING - 0.5) * TILE_ANGLE);
}

const rivalWorld: RivalWorld = {
  // The rivals' tiles give what their terrain gives; the player's improvements are the player's
  yieldOf: (id, centre) => terrainYield(id, centre),
  cost: id => world.cost(id),
  free: tile => freeForRival(tile, siteContext()),
  // The best fair site within ten rings
  site: from => {
    const ctx = siteContext();
    let best: number | null = null;
    let top = FAIR_SITE - 1;
    for (const t of tilesInRings(from, 10)) {
      if (!freeForRival(t, ctx)) continue;
      const s = world.siteScore(t);
      if (s > top) { top = s; best = t; }
    }
    return best;
  },
  path: (from, to) => findPath(from, to, id => world.cost(id)),
};

/** A day of the rivals: their cities work the tiles the player's leave. */
export function rivalsDay() {
  const p = play!;
  if (!p.rivals.some(r => r.cities.length)) return;
  const taken = new Set(workedByCity().flat());
  for (const r of p.rivals) {
    for (const e of r.day(rivalWorld, taken)) {
      if (e.kind === 'founded' && mapState.isMapped(e.city.tile) && stateStage()) view.notice(`${r.name} perusti kaupungin ${e.city.name}`);
    }
  }
}

/** The rivals' cities on mapped tiles; they come into play at the state level (STORY-094). */
export const visibleRivalCities = () => (stateStage() ? play!.rivals.flatMap(r => r.cities.filter(c => mapState.isMapped(c.tile)).map(city => ({ rival: r, city }))) : []);
export const rivalCityAt = (tile: number) => play!.rivals.flatMap(r => r.cities.map(city => ({ rival: r, city }))).find(x => x.city.tile === tile) ?? null;

// ─── Nomad tribes (STORY-066) ─────────────────────
// A tribe in each state next to the player's (nomads.ts): its camp moves over the state's land,
// from day 120 it raids the nearest city within reach, and the Kenraali can scatter it.
const tribeLand = new Map<number, number[]>();

export interface TribeNow { tribe: Tribe; camp: number }
/** The tribes not scattered, with today's camps; none on a city of the player's. */
export function tribesNow(): TribeNow[] {
  if (!game || !play) return [];
  const out: TribeNow[] = [];
  for (const [state, land] of tribeLand) {
    if (play.war.routed.has(state)) continue;
    const tribe = tribeOf(game.seed, state);
    const camp = tribeCamp(game.seed, tribe, clock.day, land);
    if (camp !== null && !play.cities.some(c => c.tile === camp)) out.push({ tribe, camp });
  }
  return out;
}
/** Tribes on mapped tiles; they come into play at the state level (STORY-094). */
export const visibleTribes = () => (stateStage() ? tribesNow().filter(t => mapState.isMapped(t.camp)) : []);
export const tribeAt = (tile: number) => tribesNow().find(t => t.camp === tile) ?? null;

/** The tribe's band sets off at the nearest city of the player's, within reach unless `anywhere`. */
export function sendTribe(t: TribeNow, anywhere = false): boolean {
  const p = play!;
  const at = tileCenter(t.camp);
  const city = p.cities.reduce<City | null>((best, c) => (!best || tileCenter(c.tile).angleTo(at) < tileCenter(best.tile).angleTo(at) ? c : best), null);
  if (!city || (!anywhere && tileCenter(city.tile).angleTo(at) > TRIBE_REACH * TILE_ANGLE)) return false;
  const band = tribeBand(game!.seed, t.tribe, clock.day);
  if (!p.raids.start(city.tile, t.camp, band.size, id => world.cost(id), { attack: band.attack, tribe: t.tribe.name })) return false;
  // The first attack stops the game with its card, later ones are notices (STORY-017); the Vartija answers each
  p.raidAlert = p.cityAdvisor === 'defend' || firstTime('tribe');
  if (!p.raidAlert) {
    moment('raid', t.camp);
    view.notice(`${t.tribe.name} hyökkää: ${band.size} ratsastajaa kohti kaupunkia ${city.name}`);
  }
  return true;
}

/** Land tiles of a state given the full site score: the best by the yield of a tile and its neighbours. */
const NATIVE_CANDIDATES = 300;
/**
 * Finish the scans due now, at once: the frames do them a few milliseconds at a time, but a day
 * waits for them, so the frames do not change the game (STORY-095). The longest, for measuring.
 */
export let nativeSyncMs = 0;
export function finishScans() {
  if (!play || !(nativeScan || nextNativeState() !== null)) return;
  const t0 = performance.now();
  while (nativeScan || nextNativeState() !== null) scanNatives(Infinity);
  nativeSyncMs = Math.max(nativeSyncMs, performance.now() - t0);
}
/** The scan's slice in a part of a day worked out over frames (own, STORY-117). */
const SCAN_PART_MS = 2;
/** The state whose land is being scored: its tiles, how far, and the scores so far. */
let nativeScan: { state: number; tiles: number[]; at: number; rough: { tile: number; score: number }[] } | null = null;
export let nativeMs = 0;
/** Score the land of the next state wanted for a while; when it is done, its city-states are found. */
export function scanNatives(budgetMs: number) {
  if (!game || !play) return;
  const t0 = performance.now();
  if (!nativeScan) {
    const state = nextNativeState();
    if (state === null) return;
    const table = regions.tileTable();
    const tiles: number[] = [];
    for (let t = 0; t < table.length; t++) if (table[t] >= state * 49 && table[t] < state * 49 + 49) tiles.push(t);
    nativeScan = { state, tiles, at: 0, rough: [] };
  }
  const scan = nativeScan;
  while (scan.at < scan.tiles.length && performance.now() - t0 < budgetMs) {
    const t = scan.tiles[scan.at++];
    if (Number.isFinite(world.cost(t))) scan.rough.push({ tile: t, score: neighbors(t).reduce((sum, n) => sum + siteValue(n), siteValue(t)) });
  }
  if (scan.at === scan.tiles.length) {
    nativeScan = null;
    const rough = scan.rough.sort((a, b) => b.score - a.score || a.tile - b.tile);
    const land = rough.slice(0, NATIVE_CANDIDATES).map(l => ({ tile: l.tile, score: world.siteScore(l.tile) }));
    const rival = rivalStartStates.indexOf(scan.state);
    if (rival >= 0) {
      // A rival's capital on the best site of its start state (STORY-068), not next to a city:
      // founded before the day that follows the scan, it is saved from then on
      rivalScanned.add(scan.state);
      const ours = [...play.cities.filter(c => !c.native), ...play.rivals.flatMap(r => r.cities)].map(c => tileCenter(c.tile));
      const best = land.filter(l => l.score > 0 && !ours.some(c => c.angleTo(tileCenter(l.tile)) < NATIVE_CLEARANCE * TILE_ANGLE)).sort((a, b) => b.score - a.score || a.tile - b.tile)[0];
      if (best && !play.rivals[rival].cities.length) play.rivals[rival].found(best.tile);
      if (budgetMs < Infinity) nativeMs = Math.max(nativeMs, performance.now() - t0);
      return;
    }
    const near = (a: number, b: number) => tileCenter(a).angleTo(tileCenter(b)) < NATIVE_SPACING * TILE_ANGLE;
    const found = nativeCities(game.seed, scan.state, land, near);
    nativesOf.set(scan.state, found);
    tribeLand.set(scan.state, scan.rough.map(l => l.tile).filter(t => !found.some(n => n.tile === t)).sort((a, b) => a - b));
    natives.push(...found);
    nativeCenters.push(...found.map(n => tileCenter(n.tile)));
    shadowNatives();
  }
  if (budgetMs < Infinity) nativeMs = Math.max(nativeMs, performance.now() - t0);
}

/**
 * The next state to scan: next to home or a conquered state for its city-states and tribe (not
 * home nor a rival's start), then a rival's start state for its capital (STORY-068).
 */
function nextNativeState(): number | null {
  for (const s of [homeState(), ...conquestNow().conquered]) {
    for (const t of regions.neighbors[s]) if (t !== homeState() && !rivalStartStates.includes(t) && !nativesOf.has(t)) return t;
  }
  const k = play!.rivals.findIndex((r, i) => !r.cities.length && !rivalScanned.has(rivalStartStates[i]));
  return k >= 0 ? rivalStartStates[k] : null;
}

/** City-states found so far, not taken, on mapped tiles; they come into play at the state level (STORY-094). */
export function visibleNatives(): NativeCity[] {
  if (!stateStage()) return [];
  return natives.filter(n => mapState.isMapped(n.tile) && !nativeGone(n));
}

/**
 * City-states with a city next to their site (STORY-095). The scan gives a state's city-states
 * from the seed alone, whenever it runs; a city that stood there before them hides them, as no
 * city may be founded next to one after. Worked out when a scan ends and at each day's start.
 */
const shadowed = new Set<number>();
export function shadowNatives() {
  shadowed.clear();
  if (!play || !natives.length) return;
  const ours = [...play.cities.filter(c => !c.native), ...play.rivals.flatMap(r => r.cities)].map(c => tileCenter(c.tile));
  natives.forEach((n, i) => { if (ours.some(c => c.angleTo(nativeCenters[i]) < NATIVE_CLEARANCE * TILE_ANGLE)) shadowed.add(n.tile); });
}

/** A city-state taken by the player or destroyed (STORY-064), or hidden by a city that stood there first. */
export const nativeGone = (n: NativeCity) => shadowed.has(n.tile) || play!.war.razed.has(n.tile) || play!.cities.some(c => c.tile === n.tile);
export const nativeAt = (tile: number) => natives.find(n => n.tile === tile && !nativeGone(n)) ?? null;
/** Near a rival's city (STORY-068): within the rings kept between cities. */
const nearRival = (tile: number) => {
  if (!play?.rivals.some(r => r.cities.length)) return false;
  const at = tileCenter(tile);
  return play.rivals.some(r => r.cities.some(c => tileCenter(c.tile).angleTo(at) < (SITE_SPACING - 0.5) * TILE_ANGLE));
};
/** No city of the player's may be founded here: next to a city-state or a rival's city. */
export const nearForeign = (tile: number) => nearNative(tile) || nearRival(tile);
/** Near a city-state: no city may be founded there. */
const nearNative = (tile: number) => {
  if (!natives.length) return false;
  const at = tileCenter(tile);
  return natives.some((n, i) => nativeCenters[i].angleTo(at) < NATIVE_CLEARANCE * TILE_ANGLE && !nativeGone(n));
};

/** A resource building's reward once it is done (STORY-073): an advance, gold if it is known, or a unit of no city. */
function rewardOf(c: City, b: ResourceBuilding) {
  const p = play!;
  const r = RESOURCE_BUILDINGS[b].reward;
  if (r === null) return;
  if (r === 'scout' || r === 'settler' || r === 'horseman') {
    p.units.spawn(r, c.tile, world, null);
    view.notice(`${BUILDS[b].name}: ${BUILDS[r].name.toLowerCase()} liittyi joukkoon`);
  } else if (p.research.known.has(r)) {
    p.gold += KNOWN_REWARD_GOLD;
    view.notice(`${BUILDS[b].name}: ${ADVANCES[r].name} on jo tiedossa · +${KNOWN_REWARD_GOLD} kultaa`);
  } else {
    p.research.known.add(r);
    if (p.research.target === r) p.research.target = null;
    view.notice(`${BUILDS[b].name}: keksintö ${ADVANCES[r].name}`);
    gained(r);
  }
}

// ─── An advance's card (STORY-118) ────────────────
// Sami 2026-11-23: an advance gained stops the game on a card that tells its effects, until
// the next study is chosen; the state's advisor's choice waits ready on it. A building it
// opened can be put first in every city or in the capital (own rules).

/** An advance gained by research, ruins, trade or a resource building: its card waits. */
function gained(a: Advance) {
  if (advanceCardsOn && !play!.learned.includes(a)) play!.learned.push(a);
  if (a === 'philosophy') philosophersStone();
}

/**
 * Philosophy (STORY-121, own rule, Sami 2026-11-24; in Freeciv civ1 it opens only what needs
 * it): the first to learn it, while no rival knows it, gets an advance more, however it came
 * (research, ruins, trade or a reward, all through gained). The advance is the study under way,
 * else the state's advisor's next one, else the first open. It is once a game without a flag:
 * Philosophy is learned only once, and a rival that knew it first took the gift.
 */
function philosophersStone() {
  const p = play!;
  if (p.rivals.some(r => r.research.known.has('philosophy'))) return;
  const open = p.research.available().filter((s): s is Advance => !isKind(s));
  const t = p.research.target;
  const free = t !== null && !isKind(t) && open.includes(t) ? t
    : (p.stateAdvisor === 'none' ? null : nextAdvance(STATE_PLANS[p.stateAdvisor].order, open)) ?? open[0];
  if (!free) return;
  p.research.known.add(free);
  if (p.research.target === free) p.research.target = null;
  view.notice(['Filosofia, ensimmäisenä: ', advanceRef(free), ' ilmaiseksi']);
  gained(free);
}

/**
 * The Great Library (STORY-121, Freeciv civ1 effects.ruleset Tech_Parasite 2 and game.ruleset
 * tech_parasite_allow_holes FALSE; server/techtools.c do_tech_parasite_effects, commit
 * 04852fb): after the rivals' day the player gets an advance two rivals or more know and whose
 * needs the player knows, one of them at random (here from the game's seed and the day). The
 * city-states and tribes have no research. An advance from a resource waits for its kind, as
 * research does (Research.available).
 */
function greatLibraryDay(day: number) {
  const p = play!;
  if (!hasWonder('greatlibrary')) return;
  const can = p.research.available().filter((s): s is Advance => !isKind(s) && p.rivals.filter(r => r.research.known.has(s as Advance)).length >= 2);
  if (!can.length) return;
  const a = can[Math.min(can.length - 1, Math.floor(((hash(day, 121, 7, game!.seed) + 1) / 2) * can.length))];
  p.research.known.add(a);
  if (p.research.target === a) p.research.target = null;
  view.notice([`${BUILDS.greatlibrary.name}: `, advanceRef(a), ' kilpailijoilta']);
  gained(a);
}

/**
 * The study an advisor would choose: the one under way, else a kind found (cheap, it shows
 * and yields; STORY-072), else the state's advisor's next advance, else the first open. Null
 * when none is open.
 */
export function suggestedStudy(): Study | null {
  const p = play!;
  if (p.research.target !== null) return p.research.target;
  const open = p.research.available(foundKinds);
  const kind = open.find(isKind);
  if (kind) return kind;
  const advances = open.filter((s): s is Advance => !isKind(s));
  return p.stateAdvisor === 'none' ? (advances[0] ?? null) : nextAdvance(STATE_PLANS[p.stateAdvisor].order, advances);
}

/** The buildings an advance opened that a city of the player's may still build: the card's choices to put first. */
export function firstChoices(a: Advance): Building[] {
  const p = play!;
  return BUILDINGS.filter(b => NEEDS[b] === a && p.cities.some(c => startable(c).includes(b)));
}

/** Where a building can go first (Utu's review): in every city when two or more can start it and it is no wonder, in the capital when the capital can. */
export function firstScopes(b: Building): FirstScope[] {
  const p = play!;
  const capital = p.cities.find(c => c.capital) ?? p.cities[0];
  const can = p.cities.filter(c => startable(c).includes(b)).length;
  return [...(!isWonder(b) && can >= 2 ? ['all' as const] : []), ...(capital && startable(capital).includes(b) ? ['capital' as const] : [])];
}

/** The answer to the first advance card waiting: its next study and a building put first, as the learned command. */
function answerLearned(study: Study | null, first: { build: Building; scope: FirstScope } | null): boolean {
  const p = play!;
  const a = p.learned[0];
  if (!a) return false;
  const open = p.research.available(foundKinds);
  if (study !== null && study !== p.research.target && !open.includes(study)) return false;
  // Nothing open is the only way to choose no study
  if (study === null && (open.length || p.research.target !== null)) return false;
  // A wonder goes first in the capital only: in every city all would build it and one win (Utu's review)
  if (first && (!firstChoices(a).includes(first.build) || (isWonder(first.build) && first.scope === 'all'))) return false;
  const capital = p.cities.find(c => c.capital) ?? p.cities[0];
  const cities = first ? (first.scope === 'all' ? p.cities : [capital]).filter(c => c && startable(c).includes(first.build)) : [];
  // None of the cities chosen can build it: the answer changes nothing it says
  if (first && !cities.length) return false;
  p.learned.shift();
  if (study !== null) p.research.target = study;
  for (const c of cities) {
    c.first = first!.build;
    // A soldier against bandits on their way and a waiting site's settler stay; the building comes after (Utu's review)
    if (!keepsBuild(c)) c.build = first!.build;
  }
  return true;
}

/** A build an advisor or a card does not change: a soldier against bandits on their way, a waiting site's settler (STORY-108, STORY-113). */
function keepsBuild(c: City): boolean {
  const p = play!;
  return (p.raids.band?.city === c.tile && isSoldier(c.build)) || (c.build === 'settler' && p.pendingSite !== null && c === settlerBuilder(p.pendingSite));
}

// ─── Advisors (STORY-049, STORY-050, STORY-051) ───
// The advisors of the city area, province and state levels run their level each day
// (advisors.ts). The higher level goes first: the state's target, then the province's
// builds and expeditions, then the city's.

/**
 * Builds a city makes of shields: in a city of chains not its chain buildings, which go on a
 * site, and elsewhere not the three only a city of chains has (STORY-088).
 */
export const shieldless = (c: City, kind: Build) => (c.chain ? isChainBuilding(kind) : (CHAIN_ONLY as readonly Build[]).includes(kind));
/** Builds a city may start: known, not built, and no wonder another city has. */
const startable = (c: City) => (Object.keys(BUILDS) as Build[]).filter(kind =>
  !shieldless(c, kind) && !(isBuilding(kind) && c.buildings.includes(kind)) && !(isWonder(kind) && hasWonder(kind)) && (NEEDS[kind] === undefined || play!.research.known.has(NEEDS[kind]!))
  && (!isTerrainBuilding(kind) || terrainNear(c, kind)) && (!isResourceBuilding(kind) || resourceNear(c, kind)) && (!UNIT_BUILDS.has(kind) || unitsOpen()) && !(kind === 'settler' && cityStage()) && !(kind === 'worker' && !provinceStage()));
/** Units the cities build: once the city area is open; a new game's city level has none (STORY-089, Sami 2026-11-22). */
export const UNIT_BUILDS = new Set<Build>(['warrior', 'phalanx', 'settler', 'scout', 'caravan', ...ATTACKERS]);
export const unitsOpen = () => !play || play.progress.openLevel < 4;
/** A new game's first level, the city alone: the city area's systems wait for the scout (STORY-017, Sami 2026-11-20). */
const cityStage = () => !!play && !classic && play.progress.openLevel === 4;
/** The state level is open, where diplomacy, war and trade belong (STORY-017); always in the old start. */
export const stateStage = () => classic || (!!play && play.progress.openLevel <= 1);
/** The province level is open, where culture borders, roads to resources and workers belong (STORY-093). */
export const provinceStage = () => !!play && play.progress.openLevel <= 2;

// ─── The province level (STORY-093, PLAN-090) ─────
// Culture widens the cities' borders (culture.ts), a border of ten land tiles holds a province,
// and a strategic resource inside the border joined to a city by road serves its province
// (connection.ts); workers build the roads. All of it is worked out from the cities and roads.

/** Province of a tile. */
export const provinceOfTile = (t: number) => Math.floor(regions.tileTable()[t] / 7);
/** Changes when a road is built or a game starts, for the joins below. */
export let roadVersion = 0;
/** The player's border, worked out when a city's tile, size or rings change. */
export let bordersCache: { key: string; owned: Map<number, BorderSource>; tiles: number[]; held: number[] } | null = null;
export function bordersNow() {
  const p = play!;
  const key = p.cities.map(c => `${c.tile}:${c.size}:${borderRings(c.size, c.culture ?? 0)}`).join(',');
  if (bordersCache?.key !== key) {
    const owned = tileOwner(p.cities.map(c => ({ id: c.id, tile: c.tile, size: c.size, culture: c.culture ?? 0, owner: 0 })));
    const cover = provinceCover(owned, 0, provinceOfTile, t => Number.isFinite(world.cost(t)));
    bordersCache = { key, owned, tiles: [...owned.keys()], held: heldByBorder(cover) };
  }
  return bordersCache;
}
/** Strategic resources inside the border, the road network and the kinds joined in each province. */
export let joinsCache: { key: string; network: Set<number>; kinds: Map<number, Set<StrategicKind>>; waiting: StrategicTile[] } | null = null;
export function joinsNow() {
  const p = play!;
  const borders = bordersNow();
  const key = `${borders.key}|${roadVersion}|${kindMask()}|${mapState.count}`;
  if (joinsCache?.key !== key) {
    const network = roadNetwork(p.cities.map(c => c.tile), t => p.improvements.has(t, 'road'), neighbors);
    const known = (t: number) => {
      if (!mapState.isMapped(t)) return null;
      terrainOf(t);
      const k = kindAt(t);
      return k && knownKind(k) ? k : null;
    };
    const resources = strategicTiles(borders.owned.keys(), known, provinceOfTile);
    joinsCache = { key, network, kinds: connectedKinds(resources, network), waiting: unconnected(resources, network) };
  }
  return joinsCache;
}
/** Shields a city gets from the kinds joined in its province, at the province level. */
export const joinedShields = (c: City) => (provinceStage() ? connectedShields(joinsNow().kinds.get(provinceOfTile(c.tile)), c.buildings) : 0);

/** Resources no road can reach by land; tried again when the border changes (STORY-093, as STORY-088's guard). */
export const unreachable = new Set<number>();
let unreachableKey = '';
/** The strategic resource each worker's road is for, by unit id; not saved, the status falls back to Kehittää. */
export const joiningOf = new Map<number, StrategicKind>();
/** Land cost for a worker's road: a road goes over land only. */
const landCost = (id: number) => world.cost(id);

/**
 * A worker's next job (STORY-093): a road from a strategic resource waiting in its province
 * (then anywhere in the border) to the nearest tile of the road network, built from the network
 * outwards; the nearest resource first, ties by tile. With none, it improves land as a settler.
 */
function workerJob(u: Unit): Job | null {
  const p = play!;
  const joins = joinsNow();
  if (unreachableKey !== bordersNow().key) {
    unreachable.clear();
    unreachableKey = bordersNow().key;
  }
  const home = p.cities.find(c => c.id === u.home);
  const province = provinceOfTile(home ? home.tile : u.tile);
  const at = tileCenter(u.tile);
  const busy = new Set(p.units.units.flatMap(o => (o !== u && o.job ? [o.job.tile] : [])));
  const order = joins.waiting
    .filter(r => !unreachable.has(r.tile))
    .map(r => ({ r, own: r.province === province ? 0 : 1, far: tileCenter(r.tile).angleTo(at) }))
    .sort((a, b) => a.own - b.own || a.far - b.far || a.r.tile - b.r.tile);
  for (const { r } of order) {
    const joint = nearestTile(r.tile, landCost, t => joins.network.has(t));
    const path = joint === null ? null : findPath(r.tile, joint, landCost);
    if (!path) {
      unreachable.add(r.tile);
      continue;
    }
    // The tiles from the resource to the joint, the joint itself already on the network
    const line = [r.tile, ...path.slice(0, -1)];
    const todo = [...line].reverse().find(t => !p.improvements.has(t, 'road') && !busy.has(t));
    if (todo === undefined) continue;
    joiningOf.set(u.id, r.kind);
    return { tile: todo, kind: 'road', days: workDays('road', terrainOf(todo), p.research.known.has('bridges')) };
  }
  joiningOf.delete(u.id);
  return null;
}

/** Each province's city that builds its worker: one with a resource waiting and no worker yet (own). */
export function workerBuilders(): Set<number> {
  const p = play!;
  const out = new Set<number>();
  if (!provinceStage()) return out;
  const waiting = new Set(joinsNow().waiting.filter(r => !unreachable.has(r.tile)).map(r => r.province));
  const homeProvince = (u: Unit) => {
    const home = p.cities.find(c => c.id === u.home);
    return provinceOfTile(home ? home.tile : u.tile);
  };
  const served = new Set(p.units.units.filter(u => u.kind === 'worker').map(homeProvince));
  for (const c of p.cities) {
    const prov = provinceOfTile(c.tile);
    if (!waiting.has(prov) || served.has(prov)) continue;
    served.add(prov);
    out.add(c.id);
  }
  return out;
}
/** A resource building needs a known tile of its kind in the city's area (STORY-073). */
export const resourceNear = (c: City, b: ResourceBuilding) => tilesInRings(c.tile, cityRings(c.size)).some(t => ground.resourceOf!(t) === RESOURCE_BUILDINGS[b].kind);
/** A terrain building needs its terrain within the city's two rings. */
export const terrainNear = (c: City, b: TerrainBuilding) => tilesInRings(c.tile, 2).some(t => (TERRAIN_BUILDINGS[b] as readonly Terrain[]).includes(terrainOf(t)));


/** What an advisor did, newest first, four at most: coloured, its cities and units linked (STORY-103). */
export function advise(text: string | Rich, level: AdvisorLevel = 'city') {
  const log = level === 'town' ? 'townLog' : level === 'city' ? 'advisorLog' : level === 'province' ? 'provinceLog' : level === 'state' ? 'stateLog' : 'planetLog';
  play![log] = [[`Päivä ${clock.day}: `, ...(typeof text === 'string' ? [text] : text)], ...play![log]].slice(0, 4);
}

/** The best city site among the mapped land of an area (STORY-050). */
const bestSite = (area: number) => {
  if (!tilesOfArea.has(area)) tilesOfArea.set(area, cityTiles(regions, area));
  return Math.max(0, ...tilesOfArea.get(area)!.filter(t => mapState.isMapped(t) && Number.isFinite(world.cost(t))).map(world.siteScore));
};

/** Provinces the scouts could not reach by land, tried again when the holdings change (STORY-111). */
const goalUnreachable = new Set<number>();
let goalHeldKey = '';

/**
 * The province level's target while it is the top level (STORY-111, Sami 2026-11-22): the
 * nearest province of the home state not held, kept until it is held; null when the player
 * runs the province or none is left.
 */
function provinceGoal(): number | null {
  const p = play!;
  if (p.progress.openLevel !== 2 || p.provinceAdvisor === 'none') return null;
  const won = conquestNow();
  const key = [...won.held].sort((a, b) => a - b).join(',');
  if (key !== goalHeldKey) {
    goalUnreachable.clear();
    goalHeldKey = key;
  }
  const home = homeState();
  const keep = p.targetProvince >= 0 && Math.floor(p.targetProvince / 7) === home && !won.held.has(p.targetProvince) && !goalUnreachable.has(p.targetProvince);
  if (keep) return p.targetProvince;
  const from = tileCenter(p.units.camp);
  const target = provinceGoalTarget(Array.from({ length: 7 }, (_, k) => home * 7 + k).map(province => ({
    province, held: won.held.has(province), land: provinceHasLand(province), reachable: !goalUnreachable.has(province), distance: from.angleTo(regions.centers[1][province]),
  })));
  if (target === null || !dispatch({ kind: 'target', province: target }, 'province')) return null;
  advise(`tavoitelääni: ${nameOf(1, target).name}`, 'province');
  return target;
}

/** The land tile of a province nearest its centre, for the scouts to set off to (STORY-111). */
function goalLandTile(province: number): number | null {
  const centre = regions.centers[1][province];
  let best: number | null = null, near = Infinity;
  for (let k = 0; k < 7; k++) {
    const area = province * 7 + k;
    if (!tilesOfArea.has(area)) tilesOfArea.set(area, cityTiles(regions, area));
    for (const t of tilesOfArea.get(area)!) {
      if (!Number.isFinite(world.cost(t))) continue;
      const d = tileCenter(t).angleTo(centre);
      if (d < near || (d === near && t < best!)) { near = d; best = t; }
    }
  }
  return best;
}

/** Send the scouts to a province; a province they cannot reach by land is left out until the holdings change. */
function sendToProvince(province: number): boolean {
  const land = goalLandTile(province);
  const path = land === null ? null : findPath(play!.units.camp, land, id => world.cost(id));
  if (land === null || !path || !play!.units.sendTo(land, world)) {
    goalUnreachable.add(province);
    return false;
  }
  return true;
}

/**
 * The advisors' day, with a pause after each level and each city (STORY-117: on the planet
 * level's first day it took up to 47 ms in one part); nothing else runs in the pauses.
 */
function* advisorDay(): Generator<void, void, void> {
  const p = play;
  if (!p) return;
  p.units.keepHome = p.provinceAdvisor === 'defend';
  // The province level's goal (STORY-111): its advisors aim at the nearest province not held
  const goal = provinceGoal();
  p.units.keepAlso = p.provinceAdvisor === 'defend' && goal !== null ? new Set([...conquestNow().held, goal]) : new Set();
  if (p.planetAdvisor !== 'none') {
    planetAdvisorDay();
    yield;
  }
  armyHome();
  if (p.townAdvisor === 'none' && p.cityAdvisor === 'none' && p.provinceAdvisor === 'none' && p.stateAdvisor === 'none') return;
  const home = p.units.homeProvince;
  const homeAreas = Array.from({ length: 7 }, (_, k) => home * 7 + k);
  // The campaign first: a city taken today gets its yields with the others
  if (p.stateAdvisor === 'war') {
    warDay();
    yield;
  }
  const yields = cityYields();
  if (p.stateAdvisor !== 'none') {
    stateAdvisorDay(p.stateAdvisor, yields);
    yield;
  }
  // The cities that build their province's worker (STORY-093)
  const builders = workerBuilders();
  // As forEach went: the cities there at the start, by index
  const count = p.cities.length;
  for (let i = 0; i < count; i++) {
    if (!(i in p.cities)) continue;
    const c = p.cities[i];
    const soldiers = soldiersIn(c.tile).length;
    const available = startable(c);
    const luxury = cityLuxury(c, yields[i], rates().tax, rates().lux);
    const bigger = cityMood({ ...c, size: c.size + 1 }, soldiers, p.cities.length, faith(), luxury, p.gov, awayOf(c));
    // At the city stage the city level's advisor sets the way to the ready settlement (STORY-105, STORY-089)
    const town = p.progress.openLevel === 4;
    const advice = town ? townAdvice(p.townAdvisor, settlementDone(c.buildings, c.size)) : cityAdvice(p.cityAdvisor, c, {
      available, soldiers, unrestNear: !!yields[i].disorder || bigger.disorder, disorder: !!yields[i].disorder,
      threat: p.raids.band?.city === c.tile, soldier: bestSoldier(), settlers: supportOf(c).settlers,
    });
    if (advice && c.focus !== advice.focus) c.focus = advice.focus;
    const border = tilesInRings(c.tile, 3).some(t => Math.floor(world.cityOf(t) / 7) !== home);
    const ordered = provinceBuild(p.provinceAdvisor, { soldiers, border, available, soldier: bestSoldier(), walls: hasWalls(c), worker: builders.has(c.id) });
    // The state's campaign goes first (STORY-064), then a building put first from an advance's
    // card (STORY-118; not over a soldier against bandits on their way), then the province's builds
    const war = p.stateAdvisor === 'war' ? warBuild(c, available) : null;
    if (c.first && !available.includes(c.first)) delete c.first;
    const first = c.first && !keepsBuild(c) ? c.first : null;
    const caravan = caravanBuild(c, available, advice?.build ?? null);
    const build = war ?? first ?? ordered ?? caravan ?? advice?.build ?? null;
    // The settler for a waiting city site is not changed in the city that builds it (STORY-113:
    // only there, or every city that ever built one kept building them, Utu's review)
    if (build && build !== c.build && !(c.build === 'settler' && p.pendingSite !== null && c === settlerBuilder(p.pendingSite))) {
      const by = war || (caravan !== null && build === caravan) ? 'state' : ordered ? 'province' : town ? 'town' : 'city';
      if (dispatch({ kind: 'build', city: c.tile, build }, by)) advise([cityRef(c.tile, c.name), ' rakentaa: ', buildRef(build)], by);
    }
    // The city level's advisor keeps a site going in a city of chains (STORY-088, STORY-105), whatever the level
    const site = c.chain && !c.chain.site ? chainAdvice(p.townAdvisor, b => chainOpen(c.chain!, c.buildings, b) && spots(c, b, ground).length > 0) : null;
    if (site && dispatch({ kind: 'build', city: c.tile, build: site }, 'town')) advise([cityRef(c.tile, c.name), ' aloitti työmaan: ', buildRef(site)], 'town');
    // In disorder a city makes no shields: the Kasvattaja buys the calm (STORY-060), at half the treasury at most
    if (p.cityAdvisor === 'growth' && yields[i].disorder && (c.build === 'temple' || c.build === 'colosseum')) {
      const price = buyCost(c);
      if (price > 0 && price * 2 <= p.gold && dispatch({ kind: 'buy', city: c.tile }, 'city')) advise([cityRef(c.tile, c.name), ' osti: ', buildRef(c.build), ` (${price} kultaa)`]);
    }
    yield;
  }
  // The caravans waiting go to the capital's wonder (STORY-121, own)
  const capital = p.cities[0];
  if (p.stateAdvisor !== 'none' && capital && wonderShort(capital)) {
    for (const u of p.units.units.filter(caravanFree)) {
      if (dispatch({ kind: 'help', unit: u.id, city: capital.tile }, 'state')) advise([unitRef(u.id, u.name), ' kohti ihmettä: ', cityRef(capital.tile, capital.name)], 'state');
    }
  }
  if (p.provinceAdvisor === 'settle') {
    const withCity = new Set(p.cities.map(c => world.cityOf(c.tile)));
    const chosen = settleAreas(homeAreas.map(area => ({ area, hasCity: withCity.has(area), share: areaShare(area), best: bestSite(area) })));
    // The target province's best mapped area too, and the scouts go there while none is (STORY-111)
    const goalAreas = goal === null ? [] : Array.from({ length: 7 }, (_, k) => goal * 7 + k);
    const aimed = settleAreas(goalAreas.map(area => ({ area, hasCity: withCity.has(area), share: areaShare(area), best: bestSite(area) })), 1);
    for (const area of [...homeAreas, ...goalAreas]) {
      const plan = chosen.includes(area) || aimed.includes(area) ? 'settle' : 'explore';
      if ((p.units.areaPlans.get(area) ?? 'explore') === plan) continue;
      p.units.setAreaPlan(area, plan, world);
      if (plan === 'settle') advise(`${nameOf(2, area).name} asutettavaksi`, 'province');
    }
    if (goal !== null && !aimed.length && p.units.flag === null && sendToProvince(goal)) advise(`tiedustelijat kohti tavoitelääniä: ${nameOf(1, goal).name}`, 'province');
  }
  if (p.provinceAdvisor === 'explore') {
    for (const area of homeAreas) if (p.units.areaPlans.get(area) === 'skip') p.units.setAreaPlan(area, 'explore', world);
    if (p.units.flag === null) {
      // The home province first, then the target province (STORY-111), then the home state
      const areas = provinceShare(home) < UNLOCK_SHARE ? homeAreas : goal !== null && provinceShare(goal) < UNLOCK_SHARE ? Array.from({ length: 7 }, (_, k) => goal * 7 + k) : Array.from({ length: 49 }, (_, k) => Math.floor(home / 7) * 49 + k);
      const from = tileCenter(p.units.camp);
      const target = expeditionTarget(areas.map(area => ({ area, share: areaShare(area), distance: from.angleTo(regions.centers[2][area]) })), UNLOCK_SHARE);
      if (target !== null && p.units.sendTo(pointToTile(regions.centers[2][target]), world)) advise(`retkikunta kohti: ${nameOf(2, target).name}`, 'province');
    }
  }
  if (p.cityAdvisor === 'explore') {
    for (const u of p.units.units) if (u.kind === 'scout' && u.mode !== 'explore') p.units.setMode(u, 'explore');
    if (p.units.flag === null) {
      const shares = homeAreas.filter(area => p.units.areaPlans.get(area) !== 'skip').map(area => [area, areaShare(area)] as const);
      const target = exploreTarget(shares);
      if (target !== null && p.units.sendTo(pointToTile(regions.centers[2][target]), world)) advise(`tiedustelijat kohti: ${nameOf(2, target).name}`);
    }
  }
  if (p.cityAdvisor === 'growth' && p.pendingSite === null) {
    for (const u of p.units.units) {
      if (u.kind !== 'settler' || u.home === null || u.task !== 'found' || (p.units.founding && u === p.units.settler)) continue;
      p.units.setTask(u, 'improve', world);
      advise([unitRef(u.id, u.name), ' kehittää maata']);
    }
  }
}

/** Land tiles of each state, counted once (STORY-057). */
const stateLand = new Map<number, number>();
function landOf(state: number): number {
  if (!stateLand.has(state)) {
    let n = 0;
    for (const id of tilesOfState(state)) if (Number.isFinite(world.cost(id))) n++;
    stateLand.set(state, n);
  }
  return stateLand.get(state)!;
}
/**
 * Tiles of each state, for its mapped share: indexed in one pass over all the tiles the first
 * time (STORY-117: a pass for each state newly open took the planet level's first day over 100 ms).
 */
let stateTiles: number[][] | null = null;
export function stateShare(state: number): number {
  return mapState.share(tilesOfState(state));
}

/** The tiles of a state. */
export function tilesOfState(state: number): number[] {
  if (!stateTiles) {
    const table = regions.tileTable();
    const index: number[][] = [];
    for (let id = 0; id < table.length; id++) (index[Math.floor(table[id] / 49)] ??= []).push(id);
    stateTiles = index;
  }
  return stateTiles[state] ?? [];
}

/** Make a state the target: the expedition goes there (STORY-057). */
export function setTargetState(state: number, by: AdvisorLevel | null) {
  const p = play!;
  if (p.targetState === state) return;
  p.targetState = state;
  p.units.sendTo(pointToTile(regions.centers[0][state]), world);
  if (by) advise(`kohdevaltio: ${stateNameOf(state).name}`, by);
}

/** The planet advisor's day: a new target once the old one is conquered or none is set. */
function planetAdvisorDay() {
  const p = play!;
  const won = conquestNow();
  if (p.targetState >= 0 && !won.conquered.has(p.targetState) && won.open.has(p.targetState)) return;
  const target = planetTarget(p.planetAdvisor, [...won.open].map(state => ({ state, land: landOf(state), mapped: stateShare(state), conquered: won.conquered.has(state) })));
  if (target !== null) setTargetState(target, 'planet');
}

/** The state advisor's day (STORY-051): the line, taxes, science, revolution, luxury, the target and buying. */
function stateAdvisorDay(a: Exclude<StateAdvisor, 'none'>, yields: CityYield[]) {
  const p = play!;
  const plan = STATE_PLANS[a];
  if (p.units.stateLine !== plan.line) p.units.setStateLine(plan.line, world);
  if (p.gov !== 'anarchy') p.tax = plan.tax;
  if (p.research.target === null && !p.learned.length) {
    // A kind of resource first: it is cheap, and it shows and yields (STORY-072)
    const next = p.research.available(foundKinds).find(isKind) ?? nextAdvance(plan.order, p.research.available() as Advance[]);
    if (next && dispatch({ kind: 'study', target: next }, 'state')) advise(['tutkitaan: ', (isKind(next) ? resourceRef(next, knownKind(next)) : advanceRef(next))], 'state');
  }
  // Laajentaja and Oppinut wait for the Republic and turn to it once it is known, also from
  // Monarchy (Sami 2026-11-26: one anarchy), and Kenraali to Monarchy from Despotism only, never
  // back from the Republic (STORY-125, own)
  const targets = revolutionTargets();
  const to = a !== 'war' ? (targets.includes('republic') ? 'republic' : null) : p.gov === 'despotism' && targets.includes('monarchy') ? 'monarchy' : null;
  if (to && dispatch({ kind: 'revolution', to }, 'state')) advise(`vallankumous ${REVOLUTION_TO[to]}`, 'state');
  // Luxury a step up while a city is in disorder, a step down after calm days
  const disorder = yields.some(y => y.disorder);
  p.calmDays = disorder ? 0 : p.calmDays + 1;
  const lux = luxuryStep(p.lux, disorder, p.calmDays, LUX_RATES);
  if (lux !== p.lux) {
    p.lux = lux;
    p.calmDays = 0;
    advise(`ylellisyys ${lux} %`, 'state');
  }
  if (a === 'expand') {
    // The nearest province without a city: the home state's first, then the open states' (STORY-016)
    const current = p.targetProvince;
    const won = conquestNow();
    if (current < 0 || won.held.has(current)) {
      const aim = p.targetState >= 0 && won.open.has(p.targetState) && !won.conquered.has(p.targetState) ? [p.targetState] : null;
      const states = !won.conquered.has(homeState()) ? [homeState()] : aim ?? [...won.open];
      const from = tileCenter(p.units.camp);
      const provinces = states.flatMap(s => Array.from({ length: 7 }, (_, k) => s * 7 + k));
      const target = expeditionTarget(provinces.map(id => ({ area: id, share: won.held.has(id) ? 1 : 0, distance: from.angleTo(regions.centers[1][id]) })), 1);
      if (target !== null && target !== current) {
        p.targetProvince = target;
        p.units.sendTo(pointToTile(regions.centers[1][target]), world);
        advise(`tavoitelääni: ${nameOf(1, target).name}`, 'state');
      }
    }
  }
  if (a === 'war') {
    for (const c of p.cities) {
      if (p.raids.band?.city !== c.tile || !(isSoldier(c.build) || c.build === 'walls')) continue;
      const price = buyCost(c);
      if (!price || !dispatch({ kind: 'buy', city: c.tile }, 'state')) continue;
      advise(['osti: ', cityRef(c.tile, c.name), ' · ', buildRef(c.build), ` (${price} kultaa)`], 'state');
    }
  }
}

/** The era of the people: the iron age with Rautatyö (own, until Sami decides the era's condition). */
/** The era now: the latest whose key advance is known (STORY-120, eras.ts). */
export const eraNow = (): Era => (play ? eraOf(play.research.known) : 'early');

/** The chosen advisor of a level. */
export function chosenAdvisor(level: AdvisorLevel): string {
  const p = play!;
  return level === 'town' ? p.townAdvisor : level === 'city' ? p.cityAdvisor : level === 'province' ? p.provinceAdvisor : level === 'state' ? p.stateAdvisor : p.planetAdvisor;
}

/** Set a level's advisor (the advise command, STORY-096); false when it is not one of that level's. */
function setAdvisor(level: AdvisorLevel, id: string): boolean {
  if (!play) return false;
  if (level === 'town' && (TOWN_ADVISOR_LIST as readonly string[]).includes(id)) {
    play.townAdvisor = id as TownAdvisor;
    play.townLog = [];
    return true;
  }

  if (level === 'city' && (CITY_ADVISOR_LIST as readonly string[]).includes(id)) {
    play.cityAdvisor = id as CityAdvisor;
    play.advisorLog = [];
  } else if (level === 'province' && (PROVINCE_ADVISOR_LIST as readonly string[]).includes(id)) {
    play.provinceAdvisor = id as ProvinceAdvisor;
    play.provinceLog = [];
  } else if (level === 'state' && (STATE_ADVISOR_LIST as readonly string[]).includes(id)) {
    play.stateAdvisor = id as StateAdvisor;
    play.stateLog = [];
  } else if (level === 'planet' && (PLANET_ADVISOR_LIST as readonly string[]).includes(id)) {
    play.planetAdvisor = id as PlanetAdvisor;
    play.planetLog = [];
  } else return false;
  return true;
}

/** Governments the realm can turn to now: known, and not the one it has (STORY-125). Not in anarchy. */
export function revolutionTargets(): RevolutionTarget[] {
  const p = play;
  if (!p || p.gov === 'anarchy') return [];
  return (['monarchy', 'republic'] as const).filter(t => t !== p.gov && p.research.known.has(t));
}

/**
 * A revolution to a known government: some days of anarchy first (STORY-047). From Despotism
 * or Monarchy, to Monarchy or the Republic (STORY-125; civ1 lets a realm turn to any it knows).
 */
export function startRevolution(to: RevolutionTarget = 'monarchy'): boolean {
  if (!play || !game || !revolutionTargets().includes(to)) return false;
  play.gov = 'anarchy';
  play.revolutionTo = to;
  play.anarchyUntil = clock.day + revolutionDays(game.seed, clock.day);
  view.notice(`Vallankumous: anarkiaa ${play.anarchyUntil - clock.day} pv, sitten ${GOVERNMENTS[to].name}`);
  return true;
}

/** Open ruins: what they hold comes to the player, with a notice and a glow on the tile. */
export function openRuin(tile: number, finder: number) {
  if (!play || !game) return;
  const { kind, pick } = ruinAt(game.seed, tile);
  const who = play.units.units.find(u => u.id === finder)?.name ?? 'Tiedustelija';
  const gold = (n: number) => { play!.gold += n; return `${n} kultaa`; };
  let got: string;
  if (RUIN_GOLD[kind]) got = gold(RUIN_GOLD[kind]!);
  else if (kind === 'advance') {
    const can = play.research.available() as Advance[];
    const a = can[Math.min(can.length - 1, Math.floor(pick * can.length))];
    if (a) {
      play.research.known.add(a);
      if (play.research.target === a) play.research.target = null;
      gained(a);
      got = `keksintö ${ADVANCES[a].name}`;
    } else got = gold(CONSOLATION_GOLD);
  } else if (kind === 'soldier') {
    // Soldiers stay in a city, so the band joins the capital (Freeciv: on the hut's tile)
    const capital = play.cities[0];
    if (capital) {
      const soldier = bestSoldier();
      play.units.spawn(soldier, capital.tile, world, null);
      got = `${soldier === 'phalanx' ? 'falangi' : 'soturi'} liittyi kaupunkiin ${capital.name}`;
    } else got = gold(CONSOLATION_GOLD);
  } else got = `${play.units.recruit(tile, world).name} liittyi joukkoon`;
  play.found++;
  moment('find', tile);
  view.notice(`Rauniot · ${who}: ${got}`);
}

function noteDiscoveries(fresh: number[]) {
  if (!play || !game) return;
  for (const tile of discoveriesOn ? fresh : []) {
    if (!Number.isFinite(world.cost(tile)) || !isRuin(game.seed, tile)) continue;
    // The finder is the scout nearest to the tile
    const at = tileCenter(tile);
    let finder = 0, best = Infinity;
    for (const u of play.units.units) {
      const a = u.kind === 'scout' ? tileCenter(u.tile).angleTo(at) : Infinity;
      if (a < best) { best = a; finder = u.id; }
    }
    openRuin(tile, finder);
  }
  noteSiteOffer(fresh);
}


// ─── Raids (STORY-034) ────────────────────────────
// From day 60 bandits rise 5 to 8 tiles from a city and march on it (raids.ts). Their
// first sight stops the game; the soldiers in the city fight them one by one.

/** Soldiers in the city on a tile. */
export const soldiersIn = (tile: number) => (play ? play.units.units.filter(u => (u.kind === 'warrior' || u.kind === 'phalanx') && u.tile === tile) : []);
/** The best soldier a city can build now (STORY-043). */
export const bestSoldier = (): 'warrior' | 'phalanx' => (play?.research.known.has('bronze') ? 'phalanx' : 'warrior');

const raidWorld: RaidWorld = {
  cost: id => world.cost(id),
  terrainOf,
  walls: tile => { const c = play?.cities.find(x => x.tile === tile); return c ? hasWalls(c) : false; },
  defenders: tile => soldiersIn(tile).length,
  // The advisors' bonus (STORY-107): bandits answer to the city level at the capital and to the city area elsewhere, nomads to the province
  defense: tile => Math.max(1, ...soldiersIn(tile).map(u => defenseOf(u.kind))) * defenseBonus(activeBonuses(), play?.raids.band?.tribe ? 'nomads' : 'bandits', !!play?.cities.find(c => c.tile === tile)?.capital),
  // The best defender fights, and falls
  loseDefender: tile => {
    const soldiers = soldiersIn(tile);
    const best = soldiers.reduce((a, b) => (defenseOf(b.kind) > defenseOf(a.kind) ? b : a));
    play!.units.disband(best, world);
  },
  plunder: tile => {
    const c = play!.cities.find(x => x.tile === tile)!;
    c.food = 0;
    c.shields = 0;
    if (c.size > 1) c.size--;
  },
  roll: k => raidRoll(game!.seed, clock.day, k + 1),
};

/** The day's fights in a few words: "Rosvo kaatoi soturin · Soturit torjuivat 2 rosvoa". */
// ─── Campaigns (STORY-064) ────────────────────────
// The Kenraali sends an army against the nearest city-state of an open state: the three cities
// nearest to it build attackers, which gather in the nearest; it sets off once it can expect
// to beat the defenders, and takes the city.
export const army = () => play!.units.units.filter(u => isAttacker(u.kind));
const stagingCity = (tile: number) => {
  const at = tileCenter(tile);
  return play!.cities.reduce<City | null>((best, c) => (!best || tileCenter(c.tile).angleTo(at) < tileCenter(best.tile).angleTo(at) ? c : best), null);
};
/** The cities that build the army: the three nearest to the target (one alone could not pay for it in a long game). */
const armyCities = (tile: number) => {
  const at = tileCenter(tile);
  return play!.cities.map(c => [tileCenter(c.tile).angleTo(at), c] as const).sort((a, b) => a[0] - b[0]).slice(0, 3).map(([, c]) => c);
};
const unitPath = (from: number, to: number) => findPath(from, to, id => world.travel!(id));
/** Campaign paths found not to exist, by city, target and sea travel: a search for one costs up to 20 000 tiles (not saved). */
const noWay = new Set<string>();
function reachable(from: number, to: number): boolean {
  const key = `${from}>${to}>${canSail()}`;
  if (noWay.has(key)) return false;
  if (unitPath(from, to) !== null) return true;
  noWay.add(key);
  return false;
}

const warWorld: WarWorld = {
  defence: tile => {
    // A rival's city: its warriors, who fall one by one (STORY-077)
    const rc = rivalCityAt(tile);
    if (rc) return { full: rivalDefenders(rc.rival, tile).length, defense: 1, walls: false, terrain: terrainOf(tile), live: true };
    const n = nativeAt(tile);
    // A tribe's camp: its band, defense 1 (Cavalry and Legion)
    if (!n) return { full: tribeBand(game!.seed, tribeAt(tile)!.tribe, clock.day).size, defense: 1, walls: false, terrain: terrainOf(tile) };
    const s = nativeStrength(n, clock.day);
    return { full: s.defenders, defense: defenseOf(s.defender), walls: s.walls, terrain: terrainOf(tile) };
  },
  path: unitPath,
  roll: k => warRoll(game!.seed, clock.day, k),
  lose: u => play!.units.disband(u, world),
  defeat: tile => {
    const rc = rivalCityAt(tile);
    if (rc) rc.rival.units.splice(rc.rival.units.indexOf(rivalDefenders(rc.rival, tile)[0]), 1);
  },
  // Freeciv: the city loses a citizen, and one of size 1 is destroyed
  take: (tile, u) => {
    const p = play!;
    // A rival's city comes over (STORY-077)
    const rc = rivalCityAt(tile);
    if (rc) {
      p.ties[p.rivals.indexOf(rc.rival)].lost++;
      rc.rival.lose(rc.city);
      if (rc.city.size <= 1) return 'razed';
      const c = foundCity(p.cities, tile);
      Object.assign(c, { name: rc.city.name, size: rc.city.size - 1, buildings: [...rc.city.buildings] });
      record(c, { kind: 'taken', day: today(), from: rc.rival.name });
      placeAll(c, ground);
      u.tile = tile;
      u.path = [];
      reveal(tilesInRings(tile, CITY_RINGS));
      return 'taken';
    }
    const n = nativeAt(tile);
    // A tribe scattered pays the ransom (STORY-066)
    if (!n) {
      p.war.routed.add(tribeAt(tile)!.tribe.state);
      p.gold += RANSOM_GOLD;
      return 'routed';
    }
    const size = nativeStrength(n, clock.day).size;
    if (size <= 1) return 'razed';
    const c = foundCity(p.cities, tile);
    Object.assign(c, { name: n.name, size: size - 1, native: true });
    record(c, { kind: 'taken', day: today(), from: null });
    u.tile = tile;
    u.path = [];
    reveal(tilesInRings(tile, CITY_RINGS));
    return 'taken';
  },
};

/** The Kenraali's campaign day: the target, the army gathering, and the fights. */
/**
 * With no campaign under way (no target, or the state's advisor is not the Kenraali), attackers
 * outside a city walk to the player's nearest city they can reach (own, Sami 2026-11-26: after a
 * campaign they stood in the field, and under the Republic each made one citizen unhappy for good).
 */
function armyHome() {
  const p = play!;
  if ((p.stateAdvisor === 'war' && p.war.target !== null) || !p.cities.length) return;
  const cities = new Set(p.cities.map(c => c.tile));
  for (const u of army()) {
    if (cities.has(u.tile) || u.path.length) continue;
    const home = stagingCity(u.tile);
    const key = home && `${u.tile}>${home.tile}>${canSail()}`;
    if (!home || !key || noWay.has(key)) continue;
    const path = unitPath(u.tile, home.tile);
    if (path) u.path = path;
    else noWay.add(key);
  }
}

function warDay() {
  const p = play!;
  // City-states and the camps of the tribes (STORY-066)
  // A rival's cities at war, wherever they are (STORY-077)
  const enemies = visibleRivalCities().filter(x => p.ties[p.rivals.indexOf(x.rival)]?.state === 'war')
    .map(x => ({ tile: x.city.tile, state: Math.floor(regions.tileTable()[x.city.tile] / 49), name: x.city.name }));
  const open = [...[...visibleNatives(), ...visibleTribes().map(t => ({ tile: t.camp, state: t.tribe.state, name: t.tribe.name }))].filter(n => p.units.isOpen(n.tile, world)), ...enemies];
  if (p.war.target === null || !open.some(n => n.tile === p.war.target)) {
    // The planet's target state first, then the nearest to the capital that the army can reach
    const aim = open.filter(n => n.state === p.targetState);
    const from = tileCenter(p.cities[0]?.tile ?? p.units.camp);
    const near = (aim.length ? aim : open).sort((a, b) => from.angleTo(tileCenter(a.tile)) - from.angleTo(tileCenter(b.tile)));
    const next = near.slice(0, 3).find(n => { const c = stagingCity(n.tile); return c !== null && reachable(c.tile, n.tile); }) ?? null;
    p.war.setTarget(next?.tile ?? null);
    if (next) advise(`sotaretken kohde: ${next.name}`, 'state');
  }
  const target = p.war.target;
  if (target === null) {
    // None in sight: the scouts look for the nearest of an open state (the Puolustus line keeps them home otherwise)
    const from = tileCenter(p.cities[0]?.tile ?? p.units.camp);
    const hidden = natives.filter(n => !nativeGone(n) && !mapState.isMapped(n.tile) && p.units.isOpen(n.tile, world))
      .sort((a, b) => from.angleTo(tileCenter(a.tile)) - from.angleTo(tileCenter(b.tile)));
    if (p.units.flag === null && hidden.length && p.units.sendTo(hidden[0].tile, world)) advise(`tiedustelijat etsivät kaupunkivaltiota kohti ${directionName(p.cities[0]?.tile ?? p.units.camp, hidden[0].tile)}`, 'state');
    return;
  }
  const name = nativeAt(target)?.name ?? tribeAt(target)?.tribe.name ?? rivalCityAt(target)!.city.name;
  const troops = army();
  // Before the march the army gathers in the city nearest to the target, and gold buys
  // attackers, at half the treasury at most
  const camp = stagingCity(target);
  const need = warNeed(target);
  if (!p.war.marching && camp && troops.length < need) {
    for (const u of troops) if (u.tile !== camp.tile && !u.path.length) u.path = unitPath(u.tile, camp.tile) ?? [];
    for (const c of armyCities(target)) {
      const price = buyCost(c);
      if (!isAttacker(c.build) || price <= 0 || price * 2 > p.gold || !dispatch({ kind: 'buy', city: c.tile }, 'state')) continue;
      advise(['osti: ', cityRef(c.tile, c.name), ' · ', buildRef(c.build), ` (${price} kultaa)`], 'state');
    }
  }
  const events = p.war.day(troops, warWorld, clock.day, need);
  if (!events.length) return;
  view.notice(`${warNotice(events)} · ${name}`);
  moment(events.some(e => e === 'lost' || e === 'razed') ? 'raid' : 'victory', target);
  if (events.includes('taken')) advise(`${name} vallattu`, 'state');
  if (events.includes('razed')) advise(`${name} tuhoutui`, 'state');
  if (events.includes('routed')) advise(`${name} hajosi · ${RANSOM_GOLD} kultaa lunnaita`, 'state');
}

/** Attackers the Kenraali gathers against a city-state, by the odds of the strongest attacker known. */
export function warNeed(target: number): number {
  const d = warWorld.defence(target);
  const best = [...ATTACKERS].reverse().find(k => play!.research.known.has(NEEDS[k]!)) ?? 'horseman';
  return armyNeeded(d.live ? d.full : play!.war.left(target, d.full, clock.day), attackWins(ATTACK[best], d.terrain, d.walls, d.defense));
}

/** What the Kenraali has the cities nearest to the target build: the strongest attacker they can, until the army is big enough. */
function warBuild(c: City, available: Build[]): Build | null {
  const p = play!;
  const target = p.war.target;
  if (target === null || p.war.marching || !armyCities(target).includes(c)) return null;
  if (army().length >= warNeed(target)) return null;
  return [...ATTACKERS].reverse().find(k => available.includes(k)) ?? null;
}

function warNotice(events: WarEvent[]): string {
  const n = (e: WarEvent) => events.filter(x => x === e).length;
  return [
    n('won') === 1 ? 'Hyökkääjä kaatoi puolustajan' : n('won') ? `Hyökkääjät kaatoivat ${n('won')} puolustajaa` : '',
    n('lost') === 1 ? 'Hyökkääjä kaatui' : n('lost') ? `${n('lost')} hyökkääjää kaatui` : '',
    n('taken') ? 'Kaupunki vallattu: se on nyt sinun' : '',
    n('razed') ? 'Kaupunki tuhoutui valtauksessa' : '',
    n('routed') ? `Heimo hajosi: ${RANSOM_GOLD} kultaa lunnaita` : '',
  ].filter(Boolean).join(' · ');
}

function raidNotice(events: RaidEvent[], nomads = false): string {
  const n = (e: RaidEvent) => events.filter(x => x === e).length;
  const [one, many, some] = nomads ? ['Paimentolainen', 'Paimentolaiset', 'paimentolaista'] : ['Rosvo', 'Rosvot', 'rosvoa'];
  return [
    n('won') === 1 ? `${one} kaatoi soturin` : n('won') ? `${many} kaatoivat ${n('won')} soturia` : '',
    n('repelled') === 1 ? `Soturi torjui ${nomads ? 'paimentolaisen' : 'rosvon'}` : n('repelled') ? `Soturit torjuivat ${n('repelled')} ${some}` : '',
    n('plundered') ? `${many} ryöstivät kaupungin` : '',
  ].filter(Boolean).join(' · ');
}

/**
 * After a plunder, what would have held the city (STORY-108; PLAYTEST-002): a soldier, then a
 * second one, a phalanx and walls, each with what it needs when it is not known yet.
 */
function raidLesson(c: City, hadSoldier: boolean): Segment[] {
  const p = play!;
  const helps: Segment[][] = [[hadSoldier ? 'toinen sotilas' : 'sotilas']];
  if (!p.research.known.has('bronze')) helps.push([buildRef('phalanx', 'falangi'), ' (', advanceRef('bronze'), ')']);
  else helps.push([buildRef('phalanx', 'falangi')]);
  if (!hasWalls(c)) helps.push(p.research.known.has('masonry') ? [buildRef('walls', 'muuri')] : [buildRef('walls', 'muuri'), ' (', advanceRef('masonry'), ')']);
  return ['. Puolustukseksi auttaa ', ...helps.flatMap((h, i) => [...(i === 0 ? [] : [i === helps.length - 1 ? ' tai ' : ', ']), ...h])];
}

/** A day of the band, then perhaps a new uprising against a city. */
/** The band whose end goes into the chronicle, and whether it plundered (STORY-106). */
let raidTally: { band: object; plundered: boolean; fought: boolean } | null = null;

export function raidDay() {
  if (!play || !game) return;
  const band = play.raids.band;
  const city = band && play.cities.find(c => c.tile === band.city);
  // The best soldier stands at the gate: if it lives through the day, the chronicle names it
  const guard = city ? soldiersIn(city.tile).reduce<Unit | null>((a, b) => (!a || defenseOf(b.kind) > defenseOf(a.kind) ? b : a), null) : null;
  const events = play.raids.day(raidWorld);
  if (city && events.length) {
    view.notice([`${raidNotice(events, !!band.tribe)} · `, cityRef(city.tile, city.name), ...(events.includes('plundered') ? raidLesson(city, events.includes('won') || (raidTally?.band === band && raidTally.fought)) : [])]);
    moment(events.includes('plundered') || events.includes('won') ? 'raid' : 'victory', city.tile);
  }
  if (band && city) {
    if (raidTally?.band !== band) raidTally = { band, plundered: false, fought: false };
    raidTally.plundered ||= events.includes('plundered');
    raidTally.fought ||= events.length > 0;
    // The band is gone: held or plundered, it is told once (a band that never reached the city is not)
    if (!play.raids.band && raidTally.fought) {
      const held = !raidTally.plundered;
      const at = held && guard && play.units.units.includes(guard) ? { id: guard.id, name: guard.name } : null;
      record(city, { kind: 'raid', day: today(), held, defender: at, nomads: !!band.tribe });
    }
    if (!play.raids.band) raidTally = null;
  }
  if (play.raids.band || !raidsOn || !play.cities.length || cityStage()) return;
  // The tribes raid from the state level on (STORY-094); bandits belong to the city area
  if (stateStage()) for (const t of tribesNow()) if (tribeRaids(game.seed, t.tribe, clock.day) && sendTribe(t)) return;
  if (!uprising(game.seed, clock.day, play.cities.length)) return;
  startRaid(play.cities[Math.floor(raidRoll(game.seed, clock.day, 100) * play.cities.length)]);
}

/** One or two bandits set off toward a city from known land 5 to 8 tiles away. */
export function startRaid(c: City): boolean {
  if (!play || !game) return false;
  const isLand = (id: number) => Number.isFinite(world.cost(id));
  const from = raidStart(c.tile, raidRoll(game.seed, clock.day, 101), id => mapState.isMapped(id), isLand);
  const size = 1 + Math.floor(raidRoll(game.seed, clock.day, 102) * 2);
  if (from === null || !play.raids.start(c.tile, from, size, id => world.cost(id))) return false;
  // The first bandits stop the game with their card, later ones are notices (STORY-017); the Vartija answers each
  play.raidAlert = play.cityAdvisor === 'defend' || firstTime('raid');
  if (!play.raidAlert) {
    moment('raid', from);
    view.notice([`${size === 1 ? 'Rosvo' : `${size} rosvoa`} liikkeellä kohti kaupunkia `, cityRef(c.tile, c.name)]);
  }
  return true;
}

/** The answer to the raid the game stopped for (the raid command): build a soldier, buy one, or trust the defence. */
function answerRaid(choice: RaidChoice): boolean {
  if (!play || !play.raidAlert) return false;
  play.raidAlert = false;
  const band = play.raids.band;
  const c = band && play.cities.find(x => x.tile === band.city);
  if (choice === 'later' || !c) return true;
  const soldier = bestSoldier();
  const price = buyCost({ ...c, build: soldier, shields: c.build === soldier ? c.shields : 0 });
  if (!execute({ kind: 'build', city: c.tile, build: soldier }, commandWorld())) return true;
  const name = c.build === 'phalanx' ? 'falangin' : 'soturin';
  if (choice === 'buy' && execute({ kind: 'buy', city: c.tile }, commandWorld())) view.notice([cityRef(c.tile, c.name), ` osti ${name} · ${price} kultaa`]);
  else view.notice([cityRef(c.tile, c.name), ` rakentaa ${name}`]);
  return true;
}

/** Names of the 7 children of a province (areas) or a state (provinces), cached. */
const nameCache = new Map<string, RegionName[]>();
function childNames(level: 1 | 2, parent: number): RegionName[] {
  const key = `${level}/${parent}`;
  const cached = nameCache.get(key);
  if (cached || !game) return cached ?? [];
  // Directions within the parent: from its centre, the middle child is "Keski-"
  const parentTile = pointToTile(regions.centers[level - 1][parent]);
  const ids = Array.from({ length: 7 }, (_, k) => parent * 7 + k);
  const terrainsOf = (cities: number[]) => cities.flatMap(c => cityTiles(regions, c)).map(terrainOf);
  const dirs = ids.map((id, k) => (k === 0 ? MIDDLE : directionFrom(parentTile, pointToTile(regions.centers[level][id]))));
  const names = level === 2
    ? ids.map((id, k) => areaName(id === game!.startCity, dirs[k], landscapeOf(terrainsOf([id]))))
    : ids.map((id, k) => provinceName(id === Math.floor(game!.startCity / 7), dirs[k], landscapeOf(terrainsOf(Array.from({ length: 7 }, (_, j) => id * 7 + j)))));
  const distinct = distinctNames(names, dirs, level === 2 ? 'area' : 'province');
  nameCache.set(key, distinct);
  return distinct;
}
export const nameOf = (level: 1 | 2, id: number) => childNames(level, Math.floor(id / 7))[id % 7];

/** The home state: where the game starts (STORY-016). */
export const homeState = () => Math.floor((game?.startCity ?? 0) / 49);

/** Provinces held, states conquered and states open, from the cities (conquest.ts). */
export function conquestNow(): Conquest {
  const table = regions.tileTable();
  // At the province level a border holds a province too (STORY-093)
  return conquest(play ? play.cities.map(c => table[c.tile]) : [], homeState(), regions.neighbors, provinceHasLand, play && provinceStage() ? bordersNow().held : []);
}

/** Whether a province has land, found once (STORY-058: a province without land counts as held). */
const provinceLand = new Map<number, boolean>();
export function provinceHasLand(p: number): boolean {
  if (!provinceLand.has(p)) {
    let land = false;
    for (let a = p * 7; a < p * 7 + 7 && !land; a++) {
      if (!tilesOfArea.has(a)) tilesOfArea.set(a, cityTiles(regions, a));
      land = tilesOfArea.get(a)!.some(t => Number.isFinite(world.cost(t)));
    }
    provinceLand.set(p, land);
  }
  return provinceLand.get(p)!;
}

/** A state's name at the planet level: home, else its direction from home. */
export function stateNameOf(id: number): RegionName {
  const home = homeState();
  return stateName(id === home, directionFrom(pointToTile(regions.centers[0][home]), pointToTile(regions.centers[0][id])));
}

export const tilesOfArea = new Map<number, number[]>();
export const areaShare = (city: number) => {
  if (!tilesOfArea.has(city)) tilesOfArea.set(city, cityTiles(regions, city));
  return mapState.share(tilesOfArea.get(city)!);
};
export const provinceShare = (p: number) => Array.from({ length: 7 }, (_, k) => areaShare(p * 7 + k)).reduce((a, b) => a + b, 0) / 7;

/** A rival's cities on the player's map. */
export const knownRivalCities = (k: number) => visibleRivalCities().filter(x => x.rival === play!.rivals[k]).map(x => x.city);

/** The player's cities within BORDER_TILES of a rival's. */
export function nearCitiesOf(k: number): City[] {
  const r = play!.rivals[k];
  const theirs = r.cities.map(c => tileCenter(c.tile));
  return play!.cities.filter(c => {
    const at = tileCenter(c.tile);
    return theirs.some(t => t.angleTo(at) < BORDER_TILES * TILE_ANGLE);
  });
}

/** The day's ties: meeting, attitude, and what each rival does. */
export function diplomacyDay() {
  const p = play!;
  // Diplomacy belongs to the state level (STORY-017); the old start has it from the outset
  if (!stateStage()) return;
  p.rivals.forEach((r, k) => {
    const t = p.ties[k];
    if (!t) return;
    if (!t.met && knownRivalCities(k).length) {
      t.met = true;
      t.since = clock.day;
      view.notice(`Tapasitte kilpailijan: ${r.name} · diplomatia luettelossa`);
    }
    if (!t.met) return;
    const near = nearCitiesOf(k);
    tiesDay(t, clock.day, near.length > 0);
    // Stronger: more soldiers than the player's in the cities near it
    const stronger = r.units.filter(u => u.kind !== 'settler').length > near.reduce((n, c) => n + soldiersIn(c.tile).length, 0);
    const move = rivalMove(t, clock.day, stronger);
    if (move === 'war') {
      setState(t, 'war', clock.day);
      view.notice(`${r.name} julisti sodan!`);
      moment('raid', (near[0] ?? p.cities[0])?.tile ?? null);
    } else if (move && !p.treaty) offerTreaty(k, move);
  });
}

// ─── War with the rivals (STORY-077) ───────────────
// At war (diplomacy.ts) a rival's two cities nearest the player's city nearest its capital
// build its army, which gathers, marches and attacks as the Kenraali's does (war.ts); the
// Kenraali may take the rival's cities. A city taken goes over with a citizen fewer, one of
// size 1 is destroyed, and the game is over when the player's last city falls (Sami: kaupunki
// siirtyy). The units a lost city supported go with it (own).

/** A rival's defenders in a city: its warriors there. */
const rivalDefenders = (r: Rival, tile: number) => r.units.filter(u => u.kind === 'warrior' && u.tile === tile);
const landPath = (from: number, to: number) => findPath(from, to, id => world.cost(id));

function rivalWarWorld(r: Rival): WarWorld<RivalUnit> {
  return {
    defence: tile => {
      const c = play!.cities.find(x => x.tile === tile);
      const soldiers = soldiersIn(tile);
      // The planet's advisor answers the rivals' attacks (STORY-107)
      return { full: soldiers.length, defense: Math.max(1, ...soldiers.map(u => defenseOf(u.kind))) * defenseBonus(activeBonuses(), 'rival', !!c?.capital), walls: c ? hasWalls(c) : false, terrain: terrainOf(tile), live: true };
    },
    path: landPath,
    roll: k => warRoll(game!.seed + 7919 * (r.id + 1), clock.day, k),
    lose: u => { r.units.splice(r.units.indexOf(u), 1); },
    defeat: tile => raidWorld.loseDefender(tile),
    take: (tile, u) => {
      const c = play!.cities.find(x => x.tile === tile)!;
      const razed = c.size <= 1;
      loseCity(c, razed ? null : r);
      if (!razed) {
        u.tile = tile;
        u.path = [];
      }
      return razed ? 'razed' : 'taken';
    },
  };
}

/** The rivals at war: each picks the player's city to take, builds and gathers its army, and attacks. */
export function rivalWarDay() {
  const p = play!;
  // War belongs to the state level (STORY-094), as diplomacy does
  if (!stateStage()) return;
  p.rivals.forEach((r, k) => {
    if (p.ties[k]?.state !== 'war' || !p.cities.length || !r.cities.length) {
      r.enemy = null;
      r.war.setTarget(null);
      return;
    }
    // The player's city nearest to its capital that its army can reach
    if (r.war.target === null || !p.cities.some(c => c.tile === r.war.target)) {
      const at = tileCenter(r.cities[0].tile);
      const near = [...p.cities].sort((a, b) => tileCenter(a.tile).angleTo(at) - tileCenter(b.tile).angleTo(at));
      r.war.setTarget(near.slice(0, 3).find(c => landPath(r.armyCities(c.tile)[0].tile, c.tile) !== null)?.tile ?? null);
    }
    const target = r.war.target;
    if (target === null) {
      r.enemy = null;
      return;
    }
    const ww = rivalWarWorld(r);
    const d = ww.defence(target);
    const best = r.bestAttacker();
    const need = best ? armyNeeded(d.full, attackWins(ATTACK[best], d.terrain, d.walls, d.defense)) : MAX_ARMY;
    r.enemy = { tile: target, need };
    // Before the march the army gathers in its city nearest to the target
    const camp = r.armyCities(target)[0];
    const troops = r.army();
    if (!r.war.marching && troops.length < need) for (const u of troops) if (u.tile !== camp.tile && !u.path.length) u.path = landPath(u.tile, camp.tile) ?? [];
    const name = p.cities.find(c => c.tile === target)!.name;
    const events = r.war.day(troops, ww, clock.day, need);
    if (!events.length) return;
    view.notice(`${r.name}: ${rivalWarNotice(events)} · ${name}`);
    moment('raid', target);
  });
}

function rivalWarNotice(events: WarEvent[]): string {
  const n = (e: WarEvent) => events.filter(x => x === e).length;
  return [
    n('won') === 1 ? 'hyökkääjä kaatoi puolustajan' : n('won') ? `hyökkääjät kaatoivat ${n('won')} puolustajaa` : '',
    n('lost') === 1 ? 'hyökkääjä kaatui' : n('lost') ? `${n('lost')} hyökkääjää kaatui` : '',
    n('taken') ? 'kaupunki menetettiin' : '',
    n('razed') ? 'kaupunki tuhoutui' : '',
  ].filter(Boolean).join(' · ');
}

/** A city of the player's lost: to a rival, or destroyed. The others keep their ids as indices, and the last one ends the game. */
function loseCity(c: City, to: Rival | null) {
  const p = play!;
  const i = p.cities.indexOf(c);
  if (i < 0) return;
  if (to) to.gain(c);
  p.cities.splice(i, 1);
  for (const u of p.units.units.filter(x => x.home === c.id)) p.units.disband(u, world);
  for (const u of p.units.units) if (u.home !== null && u.home > c.id) u.home--;
  p.cities.forEach((x, k) => { x.id = k; });
  // The biggest city left is the capital (own)
  if (c.capital && p.cities.length) [...p.cities].sort((a, b) => b.size - a.size)[0].capital = true;
  view.cityLost(c);
  unrest.clear();
  atLimit.clear();
  if (!p.cities.length) gameOver(to);
}

/** The game is over: the player's last city fell. */
function gameOver(by: Rival | null) {
  play!.over = true;
  view.over(by);
}

/** A rival proposes an alliance or peace: the game stops for the answer (STORY-076). */
function offerTreaty(k: number, kind: 'alliance' | 'peace') {
  play!.ties[k].offered = clock.day;
  play!.treaty = { rival: k, kind };
  view.treaty();
}

/** The answer to a rival's proposal (the treaty command). */
function answerTreaty(accept: boolean): boolean {
  const offer = play?.treaty;
  if (!play || !offer) return false;
  play.treaty = null;
  const r = play.rivals[offer.rival];
  if (accept) {
    setState(play.ties[offer.rival], offer.kind, tickDay ?? clock.day);
    view.notice(offer.kind === 'alliance' ? `Liitto: ${r.name}` : `Rauha: ${r.name}`);
  } else view.notice(`Kieltäydyitte: ${r.name}`);
  return true;
}

/** Bulbs the people add a day to a study of a kind: one from each city (STORY-072, own). */
export const peopleStudy = () => (play?.research.target && isKind(play.research.target) ? play.cities.length : 0);
// ─── A day (STORY-095, PLAN-092) ──────────────────
/** What the units go by on a day: the regions they map first, where no city may be, the open states. */
export function prepareDay() {
  const p = play;
  if (!p) return;
  const won = conquestNow();
  // Scouts map first what opens the next level (STORY-060)
  const meter = p.progress.meter;
  // ... and then the provinces of the home state not yet held, where the next cities go
  const held = meter === 'conquest' ? won.held : null;
  p.units.focus = meter === 'province' ? id => Math.floor(world.cityOf(id) / 7) === p.units.homeProvince
    : meter === 'state' ? id => Math.floor(world.cityOf(id) / 49) === homeState()
    : held ? id => Math.floor(world.cityOf(id) / 49) === homeState() && !held.has(Math.floor(world.cityOf(id) / 7)) : null;
  p.units.noCity = nearForeign;
  p.units.openStates = p.planetAdvisor === 'fortify' ? new Set([homeState(), ...won.conquered]) : won.open;
}

/**
 * A day of the game: the city-states it concerns found first, then the units, the cities, the
 * chronicles, the rivals, diplomacy, war, the raids and the advisors, in that order.
 */
/** The day last begun, worked out or under way (STORY-117): the clock's day is it. */
export let dayBegun = 0;
/** Days a save or a command worked out to their end at once (STORY-117's measure). */
export let daysFinishedAtOnce = 0;

export function simulateDay(day: number) {
  finishDay();
  dayBegun = day;
  const run = dayPhases(day);
  while (!run.next().done);
}

// ─── A day over several frames (STORY-117) ────────
// A late day took 20 to 70 ms, all in one frame. The browser works it out a part at a time
// (stepDay), and the parts come in the same order as in one go, so the day ends the same. A
// player's command or a save comes at a day's edge: the day is worked out to its end first.

let dayRun: Generator<void, void, void> | null = null;
let dayStepping = false;

/** Whether a day is being worked out over the frames. */
export const dayRunning = () => dayRun !== null;

/** A day to work out over the frames, the last one ended first. */
export function startDay(day: number) {
  finishDay();
  dayBegun = day;
  dayRun = dayPhases(day);
}

/** Work on the day until it ends or the time runs out: true when it ended. */
export function stepDay(budgetMs: number): boolean {
  if (!dayRun) return true;
  const until = performance.now() + budgetMs;
  dayStepping = true;
  try {
    do {
      if (dayRun.next().done) {
        dayRun = null;
        return true;
      }
    } while (performance.now() < until);
    return false;
  } finally {
    dayStepping = false;
  }
}

/** The day in progress worked out to its end now. */
export function finishDay() {
  if (!dayRun || dayStepping) return;
  daysFinishedAtOnce++;
  dayStepping = true;
  try {
    while (!dayRun.next().done);
  } finally {
    dayRun = null;
    dayStepping = false;
  }
}

/** The parts of a day, in order: a pause after each unit and between the parts (STORY-117). */
function* dayPhases(day: number): Generator<void, void, void> {
  const p = play;
  if (!p) return;
  // The city-states a day concerns are found before it, however the frames came (STORY-095),
  // a slice of the scan a part (a whole state's scan in one part took over 100 ms, STORY-117)
  while (play && (nativeScan || nextNativeState() !== null)) {
    scanNatives(SCAN_PART_MS);
    yield;
  }
  shadowNatives();
  prepareDay();
  tickDay = day;
  scouting = true;
  // The scouts see as far as the city area's advisor lets them (STORY-107)
  p.units.extraSight = sightBonus(activeBonuses());
  // The founding settler's name goes into the chronicle before the settler becomes the city
  const founder = p.units.founding ? (p.units.settler?.name ?? null) : null;
  const founded = yield* p.units.dayEach(world);
  scouting = false;
  founded.forEach(t => foundAt(t, founder));
  caravansDay();
  yield;
  cityDays();
  yield;
  chronicleEraDay();
  rivalsDay();
  greatLibraryDay(day);
  yield;
  diplomacyDay();
  rivalWarDay();
  raidDay();
  yield;
  yield* advisorDay();
  advisorsAnswer();
  riseCheck();
  tickDay = null;
}

/** A new game, or one loaded: the province level's joins are worked out anew, and the rivals' start states. */
export function resetGame(startCity: number) {
  // What the last game found and told (a run in Node plays several games one after another);
  // the memos of the world itself (names, land, paths) stay
  natives.length = 0;
  nativeCenters.length = 0;
  nativesOf.clear();
  tribeLand.clear();
  rivalScanned.clear();
  nativeScan = null;
  shadowed.clear();
  chronicleEra = null;
  raidTally = null;
  unrest.clear();
  atLimit.clear();
  goalUnreachable.clear();
  goalHeldKey = '';
  unreachableKey = '';
  // The names know the home province and state ("Kotilääni"), which change with the start city
  nameCache.clear();
  tickDay = null;
  scouting = false;
  // The province level's joins are worked out anew for this game (STORY-093)
  roadVersion++;
  bordersCache = null;
  joinsCache = null;
  unreachable.clear();
  joiningOf.clear();
  // A state with land: 10 of its 49 city areas or more centred on land (a sample, not a scan)
  const hasLand = (state: number) => Array.from({ length: 49 }, (_, k) => pointToTile(regions.centers[2][state * 49 + k])).filter(t => Number.isFinite(world.cost(t))).length >= 10;
  rivalStartStates = rivalStarts(game!.seed, Math.floor(startCity / 49), regions.neighbors, hasLand);
}

/** Tests turn the ruins, the site offers and the raids off and on. */
export function setSwitches(s: { discoveries?: boolean; siteOffers?: boolean; raids?: boolean; advanceCards?: boolean }) {
  if (s.discoveries !== undefined) discoveriesOn = s.discoveries;
  if (s.siteOffers !== undefined) siteOffersOn = s.siteOffers;
  if (s.raids !== undefined) raidsOn = s.raids;
  if (s.advanceCards !== undefined) advanceCardsOn = s.advanceCards;
}

/** A road built by a test: the joins are worked out anew. */
export function roadBuilt() { roadVersion++; }

// ─── The advisors' answers and the rises (STORY-095, PLAN-092 phase D) ─
/**
 * What a city can do against the band on its way (STORY-108): the chance it holds against the whole
 * band now and with one soldier more, whether the soldier is ready before the band arrives, and
 * what buying it costs.
 */
export function raidPlan(c: City) {
  const band = play!.raids.band!;
  const bonus = defenseBonus(activeBonuses(), band.tribe ? 'nomads' : 'bandits', !!c.capital);
  const defenses = soldiersIn(c.tile).map(u => defenseOf(u.kind) * bonus);
  const soldier = bestSoldier();
  const n = band.bandits.length;
  const hold = (d: number[]) => holdChance(d, n, terrainOf(c.tile), hasWalls(c), band.attack);
  const arrive = play!.raids.daysToCity(id => world.cost(id));
  const ready = daysToBuild({ ...c, build: soldier, shields: c.build === soldier ? c.shields : 0 }, cityYields()[play!.cities.indexOf(c)]);
  const inTime = ready !== null && Math.max(1, ready) <= arrive;
  const price = buyCost({ ...c, build: soldier, shields: c.build === soldier ? c.shields : 0 });
  return { soldier, n, arrive, ready, inTime, price, now: hold(defenses), withOne: hold([...defenses, defenseOf(soldier) * bonus]) };
}
/** What the level goals count. */
export function levelState(): LevelState {
  const p = play!;
  const capital = p.cities.find(c => c.capital) ?? p.cities[0];
  return {
    settlement: capital ? Object.values(settlementSteps(capital.buildings, capital.size)).filter(Boolean).length : 0,
    settlements: readySettlements(p.cities),
    provinces: heldIn(conquestNow(), homeState()),
  };
}

/**
 * A level's goal was reached and the next level opened (STORY-087): its gold, and a card that
 * stops the game and tells what opened and the new goal.
 */
export function rise(opened: number, reached: NonNullable<ReturnType<typeof levelGoal>>) {
  const p = play!;
  p.gold += reached.reward;
  view.notice(`Tavoite saavutettu: ${reached.text} · +${reached.reward} kultaa`);
  const next = levelGoal(opened);
  const s = levelState();
  const met = opened === 1 && !classic ? meetOpponents() : '';
  view.rise(opened, reached.opens.title, `${reached.opens.text}${met}${next ? ` Uusi tavoite: ${next.text} (${goalCount(next, s)} / ${next.need}).` : ''}`);
  moment('unlock', p.cities[0]?.tile ?? null);
  // The city area shows once it opens (STORY-017), and the ready settlement sends its first scout,
  // the Retkeilijä's two (STORY-089, own)
  if (opened === 3 && game) {
    reveal(cityTiles(regions, game.startCity));
    const capital = p.cities.find(c => c.capital) ?? p.cities[0];
    if (capital && !classic) for (let k = p.townAdvisor === 'roam' ? 2 : 1; k > 0; k--) p.units.spawn('scout', capital.tile, world, capital.id);
  }
}

/**
 * The first meeting at the state level (STORY-094, design brief view 7): the city-states and the
 * tribes of the home state's neighbours show on the map, and the card tells them and the rivals
 * growing farther away, in a sentence.
 */
function meetOpponents(): string {
  const p = play!;
  const near = regions.neighbors[homeState()].flatMap(st => nativesOf.get(st) ?? []).filter(n => !nativeGone(n));
  const tribes = tribesNow();
  reveal([...near.flatMap(n => tilesInRings(n.tile, 1)), ...tribes.flatMap(t => tilesInRings(t.camp, 1))]);
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const rivals = p.rivals.filter(r => r.cities.length).map(r => r.name);
  const names = rivals.length > 1 ? `${rivals.slice(0, -1).join(', ')} ja ${rivals[rivals.length - 1]}` : rivals[0];
  return ` Naapurivaltioissa on ${count(near.length, 'kaupunkivaltio', 'kaupunkivaltiota')} ja ${count(tribes.length, 'paimentolaisheimo', 'paimentolaisheimoa')}${names ? `, ja kauempana ${rivals.length === 1 ? 'kasvaa kilpailija' : 'kasvavat kilpailijat'} ${names}` : ''}. Diplomatia, sota ja kauppa alkavat nyt.`;
}

/**
 * A level's goal reached: the next level opens, once no card waits (STORY-087). Returns whether
 * it rose. One level a day at most: the next is looked at after the following day.
 */
export function riseCheck(): boolean {
  const p = play;
  // Not between the parts of a day worked out over frames: the day rises at its end, as all at
  // once (Utu's review of STORY-117); inside its last part it may
  if (!p || pending(p).length || (dayRunning() && !dayStepping)) return false;
  const reached = levelGoal(p.progress.openLevel);
  const opened = advance(p.progress, levelState());
  if (opened !== null && reached) {
    rise(opened, reached);
    return true;
  }
  return false;
}

/**
 * The cards an advisor answers itself, before they show: the Asuttaja takes the sites (STORY-050),
 * the Vartija answers a raid with a soldier, bought when it would come too late (STORY-049, STORY-108).
 */
export function advisorsAnswer() {
  const p = play;
  if (!p) return;
  for (let o = p.offers[0]; o; o = p.offers[0]) {
    if (p.provinceAdvisor !== 'settle') return;
    const settler = idleSettler();
    if (dispatch({ kind: 'site', accept: true }, 'province') && settler) view.sent(settler);
    advise(`kaupunkipaikka hyväksytty: ${nameOf(2, regions.tileTable()[o.tile]).name}`, 'province');
  }
  const band = p.raids.band;
  if (!band || !p.raidAlert || p.cityAdvisor !== 'defend') return;
  const c = p.cities.find(x => x.tile === band.city);
  const plan = c && raidPlan(c);
  dispatch({ kind: 'raid', choice: 'build' }, 'city');
  if (c && plan) {
    // Own rule: at half the treasury at most, as the Kasvattaja buys the calm
    const bought = !plan.inTime && plan.price > 0 && plan.price * 2 <= p.gold && c.build === plan.soldier && dispatch({ kind: 'buy', city: c.tile }, 'city');
    advise([cityRef(c.tile, c.name), bought ? ` osti sotilaan rosvoja vastaan (${plan.price} kultaa)` : ' rakentaa sotilaan rosvoja vastaan'], 'city');
  }
}

// ─── A game starts (STORY-095) ────────────────────
/** Gold at the start: Freeciv GAME_DEFAULT_GOLD (common/game.h); the civ1 ruleset's own setting is 0. */
const START_GOLD = 50;
/** Half the trade is gold at the start (own; Freeciv's player default is all science). */
const START_TAX = 50;

/** The kinds on every mapped tile, when a game starts or goes on. */
export function rescanKinds() {
  foundKinds.clear();
  for (let t = 0; t < TILE_COUNT; t++) {
    const k = mapState.isMapped(t) ? kindAt(t) : null;
    if (k) foundKinds.add(k);
  }
}

/**
 * A new game on its start city, or a saved one going on (STORY-095): the game's state, made of
 * the view's own (ui) and the game's. A new game of the new start stands its capital already.
 */
export function startGame<U extends object>(startCity: number, saved: SaveData | undefined, ui: U): GameState & U {
  resetGame(startCity);
  // The new start removes the old start's units below: their sight must not map the city area (STORY-017)
  const newStart = !saved && !classic && game?.capital !== undefined;
  // Characters get given names in a new game, from its seed (STORY-102); the old start keeps numbers
  const units = new Units(pointToTile(regions.centers[2][startCity]), newStart ? { ...world, reveal: () => {} } : world, saved?.units, classic ? null : game!.seed);
  const province = Math.floor(startCity / 7);
  const provinceTiles: number[] = [];
  for (let c = province * 7; c < province * 7 + 7; c++) provinceTiles.push(...cityTiles(regions, c));
  const state = Math.floor(startCity / 49);
  const stateTiles: number[] = [];
  for (let c = state * 49; c < state * 49 + 49; c++) stateTiles.push(...cityTiles(regions, c));
  const base: GameState = { units, province: provinceTiles, state: stateTiles, progress: startProgress(!classic), targetProvince: -1, bonuses: new Map(), found: 0, cities: [], offers: [], offered: [], lastOfferDay: -Infinity, pendingSite: null, improvements: new Improvements(), raids: new Raids(), war: new War(), rivals: RIVALS.slice(0, rivalStartStates.length).map((_, k) => new Rival(k)), raidAlert: false, gold: START_GOLD, research: classic ? new Research() : new Research({ known: [], target: null, bulbs: 0, kinds: [] }), tax: START_TAX, lux: 0, gov: 'despotism', anarchyUntil: -1, ties: RIVALS.slice(0, rivalStartStates.length).map(() => newTies()), townAdvisor: 'none', townLog: [], cityAdvisor: 'none', advisorLog: [], provinceAdvisor: 'none', provinceLog: [], stateAdvisor: 'none', stateLog: [], calmDays: 0, planetAdvisor: 'none', planetLog: [], targetState: -1, firsts: new Set(), commands: new CommandLog(), treaty: null, learned: [], over: false };
  const s: GameState & U = Object.assign(ui, base);
  play = s;
  rescanKinds();
  if (!saved) {
    // The new start (STORY-070): the capital stands already, and its first units come later
    if (newStart && game?.capital !== undefined) {
      // The settler who founded the capital is named in its chronicle (STORY-106)
      const founder = units.units.find(u => u.kind === 'settler')?.name ?? null;
      units.units.length = 0;
      foundAt(game.capital, founder);
      // A building first: the city's units come after it (Sami). The capital's buildings are
      // built of planks and stone from its stock, and the lumberjack's site starts (STORY-088)
      const capital = s.cities[0];
      capital.chain = newChain();
      capital.build = 'coinage';
      startSite(capital.chain, 'lumberjack');
    }
    return s;
  }
  // A saved game goes on where it was
  Object.assign(s, {
    progress: saved.progress, targetProvince: saved.targetProvince,
    bonuses: new Map(saved.bonuses), found: saved.found, cities: saved.cities,
    offers: saved.offers, offered: saved.offered, lastOfferDay: saved.lastOfferDay ?? -Infinity, pendingSite: saved.pendingSite,
    improvements: Improvements.from(saved.improvements), raids: new Raids(saved.raids), war: new War(saved.war), raidAlert: saved.raidAlert,
    // A save from before STORY-068 has no rivals: they start now
    ...(saved.rivals ? { rivals: saved.rivals.map(r => new Rival(r.id, r)) } : {}), gold: saved.gold,
    // The ties with them (STORY-076); a save from before meets them anew
    ...(saved.ties && saved.ties.length === (saved.rivals?.length ?? s.rivals.length) ? { ties: saved.ties } : saved.rivals ? { ties: saved.rivals.map(() => newTies()) } : {}),
    research: new Research(saved.research), tax: saved.tax, lux: saved.lux, gov: saved.gov, anarchyUntil: saved.anarchyUntil, revolutionTo: saved.revolutionTo, townAdvisor: saved.townAdvisor, townLog: [], cityAdvisor: saved.cityAdvisor, provinceAdvisor: saved.provinceAdvisor, stateAdvisor: saved.stateAdvisor, planetAdvisor: saved.planetAdvisor, targetState: saved.targetState, firsts: new Set(saved.firsts ?? []), calmDays: saved.calmDays ?? 0,
    commands: new CommandLog(saved.commands ?? []),
    // A proposal waiting when the game was saved waits again (STORY-095)
    treaty: saved.treaty && saved.treaty.rival < s.rivals.length ? { ...saved.treaty } : null,
    // A card waits for an advance known, once (Utu's review: a save is not trusted)
    learned: [...new Set(saved.learned ?? [])].filter(a => saved.research.known.includes(a)),
  });
  clock.day = saved.day;
  for (const c of s.cities) placeAll(c, ground);
  rescanKinds();
  // Finds waiting in a save from before STORY-052 open as ruins
  for (const d of saved.discoveries) openRuin(d.tile, d.finder);
  // A save's city-states are found at once, before a settler can come near one not yet found
  finishScans();
  shadowNatives();
  return s;
}

/** The rings of the city level around a city (STORY-069): the new start maps them first (STORY-017). */
export const CITY_LEVEL_RINGS = 3;

/** The game's part of the save (STORY-036): all but the wall clock, the clock's speed and the selected unit, which are the view's. A game that ended is not saved. */
export function saveState(): GameSave | null {
  // A save holds whole days (STORY-117)
  finishDay();
  return play?.over ? null : stateOf();
}

/** The game's part of a save, also of a game that ended (a run's last state). */
export type GameSave = Omit<SaveData, 'savedAt' | 'speed' | 'paused' | 'selected'>;
export function stateOf(): GameSave | null {
  const p = play;
  if (!p || !game) return null;
  const mapped: number[] = [];
  mapState.mapped.forEach((m, id) => { if (m) mapped.push(id); });
  return {
    version: SAVE_VERSION, seed: game.seed, startCity: game.startCity, day: clock.day, mapped,
    units: p.units.save(), progress: { ...p.progress }, targetProvince: p.targetProvince,
    discoveries: [],
    bonuses: [...p.bonuses].map(([t, y]) => [t, { ...y }] as [number, Yield]),
    found: p.found, cities: p.cities.map(c => ({ ...c, buildings: [...c.buildings] })), ties: p.ties.map(t => ({ ...t })), offers: p.offers.map(o => ({ ...o })), offered: [...p.offered],
    lastOfferDay: Number.isFinite(p.lastOfferDay) ? p.lastOfferDay : null, pendingSite: p.pendingSite,
    improvements: p.improvements.entries(), raids: p.raids.save(), war: p.war.save(), rivals: p.rivals.map(r => r.save()), raidAlert: p.raidAlert, gold: p.gold,
    research: p.research.save(), tax: p.tax, lux: p.lux, gov: p.gov, anarchyUntil: p.anarchyUntil, ...(p.revolutionTo ? { revolutionTo: p.revolutionTo } : {}), townAdvisor: p.townAdvisor, cityAdvisor: p.cityAdvisor, provinceAdvisor: p.provinceAdvisor, stateAdvisor: p.stateAdvisor, planetAdvisor: p.planetAdvisor, targetState: p.targetState, firsts: [...p.firsts],
    commands: p.commands.save(),
    ...(p.treaty ? { treaty: { ...p.treaty } } : {}),
    ...(p.learned.length ? { learned: [...p.learned] } : {}),
    calmDays: p.calmDays,
  };
}

/** The city-states and the tribes in play: found anew from the seed, not saved (for comparing runs). */
export const opponentsNow = () => ({
  natives: natives.filter(n => !nativeGone(n)).map(n => n.tile).sort((a, b) => a - b),
  tribes: tribesNow().map(t => t.camp).sort((a, b) => a - b),
});
