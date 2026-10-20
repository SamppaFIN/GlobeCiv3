import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { neighbors, pointToTile } from '../globe/hexTiles';
import { cityAdvice, type CityNeeds } from './advisors';
import { BUILDS, cityGold, cityMood, cityYield, foundCity, RESOURCE_BUILDINGS, RESOURCE_BUILDING_LIST, UPKEEP, workedYield, type City } from './cities';
import { tilesInRings } from './pathfinding';
import { bestTile, fits } from './placement';
import { ADVANCES } from './science';
import type { ResourceKind, Terrain } from './terrainTypes';

const CENTRE = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const [HORSES, GOLD, SHORE] = neighbors(CENTRE);
const ring2 = tilesInRings(CENTRE, 2).filter(t => t !== CENTRE && !neighbors(CENTRE).includes(t));
const FISH = ring2.find(t => neighbors(t).includes(SHORE))!;
const FAR_HORSES = tilesInRings(CENTRE, 3).find(t => !tilesInRings(CENTRE, 2).includes(t))!;
const terrains = new Map<number, Terrain>([[HORSES, 'plains'], [GOLD, 'mountains'], [FISH, 'ocean'], [FAR_HORSES, 'plains']]);
const kinds = new Map<number, ResourceKind>([[HORSES, 'horses'], [GOLD, 'gold'], [FISH, 'fish'], [FAR_HORSES, 'horses']]);
const ground = { terrainOf: (t: number) => terrains.get(t) ?? 'grassland', heightOf: () => 0.2, resourceOf: (t: number) => kinds.get(t) ?? null };

function city(size = 1, ...buildings: City['buildings']): City {
  const c = foundCity([], CENTRE);
  c.size = size;
  c.buildings = buildings;
  return c;
}

describe('resource buildings (STORY-073, own)', () => {
  it('one for each kind, 40 shields and no upkeep, with a reward that is an advance, a unit or none', () => {
    expect(RESOURCE_BUILDING_LIST).toHaveLength(11);
    expect(new Set(RESOURCE_BUILDING_LIST.map(b => RESOURCE_BUILDINGS[b].kind)).size).toBe(11);
    for (const b of RESOURCE_BUILDING_LIST) {
      expect([BUILDS[b].cost, UPKEEP[b]]).toEqual([40, 0]);
      const r = RESOURCE_BUILDINGS[b].reward;
      expect(r === null || r in ADVANCES || ['scout', 'settler', 'horseman'].includes(r)).toBe(true);
    }
  });

  it('give their bonus each day: food, shields, a calmed citizen and gold', () => {
    const yieldOf = (id: number, centre: boolean) => workedYield({ terrain: ground.terrainOf(id), resource: null }, centre);
    const plain = cityYield(city(1), yieldOf);
    const built = cityYield(city(1, 'harbour', 'forge', 'farmstead'), yieldOf);
    expect([built.food - plain.food, built.shield - plain.shield]).toEqual([3, 3]);
    expect(cityMood(city(6, 'jeweller'), 0, 1).calmed).toBe(1);
    const y = { food: 0, shield: 0, trade: 0 };
    expect(cityGold(city(1, 'mint'), y, 50) - cityGold(city(1), y, 50)).toBe(3);
  });

  it('stand on a known tile of their kind in the city area, the harbour on the shore next to the fish', () => {
    expect(fits(city(1), 'stable', HORSES, ground)).toBe(true);
    expect(fits(city(1), 'stable', GOLD, ground)).toBe(false);
    // The mint stands on its gold mountain, where nothing else may
    expect(fits(city(1), 'mint', GOLD, ground)).toBe(true);
    expect(fits(city(1), 'temple', GOLD, ground)).toBe(false);
    expect(fits(city(1), 'harbour', SHORE, ground)).toBe(true);
    expect(fits(city(1), 'harbour', FISH, ground)).toBe(false);
    // The third ring is the city's area from size 5
    expect(fits(city(1), 'stable', FAR_HORSES, ground)).toBe(false);
    expect(fits(city(5), 'stable', FAR_HORSES, ground)).toBe(true);
    expect(bestTile(city(1, 'stable'), 'stable', ground)).toBe(HORSES);
    // A kind not known is no tile of it
    expect(fits(city(1), 'stable', HORSES, { ...ground, resourceOf: () => null })).toBe(false);
  });

  it('the governors build one when nothing else is needed: Kasvattaja for food, Vartija for shields, Kartoittaja any', () => {
    const n: CityNeeds = { available: ['mint', 'stable', 'harbour'], soldiers: 1, unrestNear: false, disorder: false, threat: false, soldier: 'warrior', settlers: 0 };
    expect(cityAdvice('growth', city(1), n)?.build).toBe('harbour');
    expect(cityAdvice('defend', city(1), n)?.build).toBe('stable');
    expect(cityAdvice('explore', city(1), n)?.build).toBe('mint');
    expect(cityAdvice('explore', city(1), { ...n, available: [] })?.build).toBeNull();
  });
});
