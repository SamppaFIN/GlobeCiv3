import { describe, expect, it } from 'vitest';
import { ALL_PERSONS, ERAS, personOf, ROLES } from './persons';
import { GIVEN_NAMES } from './personNames';
import { TOWN_ADVISOR_LIST, CITY_ADVISOR_LIST, PROVINCE_ADVISOR_LIST, STATE_ADVISOR_LIST, PLANET_ADVISOR_LIST } from './advisors';
import { portraitSvg } from '../ui/portraits';

describe('the advisors as people (STORY-105)', () => {
  it('each role of each level has a person of its own in each era: 30 in two eras', () => {
    expect(ALL_PERSONS).toHaveLength(5 * 3 * ERAS.length);
    expect(ALL_PERSONS).toHaveLength(30);
    const lists = { town: TOWN_ADVISOR_LIST, city: CITY_ADVISOR_LIST, province: PROVINCE_ADVISOR_LIST, state: STATE_ADVISOR_LIST, planet: PLANET_ADVISOR_LIST };
    for (const [level, roles] of Object.entries(ROLES)) expect([...roles].sort()).toEqual(lists[level as keyof typeof lists].filter(r => r !== 'none').slice().sort());
    expect(personOf('city', 'none', 'early')).toBeNull();
  });

  it('every person has a name and a title, no name twice, and none of the units\' given names', () => {
    const names = ALL_PERSONS.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const p of ALL_PERSONS) {
      expect(p.name).toMatch(/^\p{Lu}\p{Ll}+$/u);
      expect(p.title.length).toBeGreaterThan(3);
      expect(GIVEN_NAMES).not.toContain(p.name);
    }
  });

  it('a person always gets the same portrait, and the persons differ', () => {
    const a = personOf('town', 'build', 'early')!;
    expect(portraitSvg(a)).toBe(portraitSvg(a));
    const all = new Set(ALL_PERSONS.map(p => portraitSvg(p)));
    expect(all.size).toBe(ALL_PERSONS.length);
    for (const svg of all) expect(svg).toMatch(/^<svg [^>]*aria-hidden="true"[\s\S]*<\/svg>$/);
  });
});
