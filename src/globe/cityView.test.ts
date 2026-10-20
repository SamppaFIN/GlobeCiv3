import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { neighbors, pointToTile, tileCenter } from './hexTiles';
import { tilesInRings } from '../game/pathfinding';
import { buildCityTerrain, centreTriangles, CUTS, risingMaterial } from './cityView';
import type { Terrain } from '../game/terrainTypes';

const CITY = pointToTile(new THREE.Vector3(0.4, 0.3, 0.866).normalize());
const ring1 = new Set(tilesInRings(CITY, 1));
const ring2 = new Set(tilesInRings(CITY, 2));
// A mountain city with hills round it, then plains, and sea to one side
const sea = (t: number) => tileCenter(t).x > tileCenter(CITY).x + 0.008;
const terrainOf = (t: number): Terrain => (t === CITY ? 'mountains' : sea(t) ? 'ocean' : ring1.has(t) ? 'hills' : 'plains');
const build = (detail = () => 0) => buildCityTerrain({ centre: CITY, rings: 2, terrainOf, detail, colorOf: () => new THREE.Color(1, 1, 1), radius: 5, lift: 1e-6 });

describe('the city level terrain (STORY-069)', () => {
  it('triangles between tile centres that touch one another, each once', () => {
    const tris = centreTriangles(ring1);
    expect(new Set(tris.map(t => t.join(','))).size).toBe(tris.length);
    for (const [a, b, c] of tris) {
      expect(neighbors(a)).toContain(b);
      expect(neighbors(b)).toContain(c);
      expect(neighbors(a)).toContain(c);
    }
    // The six round the centre and the twelve round the first ring
    expect(tris.filter(t => t.includes(CITY))).toHaveLength(6);
    expect(tris.length).toBe(24);
  });

  it('rises by the terrain: the mountain highest, the sea flat, and the outer ring back on the globe', () => {
    const t = build();
    const spacing = 5 * Math.acos(1 / Math.sqrt(5)) / 330;
    expect(t.heightAt(CITY)).toBeCloseTo(1.7 * spacing);
    const hill = [...ring1].find(x => x !== CITY && !sea(x))!;
    expect(t.heightAt(hill)).toBeCloseTo(0.65 * spacing);
    expect(t.heightAt([...ring1].find(sea)!)).toBe(0);
    // Tiles beyond the rising rings stay on the globe
    const outer = tilesInRings(CITY, 3).find(x => !ring2.has(x))!;
    expect(t.heightAt(outer)).toBe(0);
    // Sixty-four small triangles to each big one, three corners each
    const tris = centreTriangles(ring2).length;
    expect(t.geometry.getAttribute('position').count).toBe(tris * CUTS * CUTS * 3);
  });

  it('has no cracks: a point shared by triangles rises the same in each', () => {
    const t = build(() => 0.5);
    const pos = t.geometry.getAttribute('position');
    const rise = t.geometry.getAttribute('rise');
    const seen = new Map<string, string>();
    for (let i = 0; i < pos.count; i++) {
      const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map(v => v.toFixed(5)).join(',');
      const r = [rise.getX(i), rise.getY(i), rise.getZ(i)].map(v => v.toFixed(6)).join(',');
      if (seen.has(key)) expect(seen.get(key)).toBe(r);
      else seen.set(key, r);
    }
    // Every face looks out from the globe, or it would be culled
    const v = [0, 1, 2].map(() => new THREE.Vector3());
    for (let i = 0; i < pos.count; i += 3) {
      v.forEach((x, k) => x.set(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)).add(t.origin));
      const normal = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0]));
      expect(normal.dot(v[0])).toBeGreaterThan(0);
    }
    // Sites lie well inside rising tiles, for trees and buildings
    expect(t.sites.length).toBeGreaterThan(19);
    expect(t.sites.every(s => ring2.has(s.tile))).toBe(true);
  });

  it('a material rises by the relief uniform', () => {
    const relief = { value: 0.5 };
    const m = risingMaterial(new THREE.MeshLambertMaterial(), relief);
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}', fragmentShader: '' };
    m.onBeforeCompile(shader as never, null as never);
    expect(shader.uniforms.relief).toBe(relief);
    expect(shader.vertexShader).toContain('transformed += rise * relief;');
    expect(shader.vertexShader).toContain('attribute vec3 rise;');
  });
});
