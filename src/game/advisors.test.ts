import { describe, expect, it } from 'vitest';
import { planetTarget, STATE_PLANS, cityAdvice, expeditionTarget, exploreTarget, luxuryStep, nextAdvance, provinceBuild, settleAreas, type CityNeeds } from './advisors';
import type { Build } from './cities';
import { foundCity } from './cities';

const needs = (over: Partial<CityNeeds> = {}): CityNeeds => ({
  available: ['warrior', 'settler', 'coinage'], soldiers: 0, unrestNear: false, threat: false, soldier: 'warrior', settlers: 0, disorder: false, ...over,
});
const city = (size: number) => {
  const c = foundCity([], 0);
  c.size = size;
  return c;
};

describe('city advisors', () => {
  it('Oma ohjaus leaves the city to the player', () => {
    expect(cityAdvice('none', city(3), needs())).toBeNull();
  });

  it('Kasvattaja: food, a temple before disorder, a granary from size 2, else as it is', () => {
    expect(cityAdvice('growth', city(1), needs({ available: ['granary'] }))).toEqual({ focus: 'food', build: null });
    expect(cityAdvice('growth', city(2), needs({ available: ['granary'] }))).toEqual({ focus: 'food', build: 'granary' });
    expect(cityAdvice('growth', city(4), needs({ available: ['granary', 'temple'], unrestNear: true }))).toEqual({ focus: 'food', build: 'temple' });
    // Not known yet: nothing to build (a settler of its own is there already)
    expect(cityAdvice('growth', city(4), needs({ unrestNear: true, settlers: 1 }))!.build).toBeNull();
    // A settler of its own to improve the land from size 3 (STORY-060)
    expect(cityAdvice('growth', city(3), needs({ available: ['settler', 'granary'] }))!.build).toBe('settler');
    expect(cityAdvice('growth', city(2), needs({ available: ['settler', 'granary'] }))!.build).toBe('granary');
  });

  it('Vartija: production and a soldier in every city; two soldiers and walls under threat', () => {
    expect(cityAdvice('defend', city(1), needs({ soldier: 'phalanx' }))).toEqual({ focus: 'production', build: 'phalanx' });
    expect(cityAdvice('defend', city(1), needs({ soldiers: 1 }))!.build).toBeNull();
    expect(cityAdvice('defend', city(1), needs({ soldiers: 1, threat: true }))!.build).toBe('warrior');
    expect(cityAdvice('defend', city(1), needs({ soldiers: 2, threat: true, available: ['walls'] }))!.build).toBe('walls');
  });

  it('Kartoittaja: balanced, and the least mapped area that is not all mapped', () => {
    expect(cityAdvice('explore', city(2), needs())).toEqual({ focus: 'balanced', build: null });
    expect(exploreTarget([[7, 0.9], [8, 0.2], [9, 0.2], [10, 1]])).toBe(8);
    expect(exploreTarget([[7, 1], [8, 1]])).toBeNull();
  });
});

describe('province advisors', () => {
  it('Asuttaja: the two best areas without a city, mapped at least a quarter', () => {
    expect(settleAreas([
      { area: 1, hasCity: true, share: 1, best: 99 },
      { area: 2, hasCity: false, share: 0.5, best: 80 },
      { area: 3, hasCity: false, share: 0.1, best: 95 },
      { area: 4, hasCity: false, share: 0.3, best: 85 },
      { area: 5, hasCity: false, share: 0.9, best: 60 },
    ])).toEqual([4, 2]);
  });

  it('Tutkimusmatkailija: the nearest area under 60 %, else the least mapped one left', () => {
    expect(expeditionTarget([{ area: 1, share: 0.2, distance: 5 }, { area: 2, share: 0.5, distance: 2 }, { area: 3, share: 0.7, distance: 1 }])).toBe(2);
    expect(expeditionTarget([{ area: 1, share: 0.9, distance: 5 }, { area: 2, share: 0.7, distance: 2 }])).toBe(2);
    expect(expeditionTarget([{ area: 1, share: 1, distance: 5 }])).toBeNull();
  });

  it('Vartija: a soldier first, then walls in a city near the border', () => {
    const n = { soldiers: 0, border: true, available: ['walls'] as Build[], soldier: 'phalanx' as const, walls: false };
    expect(provinceBuild('defend', n)).toBe('phalanx');
    expect(provinceBuild('defend', { ...n, soldiers: 1 })).toBe('walls');
    expect(provinceBuild('defend', { ...n, soldiers: 1, border: false })).toBeNull();
    expect(provinceBuild('defend', { ...n, soldiers: 1, walls: true })).toBeNull();
    expect(provinceBuild('settle', n)).toBeNull();
  });
});

describe('state advisors', () => {
  it('the next advance follows the order, else any that can be researched', () => {
    expect(nextAdvance(STATE_PLANS.science.order, ['bronze', 'pottery', 'alphabet'])).toBe('alphabet');
    expect(nextAdvance(STATE_PLANS.war.order, ['pottery', 'alphabet'])).toBe('alphabet');
    expect(nextAdvance(['monarchy'], ['pottery'])).toBe('pottery');
    expect(nextAdvance(STATE_PLANS.expand.order, [])).toBeNull();
  });

  it('luxury goes up a step in disorder and back a step after ten calm days', () => {
    expect(luxuryStep(0, true, 0, [0, 10, 20, 30])).toBe(10);
    expect(luxuryStep(30, true, 0, [0, 10, 20, 30])).toBe(30);
    expect(luxuryStep(20, false, 9, [0, 10, 20, 30])).toBe(20);
    expect(luxuryStep(20, false, 10, [0, 10, 20, 30])).toBe(10);
    expect(luxuryStep(0, false, 30, [0, 10, 20, 30])).toBe(0);
  });
});

describe('Kasvattaja and the size limit (STORY-054)', () => {
  it('an arena once the temple is there, and an aqueduct a size before the limit', () => {
    expect(cityAdvice('growth', city(6), needs({ available: ['colosseum'], unrestNear: true, disorder: true }))!.build).toBe('colosseum');
    // Only near disorder: no arena for its upkeep of 4 (STORY-060)
    expect(cityAdvice('growth', city(6), needs({ available: ['colosseum'], unrestNear: true, settlers: 1 }))!.build).toBeNull();
    expect(cityAdvice('growth', city(9), needs({ available: ['aqueduct', 'granary'] }))!.build).toBe('aqueduct');
    expect(cityAdvice('growth', city(8), needs({ available: ['aqueduct', 'granary'] }))!.build).toBe('granary');
  });
});

describe('planet advisors (STORY-057)', () => {
  const states = [
    { state: 4, land: 900, mapped: 0.1, conquered: true },
    { state: 7, land: 1200, mapped: 0.3, conquered: false },
    { state: 9, land: 600, mapped: 0.05, conquered: false },
  ];
  it('Valloittaja the open state with the most land, Löytöretkeilijä the least mapped, Linnoittaja none', () => {
    expect(planetTarget('conquer', states)).toBe(7);
    expect(planetTarget('explore', states)).toBe(9);
    expect(planetTarget('fortify', states)).toBeNull();
    expect(planetTarget('none', states)).toBeNull();
    expect(planetTarget('conquer', [states[0]])).toBeNull();
  });
});
