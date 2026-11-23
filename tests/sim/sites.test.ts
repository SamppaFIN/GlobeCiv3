import { describe, expect, it } from 'vitest';
import { Run, type Advisors } from '../../src/sim/run';

/**
 * A city site the player chooses while a settler walks to another (site-card.e2e): the card
 * promises a settler built for it. Utu's review of STORY-113 stopped settlers piling up by
 * ordering none while any settler lived, which broke the promise; one more is built, and only one.
 */
const FEED: Advisors = { town: 'feed', city: 'growth', province: 'settle', state: 'expand', planet: 'conquer' };

describe('a site chosen while a settler walks to another', () => {
  it('gets a settler built for it, and no more than that one', () => {
    const run = Run.play(42, FEED);
    const s = run.state;
    const settlers = () => s.units.units.filter(u => u.kind === 'settler');
    // The first day a settler walks to its site, with no other settler and no site waiting
    let day = 1;
    for (; day <= 400; day++) {
      expect(run.until(day), run.error ?? '').toBe(true);
      if (s.units.founding && settlers().length === 1 && s.pendingSite === null && s.cities.some(c => c.size > 1)) break;
    }
    expect(day).toBeLessThanOrEqual(400);
    const walking = s.units.settler!;
    const site = s.units.sites.find(t => t !== s.units.currentSite())!;
    expect(site).toBeDefined();

    // The player's choice: a city builds a settler for the site
    expect(run.give({ kind: 'settle', tile: site })).toBe(true);
    expect(s.pendingSite).toBe(site);
    expect(s.cities.filter(c => c.build === 'settler')).toHaveLength(1);

    // While the first walks, one more settler at most, and only one city builds it
    for (let d = day + 1; d <= day + 40 && s.units.units.includes(walking); d++) {
      expect(run.until(d), run.error ?? '').toBe(true);
      expect(settlers().length, `day ${d}`).toBeLessThanOrEqual(2);
      expect(s.cities.filter(c => c.build === 'settler').length, `day ${d}`).toBeLessThanOrEqual(1);
    }
  }, 300_000);
});
