/**
 * regions.ts — nested regions on the sphere: states → provinces → city areas.
 *
 * States are the 362 hex regions: a spherical Voronoi partition of the hex
 * nodes. Each state is split into 7 provinces and each province into 7 city
 * areas. Their centres come from a canonical layout in a regular hexagon
 * (regionLayout.ts: aperture-7 provinces, city areas relaxed to equal areas),
 * mapped onto each state by the affine map that best fits its six neighbours,
 * mirrored in about half of the states and jittered slightly by the seed.
 * A point belongs to the nearest state, then to that state's nearest province,
 * then to that province's nearest city area, so the nesting is exact.
 *
 * All centres of one level lie at the same radius, so a border between two
 * siblings is the plane through the origin that bisects them: a great-circle
 * arc on the sphere. Tiles get a short candidate list so the shader can draw
 * the borders per pixel.
 */
import * as THREE from 'three';
import { tileToSphere, type Tile } from './cubeSphere';
import type { HexNode } from './hexGrid';
import { pointToTile, tileCities } from './hexTiles';
import { CITY_LAYOUT, PROVINCE_LAYOUT } from './regionLayout';
import { DEFAULT_SEED, hash } from './terrain';

/** Upper bound of candidate regions per tile (shader uniform array size). */
export const MAX_TILE_REGIONS = 128;
export const CHILDREN = 7;
/** Levels: 0 = state, 1 = province, 2 = city area. */
export type RegionLevel = 0 | 1 | 2;

/** Jitter of a child centre as a fraction of its parent's inradius, for variety between states. */
const JITTER = 0.02;
/** Angular margins around a tile per level: about two to three region radii. */
const MARGIN: Record<RegionLevel, number> = { 0: 0.3, 1: 0.1, 2: 0.04 };
/** Lowest tile level at which a region level's borders are drawn. */
export const FIRST_TILE_LEVEL: Record<RegionLevel, number> = { 0: 0, 1: 2, 2: 4 };

export interface RegionEntry {
  /** Unit-sphere centre. */
  center: THREE.Vector3;
  level: RegionLevel;
  /** Index of the parent entry in the same list, or -1 for states. */
  parent: number;
  /** Slot of the first listed child; children are contiguous. */
  firstChild: number;
  /** Number of listed children (0..7). */
  childCount: number;
}

export class Regions {
  /** Region centres per level as unit vectors. Children of region i are i*7 .. i*7+6. */
  readonly centers: [THREE.Vector3[], THREE.Vector3[], THREE.Vector3[]];
  /** Nominal angular inradius per level. */
  readonly inradius: [number, number, number];
  /** Neighbouring states of each state. */
  readonly neighbors: number[][];

  constructor(nodes: HexNode[], seed = DEFAULT_SEED) {
    const states = nodes.map(n => n.position.clone().normalize());
    this.neighbors = nodes.map(n => [...n.neighbors]);
    // State inradius: half the angle to the nearest neighbouring centre
    const stateIn = nodes.map((n, i) => Math.min(...n.neighbors.map(j => states[i].angleTo(states[j]))) / 2);
    const frames = states.map((c, i) => stateFrame(c, nodes[i].neighbors.map(j => states[j]), stateIn[i]));
    const mirror = states.map((_, i) => (hash(i, CHILDREN, 0, seed) < 0 ? -1 : 1));
    /** Canonical (x, y) of child k of state i → sphere, jittered by a fraction of the parent inradius. */
    const place = (i: number, k: number, level: RegionLevel, [x, y]: readonly [number, number], parentIn: number) =>
      frames[i](x + hash(i, k, level, seed) * JITTER * parentIn, y * mirror[i] + hash(i, k, level + 10, seed) * JITTER * parentIn);

    // Levels are stored as they are built: the city layout checks states and provinces
    this.centers = [states, [], []];
    const provinces: THREE.Vector3[] = [];
    states.forEach((_, i) => {
      for (let p = 0; p < CHILDREN; p++) {
        // Pull a centre toward its parent until it lies inside (possible in skewed or pentagonal states)
        let xy = PROVINCE_LAYOUT[p];
        let c = place(i, p, 1, xy, 1);
        for (let t = 0; t < 20 && this.nearest(c, states, 0, states.length) !== i; t++) {
          xy = [xy[0] * 0.85, xy[1] * 0.85];
          c = place(i, p, 1, xy, 1);
        }
        provinces.push(c);
      }
    });
    this.centers[1] = provinces;
    const cities: THREE.Vector3[] = [];
    states.forEach((_, i) => {
      for (let k = 0; k < CHILDREN * CHILDREN; k++) {
        const province = i * CHILDREN + Math.floor(k / CHILDREN);
        const [px, py] = PROVINCE_LAYOUT[Math.floor(k / CHILDREN)];
        let xy = CITY_LAYOUT[k];
        let c = place(i, k, 2, xy, 1 / Math.sqrt(7));
        for (let t = 0; t < 20 && !this.isInside(c, provinces, province, 2); t++) {
          xy = [px + (xy[0] - px) * 0.85, py + (xy[1] - py) * 0.85];
          c = place(i, k, 2, xy, 1 / Math.sqrt(7));
        }
        cities.push(c);
      }
    });
    this.centers[2] = cities;
    const avg = (a: number[]) => a.reduce((sum, x) => sum + x, 0) / a.length;
    this.inradius = [avg(stateIn), avg(stateIn) / Math.sqrt(7), avg(stateIn) / 7];
  }

  private isInside(p: THREE.Vector3, parents: THREE.Vector3[], parentIndex: number, level: RegionLevel): boolean {
    if (level === 1) return this.nearest(p, parents, 0, parents.length) === parentIndex;
    // A city centre must lie in its province: its state's nearest province is the parent
    const state = Math.floor(parentIndex / CHILDREN);
    return this.stateOf(p) === state && this.nearest(p, parents, state * CHILDREN, CHILDREN) === parentIndex;
  }

  private nearest(p: THREE.Vector3, list: THREE.Vector3[], from: number, count: number): number {
    let best = from;
    let bestDot = -Infinity;
    for (let i = from; i < from + count; i++) {
      const d = p.dot(list[i]);
      if (d > bestDot) { bestDot = d; best = i; }
    }
    return best;
  }

  stateOf(p: THREE.Vector3): number {
    return this.nearest(p.clone().normalize(), this.centers[0], 0, this.centers[0].length);
  }

  provinceOf(p: THREE.Vector3): number {
    return this.nearest(p.clone().normalize(), this.centers[1], this.stateOf(p) * CHILDREN, CHILDREN);
  }

  cityOf(p: THREE.Vector3): number {
    return this.nearest(p.clone().normalize(), this.centers[2], this.provinceOf(p) * CHILDREN, CHILDREN);
  }

  private tiles: Uint16Array | null = null;

  /**
   * City area of every hex tile, by its centre (hexTiles.ts tileCities), built on first
   * use. This table is the one source of tile membership: the game logic and the shader
   * (as a texture) both read it, so they agree even where a centre lies exactly on a border.
   */
  tileTable(): Uint16Array {
    return (this.tiles ??= tileCities(this));
  }

  /** City area of the hex tile containing a point; its province is ⌊id / 7⌋ and state ⌊id / 49⌋. */
  cityOfTile(p: THREE.Vector3): number {
    return this.tileTable()[pointToTile(p)];
  }

  /** The state containing a point (kept for callers that only need states). */
  regionOf(p: THREE.Vector3): number {
    return this.stateOf(p);
  }

  /** States near a tile, nearest first, at most MAX_TILE_REGIONS. */
  candidatesForTile(tile: Tile): number[] {
    return this.near(tile, 0).slice(0, MAX_TILE_REGIONS).map(f => f[1]);
  }

  private near(tile: Tile, level: RegionLevel): [number, number][] {
    const dir = tileToSphere(tile, 0.5, 0.5);
    let ang = 0;
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]]) {
      ang = Math.max(ang, dir.angleTo(tileToSphere(tile, i, j)));
    }
    const limit = Math.cos(Math.min(Math.PI, ang + MARGIN[level]));
    const found: [number, number][] = [];
    const list = this.centers[level];
    for (let i = 0; i < list.length; i++) {
      const d = dir.dot(list[i]);
      if (d >= limit) found.push([d, i]);
    }
    return found.sort((a, b) => b[0] - a[0]);
  }

  /**
   * Candidate entries for a tile across levels: nearby states first, then the
   * nearby provinces of each listed state (from tile level 2) and the nearby
   * city areas of each listed province (from tile level 4). Children of one
   * parent are contiguous and the parent records their slot range, so the
   * shader looks only at the states plus at most 7 + 7 entries.
   */
  entriesForTile(tile: Tile): RegionEntry[] {
    const entries: RegionEntry[] = [];
    const add = (center: THREE.Vector3, level: RegionLevel, parent: number) => {
      entries.push({ center, level, parent, firstChild: 0, childCount: 0 });
      return entries.length - 1;
    };
    const stateSlots = this.near(tile, 0).slice(0, MAX_TILE_REGIONS).map(([, id]) => ({ id, slot: add(this.centers[0][id], 0, -1) }));
    let parents = stateSlots;
    for (const level of [1, 2] as RegionLevel[]) {
      if (tile.level < FIRST_TILE_LEVEL[level]) break;
      const nearIds = new Set(this.near(tile, level).map(([, id]) => id));
      const next: { id: number; slot: number }[] = [];
      for (const p of parents) {
        const kids: number[] = [];
        for (let k = 0; k < CHILDREN; k++) if (nearIds.has(p.id * CHILDREN + k)) kids.push(p.id * CHILDREN + k);
        if (!kids.length || entries.length + kids.length > MAX_TILE_REGIONS) continue;
        entries[p.slot].firstChild = entries.length;
        entries[p.slot].childCount = kids.length;
        for (const id of kids) next.push({ id, slot: add(this.centers[level][id], level, p.slot) });
      }
      parents = next;
    }
    return entries;
  }

  /** Number of state entries at the start of an entriesForTile list. */
  static stateCount(entries: RegionEntry[]): number {
    let n = 0;
    while (n < entries.length && entries[n].level === 0) n++;
    return n;
  }
}

/**
 * Map from the canonical hexagon frame (regionLayout.ts: inradius 1, neighbours at
 * distance 2 every 60°) onto a state: the linear map that best fits the six
 * neighbours in the state's gnomonic tangent plane. A pentagon gets a plain scale.
 */
function stateFrame(c: THREE.Vector3, neighbors: THREE.Vector3[], inradius: number): (x: number, y: number) => THREE.Vector3 {
  const e1 = neighbors[0].clone().addScaledVector(c, -neighbors[0].dot(c)).normalize();
  const e2 = c.clone().cross(e1);
  const turn = ([x, y]: number[]) => (Math.atan2(y, x) + 2 * Math.PI + 1e-9) % (2 * Math.PI);
  const around = neighbors
    .map(n => { const t = n.clone().divideScalar(n.dot(c)).sub(c); return [t.dot(e1), t.dot(e2)]; })
    .sort((a, b) => turn(a) - turn(b));
  let m = [inradius, 0, 0, inradius];
  if (around.length === 6) {
    // Least squares: M = Σ m_k n_kᵀ (Σ n_k n_kᵀ)⁻¹ with n_k = 2 (cos 60k°, sin 60k°), Σ n_k n_kᵀ = 12 I
    m = [0, 0, 0, 0];
    around.forEach(([x, y], k) => {
      const nx = 2 * Math.cos((k * Math.PI) / 3);
      const ny = 2 * Math.sin((k * Math.PI) / 3);
      m[0] += (x * nx) / 12; m[1] += (x * ny) / 12; m[2] += (y * nx) / 12; m[3] += (y * ny) / 12;
    });
  }
  return (x, y) => c.clone().addScaledVector(e1, m[0] * x + m[1] * y).addScaledVector(e2, m[2] * x + m[3] * y).normalize();
}

export interface HierarchyHit {
  slots: [number, number, number];
  /** Distance to the nearest border with a sibling at each level (Infinity if none). */
  border: [number, number, number];
}

/**
 * The shader's computation on the CPU: starting from the state slots, for each
 * level the nearest entry in the current slot range and the distance to the
 * nearest bisecting plane with an entry of the same range; then descend into
 * the winner's children. Positions and centres must use the same coordinates.
 */
export function hierarchyAt(p: THREE.Vector3, entries: { center: THREE.Vector3; level: number; firstChild?: number; childCount?: number }[]): HierarchyHit {
  const slots: [number, number, number] = [-1, -1, -1];
  const border: [number, number, number] = [Infinity, Infinity, Infinity];
  let from = 0;
  let count = 0;
  while (count < entries.length && entries[count].level === 0) count++;
  for (let level = 0; level < 3 && count > 0; level++) {
    let best = Infinity;
    for (let i = from; i < from + count; i++) {
      const q = p.distanceToSquared(entries[i].center);
      if (q < best) { best = q; slots[level] = i; }
    }
    const own = entries[slots[level]].center;
    for (let j = from; j < from + count; j++) {
      if (j === slots[level]) continue;
      const c = entries[j].center;
      border[level] = Math.min(border[level], (p.distanceToSquared(c) - best) / (2 * c.distanceTo(own)));
    }
    from = entries[slots[level]].firstChild ?? 0;
    count = entries[slots[level]].childCount ?? 0;
  }
  return { slots, border };
}

/** Kept for the state-level tests: nearest centre and distance to the nearest border plane. */
export function nearestAndBorder(p: THREE.Vector3, centers: THREE.Vector3[]): { region: number; border: number } {
  const hit = hierarchyAt(p, centers.map(center => ({ center, level: 0 })));
  return { region: hit.slots[0], border: hit.border[0] };
}
