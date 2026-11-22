import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateSave } from '../../src/game/save';
import { TILE_COUNT } from '../../src/globe/hexTiles';
import { sha, simOf } from '../golden/hash';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * The day's simulation in Node (STORY-095, src/sim/run.ts): seed 42 under the golden runs' three sets of
 * advisors comes to the same states as in the browser (tests/golden/seed42.json, written by
 * tests/e2e/golden.e2e.ts), and a game played again from its save's command log comes to the
 * same state as the game itself.
 */
const golden = JSON.parse(readFileSync('tests/golden/seed42.json', 'utf8')) as Record<string, Record<string, { sim: string; day: number; cities: number; open: number; gold: number; units: number }>>;
const COMBOS: Record<string, Advisors> = {
  feed: { town: 'feed', city: 'growth', province: 'settle', state: 'expand', planet: 'conquer' },
  build: { town: 'build', city: 'defend', province: 'defend', state: 'war', planet: 'fortify' },
  roam: { town: 'roam', city: 'explore', province: 'explore', state: 'science', planet: 'explore' },
};
const DAYS = [50, 100, 200];

describe('the simulation in Node (STORY-095)', () => {
  for (const [name, advisors] of Object.entries(COMBOS)) {
    it(`plays seed 42 as the browser does, ${name}`, () => {
      const run = Run.play(42, advisors);
      for (const day of DAYS) {
        expect(run.until(day), `${name} reaches day ${day}`).toBe(true);
        const s = run.snapshot();
        const sum = { day: s.day, cities: s.cities.length, open: s.progress.openLevel, gold: s.gold, units: s.units.units.length };
        const want = golden[name][day];
        expect(sum, `${name} on day ${day}`).toEqual({ day: want.day, cities: want.cities, open: want.open, gold: want.gold, units: want.units });
        expect(sha(simOf(s)), `${name} on day ${day}`).toBe(want.sim);
      }
    }, 600_000);
  }

  it('plays a game again from its save\'s command log to the same state (feed, 200 days)', () => {
    const run = Run.play(42, COMBOS.feed);
    expect(run.until(200)).toBe(true);
    const played = run.snapshot();
    // The log as a save keeps it, checked as a loaded save is (security rule 5)
    const save = validateSave(JSON.parse(JSON.stringify({ ...played, savedAt: 0, speed: 1, paused: false, selected: 0 })), { tiles: TILE_COUNT, cityAreas: 362 * 49 });
    expect(save).not.toBeNull();
    const again = Run.replay(42, save!.commands!);
    expect(again.until(200), again.error ?? '').toBe(true);
    const replayed = again.snapshot();
    // The same commands again, the advisors' too, and the same game
    expect(replayed.commands).toEqual(played.commands);
    expect(sha(simOf(replayed))).toBe(sha(simOf(played)));
  }, 600_000);

  it('plays again the player\'s own commands given between the days, not only the answers to cards (Utu\'s review)', () => {
    const run = Run.play(42, COMBOS.build);
    expect(run.until(40)).toBe(true);
    // The player changes the city area's advisor and the capital's build on day 40, and the state's advisor on day 90
    expect(run.give({ kind: 'advise', level: 'city', advisor: 'growth' })).toBe(true);
    const capital = run.state.cities[0];
    expect(run.give({ kind: 'build', city: capital.tile, build: 'warrior' })).toBe(true);
    expect(run.until(90)).toBe(true);
    expect(run.give({ kind: 'advise', level: 'state', advisor: 'science' })).toBe(true);
    expect(run.until(150)).toBe(true);
    const played = run.snapshot();
    expect(played.commands.filter(e => e.by === 'player' && e.day === 40).map(e => e.cmd.kind)).toEqual(['advise', 'build']);
    const again = Run.replay(42, played.commands);
    expect(again.until(150), again.error ?? '').toBe(true);
    expect(sha(simOf(again.snapshot()))).toBe(sha(simOf(played)));
  }, 600_000);

  it('a log that does not fit the game stops the replay with the reason', () => {
    const run = Run.play(42, COMBOS.feed);
    expect(run.until(30)).toBe(true);
    // A command of day 3 after those of later days: the game has gone on past it
    const again = Run.replay(42, [...run.snapshot().commands, { day: 3, by: 'player', cmd: { kind: 'site', accept: true } }]);
    expect(again.until(40)).toBe(false);
    expect(again.error).toMatch(/day 3 \(site\)/);
  }, 600_000);

  it('a run gives way to the next one, and the old one refuses to go on', () => {
    const first = Run.play(7, COMBOS.feed);
    Run.play(7, COMBOS.roam);
    expect(() => first.step()).toThrow(/another run/);
  }, 600_000);
});
