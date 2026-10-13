import { describe, expect, it } from 'vitest';
import { DISCOVERY_EVERY, isRuin, ruinAt, type RuinKind } from './discoveries';

const SEED = 42;
const SAMPLE = 400_000;

describe('ruins (STORY-052)', () => {
  it('lie on about one land tile in DISCOVERY_EVERY, the same for the same seed', () => {
    let count = 0;
    for (let id = 0; id < SAMPLE; id++) if (isRuin(SEED, id)) count++;
    // Binomial: mean SAMPLE / 180 ≈ 2222, standard deviation ≈ 47
    expect(count).toBeGreaterThan(SAMPLE / DISCOVERY_EVERY - 200);
    expect(count).toBeLessThan(SAMPLE / DISCOVERY_EVERY + 200);
    expect(isRuin(SEED, 1234)).toBe(isRuin(SEED, 1234));
    expect([...Array(2000).keys()].filter(id => isRuin(SEED, id))).not.toEqual([...Array(2000).keys()].filter(id => isRuin(SEED + 1, id)));
  });

  it('hold Freeciv hut prizes in Freeciv odds out of eleven: gold 5, an advance 3, a soldier 2 and rarely a scout', () => {
    const counts: Record<RuinKind, number> = { gold25: 0, gold50: 0, gold100: 0, advance: 0, soldier: 0, scout: 0 };
    const n = 110_000;
    let low = 1, high = 0;
    for (let id = 0; id < n; id++) {
      const r = ruinAt(SEED, id);
      counts[r.kind]++;
      low = Math.min(low, r.pick);
      high = Math.max(high, r.pick);
    }
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
    const expected: Record<RuinKind, number> = { gold25: 1, gold50: 3, gold100: 1, advance: 3, soldier: 2, scout: 1 };
    for (const k of Object.keys(expected) as RuinKind[]) expect(Math.abs(counts[k] / n - expected[k] / 11)).toBeLessThan(0.006);
    expect(ruinAt(SEED, 77)).toEqual(ruinAt(SEED, 77));
  });
});
