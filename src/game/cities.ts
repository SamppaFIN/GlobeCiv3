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

export type Build = 'warrior' | 'settler';
export const BUILDS: Record<Build, { name: string; cost: number; pop: number }> = {
  warrior: { name: 'Soturi', cost: 10, pop: 0 },
  settler: { name: 'Uudisasukas', cost: 40, pop: 1 },
};
const BUILD_ORDER = Object.keys(BUILDS) as Build[];

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
}

export function foundCity(cities: City[], tile: number): City {
  const city: City = {
    id: cities.length, name: CITY_NAMES[cities.length % CITY_NAMES.length], tile,
    capital: cities.length === 0, size: 1, food: 0, shields: 0, build: 'warrior',
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
    city.size++;
    city.food = 0;
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
  return city.build;
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

/** "Vaihda": the next build; shields in store are kept (both are units, so Freeciv has no change penalty). */
export function nextBuild(city: City): void {
  city.build = BUILD_ORDER[(BUILD_ORDER.indexOf(city.build) + 1) % BUILD_ORDER.length];
}
