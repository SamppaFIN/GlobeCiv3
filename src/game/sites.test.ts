import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile, tileCenter } from '../globe/hexTiles';
import { tilesInRings } from './pathfinding';
import { GOOD_SITE, goodSite, SITE_SPACING } from './sites';

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
