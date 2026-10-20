/**
 * cityView.ts — the city level (STORY-069; Sami 2026-10-20: the Settlers test's height
 * differences and buildings as the city level, docs/design/kaupunkitaso.md). Close to a city
 * its area rises into relief: the triangles between neighbouring tile centres are cut into
 * smaller ones, raised by each tile's terrain with a little noise, coloured by the terrain
 * and shaded flat under the light from the top left, with shadows, trees, rocks and the
 * city's houses and buildings. Own code after the Settlers test's technique: a
 * vertex-coloured triangle mesh through the tile centres, flat shading and a shadow map.
 *
 * Everything is built around the city's own origin, so that it keeps its precision close
 * up, and the relief is an offset scaled by a uniform: the land rises when the camera
 * comes close, and sinks back when it leaves (rule 5: by the wall clock).
 */
import * as THREE from 'three';
import { neighbors, tileCenter } from './hexTiles';
import { tilesInRings } from '../game/pathfinding';
import type { Terrain } from '../game/terrainTypes';

/** Height of a terrain's land and how rough it is, in tile spacings (own). */
const RELIEF: Record<Terrain, [number, number]> = {
  ocean: [0, 0], arctic: [0.3, 0.12], desert: [0.1, 0.06], forest: [0.28, 0.12], grassland: [0.16, 0.06],
  hills: [0.65, 0.25], jungle: [0.24, 0.1], mountains: [1.7, 0.55], plains: [0.14, 0.05], swamp: [0.05, 0.02], tundra: [0.2, 0.08],
};
/** Cuts along each side of a triangle between tile centres. */
export const CUTS = 8;

export interface CityTerrainInput {
  /** The city's tile. */
  centre: number;
  /** Rings of tiles that rise; the next ring slopes back to the globe's surface. */
  rings: number;
  terrainOf(id: number): Terrain;
  /** Small relief noise at a point of the unit sphere, about −1 to 1. */
  detail(p: THREE.Vector3): number;
  colorOf(t: Terrain): THREE.Color;
  /** The globe's radius, and the height of the ground above it (no z-fighting). */
  radius: number;
  lift: number;
}

/** A point of the ground: where it is at rest, how far it rises, and the tile it is in. */
export interface Site { base: THREE.Vector3; rise: THREE.Vector3; tile: number; key: string }

export interface CityTerrain {
  geometry: THREE.BufferGeometry;
  /** The city's centre on the globe: everything else is relative to it. */
  origin: THREE.Vector3;
  /** Points well inside a tile, for trees, rocks and buildings. */
  sites: Site[];
  /** Height of the ground at a tile's centre, in world units at full relief. */
  heightAt(tile: number): number;
}

const TILE_ANGLE = Math.acos(1 / Math.sqrt(5)) / 330;

/** Triangles between the centres of three tiles that touch one another, each once. */
export function centreTriangles(tiles: Iterable<number>): [number, number, number][] {
  const out = new Map<string, [number, number, number]>();
  for (const t of tiles) {
    const ns = neighbors(t);
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      if (!neighbors(ns[i]).includes(ns[j])) continue;
      const tri = [t, ns[i], ns[j]].sort((a, b) => a - b) as [number, number, number];
      out.set(tri.join(','), tri);
    }
  }
  return [...out.values()];
}

export function buildCityTerrain(input: CityTerrainInput): CityTerrain {
  const { centre, rings, terrainOf, detail, colorOf, radius, lift } = input;
  const spacing = radius * TILE_ANGLE;
  const rising = new Set(tilesInRings(centre, rings));
  const origin = tileCenter(centre).multiplyScalar(radius);
  const tris = centreTriangles(rising);
  const centres = new Map<number, THREE.Vector3>();
  const at = (t: number) => {
    if (!centres.has(t)) centres.set(t, tileCenter(t));
    return centres.get(t)!;
  };
  const kind = new Map<number, Terrain>();
  const terrain = (t: number) => {
    if (!kind.has(t)) kind.set(t, terrainOf(t));
    return kind.get(t)!;
  };
  // Height above the ground at a point with these weights of its three tiles; the tiles of the
  // outer ring do not rise, so the land slopes back to the globe
  const heightOf = (p: THREE.Vector3, tri: readonly number[], w: readonly number[]) => {
    let h = 0;
    const d = detail(p);
    for (let i = 0; i < 3; i++) {
      if (!rising.has(tri[i])) continue;
      const [base, rough] = RELIEF[terrain(tri[i])];
      h += w[i] * (base + rough * d);
    }
    return Math.max(0, h) * spacing;
  };

  const positions: number[] = [];
  const rises: number[] = [];
  const colors: number[] = [];
  const sites = new Map<string, Site>();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const n = CUTS;
  for (const sorted of tris) {
    // Corners counter-clockwise seen from outside, so that every face looks out
    const [a0, b0, c0] = sorted.map(at);
    const out = new THREE.Vector3().subVectors(b0, a0).cross(new THREE.Vector3().subVectors(c0, a0)).dot(a0) > 0;
    const tri = out ? sorted : [sorted[0], sorted[2], sorted[1]];
    const [A, B, C] = tri.map(at);
    const cols = tri.map(t => colorOf(terrain(t)));
    // Grid points of the triangle, then its small triangles
    const grid: { pos: number[]; rise: number[]; col: number[] }[][] = [];
    for (let i = 0; i <= n; i++) {
      grid.push([]);
      for (let j = 0; j <= n - i; j++) {
        const w = [(n - i - j) / n, i / n, j / n];
        p.set(0, 0, 0).addScaledVector(A, w[0]).addScaledVector(B, w[1]).addScaledVector(C, w[2]).normalize();
        const h = heightOf(p, tri, w);
        const base = p.clone().multiplyScalar(radius * (1 + lift)).sub(origin);
        const rise = p.clone().multiplyScalar(h);
        c.setRGB(0, 0, 0).add(cols[0].clone().multiplyScalar(w[0])).add(cols[1].clone().multiplyScalar(w[1])).add(cols[2].clone().multiplyScalar(w[2]));
        grid[i].push({ pos: base.toArray(), rise: rise.toArray(), col: [c.r, c.g, c.b] });
        // Points well inside one rising tile hold trees, rocks and buildings
        const top = w.indexOf(Math.max(...w));
        if (w[top] > 0.62 && rising.has(tri[top])) {
          const key = base.toArray().map(v => v.toFixed(6)).join(',');
          if (!sites.has(key)) sites.set(key, { base, rise, tile: tri[top], key });
        }
      }
    }
    const put = (v: { pos: number[]; rise: number[]; col: number[] }) => {
      positions.push(...v.pos);
      rises.push(...v.rise);
      colors.push(...v.col);
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      put(grid[i][j]); put(grid[i + 1][j]); put(grid[i][j + 1]);
      if (j < n - i - 1) { put(grid[i + 1][j]); put(grid[i + 1][j + 1]); put(grid[i][j + 1]); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('rise', new THREE.Float32BufferAttribute(rises, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // Bounds at full relief, for the frustum and the shadow camera
  const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
  box.expandByScalar(spacing * 2.5);
  geometry.boundingBox = box;
  geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
  const heights = new Map<number, number>();
  for (const t of rising) {
    const [base] = RELIEF[terrain(t)];
    heights.set(t, Math.max(0, base + RELIEF[terrain(t)][1] * detail(at(t))) * spacing);
  }
  return { geometry, origin, sites: [...sites.values()], heightAt: t => heights.get(t) ?? 0 };
}

/** A material whose vertices rise by their `rise` times the uniform `relief` (0 to 1). */
export function risingMaterial<M extends THREE.Material>(material: M, relief: { value: number }): M {
  material.onBeforeCompile = shader => {
    shader.uniforms.relief = relief;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 rise;\nuniform float relief;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += rise * relief;');
  };
  return material;
}
