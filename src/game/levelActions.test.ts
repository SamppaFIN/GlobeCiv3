import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointToTile, tileCenter } from '../globe/hexTiles';
import { MapState } from './mapping';
import { areaName, compassIndex, distinctNames, landscapeOf, provinceName } from './names';
import { tilesInRings } from './pathfinding';
import { advance, startProgress, UNLOCK_SHARE } from './progress';
import { Units, type World } from './units';

const START = new THREE.Vector3(0.4, 0.3, 0.866).normalize();
const START_TILE = pointToTile(START);
// Test world: all land, city areas are bands of longitude around the start (7 per province)
const cityOf = (id: number) => {
  const c = tileCenter(id);
  return 1000 + Math.floor(Math.atan2(c.x, c.z) * 40);
};
function makeWorld(map = new MapState()): World & { map: MapState } {
  return {
    map,
    cost: () => 1,
    isMapped: id => map.isMapped(id),
    hasResource: () => false,
    reveal: ids => { map.reveal(ids); },
    siteScore: id => -tileCenter(id).angleTo(START),
    cityOf,
  };
}

describe('progress', () => {
  it('opens the province level at 60 % of the home province, then the state level', () => {
    const p = startProgress();
    expect(p.openLevel).toBe(3);
    expect(advance(p, UNLOCK_SHARE - 0.01, 0.9)).toBeNull();
    expect(advance(p, UNLOCK_SHARE, 0.1)).toBe(2);
    expect(p).toEqual({ openLevel: 2, meter: 'state' });
    expect(advance(p, 1, UNLOCK_SHARE - 0.01)).toBeNull();
    expect(advance(p, 1, UNLOCK_SHARE)).toBe(1);
    expect(advance(p, 1, 1)).toBeNull();
    expect(p.openLevel).toBe(1);
  });
});

describe('names', () => {
  it('name areas by direction and landscape, with the illative', () => {
    expect(areaName(true, 0, 'coast')).toEqual({ name: 'Kotialue', illative: 'Kotialueelle' });
    expect(areaName(false, 2, 'coast')).toEqual({ name: 'Itäranta', illative: 'Itärantaan' });
    expect(areaName(false, 5, 'swamp')).toEqual({ name: 'Lounaissuo', illative: 'Lounaissuohon' });
    expect(areaName(false, 1, 'cape')).toEqual({ name: 'Koillisniemi', illative: 'Koillisniemeen' });
    expect(provinceName(false, 2, 'lowland').name).toBe('Itälääni');
    expect(provinceName(false, 2, 'coast').name).toBe('Rannikkolääni');
    expect(landscapeOf(['ocean', 'ocean', 'grassland', 'forest'])).toBe('coast');
    expect(landscapeOf(['hills', 'hills', 'grassland'])).toBe('hills');
    const names = distinctNames([provinceName(false, 0, 'coast'), provinceName(false, 4, 'coast')], [0, 4], 'province');
    expect(names.map(n => n.name)).toEqual(['Rannikkolääni', 'Etelälääni']);
  });

  it('point the compass the right way', () => {
    const at = (dx: number, dy: number) => START.clone().add(new THREE.Vector3(dx, dy, 0)).normalize();
    expect(compassIndex(START, at(0, 0.05))).toBe(0);
    expect(compassIndex(START, at(0, -0.05))).toBe(4);
  });
});

describe('level actions', () => {
  it('skip an area: exploring scouts never head for its tiles', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    const home = cityOf(START_TILE);
    // Skip the areas on both sides of home
    for (const c of [home - 1, home + 1]) units.setAreaPlan(c, 'skip', world);
    let goals = 0;
    for (let d = 0; d < 60; d++) {
      units.day(world);
      for (const u of units.units) {
        const goal = u.path.at(-1);
        if (u.kind !== 'scout' || goal === undefined) continue;
        goals++;
        expect([home - 1, home + 1]).not.toContain(cityOf(goal));
      }
    }
    expect(goals).toBeGreaterThan(10);
  });

  it('settle an area: its best site comes first; the state line changes sight and the site search', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    expect(units.sight).toBe(3); // Tutkimus
    const ring = tilesInRings(START_TILE, 3).filter(id => cityOf(id) !== cityOf(START_TILE));
    const area = cityOf(ring[0]);
    units.setAreaPlan(area, 'settle', world);
    expect(cityOf(units.currentSite()!)).toBe(area);
    const before = units.sites.length;
    units.setStateLine('expand', world);
    expect(units.sight).toBe(2);
    expect(units.sites.length).toBeGreaterThan(before);
  });

  it('send an expedition: the exploring scouts head for the tile', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    const target = pointToTile(START.clone().add(new THREE.Vector3(0.03, -0.02, 0)).normalize());
    expect(units.sendTo(target, world)).toBe(true);
    let reached = false;
    for (let d = 0; d < 80 && !reached; d++) {
      units.day(world);
      reached = units.units.some(u => u.tile === target);
    }
    expect(reached).toBe(true);
  });
});
