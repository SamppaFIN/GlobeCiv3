import { describe, expect, it } from 'vitest';
import { neighbors, TILE_COUNT } from '../../src/globe/hexTiles';
import { validateSave } from '../../src/game/save';
import { ADVANCES, type Advance } from '../../src/game/science';
import { awayOf, cityYields, moodOf, saveState, world } from '../../src/sim/game';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * The Republic (STORY-125, Freeciv civ1): more trade, settlers that eat 2 food, no martial law,
 * and units away from a city that make their home city unhappy; a revolution with a target, and
 * the state's advisors that turn to it.
 */
const ADVISORS = (state: Advisors['state']): Advisors => ({ town: 'explore', city: 'explore', province: 'explore', state, planet: 'explore' });

function knowWithNeeds(known: Set<Advance>, a: Advance) {
  for (const n of ADVANCES[a].needs) knowWithNeeds(known, n);
  known.add(a);
}

/** Steps until a day has passed; the cards answered as the advisors would. */
function aDay(run: Run) {
  const day = run.clock.day;
  while (run.clock.day === day) if (!run.step()) expect(run.decide()).toBe(true);
}

/** Days until anarchy is over, at most ten. */
function pastAnarchy(run: Run) {
  for (let i = 0; i < 10 && run.state.gov === 'anarchy'; i++) aDay(run);
}

describe('the revolution with a target (STORY-125)', () => {
  it('goes from Monarchy to the Republic, and from Despotism straight to it, but not to an unknown one', () => {
    const run = Run.play(42, ADVISORS('none'));
    const s = run.state;
    expect(s.gov).toBe('despotism');
    expect(run.give({ kind: 'revolution', to: 'republic' })).toBe(false);
    knowWithNeeds(s.research.known, 'monarchy');
    expect(run.give({ kind: 'revolution' })).toBe(true);
    expect(s.gov).toBe('anarchy');
    pastAnarchy(run);
    expect(s.gov).toBe('monarchy');
    knowWithNeeds(s.research.known, 'republic');
    expect(run.give({ kind: 'revolution', to: 'monarchy' })).toBe(false);
    expect(run.give({ kind: 'revolution', to: 'republic' })).toBe(true);
    // In anarchy no revolution starts
    expect(run.give({ kind: 'revolution', to: 'monarchy' })).toBe(false);
    pastAnarchy(run);
    expect(s.gov).toBe('republic');
    expect(s.revolutionTo).toBeUndefined();

    const straight = Run.play(42, ADVISORS('none'));
    knowWithNeeds(straight.state.research.known, 'republic');
    expect(straight.give({ kind: 'revolution', to: 'republic' })).toBe(true);
    pastAnarchy(straight);
    expect(straight.state.gov).toBe('republic');
  }, 120_000);

  it('keeps its target over a save, and an old save in anarchy, without one, ends in Monarchy', () => {
    const run = Run.play(42, ADVISORS('none'));
    knowWithNeeds(run.state.research.known, 'republic');
    expect(run.give({ kind: 'revolution', to: 'republic' })).toBe(true);
    const saved = JSON.parse(JSON.stringify({ ...saveState()!, savedAt: 0, speed: 1, paused: false, selected: 0 }));
    expect(validateSave(saved, { tiles: TILE_COUNT, cityAreas: 362 * 49 })!.revolutionTo).toBe('republic');
    delete saved.revolutionTo;
    expect(validateSave(saved, { tiles: TILE_COUNT, cityAreas: 362 * 49 })!.revolutionTo).toBeUndefined();
    // As loaded from it: the anarchy has no target
    run.state.revolutionTo = undefined;
    pastAnarchy(run);
    expect(run.state.gov).toBe('monarchy');
  }, 120_000);
});

describe('a log with a revolution to the Republic (STORY-125, review by Utu)', () => {
  it('plays again to the same government on the same day', () => {
    const run = Run.play(42, ADVISORS('none'));
    knowWithNeeds(run.state.research.known, 'republic');
    // The advances as a command can give them: the replay knows them only from the log's own play
    for (let i = 0; i < 2; i++) aDay(run);
    expect(run.give({ kind: 'revolution', to: 'republic' })).toBe(true);
    const log = run.state.commands.save();
    const day = run.clock.day;
    pastAnarchy(run);
    expect(run.state.gov).toBe('republic');
    const again = Run.replay(42, log);
    knowWithNeeds(again.state.research.known, 'republic');
    expect(again.until(day + 6), again.error ?? '').toBe(true);
    expect(again.state.gov).toBe('republic');
  }, 120_000);
});

describe('the Republic\'s rules (STORY-125, Freeciv civ1)', () => {
  it('a settler eats 2 food (the trade of a tile: government.test)', () => {
    const run = Run.play(42, ADVISORS('none'));
    const s = run.state;
    const c = s.cities[0];
    s.units.spawn('settler', c.tile, world, c.id);
    s.gov = 'monarchy';
    const monarchy = cityYields()[0];
    s.gov = 'republic';
    const republic = cityYields()[0];
    expect(republic.food).toBe(monarchy.food);
    expect(monarchy.surplus - republic.surplus).toBe(1);
  }, 120_000);

  it('a soldier outside a city makes its home city unhappy, and in a city it does not; none counts under Monarchy', () => {
    const run = Run.play(42, ADVISORS('none'));
    const s = run.state;
    const c = s.cities[0];
    s.gov = 'republic';
    const u = s.units.spawn('warrior', c.tile, world, c.id);
    expect(awayOf(c)).toBe(0);
    const out = neighbors(c.tile).find(t => Number.isFinite(world.cost(t)))!;
    const before = moodOf(c, cityYields()[0]);
    u.tile = out;
    expect(awayOf(c)).toBe(1);
    const after = moodOf(c, cityYields()[0]);
    expect(after.unhappy + after.content + after.happy).toBe(before.unhappy + before.content + before.happy);
    expect(after.unhappy).toBe(Math.min(before.unhappy + 1, before.unhappy + before.content));
    // A phalanx and an attacker count too (both can attack, civ1 attack 1 and more)
    const phalanx = s.units.spawn('phalanx', out, world, c.id);
    const horseman = s.units.spawn('horseman', out, world, c.id);
    expect(awayOf(c)).toBe(3);
    phalanx.tile = c.tile;
    horseman.tile = c.tile;
    // Units that cannot attack and units without a home count for nothing
    s.units.spawn('scout', out, world, c.id);
    s.units.spawn('settler', out, world, c.id);
    s.units.spawn('warrior', out, world);
    expect(awayOf(c)).toBe(1);
    s.gov = 'monarchy';
    expect(awayOf(c)).toBe(0);
  }, 120_000);
});

describe('the state\'s advisors and the Republic (STORY-125)', () => {
  it('Oppinut waits for the Republic: not to Monarchy alone, to the Republic once it is known', () => {
    const run = Run.play(42, ADVISORS('science'));
    const s = run.state;
    knowWithNeeds(s.research.known, 'monarchy');
    for (let i = 0; i < 3; i++) aDay(run);
    expect(s.gov).toBe('despotism');
    knowWithNeeds(s.research.known, 'republic');
    aDay(run);
    expect(['anarchy', 'republic']).toContain(s.gov);
    expect(s.commands.entries.some(e => e.by === 'state' && e.cmd.kind === 'revolution' && e.cmd.to === 'republic')).toBe(true);
    pastAnarchy(run);
    expect(s.gov).toBe('republic');
  }, 120_000);

  it('Laajentaja too waits for the Republic, also when Monarchy is known (review by Utu)', () => {
    const run = Run.play(42, ADVISORS('expand'));
    const s = run.state;
    knowWithNeeds(s.research.known, 'monarchy');
    for (let i = 0; i < 3; i++) aDay(run);
    expect(s.gov).toBe('despotism');
    knowWithNeeds(s.research.known, 'republic');
    aDay(run);
    pastAnarchy(run);
    expect(s.gov).toBe('republic');
  }, 120_000);

  it('Kenraali turns to Monarchy from Despotism, and does not leave the Republic', () => {
    const run = Run.play(42, ADVISORS('war'));
    const s = run.state;
    knowWithNeeds(s.research.known, 'republic');
    knowWithNeeds(s.research.known, 'monarchy');
    aDay(run);
    pastAnarchy(run);
    expect(s.gov).toBe('monarchy');
    const again = Run.play(42, ADVISORS('war'));
    knowWithNeeds(again.state.research.known, 'republic');
    knowWithNeeds(again.state.research.known, 'monarchy');
    again.state.gov = 'republic';
    for (let i = 0; i < 3; i++) aDay(again);
    expect(again.state.gov).toBe('republic');
  }, 120_000);
});

describe('attackers come home with no campaign (own, Sami 2026-11-26)', () => {
  it('an attacker standing in the field walks to the nearest city, and stands in it', () => {
    const run = Run.play(42, ADVISORS('none'));
    const s = run.state;
    const c = s.cities[0];
    const field = neighbors(c.tile).flatMap(n => neighbors(n)).find(t => t !== c.tile && !neighbors(c.tile).includes(t) && Number.isFinite(world.cost(t)))!;
    const u = s.units.spawn('horseman', field, world, c.id);
    for (let i = 0; i < 6 && u.tile !== c.tile; i++) aDay(run);
    expect(u.tile).toBe(c.tile);
  }, 120_000);
});

describe('a long game under the state\'s advisors (STORY-125, review by Utu)', () => {
  // The golden runs' advisors (tests/sim/run.test.ts): Laajentaja, Kenraali and Oppinut
  const COMBOS: Record<string, Advisors> = {
    feed: { town: 'feed', city: 'growth', province: 'settle', state: 'expand', planet: 'conquer' },
    build: { town: 'build', city: 'defend', province: 'defend', state: 'war', planet: 'fortify' },
    roam: { town: 'roam', city: 'explore', province: 'explore', state: 'science', planet: 'explore' },
  };
  for (const [name, advisors] of Object.entries(COMBOS)) {
    // Oppinut learns the Republic within 500 days (seed 42); Laajentaja and Kenraali learn too
    // little in that time (pre-existing: their cities make almost no trade, TICKET-TEST-105), so
    // for them the test holds that they never come to the other one
    it(`${name}: in 500 days the realm comes to no government its advisor does not want${advisors.state === 'science' ? ', and Oppinut to the Republic' : ''}`, () => {
      const run = Run.play(42, advisors);
      const seen = new Set<string>();
      for (let day = 25; day <= 500; day += 25) {
        expect(run.until(day), run.error ?? '').toBe(true);
        seen.add(run.state.gov);
      }
      const unwanted = advisors.state === 'war' ? 'republic' : 'monarchy';
      expect(seen.has(unwanted), `${name}: ${[...seen].join(', ')}`).toBe(false);
      if (advisors.state === 'science') expect([...seen]).toContain('republic');
    }, 600_000);
  }
});
