import { describe, expect, it } from 'vitest';
import { BUILDS } from '../../src/game/cities';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * The jams the autopilot finds (STORY-085), each played in Node to the point it showed.
 */
describe('jams found by the autopilot', () => {
  it('a waiting city site gets its settler from a city that can give a citizen, not only the capital (STORY-113)', () => {
    // Seed 42 under the defending advisors: the capital stays at size 1 and built the waiting
    // site's settler for ever, while four cities of size 5 to 10 made gold; no city came after day 200
    const advisors: Advisors = { town: 'build', city: 'defend', province: 'defend', state: 'war', planet: 'fortify' };
    const run = Run.play(42, advisors);
    const s = run.state;
    const canGive = (size: number) => size > BUILDS.settler.pop;
    let waited = 0;
    for (let day = 1; day <= 300; day++) {
      expect(run.until(day)).toBe(true);
      if (s.pendingSite === null || s.units.units.some(u => u.kind === 'settler')) continue;
      waited++;
      // Whenever a site waits, its settler is built where it can be, if anywhere
      const able = s.cities.some(c => canGive(c.size));
      expect(s.cities.some(c => c.build === 'settler' && (canGive(c.size) || !able)), `day ${day}`).toBe(true);
    }
    expect(waited).toBeGreaterThan(0);
    expect(s.cities.length).toBeGreaterThan(5);
  }, 600_000);
});
