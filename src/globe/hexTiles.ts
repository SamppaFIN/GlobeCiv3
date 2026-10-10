/**
 * hexTiles.ts — the global hex tile grid, the lowest map level.
 *
 * The grid is the dual of an icosahedron subdivided at frequency F: every lattice
 * point of the subdivided faces is a tile, 12 of them (the corners) pentagons.
 * It uses the same icosahedron as three.js IcosahedronGeometry, which subdivides
 * each face in its plane and then normalises (a gnomonic projection). The states
 * (hexGrid.ts) are that grid at frequency 6, and F = 6 × 55, so every state centre
 * is a tile centre and tiles shrink toward the icosahedron corners in step with
 * the states.
 *
 * A point belongs to the face whose centroid is nearest (the spherical faces are
 * the Voronoi cells of their centroids), and then, projected onto that face's
 * plane, to the nearest lattice point: the hexagonal cells of a triangular
 * lattice. Lattice coordinates are barycentric (i, j, k) with i + j + k = F.
 * Tile ids are canonical: 12 corners, then (F − 1) points per icosahedron edge,
 * then (F − 1)(F − 2)/2 interior points per face, 10F² + 2 in total.
 */
import * as THREE from 'three';
import type { Regions } from './regions';

export const FREQUENCY = 330;
const F = FREQUENCY;
export const TILE_COUNT = 10 * F * F + 2;

const T = (1 + Math.sqrt(5)) / 2;
// three.js IcosahedronGeometry, vertex for vertex and face for face
const RAW = [-1, T, 0, 1, T, 0, -1, -T, 0, 1, -T, 0, 0, -1, T, 0, 1, T, 0, -1, -T, 0, 1, -T, T, 0, -1, T, 0, 1, -T, 0, -1, -T, 0, 1];
export const CORNERS: readonly THREE.Vector3[] = Array.from({ length: 12 }, (_, i) => new THREE.Vector3(RAW[i * 3], RAW[i * 3 + 1], RAW[i * 3 + 2]).normalize());
const IDX = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
export const FACES: readonly [number, number, number][] = Array.from({ length: 20 }, (_, f) => [IDX[f * 3], IDX[f * 3 + 1], IDX[f * 3 + 2]]);
export const FACE_CENTROIDS: readonly THREE.Vector3[] = FACES.map(([a, b, c]) => CORNERS[a].clone().add(CORNERS[b]).add(CORNERS[c]).normalize());
/** Inverse of the matrix whose columns are the face corners: point → unnormalised barycentrics. */
export const FACE_INVERSES: readonly THREE.Matrix3[] = FACES.map(([a, b, c]) => new THREE.Matrix3().set(
  CORNERS[a].x, CORNERS[b].x, CORNERS[c].x,
  CORNERS[a].y, CORNERS[b].y, CORNERS[c].y,
  CORNERS[a].z, CORNERS[b].z, CORNERS[c].z,
).invert());

// Edges as sorted corner pairs, with the faces on each side and the faces around each corner
const EDGES: [number, number][] = [];
const EDGE_OF = new Map<number, number>();
const EDGE_FACES: number[][] = [];
const CORNER_FACES: number[][] = Array.from({ length: 12 }, () => []);
FACES.forEach((tri, f) => {
  for (let k = 0; k < 3; k++) {
    CORNER_FACES[tri[k]].push(f);
    const lo = Math.min(tri[k], tri[(k + 1) % 3]);
    const hi = Math.max(tri[k], tri[(k + 1) % 3]);
    let e = EDGE_OF.get(lo * 12 + hi);
    if (e === undefined) {
      e = EDGES.length;
      EDGES.push([lo, hi]);
      EDGE_OF.set(lo * 12 + hi, e);
      EDGE_FACES.push([]);
    }
    EDGE_FACES[e].push(f);
  }
});

/** For each face and corner slot q: the edge opposite that slot (between the other two corners). */
export const FACE_EDGES: readonly [number, number, number][] = FACES.map(tri => [0, 1, 2].map(q => {
  const a = tri[(q + 1) % 3];
  const b = tri[(q + 2) % 3];
  return EDGE_OF.get(Math.min(a, b) * 12 + Math.max(a, b))!;
}) as [number, number, number]);

/**
 * For each face and corner slot q: the face across the edge opposite that slot, and the
 * slots in it of (its corner opposite the edge, corner of slot q + 1, corner of slot q + 2),
 * packed as face × 64 + slot × 16 + slot × 4 + slot for the shader.
 */
export const FACE_ADJACENT: readonly [number, number, number][] = FACES.map((tri, fi) => [0, 1, 2].map(q => {
  const x = tri[(q + 1) % 3];
  const y = tri[(q + 2) % 3];
  const adj = EDGE_FACES[FACE_EDGES[fi][q]].find(g => g !== fi)!;
  const other = FACES[adj];
  const d = other.find(c => c !== x && c !== y)!;
  return adj * 64 + other.indexOf(d) * 16 + other.indexOf(x) * 4 + other.indexOf(y);
}) as [number, number, number]);

export const EDGE_BASE = 12;
export const FACE_BASE = EDGE_BASE + 30 * (F - 1);
const PER_FACE = ((F - 1) * (F - 2)) / 2;
/** Index of the first interior point of row i (i = 1 … F − 2) within a face. */
const rowStart = (i: number) => (i - 1) * (F - 1) - ((i - 1) * i) / 2;

/** The six neighbour offsets in lattice coordinates. */
export const NEIGHBOR_OFFSETS: readonly [number, number, number][] = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];

/** Canonical tile id of the lattice point (i, j, k), i + j + k = F, of face f. */
export function latticeToTile(f: number, i: number, j: number, k: number): number {
  const tri = FACES[f];
  if (j === 0 && k === 0) return tri[0];
  if (i === 0 && k === 0) return tri[1];
  if (i === 0 && j === 0) return tri[2];
  // On the edge opposite the zero coordinate's slot: count from its lower-numbered corner
  if (i === 0) return EDGE_BASE + FACE_EDGES[f][0] * (F - 1) + (tri[1] > tri[2] ? j : k) - 1;
  if (j === 0) return EDGE_BASE + FACE_EDGES[f][1] * (F - 1) + (tri[0] > tri[2] ? i : k) - 1;
  if (k === 0) return EDGE_BASE + FACE_EDGES[f][2] * (F - 1) + (tri[0] > tri[1] ? i : j) - 1;
  return FACE_BASE + f * PER_FACE + rowStart(i) + j - 1;
}

/**
 * Tile id of a lattice point given in face f's frame that may lie one step outside the
 * face: a negative coordinate is unfolded into the face across that edge (with the far
 * corner D = X + Y − A in the unfolded plane, w_A A + w_X X + w_Y Y = −w_A D +
 * (w_X + w_A) X + (w_Y + w_A) Y). Returns −1 where no tile exists (beside a pentagon).
 * The shader does the same.
 */
export function tileIdAt(f: number, w: readonly number[]): number {
  const q: number = w[0] < 0 ? 0 : w[1] < 0 ? 1 : w[2] < 0 ? 2 : -1;
  if (q < 0) return latticeToTile(f, w[0], w[1], w[2]);
  const code = FACE_ADJACENT[f][q];
  const wx = w[(q + 1) % 3] + w[q];
  const wy = w[(q + 2) % 3] + w[q];
  if (wx < 0 || wy < 0) return -1;
  const n = [0, 0, 0];
  n[(code >> 4) & 3] = -w[q];
  n[(code >> 2) & 3] = wx;
  n[code & 3] = wy;
  return latticeToTile(code >> 6, n[0], n[1], n[2]);
}

/** The lattice coordinates of a tile in every face that contains it (1, 2 or 5 faces). */
export function tileToLattice(id: number): { face: number; ijk: [number, number, number] }[] {
  const out: { face: number; ijk: [number, number, number] }[] = [];
  const place = (f: number, weights: Map<number, number>) => {
    out.push({ face: f, ijk: FACES[f].map(c => weights.get(c) ?? 0) as [number, number, number] });
  };
  if (id < EDGE_BASE) {
    for (const f of CORNER_FACES[id]) place(f, new Map([[id, F]]));
  } else if (id < FACE_BASE) {
    const e = Math.floor((id - EDGE_BASE) / (F - 1));
    const t = ((id - EDGE_BASE) % (F - 1)) + 1;
    const [lo, hi] = EDGES[e];
    for (const f of EDGE_FACES[e]) place(f, new Map([[lo, F - t], [hi, t]]));
  } else {
    const f = Math.floor((id - FACE_BASE) / PER_FACE);
    const r = (id - FACE_BASE) % PER_FACE;
    let i = 1;
    while (rowStart(i + 1) <= r) i++;
    const j = r - rowStart(i) + 1;
    out.push({ face: f, ijk: [i, j, F - i - j] });
  }
  return out;
}

/** Face containing a direction: the one with the nearest centroid. */
export function faceOf(p: THREE.Vector3): number {
  let best = 0;
  let bestDot = -Infinity;
  for (let f = 0; f < 20; f++) {
    const d = p.dot(FACE_CENTROIDS[f]);
    if (d > bestDot) { bestDot = d; best = f; }
  }
  return best;
}

const tmp = new THREE.Vector3();

/** Continuous lattice coordinates of a direction in a face (sum F). */
export function latticeCoords(p: THREE.Vector3, f: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  tmp.copy(p).applyMatrix3(FACE_INVERSES[f]);
  const s = F / (tmp.x + tmp.y + tmp.z);
  out[0] = tmp.x * s;
  out[1] = tmp.y * s;
  out[2] = tmp.z * s;
  return out;
}

/** Round continuous lattice coordinates to the nearest lattice point (cube rounding). */
export function roundLattice(c: readonly number[]): [number, number, number] {
  const r = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
  const sum = r[0] + r[1] + r[2];
  if (sum !== F) {
    // Fix the coordinate that moved most, so the point stays on the plane i + j + k = F
    const d = [Math.abs(r[0] - c[0]), Math.abs(r[1] - c[1]), Math.abs(r[2] - c[2])];
    const m = d[0] >= d[1] && d[0] >= d[2] ? 0 : d[1] >= d[2] ? 1 : 2;
    r[m] += F - sum;
  }
  return [Math.max(0, r[0]), Math.max(0, r[1]), Math.max(0, r[2])];
}

/** Tile containing a direction (need not be normalised). */
export function pointToTile(p: THREE.Vector3): number {
  const f = faceOf(p);
  const [i, j, k] = roundLattice(latticeCoords(p, f));
  return latticeToTile(f, i, j, k);
}

/** Unit-sphere centre of a lattice point. */
export function latticePoint(f: number, i: number, j: number, k: number, out = new THREE.Vector3()): THREE.Vector3 {
  const [a, b, c] = FACES[f];
  return out.set(0, 0, 0).addScaledVector(CORNERS[a], i).addScaledVector(CORNERS[b], j).addScaledVector(CORNERS[c], k).normalize();
}

/** Unit-sphere centre of a tile. */
export function tileCenter(id: number, out = new THREE.Vector3()): THREE.Vector3 {
  const { face, ijk } = tileToLattice(id)[0];
  return latticePoint(face, ijk[0], ijk[1], ijk[2], out);
}

/** Neighbouring tiles: 6, or 5 around a pentagon. */
export function neighbors(id: number): number[] {
  const found = new Set<number>();
  for (const { face, ijk } of tileToLattice(id)) {
    for (const [di, dj, dk] of NEIGHBOR_OFFSETS) {
      const n: [number, number, number] = [ijk[0] + di, ijk[1] + dj, ijk[2] + dk];
      if (n[0] < 0 || n[1] < 0 || n[2] < 0) continue;
      found.add(latticeToTile(face, n[0], n[1], n[2]));
    }
  }
  return [...found];
}

/**
 * Tiles whose centres lie within an angle of a direction and pass a test, found by
 * flooding outward from the tile under the direction.
 */
export function tilesWithin(center: THREE.Vector3, angle: number, keep: (id: number, c: THREE.Vector3) => boolean): number[] {
  const dir = center.clone().normalize();
  const limit = Math.cos(angle);
  const start = pointToTile(dir);
  const seen = new Set([start]);
  const queue = [start];
  const out: number[] = [];
  const c = new THREE.Vector3();
  while (queue.length) {
    const id = queue.pop()!;
    tileCenter(id, c);
    if (c.dot(dir) < limit) continue;
    if (keep(id, c)) out.push(id);
    for (const n of neighbors(id)) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  }
  return out.sort((a, b) => a - b);
}

/**
 * City area of every tile (by its centre), indexed by tile id. The state comes from the
 * frequency-6 lattice point nearest in the same face (the states are that lattice), checked
 * against its neighbours, then the province and the city area as in Regions. One pass over
 * the lattice without allocations; about a million tiles.
 */
export function tileCities(regions: Regions): Uint16Array {
  const out = new Uint16Array(TILE_COUNT);
  const done = new Uint8Array(TILE_COUNT);
  const [states, provinces, cities] = regions.centers;
  const flat = (list: THREE.Vector3[]) => {
    const a = new Float64Array(list.length * 3);
    list.forEach((v, i) => { a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; });
    return a;
  };
  const S = flat(states), P = flat(provinces), C = flat(cities);
  // Nearest state of every frequency-6 lattice point, per face
  const G = 6;
  const coarse = new Int32Array(20 * (G + 1) * (G + 1));
  const v = new THREE.Vector3();
  for (let fi = 0; fi < 20; fi++) {
    for (let i = 0; i <= G; i++) for (let j = 0; i + j <= G; j++) {
      latticePoint(fi, i, j, G - i - j, v);
      let best = 0, bestDot = -2;
      for (let s = 0; s < states.length; s++) {
        const d = v.x * S[s * 3] + v.y * S[s * 3 + 1] + v.z * S[s * 3 + 2];
        if (d > bestDot) { bestDot = d; best = s; }
      }
      coarse[(fi * (G + 1) + i) * (G + 1) + j] = best;
    }
  }
  const nearestIn = (list: Float64Array, from: number, count: number, x: number, y: number, z: number) => {
    let best = from, bestDot = -2;
    for (let k = from; k < from + count; k++) {
      const d = x * list[k * 3] + y * list[k * 3 + 1] + z * list[k * 3 + 2];
      if (d > bestDot) { bestDot = d; best = k; }
    }
    return best;
  };
  for (let fi = 0; fi < 20; fi++) {
    const [a, b, c] = FACES[fi].map(k => CORNERS[k]);
    for (let i = 0; i <= F; i++) {
      for (let j = 0; i + j <= F; j++) {
        const k = F - i - j;
        const id = latticeToTile(fi, i, j, k);
        if (done[id]) continue;
        done[id] = 1;
        let x = a.x * i + b.x * j + c.x * k, y = a.y * i + b.y * j + c.y * k, z = a.z * i + b.z * j + c.z * k;
        const len = Math.sqrt(x * x + y * y + z * z);
        x /= len; y /= len; z /= len;
        // Nearest frequency-6 point by cube rounding, then that state and its neighbours
        const r = roundCoarse(i * G / F, j * G / F, k * G / F, G);
        const s0 = coarse[(fi * (G + 1) + r[0]) * (G + 1) + r[1]];
        let state = s0, bestDot = x * S[s0 * 3] + y * S[s0 * 3 + 1] + z * S[s0 * 3 + 2];
        for (const n of regions.neighbors[s0]) {
          const d = x * S[n * 3] + y * S[n * 3 + 1] + z * S[n * 3 + 2];
          if (d > bestDot) { bestDot = d; state = n; }
        }
        const province = nearestIn(P, state * 7, 7, x, y, z);
        out[id] = nearestIn(C, province * 7, 7, x, y, z);
      }
    }
  }
  return out;
}

const coarseOut: [number, number, number] = [0, 0, 0];
function roundCoarse(ci: number, cj: number, ck: number, g: number): [number, number, number] {
  let ri = Math.round(ci), rj = Math.round(cj), rk = Math.round(ck);
  const sum = ri + rj + rk;
  if (sum !== g) {
    const di = Math.abs(ri - ci), dj = Math.abs(rj - cj), dk = Math.abs(rk - ck);
    if (di >= dj && di >= dk) ri += g - sum;
    else if (dj >= dk) rj += g - sum;
    else rk += g - sum;
  }
  coarseOut[0] = ri; coarseOut[1] = rj; coarseOut[2] = rk;
  return coarseOut;
}
