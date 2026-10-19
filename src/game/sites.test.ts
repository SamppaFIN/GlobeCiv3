import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { neighbors, pointToTile, tileCenter } from '../globe/hexTiles';
import { tilesInRings } from './pathfinding';
import { feedsCity, GOOD_SITE, goodSite, SITE_SPACING } from './sites';

const CENTRE = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const centre = tileCenter(CENTRE);
// A hill of scores peaking at the centre tile, all land
const score = (id: number) => 90 - 2000 * tileCenter(id).angleTo(centre);
const land = () => true;

describe('good city sites', () => {
  it('are the best land within two rings, with a score from the top quarter', () => {
    expect(score(CENTRE)).toBeGreaterThanOrEqual(GOOD_SITE);
    expect(goodSite(CENTRE, score, land, [])).toBe(true);
    // A neighbour scores high too, but the centre beats it
    const next = tilesInRings(CENTRE, 1).find(id => id !== CENTRE)!;
    expect(score(next)).toBeGreaterThanOrEqual(GOOD_SITE);
    expect(goodSite(next, score, land, [])).toBe(false);
    // Under the threshold nothing is good, and the sea never is
    expect(goodSite(CENTRE, id => score(id) - 20, land, [])).toBe(false);
    expect(goodSite(CENTRE, score, () => false, [])).toBe(false);
  });

  it('keep clear of cities and sites already chosen', () => {
    const ring = (r: number) => tilesInRings(CENTRE, r).filter(id => !tilesInRings(CENTRE, r - 1).includes(id));
    expect(goodSite(CENTRE, score, land, [ring(SITE_SPACING - 1)[0]])).toBe(false);
    expect(goodSite(CENTRE, score, land, [ring(SITE_SPACING)[0]])).toBe(true);
  });
});

describe('a site feeds its city (STORY-065)', () => {
  // Food as the centre (irrigated where it can be) and as a worked tile: mountains 0, hills 1 + 1, grassland 2 + 1
  const FOOD = { mountains: [0, 0], hills: [2, 1], grassland: [3, 2], forest: [1, 1], fish: [3, 3] } as const;
  const world = (centre: keyof typeof FOOD, ring: keyof typeof FOOD, one?: keyof typeof FOOD) => {
    const first = neighbors(CENTRE)[0];
    return (id: number, isCentre: boolean) => FOOD[id === CENTRE ? centre : id === first && one ? one : ring][isCentre ? 0 : 1];
  };

  it('the centre and its best neighbour give the first citizen its 2 food and 1 to spare', () => {
    expect(feedsCity(CENTRE, world('mountains', 'mountains'))).toBe(false);
    expect(feedsCity(CENTRE, world('mountains', 'mountains', 'grassland'))).toBe(false);
    expect(feedsCity(CENTRE, world('mountains', 'mountains', 'fish'))).toBe(true);
    expect(feedsCity(CENTRE, world('hills', 'mountains'))).toBe(false);
    expect(feedsCity(CENTRE, world('hills', 'mountains', 'forest'))).toBe(true);
    expect(feedsCity(CENTRE, world('grassland', 'mountains'))).toBe(true);
  });
});
