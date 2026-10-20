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
import { GOVERNMENTS, governed, type Government } from './government';
import { isAttacker, type Attacker } from './war';
import { improvementYield } from './improvements';
import { splitTrade } from './science';
import { tilesInRings } from './pathfinding';
import { tileYield, type Terrain, type TileInfo, type Yield } from './terrainTypes';

/** Extra food on a city centre: irrigation_food_incr of the terrains that can be irrigated. */
export const CENTRE_IRRIGATION: Partial<Record<Terrain, number>> = { desert: 1, grassland: 1, hills: 1, plains: 1 };

/**
 * A worked tile's yield; the centre gets its irrigation, and its road: Freeciv civ1 has a
 * road on every city centre (terrain.ruleset extra Road, flag AlwaysOnCityCenter, commit
 * 63c099a4), +1 trade on desert, grassland and plains (STORY-040).
 */
export function workedYield(info: TileInfo, centre: boolean): Yield {
  const y = tileYield(info);
  return centre ? { ...y, food: y.food + (CENTRE_IRRIGATION[info.terrain] ?? 0), trade: y.trade + improvementYield('road', info.terrain).trade } : y;
}

/** Units a city built and still supports, and how many of them are settlers. */
export interface Support { units: number; settlers: number }
const NO_SUPPORT: Support = { units: 0, settlers: 0 };

/** Food a citizen eats each day. */
export const FOOD_PER_CITIZEN = 2;
/** Rings a site is judged by, and mapped when a city is founded there. */
export const CITY_RINGS = 2;

/**
 * Rings of tiles a city may work (STORY-039, own rule so that the area grows with the city):
 * one at size 1, two at 2 to 4, three from size 5. Civ I has a fixed area of 21 tiles.
 */
export const cityRings = (size: number) => (size <= 1 ? 1 : size <= 4 ? 2 : 3);

/** What a city's citizens work for: food, a balance, or production (STORY-039). */
export type Focus = 'food' | 'balanced' | 'production';
export const FOCUS_NAMES: Record<Focus, string> = { food: 'Ruoka', balanced: 'Tasapaino', production: 'Tuotanto' };
/** How a tile is valued for each focus (own weights). */
const FOCUS_SCORE: Record<Focus, (y: Yield) => number> = {
  food: y => 4 * y.food + y.shield + y.trade,
  balanced: y => 2 * y.food + y.shield + y.trade,
  production: y => y.food + 3 * y.shield + y.trade,
};

/**
 * Buildings (STORY-038), Freeciv civ1 buildings.ruleset (commit 27a6a0c1): build_cost and
 * upkeep in gold a day. A granary keeps half of the new food box when the city grows
 * (effects.ruleset Growth_Food 50), walls give defenders +200 % (Defend_Bonus 200, and no
 * fortify bonus with walls), a marketplace +50 % gold (Output_Bonus 50), a library +50 %
 * science (STORY-040). Each needs an advance (science.ts NEEDS).
 */
export const BUILDINGS = ['granary', 'walls', 'market', 'library', 'temple', 'aqueduct', 'colosseum', 'colossus', 'gardens', 'greatwall', 'fishery', 'sawmill', 'quarry', 'field'] as const;
/**
 * The terrain buildings (STORY-070; Sami 2026-10-20, own rules): a city builds them from the
 * start where its two rings hold their terrain, each 30 shields, no upkeep, +1 food or shield
 * a day. The first building of the game opens the units.
 */
export const TERRAIN_BUILDINGS = { fishery: ['ocean'], sawmill: ['forest', 'jungle'], quarry: ['hills', 'mountains'], field: ['grassland', 'plains'] } as const satisfies Record<string, readonly Terrain[]>;
export type TerrainBuilding = keyof typeof TERRAIN_BUILDINGS;
export const isTerrainBuilding = (b: Build): b is TerrainBuilding => b in TERRAIN_BUILDINGS;
/**
 * Wonders (STORY-045), Freeciv civ1 buildings.ruleset and effects.ruleset: once in the game,
 * no upkeep. Kolossi (Colossus, 200, Bronze Working): +1 trade on each tile the city works
 * that has trade (Output_Inc_Tile); Riippuvat puutarhat (Hanging Gardens, 300, Pottery): a
 * happy citizen in every city (Make_Happy 1, player range); Suuri muuri (Great Wall, 300,
 * Masonry): walls in every city (Defend_Bonus 200 at every city centre).
 */
export const WONDERS = ['colossus', 'gardens', 'greatwall'] as const;
export const isWonder = (b: Build): boolean => (WONDERS as readonly string[]).includes(b);
export type Building = (typeof BUILDINGS)[number];
export const UPKEEP: Record<Building, number> = { granary: 1, walls: 2, market: 1, library: 1, temple: 1, aqueduct: 2, colosseum: 4, colossus: 0, gardens: 0, greatwall: 0, fishery: 0, sawmill: 0, quarry: 0, field: 0 };
export const isBuilding = (b: Build): b is Building => (BUILDINGS as readonly string[]).includes(b);

/**
 * Kultaa: the shields become gold each day and nothing is built (Freeciv classic Coinage,
 * genus Convert, data/classic/buildings.ruleset commit 27a6a0c1; Civ I has none). After a
 * soldier or a building the city goes on to it (STORY-039).
 */
export type Build = 'warrior' | 'phalanx' | 'settler' | 'scout' | Attacker | Building | 'coinage';
/** Soldiers defend their city; a phalanx twice as well (STORY-043). */
export const isSoldier = (b: Build): b is 'warrior' | 'phalanx' => b === 'warrior' || b === 'phalanx';
export const BUILDS: Record<Build, { name: string; cost: number; pop: number }> = {
  warrior: { name: 'Soturi', cost: 10, pop: 0 },
  // Freeciv civ1 units.ruleset Phalanx: build_cost 20, attack 1, defense 2 (Bronze Working)
  phalanx: { name: 'Falangi', cost: 20, pop: 0 },
  // Freeciv civ1 units.ruleset (STORY-064): Cavalry 20, Legion 20, Chariot 40, Catapult 40 (war.ts)
  horseman: { name: 'Ratsumies', cost: 20, pop: 0 },
  swordsman: { name: 'Miekkamies', cost: 20, pop: 0 },
  chariot: { name: 'Sotavaunut', cost: 40, pop: 0 },
  catapult: { name: 'Katapultti', cost: 40, pop: 0 },
  settler: { name: 'Uudisasukas', cost: 40, pop: 1 },
  // Own (STORY-070): Freeciv civ1 has no explorer
  scout: { name: 'Tiedustelija', cost: 20, pop: 0 },
  granary: { name: 'Viljavarasto', cost: 60, pop: 0 },
  walls: { name: 'Muuri', cost: 120, pop: 0 },
  market: { name: 'Tori', cost: 80, pop: 0 },
  library: { name: 'Kirjasto', cost: 80, pop: 0 },
  // Freeciv civ1 buildings.ruleset Temple: build_cost 40, upkeep 1 (STORY-044)
  temple: { name: 'Temppeli', cost: 40, pop: 0 },
  // Freeciv civ1 buildings.ruleset (STORY-054): Aqueduct 120 and upkeep 2, Colosseum 100 and
  // upkeep 4, both with Construction
  aqueduct: { name: 'Vesijohto', cost: 120, pop: 0 },
  colosseum: { name: 'Areena', cost: 100, pop: 0 },
  colossus: { name: 'Kolossi', cost: 200, pop: 0 },
  gardens: { name: 'Riippuvat puutarhat', cost: 300, pop: 0 },
  greatwall: { name: 'Suuri muuri', cost: 300, pop: 0 },
  coinage: { name: 'Kultaa', cost: 0, pop: 0 },
  fishery: { name: 'Kalastamo', cost: 30, pop: 0 },
  sawmill: { name: 'Saha', cost: 30, pop: 0 },
  quarry: { name: 'Louhos', cost: 30, pop: 0 },
  field: { name: 'Pelto', cost: 30, pop: 0 },
};

/**
 * The size a city cannot grow past without an aqueduct (STORY-054; Freeciv civ1
 * effects.ruleset Size_Adj 10, and Size_Unlimit with an Aqueduct).
 */
export const SIZE_LIMIT = 10;
export const sizeLimit = (city: City) => (city.buildings.includes('aqueduct') ? Infinity : SIZE_LIMIT);

/** Own city names (rule 4), given in order. */
export const CITY_NAMES = [
  'Aamuranta', 'Kivisalmi', 'Tuulikallio', 'Hopealahti', 'Karhuniemi', 'Sammalvuori', 'Kaislakorpi', 'Routajärvi',
  // More own names (STORY-060: a long game ran out of the eight and repeated them)
  'Koivuranta', 'Lumivaara', 'Peltoniemi', 'Kuusisalo', 'Hiekkalahti', 'Tähtiniemi', 'Ruskovaara', 'Myllysalmi',
  'Kalliokoski', 'Suvantola', 'Pajulahti', 'Vuorenrinne', 'Lehtokorpi', 'Kanervala', 'Jäkälänummi', 'Ahvenlampi',
];

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
  /** What the citizens work for (STORY-039). */
  focus: Focus;
  /**
   * Citizens off the tiles as entertainers, 2 luxury each (STORY-061; Freeciv civ1
   * cities.ruleset specialist elvis, effects.ruleset Specialist_Output 2). Chosen each day.
   */
  entertainers?: number;
  /** A city-state taken (STORY-064): its land was the city-state's, not one of the player's sites. */
  native?: boolean;
}

export function foundCity(cities: City[], tile: number): City {
  const city: City = {
    // After the list, the names come round again with a number: "Aamuranta 2"
    id: cities.length, name: CITY_NAMES[cities.length % CITY_NAMES.length] + (cities.length >= CITY_NAMES.length ? ` ${Math.floor(cities.length / CITY_NAMES.length) + 1}` : ''), tile,
    capital: cities.length === 0, size: 1, food: 0, shields: 0, build: 'warrior', buildings: [], focus: 'balanced',
  };
  cities.push(city);
  return city;
}

/** A tile's yield for a city; `centre` for the city's own tile. */
export type YieldOf = (id: number, centre: boolean) => Yield;

/** Food box of a city of this size. */
export const granary = (size: number) => 20 + 10 * (size - 1);

/**
 * The centre and the best `size` tiles in the city's area that no other city works, by
 * the city's focus (balanced: 2 × food + shields + trade).
 */
export function workedTiles(city: City, yieldOf: YieldOf, taken: ReadonlySet<number> = new Set()): number[] {
  // Entertainers work no tile (STORY-061)
  const workers = city.size - (city.entertainers ?? 0);
  const score = FOCUS_SCORE[city.focus ?? 'balanced'];
  const around = tilesInRings(city.tile, cityRings(city.size))
    .filter(id => id !== city.tile && !taken.has(id))
    .map(id => [score(yieldOf(id, false)), id] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .map(([, id]) => id);
  return [city.tile, ...around.slice(0, workers)];
}

export interface CityYield extends Yield {
  /** Food left after the citizens and the settlers it supports have eaten. */
  surplus: number;
  /** In civil disorder (STORY-044): no surplus food or shields, no gold or science. */
  disorder?: boolean;
}

/**
 * Citizens content under Despotism before anything calms them (Freeciv civ1
 * effects.ruleset City_Unhappy_Size 4, Empire_Size_Base 10 and Empire_Size_Step 10;
 * common/city.c player_base_citizen_happiness, commit fc8f694f): one fewer from the 11th
 * city on, and one fewer again each 10 cities more.
 */
export function baseContent(cities: number, gov: Government = 'despotism'): number {
  // The base is per government (STORY-047): 9, 10 or 11 cities
  const base = GOVERNMENTS[gov].empireBase;
  const fewer = cities > base ? 1 + Math.floor((cities - base - 1) / 10) : 0;
  return Math.max(0, 4 - fewer);
}

export interface Mood {
  /** Happy citizens (Riippuvat puutarhat, STORY-045). */
  happy: number;
  content: number;
  unhappy: number;
  /** Citizens a temple and the soldiers calmed. */
  calmed: number;
  disorder: boolean;
}

/**
 * A city's mood: citizens over the content base are unhappy; a temple calms one
 * (Make_Content 1) and each soldier in the city one (Despotism: Martial_Law_Each 1). With no
 * luxury yet no citizen is happy, so any unhappy citizen left means civil disorder
 * (common/city.c city_unhappy: happy < unhappy).
 */
export function cityMood(city: City, soldiers: number, cities: number, gardens = false, luxury = 0, gov: Government = 'despotism'): Mood {
  // Entertainers come out of the content ones and are never unhappy (common/city.c citizen_base_mood)
  const spes = city.entertainers ?? 0;
  let content = Math.max(0, Math.min(city.size, baseContent(cities, gov)) - spes);
  let unhappy = city.size - spes - content;
  let happy = 0;
  // Luxury first (STORY-046, common/city.c citizen_luxury_happy, happy_cost 2): content to
  // happy for 2, unhappy to happy for 4, then unhappy to content for 2
  let lux = luxury;
  for (; lux >= 2 && content > 0; lux -= 2) { content--; happy++; }
  for (; lux >= 4 && unhappy > 0; lux -= 4) { unhappy--; happy++; }
  if (lux >= 2 && unhappy > 0) { unhappy--; content++; }
  // Then the temple and the soldiers, then the gardens make a content citizen happy
  // An arena calms three (STORY-054, Freeciv civ1 effects.ruleset Colosseum Make_Content 3)
  const buildings = (city.buildings.includes('temple') ? 1 : 0) + (city.buildings.includes('colosseum') ? 3 : 0);
  const calmed = Math.min(unhappy, buildings + Math.min(soldiers, GOVERNMENTS[gov].martialLaw));
  unhappy -= calmed;
  content += calmed;
  if (gardens && content > 0) { content--; happy++; }
  return { happy, content, unhappy, calmed, disorder: unhappy > happy };
}

/** Luxury a city makes: its share of trade, +50 % with a marketplace (effects.ruleset). */
export const cityLuxury = (city: City, y: Yield & { disorder?: boolean }, tax: number, lux: number) =>
  Math.floor((splitTrade(y.trade, tax, lux).luxury + 2 * (city.entertainers ?? 0)) * (city.buildings.includes('market') ? 1.5 : 1));

/**
 * A city's yield in disorder (common/city.c, output_types: food and shields lose their
 * surplus, gold and science all of it; trade stays).
 */
export function withMood(y: CityYield, mood: Mood): CityYield {
  return mood.disorder ? { ...y, surplus: Math.min(y.surplus, 0), shield: Math.min(y.shield, 0), disorder: true } : y;
}

/** What a worked tile gives the city: Kolossi adds a trade where there is trade, then the government's penalty. */
export function tileOutput(city: City, t: Yield, gov: Government = 'despotism'): Yield {
  const colossus = city.buildings.includes('colossus');
  return governed({ ...t, trade: t.trade + (colossus && t.trade > 0 ? 1 : 0) }, gov);
}

/** Food, shields left after unit upkeep, trade, and the food surplus. */
export function cityYield(city: City, yieldOf: YieldOf, taken?: ReadonlySet<number>, support: Support = NO_SUPPORT, gov: Government = 'despotism'): CityYield {
  const y = { food: 0, shield: 0, trade: 0 };
  for (const id of workedTiles(city, yieldOf, taken)) {
    const t = tileOutput(city, yieldOf(id, id === city.tile), gov);
    y.food += t.food;
    y.shield += t.shield;
    y.trade += t.trade;
  }
  // The terrain buildings' +1 a day (STORY-070)
  const has = (b: Building) => (city.buildings.includes(b) ? 1 : 0);
  y.food += has('fishery') + has('field');
  y.shield += has('sawmill') + has('quarry');
  return {
    food: y.food,
    shield: y.shield - Math.max(0, support.units - GOVERNMENTS[gov].freeUnits),
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
  if (city.food >= granary(city.size) && city.size >= sizeLimit(city)) {
    // At the limit the box holds no more (server/cityturn.c city_increase_size, aqueductloss 0)
    city.food = granary(city.size);
  } else if (city.food >= granary(city.size)) {
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
  if (city.build === 'coinage') return null;
  const build = BUILDS[city.build];
  city.shields += y.shield;
  // A build that costs a citizen waits until the city can spare one
  if (city.shields < build.cost || city.size <= build.pop) return null;
  city.shields -= build.cost;
  city.size -= build.pop;
  const done = city.build;
  // Own rule: after a soldier the city goes on to gold (STORY-039). In Freeciv the build
  // repeats, and a city left alone built soldiers until their upkeep took all its shields;
  // settlers next (STORY-033) took a citizen at each growth and ate the city's food.
  // A building is there once, and the city goes on to gold after it too.
  if (isBuilding(done) && !city.buildings.includes(done)) city.buildings.push(done);
  if (isSoldier(done) || isAttacker(done) || done === 'scout' || isBuilding(done)) city.build = 'coinage';
  return done;
}

/**
 * Gold a city brings a day: the tax rate's share of its trade, +50 % with a marketplace,
 * and its shields while it makes gold (Kultaa).
 */
export const cityGold = (city: City, y: Yield & { disorder?: boolean }, tax = 100, lux = 0) => y.disorder ? 0 :
  Math.floor(splitTrade(y.trade, tax, lux).gold * (city.buildings.includes('market') ? 1.5 : 1)) + (city.build === 'coinage' ? Math.max(0, y.shield) : 0);

/** Science a city brings a day: the rest of its trade, +50 % with a library (STORY-040). */
export const cityScience = (city: City, y: Yield & { disorder?: boolean }, tax: number, lux = 0) => y.disorder ? 0 :
  Math.floor(splitTrade(y.trade, tax, lux).science * (city.buildings.includes('library') ? 1.5 : 1));

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
  if (city.build === 'coinage') return 0;
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
  return y.surplus > 0 && city.size < sizeLimit(city) ? Math.max(1, Math.ceil((granary(city.size) - city.food) / y.surplus)) : null;
}

/** Days until the build is ready (0: ready, waiting for a citizen to spare), or null without shields. */
export function daysToBuild(city: City, y: CityYield): number | null {
  if (city.build === 'coinage') return null;
  const left = BUILDS[city.build].cost - city.shields;
  if (left <= 0) return 0;
  return y.shield > 0 ? Math.ceil(left / y.shield) : null;
}
