import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile } from '../globe/hexTiles';
import { BUILDS, cityDay, cityYield, daysToBuild, daysToGrow, foundCity, granary, nextBuild, shortfall, workedTiles, workedYield, type City } from './cities';
import { tilesInRings } from './pathfinding';
import { type Terrain, type TileInfo } from './terrainTypes';

const START = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const [OCEAN_FISH, FOREST] = tilesInRings(START, 2).filter(id => id !== START);
// Terrains around the city; yields come from the Freeciv civ1 table in terrainTypes.ts
const info = (id: number): TileInfo => {
  if (id === START) return { terrain: 'grassland', resource: null }; // 2 (+1 irrigated centre) / 0 / 0
  if (id === OCEAN_FISH) return { terrain: 'ocean', resource: 'fish' }; // 1 + 2 / 0 / 2
  if (id === FOREST) return { terrain: 'forest' as Terrain, resource: null }; // 1 / 2 / 0
  return { terrain: 'desert', resource: null }; // 0 / 1 / 0
};
const yieldOf = (id: number, centre: boolean) => workedYield(info(id), centre);

function city(size = 1): City {
  const c = foundCity([], START);
  c.size = size;
  return c;
}

describe('cities', () => {
  it('found the capital first, with the first own name', () => {
    const cities: City[] = [];
    expect(foundCity(cities, START)).toMatchObject({ name: 'Aamuranta', capital: true, size: 1, build: 'warrior' });
    expect(foundCity(cities, OCEAN_FISH)).toMatchObject({ name: 'Kivisalmi', capital: false });
  });

  it('work the centre and one tile per citizen, by 2 × food + shields + trade', () => {
    expect(workedTiles(city(1), yieldOf)).toEqual([START, OCEAN_FISH]);
    expect(workedTiles(city(2), yieldOf)).toEqual([START, OCEAN_FISH, FOREST]);
    expect(workedTiles(city(2), yieldOf, new Set([OCEAN_FISH]))).toEqual([START, FOREST, expect.any(Number)]);
    expect(workedTiles(city(30), yieldOf)).toHaveLength(19);
  });

  it('yield the source table values of the worked tiles, less 2 food per citizen', () => {
    // The grassland centre is irrigated: 3 food; the ocean with fish 3 food and 2 trade
    expect(cityYield(city(1), yieldOf)).toEqual({ food: 6, shield: 0, trade: 2, surplus: 4 });
    expect(cityYield(city(2), yieldOf)).toEqual({ food: 7, shield: 2, trade: 2, surplus: 3 });
    // Three desert tiles more: shields only, and the citizens go hungry
    expect(cityYield(city(5), yieldOf)).toEqual({ food: 7, shield: 5, trade: 2, surplus: -3 });
    expect(workedYield({ terrain: 'hills', resource: null }, true).food).toBe(2);
    expect(workedYield({ terrain: 'forest', resource: null }, true).food).toBe(1);
  });

  it('grow when the food box of 20 + 10 per extra citizen is full, and shrink when starving', () => {
    expect([granary(1), granary(2), granary(5)]).toEqual([20, 30, 60]);
    const c = city(1);
    const y = cityYield(c, yieldOf);
    expect(daysToGrow(c, y)).toBe(5);
    for (let d = 0; d < 4; d++) cityDay(c, y);
    expect([c.size, c.food]).toEqual([1, 16]);
    cityDay(c, y);
    expect([c.size, c.food]).toEqual([2, 0]);
    const starving = city(5);
    cityDay(starving, cityYield(starving, yieldOf));
    expect([starving.size, starving.food]).toEqual([4, 0]);
  });

  it('pay upkeep under Despotism: three units free, a shield for each beyond, a food for each settler', () => {
    const c = city(2); // 7 food, 2 shields, 2 trade, surplus 3
    expect(cityYield(c, yieldOf, undefined, { units: 3, settlers: 0 })).toEqual({ food: 7, shield: 2, trade: 2, surplus: 3 });
    expect(cityYield(c, yieldOf, undefined, { units: 5, settlers: 2 })).toEqual({ food: 7, shield: 0, trade: 2, surplus: 1 });
    const six = { units: 6, settlers: 0 };
    expect(shortfall(c, cityYield(c, yieldOf, undefined, six), six)).toBe('shield');
    // Out of food with settlers to feed: a settler leaves before the city starves
    const settlers = { units: 4, settlers: 4 };
    const hungry = cityYield(c, yieldOf, undefined, settlers);
    expect(hungry.surplus).toBe(-1);
    expect(shortfall(c, hungry, settlers)).toBe('food');
    c.food = 5;
    expect(shortfall(c, hungry, settlers)).toBeNull();
  });

  it('build a 10-shield Soturi, and an Uudisasukas for 40 shields and a citizen', () => {
    const c = city(2);
    const y = cityYield(c, yieldOf); // 2 shields a day
    expect(daysToBuild(c, y)).toBe(5);
    const done = Array.from({ length: 5 }, () => cityDay(c, { ...y, surplus: 0 }));
    expect(done).toEqual([null, null, null, null, 'warrior']);
    expect(c.shields).toBe(0);
    nextBuild(c);
    expect(c.build).toBe('settler');
    expect(BUILDS.settler).toEqual({ name: 'Uudisasukas', cost: 40, pop: 1 });
    // A size-1 city waits with the shields until it can spare a citizen
    c.size = 1;
    c.shields = 39;
    expect(cityDay(c, { ...y, surplus: 0 })).toBeNull();
    expect(daysToBuild(c, y)).toBe(0);
    c.size = 2;
    expect(cityDay(c, { ...y, surplus: 0 })).toBe('settler');
    expect([c.size, c.shields]).toEqual([1, 3]);
  });
});
