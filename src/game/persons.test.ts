import { describe, expect, it } from 'vitest';
import { ALL_PERSONS, ERAS, personOf, ROLES } from './persons';
import { GIVEN_NAMES } from './personNames';
import { TOWN_ADVISOR_LIST, CITY_ADVISOR_LIST, PROVINCE_ADVISOR_LIST, STATE_ADVISOR_LIST, PLANET_ADVISOR_LIST } from './advisors';
import { portraitSvg } from '../ui/portraits';
import { BUILDS } from './cities';

describe('the advisors as people (STORY-105)', () => {
  it('each role of each level has a person of its own in each era: 105 in seven eras', () => {
    expect(ALL_PERSONS).toHaveLength(5 * 3 * ERAS.length);
    // 30 in two eras until STORY-120
    expect(ALL_PERSONS).toHaveLength(105);
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

describe('the persons of the seven eras (STORY-120)', () => {
  const ROLE_CHAINS = Object.entries(ROLES).flatMap(([level, roles]) => roles.map(role => ERAS.map(e => personOf(level as keyof typeof ROLES, role, e)!)));

  it('no name or title is a unit\'s kind or a model game\'s name, and every title is unique in its role', () => {
    const units = Object.values(BUILDS).map(b => b.name);
    for (const p of ALL_PERSONS) {
      expect(units, p.id).not.toContain(p.title);
      expect(`${p.name} ${p.title}`, p.id).not.toMatch(/Civilization|Settlers|Nuclear|Freeciv/i);
    }
    for (const chain of ROLE_CHAINS) expect(new Set(chain.map(p => p.title)).size).toBe(ERAS.length);
  });

  it('a kind\'s amount does not fall from an era to the next in a role, and stays in its bounds', () => {
    for (const chain of ROLE_CHAINS) {
      const last = new Map<string, number>();
      for (const p of chain) {
        expect(p.bonus.amount, p.id).toBeGreaterThanOrEqual(last.get(p.bonus.kind) ?? 0);
        last.set(p.bonus.kind, p.bonus.amount);
        if (p.bonus.kind === 'defense') expect(p.bonus.amount, p.id).toBeLessThanOrEqual(2);
        else if (p.bonus.kind === 'settle') expect(p.bonus.amount, p.id).toBeLessThanOrEqual(30);
        else expect(p.bonus.amount, p.id).toBeLessThanOrEqual(5);
      }
    }
  });

  it('the era gives the clothes and the headwear: the same person in another era looks different', () => {
    for (const p of ALL_PERSONS.filter(x => x.era === 'early')) {
      const looks = new Set(ERAS.map(era => portraitSvg({ ...p, id: p.id, era })));
      expect(looks.size, p.id).toBe(ERAS.length);
    }
    // A soldier's headwear and the others' differ in every era
    const soldier = personOf('city', 'defend', 'early')!;
    // The same face as a soldier and not: the picture inside its circle, the role's badge left out
    const face = (role: string, era: typeof ERAS[number]) => portraitSvg({ ...soldier, role, era }).split('</g>')[0];
    for (const era of ERAS) expect(face('defend', era), era).not.toBe(face('growth', era));
    expect(new Set(ERAS.map(era => face('defend', era))).size).toBe(ERAS.length);
  });
});
