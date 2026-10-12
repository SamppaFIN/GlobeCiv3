import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile } from '../globe/hexTiles';
import { BUILDS, buy, buyCost, cityDay, cityGold, cityRings, cityYield, daysToBuild, daysToGrow, foundCity, granary, payUpkeep, shortfall, workedTiles, workedYield, type City } from './cities';
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
    // A city bigger than its area works all of its three rings (STORY-039): 37 tiles
    expect(workedTiles(city(40), yieldOf)).toHaveLength(37);
  });

  it('the city area grows with the city: one ring at size 1, two at 2 to 4, three from 5 (own rule)', () => {
    expect([1, 2, 4, 5, 12].map(cityRings)).toEqual([1, 2, 2, 3, 3]);
    // Size 1 works a tile of the first ring only
    const near = new Set(tilesInRings(START, 1));
    expect(near.has(workedTiles(city(1), yieldOf)[1])).toBe(true);
  });

  it('the focus chooses the tiles: food 4 × food, balanced 2 × food, production 3 × shields', () => {
    const c = city(1);
    expect(workedTiles(c, yieldOf)).toEqual([START, OCEAN_FISH]);
    c.focus = 'food';
    expect(workedTiles(c, yieldOf)).toEqual([START, OCEAN_FISH]);
    c.focus = 'production';
    expect(workedTiles(c, yieldOf)).toEqual([START, FOREST]);
    expect(cityYield(c, yieldOf)).toEqual({ food: 4, shield: 2, trade: 1, surplus: 2 });
  });

  it('yield the source table values of the worked tiles, less 2 food per citizen', () => {
    // The grassland centre is irrigated and has a road (STORY-040): 3 food and 1 trade; the
    // ocean with fish 3 food and 2 trade
    expect(cityYield(city(1), yieldOf)).toEqual({ food: 6, shield: 0, trade: 3, surplus: 4 });
    expect(cityYield(city(2), yieldOf)).toEqual({ food: 7, shield: 2, trade: 3, surplus: 3 });
    // Three desert tiles more: shields only, and the citizens go hungry
    expect(cityYield(city(5), yieldOf)).toEqual({ food: 7, shield: 5, trade: 3, surplus: -3 });
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
    const c = city(2); // 7 food, 2 shields, 3 trade, surplus 3
    expect(cityYield(c, yieldOf, undefined, { units: 3, settlers: 0 })).toEqual({ food: 7, shield: 2, trade: 3, surplus: 3 });
    expect(cityYield(c, yieldOf, undefined, { units: 5, settlers: 2 })).toEqual({ food: 7, shield: 0, trade: 3, surplus: 1 });
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

  it('build a 10-shield Soturi, then turn shields into gold; an Uudisasukas costs 40 shields and a citizen', () => {
    const c = city(2);
    const y = cityYield(c, yieldOf); // 2 shields a day
    expect(daysToBuild(c, y)).toBe(5);
    const done = Array.from({ length: 5 }, () => cityDay(c, { ...y, surplus: 0 }));
    expect(done).toEqual([null, null, null, null, 'warrior']);
    // One soldier is enough: the city goes on to gold by itself (STORY-039; settlers next
    // took a citizen at each growth and their upkeep stopped the city growing)
    expect([c.shields, c.build]).toEqual([0, 'coinage']);
    c.build = 'settler';
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

  it('carry the food over the box when growing, and with a granary half of the new box (Freeciv)', () => {
    const plain = city(1);
    plain.food = 18;
    cityDay(plain, { food: 6, shield: 0, trade: 0, surplus: 4 });
    expect([plain.size, plain.food]).toEqual([2, 2]);
    const stored = city(1);
    stored.buildings.push('granary');
    stored.food = 18;
    cityDay(stored, { food: 6, shield: 0, trade: 0, surplus: 4 });
    // 2 over the box of 20, and half of the new box of 30
    expect([stored.size, stored.food]).toEqual([2, 17]);
  });

  it('build a granary, walls or a marketplace once; then the city goes on to gold', () => {
    const c = city(2);
    c.build = 'granary';
    c.shields = 59;
    expect(cityDay(c, { food: 0, shield: 1, trade: 0, surplus: 0 })).toBe('granary');
    expect([c.buildings, c.build, c.shields]).toEqual([['granary'], 'coinage', 0]);
    // A phalanx (Freeciv civ1: 20 shields) is a soldier: then gold too
    c.build = 'phalanx';
    c.shields = 19;
    expect(cityDay(c, { food: 0, shield: 1, trade: 0, surplus: 0 })).toBe('phalanx');
    expect([c.build, BUILDS.phalanx.cost]).toEqual(['coinage', 20]);
    expect([BUILDS.granary.cost, BUILDS.walls.cost, BUILDS.market.cost]).toEqual([60, 120, 80]);
  });

  it('trade is gold, half as much again with a marketplace; buildings cost their upkeep, and are sold when the gold runs out', () => {
    const c = city(3);
    expect(cityGold(c, { food: 0, shield: 0, trade: 5 })).toBe(5);
    c.buildings.push('market');
    expect(cityGold(c, { food: 0, shield: 0, trade: 5 })).toBe(7);
    c.buildings.push('walls', 'granary');
    // Upkeep 1 + 2 + 1 a day
    expect(payUpkeep(c, 10)).toEqual({ treasury: 6, sold: [] });
    // 3 gold cannot pay 4: the walls (the dearest upkeep) go for their cost, 120
    expect(payUpkeep(c, 3)).toEqual({ treasury: 119, sold: ['walls'] });
    expect(c.buildings).toEqual(['market', 'granary']);
  });

  it('buying costs 2 gold a missing shield, a unit more, and twice as much with nothing in store (Freeciv)', () => {
    const c = city(2);
    expect(buyCost(c)).toBe(50); // Soturi: (2 × 10 + 10² / 20) × 2
    c.shields = 4;
    expect(buyCost(c)).toBe(13); // 2 × 6 + 36 / 20
    c.build = 'granary';
    c.shields = 0;
    expect(buyCost(c)).toBe(240);
    c.shields = 30;
    expect(buyCost(c)).toBe(60);
    // Bought: the shields are in store, the build is done the next day
    expect(buy(c, 100)).toBe(60);
    expect(c.shields).toBe(60);
    expect(buyCost(c)).toBe(0);
    expect(buy(c, 100)).toBeNull();
    // Not enough gold: nothing bought
    c.build = 'walls';
    expect(buy(c, 10)).toBeNull();
    expect(c.shields).toBe(60);
  });

  it('Kultaa turns the shields into gold each day and builds nothing (Freeciv classic Coinage)', () => {
    const c = city(2);
    c.build = 'coinage';
    c.shields = 5;
    const y = { food: 4, shield: 3, trade: 1, surplus: 0 };
    expect(cityDay(c, y)).toBeNull();
    expect(c.shields).toBe(5);
    expect(cityGold(c, y)).toBe(4);
    expect([daysToBuild(c, y), buyCost(c)]).toEqual([null, 0]);
  });
});
