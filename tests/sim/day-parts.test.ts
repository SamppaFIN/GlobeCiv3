import { describe, expect, it } from 'vitest';
import { saveState } from '../../src/sim/game';
import { Run, type Advisors } from '../../src/sim/run';
import { sha, simOf } from '../golden/hash';

/**
 * A day over several frames (STORY-117, criterion 2): worked out a part at a time, a day ends
 * as it does in one go, and a player's command in the middle of a day comes at its edge.
 */
const BUILD: Advisors = { town: 'build', city: 'defend', province: 'defend', state: 'war', planet: 'fortify' };
const FEED: Advisors = { town: 'feed', city: 'growth', province: 'settle', state: 'expand', planet: 'conquer' };

const hashes = (run: Run, days: number[]) => days.map(d => {
  expect(run.until(d), run.error ?? '').toBe(true);
  return sha(simOf(run.snapshot()));
});

describe('a day over several frames (STORY-117)', () => {
  for (const [way, advisors] of Object.entries({ build: BUILD, feed: FEED })) {
    it(`${way}: a day in parts ends as a day in one go`, () => {
      const whole = hashes(Run.play(42, advisors), [60, 150, 250]);
      const run = Run.play(42, advisors);
      run.stepped = true;
      let parts = 0;
      run.between = () => { parts++; };
      expect(hashes(run, [60, 150, 250])).toEqual(whole);
      // Many parts a day, not one
      expect(parts / 250).toBeGreaterThan(5);
    }, 600_000);
  }

  it('a player\'s command in the middle of a day comes at its edge, logged on that day', () => {
    // The tax set at the end of day 120, its days in one go
    const edge = Run.play(42, FEED);
    expect(edge.until(120)).toBe(true);
    expect(edge.give({ kind: 'tax', tax: 70 })).toBe(true);
    const want = hashes(edge, [121, 180]);
    const taxed = (r: Run) => r.snapshot().commands.filter(e => e.by === 'player' && e.cmd.kind === 'tax').map(e => e.day);
    const edgeTaxed = taxed(edge);
    // The same command given in the middle of day 120, worked out in parts: the day ends first
    const mid = Run.play(42, FEED);
    mid.stepped = true;
    expect(mid.until(119)).toBe(true);
    let given = false;
    mid.between = r => {
      if (!given && r.clock.day === 120) {
        given = true;
        expect(r.give({ kind: 'tax', tax: 70 })).toBe(true);
      }
    };
    expect(hashes(mid, [121, 180])).toEqual(want);
    expect(given).toBe(true);
    expect(taxed(mid)).toEqual([120]);
    expect(taxed(mid)).toEqual(edgeTaxed);
  }, 600_000);

  it('a save in the middle of a day holds the day worked out to its end', () => {
    const edge = Run.play(42, FEED);
    expect(edge.until(120)).toBe(true);
    const want = sha(simOf(saveState()!));
    const mid = Run.play(42, FEED);
    mid.stepped = true;
    expect(mid.until(119)).toBe(true);
    let saved: string | null = null;
    let parts = 0;
    mid.between = r => {
      // A few parts into day 120: the day is under way
      if (saved === null && r.clock.day === 120 && ++parts === 3) saved = sha(simOf(saveState()!));
    };
    expect(mid.until(120)).toBe(true);
    expect(saved).toBe(want);
  }, 600_000);
});
