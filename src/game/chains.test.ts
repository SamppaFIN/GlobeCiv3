import { describe, expect, it } from 'vitest';
import { BASE, buildDay, chainOpen, CHAIN_BUILDINGS, CHAIN_RULES, eat, GOODS, has, MAKE_DAYS, mealsReady, newChain, startSite, workDay, type ChainBuilding, type ChainState } from './chains';
import { readySettlements, settlementDone, settlementStart, settlementSteps } from './chains';

const total = (s: ChainState) => GOODS.reduce((n, g) => n + has(s, g), 0);
/** Build a site to the end; the days it took. */
function build(s: ChainState, b: ChainBuilding, built: ChainBuilding[], best: ChainBuilding[] = []): number | null {
  startSite(s, b);
  for (let day = 1; day <= 60; day++) {
    workDay(s, built, best);
    if (buildDay(s).done === b) {
      built.push(b);
      return day;
    }
  }
  return null;
}

describe('production chains (STORY-088)', () => {
  it('the starting stock builds the lumberjack, the sawmill and the quarry, and nothing more (Freeserf)', () => {
    const s = newChain();
    expect(s.stock).toEqual({ plank: 7, stone: 2 });
    const need = (['lumberjack', 'sawmill', 'quarry'] as const).reduce((n, b) => ({ planks: n.planks + CHAIN_RULES[b].planks, stones: n.stones + CHAIN_RULES[b].stones }), { planks: 0, stones: 0 });
    expect(need).toEqual({ planks: 7, stones: 2 });
  });

  it('a site takes its materials, then its builders\' days; goods are not made from nothing', () => {
    const s = newChain();
    const built: ChainBuilding[] = [];
    expect(build(s, 'lumberjack', built)).toBe(2);
    expect(s.stock).toEqual({ plank: 5, stone: 2 });
    // The sawmill takes three planks and both stones, and the starting stock keeps two planks
    expect(build(s, 'sawmill', built)).not.toBeNull();
    expect(s.stock).toMatchObject({ plank: 2, stone: 0 });
    const before = has(s, 'log') + has(s, 'plank');
    for (let d = 0; d < 2 * MAKE_DAYS; d++) workDay(s, built, []);
    // The sawmill turns a log into a plank: logs and planks together grow only by the logs felled
    expect(has(s, 'log') + has(s, 'plank') + (s.work.sawmill ? 1 : 0)).toBe(before + 2);
    expect(has(s, 'plank')).toBeGreaterThan(0);
  });

  it('a site waits while planks or stone are missing, and goes on once they come', () => {
    const s = newChain();
    s.stock = { plank: 1 };
    startSite(s, 'field');
    for (let d = 0; d < 10; d++) expect(buildDay(s).done).toBeNull();
    expect(s.site).toMatchObject({ building: 'field', planks: 1, stones: 0, days: 0 });
    s.stock = { plank: 3, stone: 1 };
    let done = null;
    for (let d = 0; d < 3 && !done; d++) done = buildDay(s).done;
    expect(done).toBe('field');
    expect(total(s)).toBe(0);
  });

  it('wheat becomes flour and flour bread; on its best ground a building makes a good a day', () => {
    const s = newChain();
    s.stock = {};
    const built: ChainBuilding[] = ['field', 'mill', 'bakery'];
    for (let d = 0; d < 12; d++) workDay(s, built, []);
    expect(has(s, 'bread')).toBeGreaterThan(0);
    const slow = newChain();
    const fast = newChain();
    slow.stock = {};
    fast.stock = {};
    for (let d = 0; d < 10; d++) {
      workDay(slow, ['lumberjack'], []);
      workDay(fast, ['lumberjack'], ['lumberjack']);
    }
    expect(has(slow, 'log')).toBe(5);
    expect(has(fast, 'log')).toBe(10);
  });

  it('each citizen eats a meal of bread or fish at most', () => {
    const s = newChain();
    s.stock = { bread: 3, fish: 2 };
    expect(mealsReady(s, 4)).toBe(4);
    expect(eat(s, 4)).toBe(4);
    expect(s.stock).toEqual({ bread: 0, fish: 1 });
  });

  it('the base comes first: in any order the starting stock builds it, and then everything opens', () => {
    const orders: ChainBuilding[][] = [['lumberjack', 'sawmill', 'quarry'], ['quarry', 'lumberjack', 'sawmill'], ['sawmill', 'quarry', 'lumberjack']];
    for (const order of orders) {
      const s = newChain();
      const built: ChainBuilding[] = [];
      expect(chainOpen(s, built, 'field')).toBe(false);
      for (const b of order) {
        expect(chainOpen(s, built, b)).toBe(true);
        expect(build(s, b, built)).not.toBeNull();
      }
      expect(built).toEqual(order);
      for (const b of CHAIN_BUILDINGS) expect(chainOpen(s, built, b)).toBe(!BASE.includes(b));
    }
    // One site at a time
    const s = newChain();
    startSite(s, 'quarry');
    expect(chainOpen(s, [], 'lumberjack')).toBe(false);
  });

  it('once the base stands the whole chain is built from what it makes, and bread comes (no jam)', () => {
    const s = newChain();
    const built: ChainBuilding[] = [];
    for (const b of ['lumberjack', 'sawmill', 'quarry', 'field', 'mill', 'bakery', 'fishery'] as const) expect(build(s, b, built)).not.toBeNull();
    let bread = 0;
    for (let d = 0; d < 20; d++) {
      workDay(s, built, []);
      bread += eat(s, 1);
    }
    expect(bread).toBeGreaterThan(5);
  });

  it('goods are kept: a log sawn is a plank, and what a site takes is in the site', () => {
    const s = newChain();
    s.stock = { log: 4, plank: 0, stone: 0 };
    startSite(s, 'quarry');
    for (let d = 0; d < 12; d++) {
      workDay(s, ['sawmill'], []);
      buildDay(s);
      const site = s.site ? s.site.planks : CHAIN_RULES.quarry.planks;
      expect(has(s, 'log') + has(s, 'plank') + site + (s.work.sawmill ? 1 : 0)).toBe(4);
    }
  });

  it('the same days give the same stock (determinism)', () => {
    const run = () => {
      const s = newChain();
      const built: ChainBuilding[] = [];
      for (const b of BASE) build(s, b, built, ['quarry']);
      for (let d = 0; d < 30; d++) workDay(s, built, ['quarry']);
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });

  it('the materials are Freeserf\'s (src/building.cc const_info, commit f537310)', () => {
    expect(Object.fromEntries(CHAIN_BUILDINGS.map(b => [b, [CHAIN_RULES[b].planks, CHAIN_RULES[b].stones]]))).toEqual({
      lumberjack: [2, 0], sawmill: [3, 2], quarry: [2, 0], field: [4, 1], mill: [3, 1], bakery: [2, 1], fishery: [2, 0],
    });
  });

  it('the moves tell the carriers each good from its building to the centre and on', () => {
    const s = newChain();
    s.stock = { log: 1 };
    s.work = {};
    const moves = [...workDay(s, ['lumberjack', 'sawmill'], ['lumberjack'])];
    expect(moves).toContainEqual({ good: 'log', from: 'lumberjack', to: 'centre' });
    expect(moves).toContainEqual({ good: 'log', from: 'centre', to: 'sawmill' });
    startSite(s, 'quarry');
    s.stock.plank = 2;
    expect(buildDay(s).moves).toEqual([{ good: 'plank', from: 'centre', to: 'site' }, { good: 'plank', from: 'centre', to: 'site' }]);
  });
});

describe('the ready settlement (STORY-089)', () => {
  it('is the base, a chain of food (bread or fish) and three citizens', () => {
    expect(settlementSteps([], 1)).toEqual({ base: false, food: false, size: false });
    expect(settlementSteps(['lumberjack', 'sawmill', 'quarry'], 2)).toEqual({ base: true, food: false, size: false });
    // Bread needs the whole chain; fish alone is enough
    expect(settlementSteps(['lumberjack', 'sawmill', 'quarry', 'field', 'mill'], 3).food).toBe(false);
    expect(settlementSteps(['lumberjack', 'sawmill', 'quarry', 'field', 'mill', 'bakery'], 3)).toEqual({ base: true, food: true, size: true });
    expect(settlementDone(['lumberjack', 'sawmill', 'quarry', 'fishery'], 3)).toBe(true);
    expect(settlementDone(['lumberjack', 'sawmill', 'quarry', 'fishery'], 2)).toBe(false);
    expect(settlementDone(['sawmill', 'quarry', 'fishery', 'field', 'mill', 'bakery'], 5)).toBe(false);
  });
});

describe('a settlement founded in the city area (STORY-091)', () => {
  const all = () => true;
  it('starts with the base and a chain of food, bread before fish', () => {
    expect(settlementStart(all)).toEqual(['lumberjack', 'sawmill', 'quarry', 'field', 'mill', 'bakery']);
    // Without ground for a field, the fishery is the chain of food
    expect(settlementStart(b => b !== 'field')).toEqual(['lumberjack', 'sawmill', 'quarry', 'fishery']);
  });
  it('leaves out what has no ground near the city, and is then not ready', () => {
    const noForest = (b: ChainBuilding) => b !== 'lumberjack' && b !== 'field' && b !== 'fishery';
    const start = settlementStart(noForest);
    expect(start).toEqual(['sawmill', 'quarry']);
    expect(settlementSteps(start, 3)).toEqual({ base: false, food: false, size: true });
    // A city of size 1 with all of them is a settlement still growing
    expect(settlementSteps(settlementStart(all), 1)).toEqual({ base: true, food: true, size: false });
  });
});

describe('the city area\'s ready settlements (STORY-092)', () => {
  const ready = { buildings: ['lumberjack', 'sawmill', 'quarry', 'fishery'], size: 3, chain: newChain() };
  it('counts a city of chains once it is ready, and a city of the old rules as it stands', () => {
    expect(readySettlements([])).toBe(0);
    expect(readySettlements([ready, { ...ready, size: 2 }, { ...ready, buildings: ['sawmill'] }])).toBe(1);
    // Taken, the old start or a save from before: no chains
    expect(readySettlements([ready, { buildings: [], size: 1 }])).toBe(2);
  });
});
