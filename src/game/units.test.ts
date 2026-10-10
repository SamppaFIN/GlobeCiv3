import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { neighbors, pointToTile, tileCenter } from '../globe/hexTiles';
import { GameClock } from './clock';
import { MapState } from './mapping';
import { findPath, tilesInRings } from './pathfinding';
import { directionName, unitStatus, Units, type World } from './units';

// A test world around a start point: land costs 1 (hills 2 on a stripe), and "sea"
// is everything with x > 0.43 near the start, so paths have to go around it
const START = new THREE.Vector3(0.4, 0.3, 0.866).normalize();
const START_TILE = pointToTile(START);
function makeWorld(map = new MapState(), resources = new Set<number>()): World & { map: MapState } {
  return {
    map,
    cost: id => {
      const c = tileCenter(id);
      if (c.x > 0.43 && c.y > 0.25) return Infinity;
      return Math.abs(c.y - 0.33) < 0.003 ? 2 : 1;
    },
    isMapped: id => map.isMapped(id),
    hasResource: id => resources.has(id),
    reveal: ids => { map.reveal(ids); },
    siteScore: id => -tileCenter(id).angleTo(START),
    // City areas of the test: bands of latitude, 7 to a province
    cityOf: id => Math.floor((tileCenter(id).y + 1) * 200),
  };
}

describe('game clock', () => {
  it('turns a day every 1.5 s of wall time per speed, stops when paused and caps catch-up', () => {
    const clock = new GameClock();
    expect(clock.advance(1.0)).toBe(0);
    expect(clock.advance(0.5)).toBe(1);
    expect(clock.day).toBe(2);
    clock.speed = 2;
    expect(clock.advance(0.75)).toBe(1);
    clock.speed = 4;
    expect(clock.advance(1.5)).toBe(4);
    clock.paused = true;
    expect(clock.advance(10)).toBe(0);
    clock.paused = false;
    // A hidden tab coming back: at most 8 days in one frame
    expect(clock.advance(600)).toBe(8);
    expect(clock.day).toBe(15);
  });
});

describe('pathfinding', () => {
  it('finds a connected path around the sea, and none into it', () => {
    const world = makeWorld();
    const goal = pointToTile(new THREE.Vector3(0.47, 0.2, 0.86).normalize());
    const path = findPath(START_TILE, goal, world.cost)!;
    expect(path.at(-1)).toBe(goal);
    let prev = START_TILE;
    for (const id of path) {
      expect(neighbors(prev)).toContain(id);
      expect(Number.isFinite(world.cost(id))).toBe(true);
      prev = id;
    }
    const sea = pointToTile(new THREE.Vector3(0.5, 0.35, 0.79).normalize());
    expect(findPath(START_TILE, sea, world.cost)).toBeNull();
  });
});

describe('units', () => {
  it('start with a settler on the landing tile and two scouts beside it, who map around themselves', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    expect(units.units.map(u => u.kind)).toEqual(['settler', 'scout', 'scout']);
    expect(units.settler!.tile).toBe(START_TILE);
    for (const u of units.units.filter(x => x.kind === 'scout')) {
      expect(neighbors(START_TILE)).toContain(u.tile);
      expect(world.map.share(tilesInRings(u.tile, 2))).toBe(1);
    }
  });

  it('explore the fog day by day, slower through costly tiles', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    const before = world.map.count;
    for (let d = 0; d < 30; d++) units.day(world);
    expect(world.map.count).toBeGreaterThan(before + 20);
    // Every step went to a neighbour of the previous tile (no teleporting)
    const scout = units.units[1];
    expect(Number.isFinite(world.cost(scout.tile))).toBe(true);
  });

  it('follow the flag and drop it on arrival', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    const flag = pointToTile(new THREE.Vector3(0.35, 0.2, 0.92).normalize());
    units.flag = flag;
    for (const u of units.units) u.path = [];
    let reached = false;
    for (let d = 0; d < 200 && !reached; d++) {
      units.day(world);
      reached = units.units.some(u => u.tile === flag);
    }
    expect(reached).toBe(true);
    expect(units.flag).toBeNull();
  });

  it('gather from a mapped resource tile back to the camp, and defend at the camp', () => {
    const map = new MapState();
    const resource = pointToTile(new THREE.Vector3(0.39, 0.32, 0.86).normalize());
    const world = makeWorld(map, new Set([resource]));
    const units = new Units(START_TILE, world);
    map.reveal(tilesInRings(resource, 1));
    const [, gatherer, defender] = units.units;
    units.setMode(gatherer, 'gather');
    units.setMode(defender, 'defend');
    for (let d = 0; d < 80; d++) units.day(world);
    expect(gatherer.gathered).toBeGreaterThan(0);
    expect(defender.tile).toBe(units.camp);
    expect(unitStatus(units, defender, world, () => 'Ruohomaa')).toBe('Puolustaa · leiri');
  });

  it('walk the settler to the chosen city site, where it founds the city', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    units.nextSite();
    const site = units.currentSite()!;
    expect(unitStatus(units, units.settler!, world, () => 'Ruohomaa')).toMatch(/^Kaupungin paikka: ruohomaa, \d+ pv$/);
    units.found(world);
    const founded: number[] = [];
    for (let d = 0; d < 20; d++) founded.push(...units.day(world));
    // STORY-028: at its site the settler becomes the city
    expect(founded).toEqual([site]);
    expect(units.settler).toBeUndefined();
    expect(units.camp).toBe(site);
  });

  it('names compass directions', () => {
    const north = pointToTile(START.clone().add(new THREE.Vector3(0, 0.05, 0)).normalize());
    expect(directionName(START_TILE, north)).toBe('pohjoista');
    const south = pointToTile(START.clone().add(new THREE.Vector3(0, -0.05, 0)).normalize());
    expect(directionName(START_TILE, south)).toBe('etelää');
  });
});

describe('cities and units (STORY-028)', () => {
  it('the player marks a city site on land, or on the land nearest to a sea tile', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    const land = tilesInRings(START_TILE, 3).find(id => id !== units.currentSite() && Number.isFinite(world.cost(id)))!;
    expect(units.setSite(land, world)).toBe(true);
    expect(units.currentSite()).toBe(land);
    const sea = pointToTile(new THREE.Vector3(0.46, 0.3, 0.84).normalize());
    expect(world.cost(sea)).toBe(Infinity);
    expect(units.setSite(sea, world)).toBe(true);
    const site = units.currentSite()!;
    expect(Number.isFinite(world.cost(site))).toBe(true);
    expect(tileCenter(site).angleTo(tileCenter(sea))).toBeLessThan(0.05);
  });

  it('cities add soldiers that stay put, and settlers that get new sites', () => {
    const world = makeWorld();
    const units = new Units(START_TILE, world);
    units.found(world);
    for (let d = 0; d < 20 && units.settler; d++) units.day(world);
    expect(units.settler).toBeUndefined();
    expect(units.sites).toEqual([]);
    const soldier = units.spawn('warrior', START_TILE, world);
    expect([soldier.name, soldier.mode]).toEqual(['Soturi 1', 'defend']);
    for (let d = 0; d < 10; d++) units.day(world);
    expect(soldier.tile).toBe(START_TILE);
    const settler = units.spawn('settler', START_TILE, world);
    expect(units.settler).toBe(settler);
    expect(units.sites.length).toBeGreaterThan(0);
    expect(new Set(units.units.map(u => u.id)).size).toBe(units.units.length);
  });
});
