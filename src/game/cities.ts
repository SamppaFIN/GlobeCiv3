/**
 * cities.ts — cities: what they work, grow and build (STORY-028, design 8a).
 *
 * Civilization I's base rules, with the numbers from Freeciv (GPL, commit 75451811f4):
 *  - a citizen eats 2 food (common/game.h RS_DEFAULT_FOOD_COST; civ1 keeps the default)
 *  - the food box of a size-n city holds 20 + 10 × (n − 1) (data/civ1/game.ruleset
 *    granary_food_ini 20 and granary_food_inc 10, at the default foodbox of 100 %,
 *    common/game.h GAME_DEFAULT_FOODBOX)
 *  - Militia (here Soturi) costs 10 shields, Settlers 40 shields and one citizen
 *    (data/civ1/units.ruleset build_cost and pop_cost)
 *  - a city works its centre and one tile per citizen within init_city_radius_sq 5
 *    (data/civ1/game.ruleset); on the hex grid that is two rings, 19 tiles
 *  - the centre yields food as if irrigated (data/civ1/effects.ruleset
 *    effect_irrigation_center with terrain.ruleset irrigation_food_incr)
 *  - under Despotism, the starting government (data/civ1/nations.ruleset), a city pays
 *    1 shield for each unit it built beyond 3 free ones (units.ruleset uk_shield,
 *    effects.ruleset Unit_Upkeep_Free_Per_City) and 1 food for each settler (uk_food);
 *    a unit it cannot pay for is disbanded (cities.ruleset missing_unit_upkeep)
 * One turn is one game day. Own choices: citizens work the tiles with the most
 * 2 × food + shields + trade, and a starving city shrinks with an empty food box.
 */
import { tilesInRings } from './pathfinding';
import { tileYield, type Terrain, type TileInfo, type Yield } from './terrainTypes';

/** Extra food on a city centre: irrigation_food_incr of the terrains that can be irrigated. */
export const CENTRE_IRRIGATION: Partial<Record<Terrain, number>> = { desert: 1, grassland: 1, hills: 1, plains: 1 };

/** A worked tile's yield; the centre gets its irrigation. */
export function workedYield(info: TileInfo, centre: boolean): Yield {
  const y = tileYield(info);
  return centre ? { ...y, food: y.food + (CENTRE_IRRIGATION[info.terrain] ?? 0) } : y;
}

/** Units a city supports free of shield upkeep. */
export const FREE_UNITS = 3;

/** Units a city built and still supports, and how many of them are settlers. */
export interface Support { units: number; settlers: number }
const NO_SUPPORT: Support = { units: 0, settlers: 0 };

/** Food a citizen eats each day. */
export const FOOD_PER_CITIZEN = 2;
/** Rings of tiles a city may work around its centre. */
export const CITY_RINGS = 2;

/**
 * Buildings (STORY-038), Freeciv civ1 buildings.ruleset (commit 27a6a0c1): build_cost and
 * upkeep in gold a day. A granary keeps half of the new food box when the city grows
 * (effects.ruleset Growth_Food 50), walls give defenders +200 % (Defend_Bonus 200, and no
 * fortify bonus with walls), a marketplace +50 % gold (Output_Bonus 50). Own: no tech is
 * needed yet (Pottery, Masonry and Currency in Civ I).
 */
export const BUILDINGS = ['granary', 'walls', 'market'] as const;
export type Building = (typeof BUILDINGS)[number];
export const UPKEEP: Record<Building, number> = { granary: 1, walls: 2, market: 1 };
export const isBuilding = (b: Build): b is Building => (BUILDINGS as readonly string[]).includes(b);

export type Build = 'warrior' | 'settler' | Building;
export const BUILDS: Record<Build, { name: string; cost: number; pop: number }> = {
  warrior: { name: 'Soturi', cost: 10, pop: 0 },
  settler: { name: 'Uudisasukas', cost: 40, pop: 1 },
  granary: { name: 'Viljavarasto', cost: 60, pop: 0 },
  walls: { name: 'Muuri', cost: 120, pop: 0 },
  market: { name: 'Tori', cost: 80, pop: 0 },
};

/** Own city names (rule 4), given in order. */
export const CITY_NAMES = ['Aamuranta', 'Kivisalmi', 'Tuulikallio', 'Hopealahti', 'Karhuniemi', 'Sammalvuori', 'Kaislakorpi', 'Routajärvi'];

export interface City {
  id: number;
  name: string;
  tile: number;
  /** The first city is the capital (design 8a: "Pääkaupunki"). */
  capital: boolean;
  size: number;
  /** Food and shields in store. */
  food: number;
  shields: number;
  build: Build;
  /** Buildings in the city (STORY-038). */
  buildings: Building[];
}

export function foundCity(cities: City[], tile: number): City {
  const city: City = {
    id: cities.length, name: CITY_NAMES[cities.length % CITY_NAMES.length], tile,
    capital: cities.length === 0, size: 1, food: 0, shields: 0, build: 'warrior', buildings: [],
  };
  cities.push(city);
  return city;
}

/** A tile's yield for a city; `centre` for the city's own tile. */
export type YieldOf = (id: number, centre: boolean) => Yield;

/** Food box of a city of this size. */
export const granary = (size: number) => 20 + 10 * (size - 1);

/**
 * The centre and the best `size` tiles around it that no other city works, by
 * 2 × food + shields + trade.
 */
export function workedTiles(city: City, yieldOf: YieldOf, taken: ReadonlySet<number> = new Set()): number[] {
  const score = (y: Yield) => 2 * y.food + y.shield + y.trade;
  const around = tilesInRings(city.tile, CITY_RINGS)
    .filter(id => id !== city.tile && !taken.has(id))
    .map(id => [score(yieldOf(id, false)), id] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .map(([, id]) => id);
  return [city.tile, ...around.slice(0, city.size)];
}

export interface CityYield extends Yield {
  /** Food left after the citizens and the settlers it supports have eaten. */
  surplus: number;
}

/** Food, shields left after unit upkeep, trade, and the food surplus. */
export function cityYield(city: City, yieldOf: YieldOf, taken?: ReadonlySet<number>, support: Support = NO_SUPPORT): CityYield {
  const y = { food: 0, shield: 0, trade: 0 };
  for (const id of workedTiles(city, yieldOf, taken)) {
    const t = yieldOf(id, id === city.tile);
    y.food += t.food;
    y.shield += t.shield;
    y.trade += t.trade;
  }
  return {
    food: y.food,
    shield: y.shield - Math.max(0, support.units - FREE_UNITS),
    trade: y.trade,
    surplus: y.food - FOOD_PER_CITIZEN * city.size - support.settlers,
  };
}

/**
 * Upkeep the city cannot pay today: 'shield' when its units cost more shields than it
 * makes, 'food' when its food would run out while it feeds a settler. Freeciv disbands
 * a unit then, before the city starves.
 */
export function shortfall(city: City, y: CityYield, support: Support): 'shield' | 'food' | null {
  if (y.shield < 0) return 'shield';
  if (support.settlers > 0 && city.food + y.surplus < 0) return 'food';
  return null;
}

/** One day: the city grows or starves and builds. Returns what was completed, if anything. */
export function cityDay(city: City, y: CityYield): Build | null {
  city.food += y.surplus;
  if (city.food >= granary(city.size)) {
    // Freeciv (server/cityturn.c city_increase_size, commit ed7a0f77): the food over the box
    // carries over, a granary keeps half of the new box, and the store never grows
    const stock = city.food;
    const over = stock - granary(city.size);
    city.size++;
    city.food = Math.min(stock, over + (city.buildings.includes('granary') ? Math.floor(granary(city.size) / 2) : 0));
  } else if (city.food < 0) {
    if (city.size > 1) city.size--;
    city.food = 0;
  }
  const build = BUILDS[city.build];
  city.shields += y.shield;
  // A build that costs a citizen waits until the city can spare one
  if (city.shields < build.cost || city.size <= build.pop) return null;
  city.shields -= build.cost;
  city.size -= build.pop;
  const done = city.build;
  // Own rule (STORY-033): after a soldier the city goes on to settlers. In Freeciv the build
  // repeats, and a city left alone built soldiers until their upkeep took all its shields.
  // A building is there once, and the city goes on to settlers after it too.
  if (isBuilding(done) && !city.buildings.includes(done)) city.buildings.push(done);
  if (done === 'warrior' || isBuilding(done)) city.build = 'settler';
  return done;
}

/**
 * Gold a city brings a day: its trade, +50 % with a marketplace. Own simplification: all
 * trade is gold while there is no science (Freeciv civ1 caps the tax rate at 60 % under
 * Despotism).
 */
export const cityGold = (city: City, y: Yield) => Math.floor(y.trade * (city.buildings.includes('market') ? 1.5 : 1));

/**
 * Pay a city's building upkeep from the treasury. When it would fall below zero, buildings
 * are sold for their cost until it does not (Freeciv gold_upkeep_style "City" and
 * impr_sell_gold; own: the dearest upkeep first, not at random).
 */
export function payUpkeep(city: City, treasury: number): { treasury: number; sold: Building[] } {
  treasury -= city.buildings.reduce((sum, b) => sum + UPKEEP[b], 0);
  const sold: Building[] = [];
  while (treasury < 0 && city.buildings.length) {
    const dearest = city.buildings.reduce((a, b) => (UPKEEP[b] > UPKEEP[a] ? b : a));
    city.buildings.splice(city.buildings.indexOf(dearest), 1);
    treasury += BUILDS[dearest].cost;
    sold.push(dearest);
  }
  return { treasury, sold };
}

/**
 * Gold to buy the rest of the build (Freeciv common/improvement.c impr_buy_gold_cost and
 * common/unittype.c utype_buy_gold_cost, commit eecd32c8): 2 a missing shield for a
 * building, 2 a shield + missing² / 20 for a unit, twice that with nothing in store.
 */
export function buyCost(city: City): number {
  const missing = BUILDS[city.build].cost - city.shields;
  if (missing <= 0) return 0;
  const cost = 2 * missing + (isBuilding(city.build) ? 0 : Math.floor((missing * missing) / 20));
  return city.shields === 0 ? 2 * cost : cost;
}

/** Buy the rest of the build: the shields are in store and it is done the next day. The price paid, or null. */
export function buy(city: City, treasury: number): number | null {
  const price = buyCost(city);
  if (price === 0 || price > treasury) return null;
  city.shields = BUILDS[city.build].cost;
  return price;
}

/** Days until the city grows, or null if it does not. */
export function daysToGrow(city: City, y: CityYield): number | null {
  return y.surplus > 0 ? Math.max(1, Math.ceil((granary(city.size) - city.food) / y.surplus)) : null;
}

/** Days until the build is ready (0: ready, waiting for a citizen to spare), or null without shields. */
export function daysToBuild(city: City, y: CityYield): number | null {
  const left = BUILDS[city.build].cost - city.shields;
  if (left <= 0) return 0;
  return y.shield > 0 ? Math.ceil(left / y.shield) : null;
}
