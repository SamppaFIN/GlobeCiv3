import { describe, expect, it } from 'vitest';
import { cityAdvice, exploreTarget, type CityNeeds } from './advisors';
import { foundCity } from './cities';

const needs = (over: Partial<CityNeeds> = {}): CityNeeds => ({
  available: ['warrior', 'settler', 'coinage'], soldiers: 0, unrestNear: false, threat: false, soldier: 'warrior', ...over,
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
    // Not known yet: nothing to build
    expect(cityAdvice('growth', city(4), needs({ unrestNear: true }))!.build).toBeNull();
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
