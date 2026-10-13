import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile } from '../globe/hexTiles';
import { BUILDS, cityGold, cityScience, foundCity, UPKEEP } from './cities';
import { advanceCost, NEEDS, Research, splitTrade } from './science';

const START = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());

describe('science (STORY-040, Freeciv civ1)', () => {
  it('an advance costs 10 bulbs for each advance known, plus one', () => {
    expect([0, 1, 2, 5].map(advanceCost)).toEqual([10, 20, 30, 60]);
  });

  it('only what an advance needs opens it; a building needs its advance', () => {
    const r = new Research();
    expect(r.available()).toEqual(['alphabet', 'bronze', 'ceremonial', 'pottery', 'masonry']);
    r.known.add('bronze');
    expect(r.available()).toContain('currency');
    expect(r.available()).not.toContain('writing');
    expect(NEEDS).toEqual({ granary: 'pottery', walls: 'masonry', market: 'currency', library: 'writing', phalanx: 'bronze', temple: 'ceremonial', aqueduct: 'construction', colosseum: 'construction', colossus: 'bronze', gardens: 'pottery', greatwall: 'masonry' });
  });

  it('bulbs gather even without a target; the target is learned when they reach its cost, and the rest carries over', () => {
    const r = new Research();
    expect(r.add(6)).toBeNull();
    r.target = 'pottery';
    expect(r.add(3)).toBeNull();
    expect(r.add(4)).toBe('pottery');
    expect([r.bulbs, r.target, [...r.known]]).toEqual([3, null, ['pottery']]);
    // The second costs 20
    r.target = 'masonry';
    expect(r.add(16)).toBeNull();
    expect(r.add(1)).toBe('masonry');
    expect(new Research(r.save()).save()).toEqual(r.save());
  });

  it('the tax rate splits trade into gold and science; a marketplace and a library add half', () => {
    expect(splitTrade(5, 50)).toEqual({ gold: 3, luxury: 0, science: 2 });
    expect(splitTrade(5, 30)).toEqual({ gold: 2, luxury: 0, science: 3 });
    // Luxury takes its share before science (STORY-046)
    expect(splitTrade(10, 50, 30)).toEqual({ gold: 5, luxury: 3, science: 2 });
    expect(splitTrade(10, 70, 30)).toEqual({ gold: 7, luxury: 3, science: 0 });
    const c = foundCity([], START);
    const y = { food: 0, shield: 0, trade: 10 };
    expect([cityGold(c, y, 30), cityScience(c, y, 30)]).toEqual([3, 7]);
    c.buildings.push('market', 'library');
    expect([cityGold(c, y, 30), cityScience(c, y, 30)]).toEqual([4, 10]);
    expect([BUILDS.library.cost, UPKEEP.library]).toEqual([80, 1]);
  });
});
