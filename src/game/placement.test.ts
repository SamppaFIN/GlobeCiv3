import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { neighbors, pointToTile } from '../globe/hexTiles';
import { cityMood, cityScience, cityYield, foundCity, workedYield, type City } from './cities';
import { tilesInRings } from './pathfinding';
import { bestTile, fits, isBest, move, placeAll, spots, HIGHER, ROOM } from './placement';
import type { Terrain } from './terrainTypes';

const CENTRE = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const ring1 = neighbors(CENTRE);
const ring2 = tilesInRings(CENTRE, 2).filter(t => t !== CENTRE && !ring1.includes(t));
// A grassland city at height 0.2 with a hill, a mountain, a forest and the sea round it
const [HILL, MOUNTAIN, FOREST, LOW] = ring1;
const SEA = ring2.find(t => neighbors(t).includes(LOW))!;
const terrains = new Map<number, Terrain>([[HILL, 'hills'], [MOUNTAIN, 'mountains'], [FOREST, 'forest'], [SEA, 'ocean']]);
const heights = new Map<number, number>([[CENTRE, 0.2], [HILL, 0.7], [MOUNTAIN, 1.8], [FOREST, 0.25], [LOW, 0.05]]);
const ground = { terrainOf: (t: number) => terrains.get(t) ?? 'grassland', heightOf: (t: number) => heights.get(t) ?? 0.2 };

function city(...buildings: City['buildings']): City {
  const c = foundCity([], CENTRE);
  c.buildings = buildings;
  return c;
}

describe('placement', () => {
  it('a building stands on land in the two rings, not on the centre, the sea or a mountain but the quarry', () => {
    const c = city();
    expect(fits(c, 'temple', HILL, ground)).toBe(true);
    expect(fits(c, 'temple', ring2[0] === SEA ? ring2[1] : ring2[0], ground)).toBe(true);
    expect(fits(c, 'temple', CENTRE, ground)).toBe(false);
    expect(fits(c, 'temple', SEA, ground)).toBe(false);
    expect(fits(c, 'temple', MOUNTAIN, ground)).toBe(false);
    expect(fits(c, 'quarry', MOUNTAIN, ground)).toBe(true);
    const far = tilesInRings(CENTRE, 3).find(t => !tilesInRings(CENTRE, 2).includes(t))!;
    expect(fits(c, 'temple', far, ground)).toBe(false);
  });

  it('the terrain buildings stand on their terrain, the fishery on a shore', () => {
    const c = city();
    expect(fits(c, 'sawmill', FOREST, ground)).toBe(true);
    expect(fits(c, 'sawmill', LOW, ground)).toBe(false);
    expect(fits(c, 'quarry', HILL, ground)).toBe(true);
    expect(fits(c, 'quarry', LOW, ground)).toBe(false);
    expect(fits(c, 'field', LOW, ground)).toBe(true);
    expect(fits(c, 'field', HILL, ground)).toBe(false);
    expect(fits(c, 'fishery', LOW, ground)).toBe(true);
    expect(fits(c, 'fishery', HILL, ground)).toBe(neighbors(HILL).includes(SEA));
  });

  it(`up is ${HIGHER} tile spacings higher than the centre; the temple and library do best up, the field, granary and market low, the quarry on a mountain`, () => {
    const c = city();
    expect(isBest(c, 'temple', HILL, ground)).toBe(true);
    expect(isBest(c, 'temple', FOREST, ground)).toBe(false); // 0.05 higher only
    expect(isBest(c, 'library', MOUNTAIN, ground)).toBe(true);
    expect(isBest(c, 'field', LOW, ground)).toBe(true);
    expect(isBest(c, 'granary', FOREST, ground)).toBe(true);
    expect(isBest(c, 'market', HILL, ground)).toBe(false);
    expect(isBest(c, 'quarry', MOUNTAIN, ground)).toBe(true);
    expect(isBest(c, 'quarry', HILL, ground)).toBe(false);
    expect(isBest(c, 'aqueduct', LOW, ground)).toBe(false);
  });

  it('the governor puts a building on its best ground, else nearest the centre, and a tile holds two', () => {
    const c = city('temple', 'library', 'aqueduct', 'colosseum');
    expect(bestTile(c, 'temple', ground)).toBe(HILL);
    expect(bestTile(c, 'aqueduct', ground)).toBe(spots(c, 'aqueduct', ground)[0].tile);
    expect(ring1).toContain(bestTile(c, 'aqueduct', ground));
    placeAll(c, ground);
    // The temple took the hill, the library the hill too, as the mountain holds no library
    expect(c.placed).toMatchObject({ temple: HILL, library: HILL });
    expect(c.best).toEqual(['temple', 'library']);
    expect(ROOM).toBe(2);
    expect(spots(c, 'aqueduct', ground).map(s => s.tile)).not.toContain(HILL);
  });

  it('placeAll keeps where the buildings stand, gives the new ones a tile and forgets the sold ones; walls ring the city', () => {
    const c = city('field', 'walls');
    c.placed = { field: ring2.find(t => t !== SEA)!, temple: HILL };
    placeAll(c, ground);
    expect(c.placed).toEqual({ field: ring2.find(t => t !== SEA) });
    expect(c.best).toEqual(['field']);
    c.buildings.push('market');
    placeAll(c, ground);
    expect(c.placed!.market).toBeDefined();
    expect(c.best).toEqual(['field', 'market']);
  });

  it('the player moves a building to a tile where it may stand, and the bonus follows', () => {
    const c = city('temple');
    placeAll(c, ground);
    expect(c.best).toEqual(['temple']);
    expect(move(c, 'temple', SEA, ground)).toBe(false);
    expect(move(c, 'market', LOW, ground)).toBe(false);
    expect(move(c, 'temple', LOW, ground)).toBe(true);
    expect(c.placed!.temple).toBe(LOW);
    expect(c.best).toEqual([]);
  });

  it('on their best ground the buildings give their bonus (own numbers)', () => {
    const yieldOf = (id: number, centre: boolean) => workedYield({ terrain: ground.terrainOf(id), resource: null }, centre);
    const c = city('field', 'granary', 'market', 'quarry');
    const plain = cityYield(c, yieldOf);
    c.best = ['field', 'granary', 'market', 'quarry'];
    const best = cityYield(c, yieldOf);
    expect(best.food - plain.food).toBe(2);
    expect(best.trade - plain.trade).toBe(1);
    expect(best.shield - plain.shield).toBe(1);
    // A temple up calms two, a library up brings +1 science a day
    const t = city('temple');
    t.size = 7;
    expect(cityMood(t, 0, 1).calmed).toBe(1);
    t.best = ['temple'];
    expect(cityMood(t, 0, 1).calmed).toBe(2);
    const l = city('library');
    const y = { food: 4, shield: 2, trade: 10, surplus: 2 };
    expect(cityScience(l, y, 50)).toBe(7);
    l.best = ['library'];
    expect(cityScience(l, y, 50)).toBe(8);
    expect(cityScience(l, { ...y, disorder: true }, 50)).toBe(0);
  });
});
