import { describe, expect, it } from 'vitest';
import { BUILDS } from '../../src/game/cities';
import { workDays } from '../../src/game/improvements';
import { validateSave } from '../../src/game/save';
import { TILE_COUNT } from '../../src/globe/hexTiles';
import { saveState, supportOf, world } from '../../src/sim/game';
import { ADVANCES, type Advance } from '../../src/game/science';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * The iron age's wonders and own rules (STORY-121): the Great Library gives an advance two
 * rivals know, Philosophy an advance more to the first to learn it, and Bridge Building halves
 * a road's days.
 */
const SCIENCE: Advisors = { town: 'explore', city: 'explore', province: 'explore', state: 'science', planet: 'explore' };

/** A run on its first day, its capital standing and two rivals or more in the game. */
function start(): Run {
  const run = Run.play(42, SCIENCE);
  expect(run.state.cities.length).toBeGreaterThan(0);
  expect(run.state.rivals.length).toBeGreaterThanOrEqual(2);
  return run;
}

/** Steps until a day has passed; the cards answered as the advisors would. */
function aDay(run: Run) {
  const day = run.clock.day;
  while (run.clock.day === day) if (!run.step()) expect(run.decide()).toBe(true);
}

/** Know an advance and what it needs, all the way down. */
function knowWithNeeds(known: Set<Advance>, a: Advance) {
  for (const n of ADVANCES[a].needs) knowWithNeeds(known, n);
  known.add(a);
}

describe('the Great Library (STORY-121, Freeciv civ1 Tech_Parasite 2)', () => {
  it('gives an advance two rivals know and whose needs the player knows, once a day, and the card tells it', () => {
    const run = start();
    const s = run.state;
    s.research.known.clear();
    s.research.target = null;
    s.cities[0].buildings.push('greatlibrary');
    // One rival knows the Alphabet: not enough. Two know Pottery, and Writing, whose need the player lacks
    s.rivals[0].research.known.add('alphabet');
    for (const r of s.rivals.slice(0, 2)) r.research.known.add('pottery').add('writing');
    aDay(run);
    expect(s.research.known.has('pottery')).toBe(true);
    expect(s.research.known.has('alphabet')).toBe(false);
    expect(s.research.known.has('writing')).toBe(false);
    expect(s.learned).toContain('pottery');
    // Nothing more to take: the next day gives nothing
    const known = s.research.known.size;
    while (s.learned.length) expect(run.decide()).toBe(true);
    aDay(run);
    expect(s.research.known.size).toBeLessThanOrEqual(known + 1);
    expect(s.research.known.has('writing')).toBe(false);
  }, 120_000);

  it('gives nothing without the wonder', () => {
    const run = start();
    const s = run.state;
    s.research.known.clear();
    for (const r of s.rivals.slice(0, 2)) r.research.known.add('pottery');
    s.research.target = 'alphabet';
    aDay(run);
    expect(s.research.known.has('pottery')).toBe(false);
  }, 120_000);
});

describe('Philosophy (STORY-121, own rule)', () => {
  it('gives the first to learn it the study under way, and nothing when a rival knew it first', () => {
    for (const rivalFirst of [false, true]) {
      const run = start();
      const s = run.state;
      knowWithNeeds(s.research.known, 'mysticism');
      knowWithNeeds(s.research.known, 'literacy');
      if (rivalFirst) s.rivals[0].research.known.add('philosophy');
      // Philosophy is learned by research today; Bronze Working is chosen next
      s.research.target = 'philosophy';
      s.research.bulbs = s.research.cost;
      const before = s.research.known.size;
      aDay(run);
      expect(s.research.known.has('philosophy')).toBe(true);
      expect(s.research.known.size - before, `rival first: ${rivalFirst}`).toBe(rivalFirst ? 1 : 2);
    }
  }, 240_000);
});

describe('Bridge Building (STORY-121, own rule)', () => {
  it('halves a road\'s days, rounded up, and leaves the other works as they were', () => {
    expect([workDays('road', 'grassland'), workDays('road', 'grassland', true)]).toEqual([2, 1]);
    expect([workDays('road', 'hills'), workDays('road', 'hills', true)]).toEqual([4, 2]);
    expect([workDays('road', 'mountains'), workDays('road', 'mountains', true)]).toEqual([6, 3]);
    expect(workDays('mine', 'hills', true)).toBe(workDays('mine', 'hills'));
  });
});

describe('the caravan (STORY-121, Freeciv civ1 Caravan: HelpWonder, uk_shield 0)', () => {
  it('takes 50 shields to a wonder being built, up to its cost, costs no upkeep, and the help is a command', () => {
    const run = start();
    const s = run.state;
    const capital = s.cities[0];
    knowWithNeeds(s.research.known, 'trade');
    knowWithNeeds(s.research.known, 'mysticism');
    // Not a wonder yet: the caravan is refused, and so is a unit that is no caravan
    const u = s.units.spawn('caravan', capital.tile, world, capital.id);
    expect(supportOf(capital).units).toBe(s.units.units.filter(x => x.home === capital.id && x.kind !== 'caravan').length);
    capital.build = 'coinage';
    expect(run.give({ kind: 'help', unit: u.id, city: capital.tile })).toBe(false);
    const scout = s.units.units.find(x => x.kind === 'scout');
    capital.build = 'oracle';
    capital.shields = BUILDS.oracle.cost - 20;
    if (scout) expect(run.give({ kind: 'help', unit: scout.id, city: capital.tile })).toBe(false);
    expect(run.give({ kind: 'help', unit: u.id, city: capital.tile })).toBe(true);
    expect(s.commands.entries.at(-1)).toMatchObject({ by: 'player', cmd: { kind: 'help', unit: u.id, city: capital.tile } });
    // The caravan's city is saved, and a save with it loads
    const saved = JSON.parse(JSON.stringify({ ...saveState()!, savedAt: 0, speed: 1, paused: false, selected: 0 }));
    const back = validateSave(saved, { tiles: TILE_COUNT, cityAreas: 362 * 49 })!;
    expect(back.units.units.find(x => x.id === u.id)?.to).toBe(capital.tile);
    expect(back.commands?.at(-1)?.cmd).toEqual({ kind: 'help', unit: u.id, city: capital.tile });
    aDay(run);
    // Up to the wonder's cost, and the caravan is gone
    expect(capital.shields === BUILDS.oracle.cost || capital.buildings.includes('oracle')).toBe(true);
    expect(s.units.units.some(x => x.id === u.id)).toBe(false);
  }, 120_000);

  it('waits in a city that builds no wonder when it arrives, and gives its shields once one is begun', () => {
    const run = start();
    const s = run.state;
    const capital = s.cities[0];
    knowWithNeeds(s.research.known, 'trade');
    knowWithNeeds(s.research.known, 'literacy');
    const u = s.units.spawn('caravan', capital.tile, world, capital.id);
    capital.build = 'greatlibrary';
    capital.shields = 0;
    expect(run.give({ kind: 'help', unit: u.id, city: capital.tile })).toBe(true);
    // The wonder is given up before the caravan's day: it waits
    capital.build = 'coinage';
    aDay(run);
    expect(s.units.units.find(x => x.id === u.id)?.to).toBe(capital.tile);
    capital.build = 'greatlibrary';
    const before = capital.shields;
    aDay(run);
    expect(s.units.units.some(x => x.id === u.id)).toBe(false);
    expect(capital.shields - before).toBeGreaterThanOrEqual(50);
  }, 120_000);
});
