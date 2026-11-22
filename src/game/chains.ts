/**
 * chains.ts — the city level's production chains (STORY-088, docs/design/tuotantoketjut.md).
 *
 * A city of a new game keeps a stock of goods at its centre. Its chain buildings make goods
 * and turn one good into another: the lumberjack fells logs and the sawmill saws them into
 * planks, the quarry cuts stone, the field grows wheat, the mill grinds it into flour and the
 * bakery bakes bread, and the fishery catches fish. The city level's buildings are built of
 * planks and stone, carried to the site, and bread and fish feed the people.
 *
 * From Freeserf (GPL-3.0, github.com/freeserf/freeserf, commit f537310): the chains (log to
 * plank, wheat to flour to bread), each building's planks and stone (src/building.cc,
 * const_info) and the starting stock (src/inventory.cc, supplies_template[0]: 7 planks and
 * 2 stones). Own: the days each good takes, the days a site takes once its materials are
 * there, and that bread and fish feed the city's growth (in Freeserf food goes to the mines).
 *
 * Everything here happens in the day's reckoning; the carriers on the map only show the
 * moves the day returns (rule 7: the frame rate never changes the game).
 */

export const GOODS = ['log', 'plank', 'stone', 'wheat', 'flour', 'bread', 'fish'] as const;
export type Good = (typeof GOODS)[number];
export type Stock = Partial<Record<Good, number>>;
export const GOOD_NAMES: Record<Good, string> = { log: 'Tukit', plank: 'Lankut', stone: 'Kivi', wheat: 'Vilja', flour: 'Jauhot', bread: 'Leipä', fish: 'Kala' };

export const CHAIN_BUILDINGS = ['lumberjack', 'sawmill', 'quarry', 'field', 'mill', 'bakery', 'fishery'] as const;
export type ChainBuilding = (typeof CHAIN_BUILDINGS)[number];
export const isChainBuilding = (b: string): b is ChainBuilding => (CHAIN_BUILDINGS as readonly string[]).includes(b);
/** The chain buildings only a city of chains has; the other four are the old terrain buildings too. */
export const CHAIN_ONLY: readonly ChainBuilding[] = ['lumberjack', 'mill', 'bakery'];

export interface ChainRule {
  /** The good it takes from the stock, if any. */
  input?: Good;
  output: Good;
  /** Its materials (Freeserf const_info). */
  planks: number;
  stones: number;
}

/** Freeserf src/building.cc const_info: lumberjack 2/0, sawmill 3/2, stonecutter 2/0, farm 4/1, mill 3/1, baker 2/1, fisher 2/0. */
export const CHAIN_RULES: Record<ChainBuilding, ChainRule> = {
  lumberjack: { output: 'log', planks: 2, stones: 0 },
  sawmill: { input: 'log', output: 'plank', planks: 3, stones: 2 },
  quarry: { output: 'stone', planks: 2, stones: 0 },
  field: { output: 'wheat', planks: 4, stones: 1 },
  mill: { input: 'wheat', output: 'flour', planks: 3, stones: 1 },
  bakery: { input: 'flour', output: 'bread', planks: 2, stones: 1 },
  fishery: { output: 'fish', planks: 2, stones: 0 },
};

/** Freeserf src/inventory.cc supplies_template[0]: the smallest starting stock. */
export const START_STOCK: Readonly<Stock> = { plank: 7, stone: 2 };
/** Own: days a good takes; on its best ground (STORY-071) one. */
export const MAKE_DAYS = 2;
/** Own: days a site takes once its materials are there. */
export const BUILD_DAYS = 2;
/** Own: food a meal of bread or fish puts in the food box (a citizen's day). */
export const MEAL_FOOD = 2;

/** A building under way: its materials carried so far and its days of work. */
export interface Site {
  building: ChainBuilding;
  planks: number;
  stones: number;
  days: number;
}

export interface ChainState {
  stock: Stock;
  /** Days each building has worked on its next good. */
  work: Partial<Record<ChainBuilding, number>>;
  site: Site | null;
}

/** A good moved today, for the carriers: from a building or the centre to another or the site. */
export interface Move {
  good: Good;
  from: ChainBuilding | 'centre';
  to: ChainBuilding | 'centre' | 'site';
}

export const newChain = (): ChainState => ({ stock: { ...START_STOCK }, work: {}, site: null });
export const has = (s: ChainState, g: Good) => s.stock[g] ?? 0;
const add = (s: ChainState, g: Good, n: number) => { s.stock[g] = has(s, g) + n; };

/**
 * The base buildings come first (own, Utu's review of STORY-088): the starting stock builds the
 * lumberjack, the sawmill and the quarry in any order and nothing more, so the others open only
 * once all three stand. A field first would leave too few planks for the sawmill, for good.
 */
export const BASE: readonly ChainBuilding[] = ['lumberjack', 'sawmill', 'quarry'];
/** The chains of food: bread from the field through the mill and the bakery, or fish. */
export const FOOD_CHAINS: readonly (readonly ChainBuilding[])[] = [['field', 'mill', 'bakery'], ['fishery']];
/** The citizens of a ready settlement (own). */
export const SETTLEMENT_SIZE = 3;
/**
 * A ready settlement (STORY-089; Sami 2026-11-22, own rule): the base, a chain of food and three
 * citizens. Its steps, each done or not; all three make the city level's goal.
 */
export function settlementSteps(built: readonly string[], size: number): { base: boolean; food: boolean; size: boolean } {
  return {
    base: BASE.every(b => built.includes(b)),
    food: FOOD_CHAINS.some(chain => chain.every(b => built.includes(b))),
    size: size >= SETTLEMENT_SIZE,
  };
}
export const settlementDone = (built: readonly string[], size: number) => Object.values(settlementSteps(built, size)).every(Boolean);

/**
 * The buildings a city founded in the city area starts with (STORY-091; Sami 2026-11-22, own):
 * the base and the first chain of food whose every building has ground near it, bread before
 * fish. A building with no ground near the city is left out, so such a city is not ready.
 */
export function settlementStart(fits: (b: ChainBuilding) => boolean): ChainBuilding[] {
  const food = FOOD_CHAINS.find(chain => chain.every(fits)) ?? [];
  return [...BASE, ...food].filter(fits);
}

/** Whether a chain building may be started: not built, no other site under way, the base first. */
export const chainOpen = (s: ChainState, built: readonly string[], b: ChainBuilding) =>
  !built.includes(b) && (s.site === null || s.site.building === b) && (BASE.includes(b) || BASE.every(x => built.includes(x)));
/** Whether a chain building waits for the base. */
export const waitsForBase = (built: readonly string[], b: ChainBuilding) => !BASE.includes(b) && !BASE.every(x => built.includes(x));

/**
 * One day of the chains: each building that has what it takes works a day, and a good done
 * goes to the stock (taken from it first, if it takes one). `best` are the buildings on their
 * best ground, a good a day. The buildings work in CHAIN_BUILDINGS' order, so a log felled
 * today may be sawn today. Returns the moves for the carriers (STORY-101).
 */
export function workDay(s: ChainState, built: readonly ChainBuilding[], best: readonly ChainBuilding[], bread = 0): Move[] {
  const moves: Move[] = [];
  // The city level's advisor may bring bread of its own (STORY-107, own)
  if (bread > 0) add(s, 'bread', bread);
  for (const b of CHAIN_BUILDINGS) {
    if (!built.includes(b)) continue;
    const rule = CHAIN_RULES[b];
    if (rule.input && has(s, rule.input) < 1 && !s.work[b]) continue;
    // The input is taken when the work begins
    if (rule.input && !s.work[b]) {
      add(s, rule.input, -1);
      moves.push({ good: rule.input, from: 'centre', to: b });
    }
    s.work[b] = (s.work[b] ?? 0) + 1;
    if (s.work[b]! < (best.includes(b) ? 1 : MAKE_DAYS)) continue;
    s.work[b] = 0;
    add(s, rule.output, 1);
    moves.push({ good: rule.output, from: b, to: 'centre' });
  }
  return moves;
}

/**
 * One day on the site: the stock's planks and stone go to it until it has its materials, and
 * then the builders work. Returns the building when it is done, and the moves.
 */
export function buildDay(s: ChainState): { done: ChainBuilding | null; moves: Move[] } {
  const site = s.site;
  if (!site) return { done: null, moves: [] };
  const rule = CHAIN_RULES[site.building];
  const moves: Move[] = [];
  // One carrier a good a day, as many as there are to carry (own)
  const planks = Math.min(rule.planks - site.planks, has(s, 'plank'));
  const stones = Math.min(rule.stones - site.stones, has(s, 'stone'));
  add(s, 'plank', -planks);
  add(s, 'stone', -stones);
  site.planks += planks;
  site.stones += stones;
  for (let k = 0; k < planks; k++) moves.push({ good: 'plank', from: 'centre', to: 'site' });
  for (let k = 0; k < stones; k++) moves.push({ good: 'stone', from: 'centre', to: 'site' });
  if (site.planks < rule.planks || site.stones < rule.stones) return { done: null, moves };
  site.days++;
  if (site.days < BUILD_DAYS) return { done: null, moves };
  s.site = null;
  return { done: site.building, moves };
}

/** Start a site, unless one is under way already. */
export function startSite(s: ChainState, b: ChainBuilding): boolean {
  if (s.site) return s.site.building === b;
  s.site = { building: b, planks: 0, stones: 0, days: 0 };
  return true;
}

/** Meals the people eat today: one of bread or fish for each citizen at most. */
export const mealsReady = (s: ChainState, citizens: number) => Math.min(has(s, 'bread') + has(s, 'fish'), citizens);

/**
 * The people eat today's meals, bread first. Their food is in the city's yield already
 * (cities.ts cityYield), so that its surplus and days to grow show it. Returns the meals.
 */
export function eat(s: ChainState, citizens: number): number {
  let meals = 0;
  for (const g of ['bread', 'fish'] as const) {
    const n = Math.min(has(s, g), citizens - meals);
    add(s, g, -n);
    meals += n;
  }
  return meals;
}

/** Planks and stone the site still lacks beyond what is in the stock. */
export const siteMissing = (s: ChainState) => {
  const site = s.site;
  if (!site) return null;
  const rule = CHAIN_RULES[site.building];
  return { planks: Math.max(0, rule.planks - site.planks - has(s, 'plank')), stones: Math.max(0, rule.stones - site.stones - has(s, 'stone')) };
};
