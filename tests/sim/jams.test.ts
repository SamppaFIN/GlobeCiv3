import { describe, expect, it } from 'vitest';
import { BUILDS } from '../../src/game/cities';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * The jams the autopilot finds (STORY-085), each played in Node to the point it showed.
 */
describe('jams found by the autopilot', () => {
  // Seed 42 under the defending advisors: the capital stayed at size 1 and built the waiting
  // site's settler for ever, while four cities of size 5 to 10 made gold; no city came after day
  // 200. And after the first fix (Utu's review): every city that built a site's settler kept
  // building them, and a settler more was ordered every day one walked to its site: 29 at most
  const WAYS: Record<string, Advisors> = {
    build: { town: 'build', city: 'defend', province: 'defend', state: 'war', planet: 'fortify' },
    roam: { town: 'roam', city: 'explore', province: 'explore', state: 'science', planet: 'explore' },
  };
  for (const [way, advisors] of Object.entries(WAYS)) {
    it(`${way}: a waiting city site gets one settler, from a city that can give a citizen (STORY-113)`, () => {
      const run = Run.play(42, advisors);
      const s = run.state;
      const canGive = (size: number) => size > BUILDS.settler.pop;
      let waited = 0;
      let most = 0;
      for (let day = 1; day <= 300; day++) {
        expect(run.until(day)).toBe(true);
        const settlers = s.units.units.filter(u => u.kind === 'settler').length;
        most = Math.max(most, settlers);
        if (s.pendingSite === null) continue;
        // No second city builds one for the site
        expect(s.cities.filter(c => c.build === 'settler').length, `day ${day}`).toBeLessThanOrEqual(1);
        if (settlers) continue;
        waited++;
        // With no settler, the site's is built where it can be, if anywhere
        const able = s.cities.some(c => canGive(c.size));
        expect(s.cities.some(c => c.build === 'settler' && (canGive(c.size) || !able)), `day ${day}`).toBe(true);
      }
      expect(waited).toBeGreaterThan(0);
      // Settlers do not pile up: the old code had 2 or 3, the first fix 29
      expect(most).toBeLessThanOrEqual(4);
      expect(s.cities.length).toBeGreaterThan(5);
    }, 600_000);
  }
});
