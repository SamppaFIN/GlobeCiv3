/**
 * cubeSphere.ts — quadtree addressing on a cube-mapped unit sphere.
 *
 * A tile is (face, level, x, y) with x, y in [0, 2^level). Each face is
 * parametrised by (a, b) in [-1, 1]^2, mapped to the cube with tan(a·π/4)
 * so that cells have nearly equal area on the sphere.
 */
import * as THREE from 'three';

export const MAX_LEVEL = 17;

export interface Tile {
  face: number;
  level: number;
  x: number;
  y: number;
}

// For every face: normal n, axes u and v with u × v = n (outward winding)
const FACES: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
  [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
  [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)],
  [new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
  [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  [new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
];

const QUARTER_PI = Math.PI / 4;

export function tileKey(t: Tile): string {
  return `${t.face}/${t.level}/${t.x}/${t.y}`;
}

/** Face parameters (a, b) in [-1, 1] → point on the unit sphere. */
export function faceToSphere(face: number, a: number, b: number, out = new THREE.Vector3()): THREE.Vector3 {
  const [n, u, v] = FACES[face];
  const s = Math.tan(a * QUARTER_PI);
  const t = Math.tan(b * QUARTER_PI);
  return out
    .set(n.x + u.x * s + v.x * t, n.y + u.y * s + v.y * t, n.z + u.z * s + v.z * t)
    .normalize();
}

/** Tile-local parameters (i, j) in [0, 1] → point on the unit sphere. */
export function tileToSphere(tile: Tile, i: number, j: number, out = new THREE.Vector3()): THREE.Vector3 {
  const size = 2 / 2 ** tile.level;
  return faceToSphere(tile.face, -1 + (tile.x + i) * size, -1 + (tile.y + j) * size, out);
}

export function tileCenter(tile: Tile): THREE.Vector3 {
  return tileToSphere(tile, 0.5, 0.5);
}

/** Corners in order (0,0), (1,0), (0,1), (1,1). */
export function tileCorners(tile: Tile): THREE.Vector3[] {
  return [
    tileToSphere(tile, 0, 0),
    tileToSphere(tile, 1, 0),
    tileToSphere(tile, 0, 1),
    tileToSphere(tile, 1, 1),
  ];
}

/** Children in order (0,0), (1,0), (0,1), (1,1), matching tileCorners. */
export function children(tile: Tile): Tile[] {
  const level = tile.level + 1;
  const x = tile.x * 2;
  const y = tile.y * 2;
  return [
    { face: tile.face, level, x, y },
    { face: tile.face, level, x: x + 1, y },
    { face: tile.face, level, x, y: y + 1 },
    { face: tile.face, level, x: x + 1, y: y + 1 },
  ];
}

/** Point on (or off) the sphere → the tile that contains it at the given level. */
export function pointToTile(p: THREE.Vector3, level: number): Tile {
  const ax = Math.abs(p.x), ay = Math.abs(p.y), az = Math.abs(p.z);
  let face: number;
  if (ax >= ay && ax >= az) face = p.x > 0 ? 0 : 1;
  else if (ay >= az) face = p.y > 0 ? 2 : 3;
  else face = p.z > 0 ? 4 : 5;

  const [n, u, v] = FACES[face];
  const d = p.dot(n);
  const a = Math.atan(p.dot(u) / d) / QUARTER_PI;
  const b = Math.atan(p.dot(v) / d) / QUARTER_PI;
  const cells = 2 ** level;
  const clamp = (k: number) => Math.min(cells - 1, Math.max(0, k));
  return { face, level, x: clamp(Math.floor(((a + 1) / 2) * cells)), y: clamp(Math.floor(((b + 1) / 2) * cells)) };
}
