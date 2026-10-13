import { describe, expect, it } from 'vitest';
import { economy, type CityEconomy } from './economy';

const city = (over: Partial<CityEconomy>): CityEconomy => ({
  food: 0, surplus: 0, shield: 0, unitUpkeep: 0, trade: 0, gold: 0, coinage: 0, science: 0, luxury: 0, buildingUpkeep: 0, resources: [], ...over,
});

describe('economy', () => {
  it('sums the cities, nets the gold against the upkeep, and counts the resources worked', () => {
    const e = economy([
      city({ food: 6, surplus: 2, shield: 3, unitUpkeep: 1, trade: 4, gold: 2, science: 2, buildingUpkeep: 1, resources: ['Kala', 'Hevoset'] }),
      city({ food: 4, surplus: -1, shield: 2, trade: 3, gold: 3, coinage: 2, science: 1, luxury: 1, resources: ['Kala'] }),
    ]);
    expect(e).toMatchObject({ food: 10, surplus: 1, shield: 5, unitUpkeep: 1, trade: 7, gold: 5, coinage: 2, science: 3, luxury: 1, buildingUpkeep: 1, net: 4 });
    expect(e.resources).toEqual([['Kala', 2], ['Hevoset', 1]]);
  });

  it('is all zero with no cities', () => {
    expect(economy([])).toMatchObject({ food: 0, trade: 0, net: 0, resources: [] });
  });
});
