/**
 * regions.ts — the 362 hex regions as a spherical Voronoi partition.
 *
 * A point belongs to the region whose centre is nearest. All centres lie at the
 * same radius, so the border between two regions is the plane through the
 * origin that bisects them, which meets the sphere in a great-circle arc.
 * Tiles get a short list of candidate centres so the shader can draw the
 * borders per pixel without looping over all 362 regions.
 */
import * as THREE from 'three';
import { tileToSphere, type Tile } from './cubeSphere';
import type { HexNode } from './hexGrid';

/** Upper bound of candidate regions per tile (shader uniform array size). */
export const MAX_TILE_REGIONS = 128;
/** Angular margin around a tile: about two region radii (cells are ~0.12 rad across). */
const MARGIN = 0.3;

export class Regions {
  /** Region centres as unit vectors, indexed like the hex grid nodes. */
  readonly centers: THREE.Vector3[];

  constructor(nodes: HexNode[]) {
    this.centers = nodes.map(n => n.position.clone().normalize());
  }

  /** Index of the region containing a point (any radius). */
  regionOf(p: THREE.Vector3): number {
    const u = p.clone().normalize();
    let best = 0;
    let bestDot = -Infinity;
    for (let i = 0; i < this.centers.length; i++) {
      const d = u.dot(this.centers[i]);
      if (d > bestDot) { bestDot = d; best = i; }
    }
    return best;
  }

  /**
   * Regions that may own any point of the tile or define the nearest border for
   * it, nearest to the tile centre first, at most MAX_TILE_REGIONS.
   */
  candidatesForTile(tile: Tile): number[] {
    const dir = tileToSphere(tile, 0.5, 0.5);
    let ang = 0;
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0, 0.5], [1, 0.5], [0.5, 1]]) {
      ang = Math.max(ang, dir.angleTo(tileToSphere(tile, i, j)));
    }
    const limit = Math.cos(Math.min(Math.PI, ang + MARGIN));
    const found: [number, number][] = [];
    for (let i = 0; i < this.centers.length; i++) {
      const d = dir.dot(this.centers[i]);
      if (d >= limit) found.push([d, i]);
    }
    found.sort((a, b) => b[0] - a[0]);
    return found.slice(0, MAX_TILE_REGIONS).map(f => f[1]);
  }
}

/**
 * The shader's computation on the CPU: nearest candidate and the distance from
 * the point to the nearest border plane, both in the coordinates the caller uses.
 */
export function nearestAndBorder(p: THREE.Vector3, centers: THREE.Vector3[]): { region: number; border: number } {
  let region = 0;
  let best = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const q = p.distanceToSquared(centers[i]);
    if (q < best) { best = q; region = i; }
  }
  let border = Infinity;
  for (let j = 0; j < centers.length; j++) {
    if (j === region) continue;
    const d = (p.distanceToSquared(centers[j]) - best) / (2 * centers[j].distanceTo(centers[region]));
    if (d < border) border = d;
  }
  return { region, border };
}
