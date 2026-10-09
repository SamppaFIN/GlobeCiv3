/**
 * regions.ts — nested regions on the sphere: states → provinces → city areas.
 *
 * States are the 362 hex regions: a spherical Voronoi partition of the hex
 * nodes. Each state is split into 7 provinces and each province into 7 city
 * areas, laid out like an aperture-7 hex subdivision (a centre and a ring of six
 * at 2/√7 of the parent inradius, turned 19.1°) with a small deterministic
 * jitter. A point belongs to the nearest state, then to that state's nearest
 * province, then to that province's nearest city area, so the nesting is exact.
 *
 * All centres of one level lie at the same radius, so a border between two
 * siblings is the plane through the origin that bisects them: a great-circle
 * arc on the sphere. Tiles get a short candidate list so the shader can draw
 * the borders per pixel.
 */
import * as THREE from 'three';
import { tileToSphere, type Tile } from './cubeSphere';
import type { HexNode } from './hexGrid';
import { DEFAULT_SEED, hash } from './terrain';

/** Upper bound of candidate regions per tile (shader uniform array size). */
export const MAX_TILE_REGIONS = 128;
export const CHILDREN = 7;
/** Levels: 0 = state, 1 = province, 2 = city area. */
export type RegionLevel = 0 | 1 | 2;

/** Ring radius of the six outer children as a fraction of the parent inradius (aperture 7). */
const RING = 2 / Math.sqrt(7);
const TWIST = Math.atan(Math.sqrt(3) / 5); // 19.1°, the aperture-7 rotation
const JITTER = 0.12;
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

  constructor(nodes: HexNode[], seed = DEFAULT_SEED) {
    const states = nodes.map(n => n.position.clone().normalize());
    // State inradius: half the angle to the nearest neighbouring centre
    const stateIn = nodes.map((n, i) => Math.min(...n.neighbors.map(j => states[i].angleTo(states[j]))) / 2);
    const refs = nodes.map((n, i) => states[n.neighbors[0]].clone().sub(states[i]));
    // Levels are stored as they are built: the city layout checks states and provinces
    this.centers = [states, [], []];
    const provinces = this.subdivide(states, stateIn, refs, seed, 1);
    this.centers[1] = provinces;
    const provIn = provinces.map((_, p) => stateIn[Math.floor(p / CHILDREN)] / Math.sqrt(7));
    const provRefs = provinces.map((c, p) => states[Math.floor(p / CHILDREN)].clone().sub(c).add(refs[Math.floor(p / CHILDREN)].clone().multiplyScalar(0.01)));
    this.centers[2] = this.subdivide(provinces, provIn, provRefs, seed, 2);
    const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    this.inradius = [avg(stateIn), avg(provIn), avg(provIn) / Math.sqrt(7)];
  }

  /** 7 children per parent: the centre and a ring of six, jittered, kept inside the parent. */
  private subdivide(parents: THREE.Vector3[], inradius: number[], refs: THREE.Vector3[], seed: number, level: RegionLevel): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < parents.length; i++) {
      const c = parents[i];
      const e1 = refs[i].clone().addScaledVector(c, -refs[i].dot(c)).normalize();
      const e2 = c.clone().cross(e1);
      const r = inradius[i];
      for (let k = 0; k < CHILDREN; k++) {
        const ang = k === 0 ? 0 : TWIST + ((k - 1) * Math.PI) / 3;
        const dist = k === 0 ? 0 : RING * r;
        const jx = hash(i, k, level, seed) * JITTER * r;
        const jy = hash(i, k, level + 10, seed) * JITTER * r;
        const offset = e1.clone().multiplyScalar(dist * Math.cos(ang) + jx).addScaledVector(e2, dist * Math.sin(ang) + jy);
        let child = c.clone().addScaledVector(offset, 1).normalize();
        // Keep the child inside its parent (it can fall out where the parent is clipped)
        for (let t = 0; t < 20 && !this.isInside(child, parents, i, level); t++) {
          offset.multiplyScalar(0.85);
          child = c.clone().add(offset).normalize();
        }
        out.push(child);
      }
    }
    return out;
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
