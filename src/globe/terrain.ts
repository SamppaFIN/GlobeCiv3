/**
 * terrain.ts — deterministic terrain on the unit sphere: f(seed, point, octaves).
 *
 * Height is fBm of 3D value noise sampled at the point itself, so neighbouring
 * tiles agree on shared edges and latitude is the point's y. Colour comes from
 * height and |y|.
 *
 * Rendering splits the octaves: a tile at quadtree level L gets octaves 0..L-1
 * per vertex (float64 on the CPU) and octaves L.. per pixel in the shader. For
 * the per-pixel octaves the lattice coordinate at the tile centre is split into
 * an integer base and a small fraction (octaveSplit), so float32 is enough.
 * hash() matches the shader bit for bit (unsigned 32-bit arithmetic).
 */

export const BASE_FREQUENCY = 1.5;
export const DEFAULT_SEED = 1337;
const OCTAVE_SEED_STEP = 1013;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export function hash(ix: number, iy: number, iz: number, seed: number): number {
  let h = seed ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(iz, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Value noise from an integer lattice cell and the fraction inside it. */
export function noiseInCell(ix: number, iy: number, iz: number, fx: number, fy: number, fz: number, seed: number): number {
  const u = fade(fx), v = fade(fy), w = fade(fz);
  const x00 = lerp(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), u);
  const x10 = lerp(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), u);
  const x01 = lerp(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), u);
  const x11 = lerp(hash(ix, iy + 1, iz + 1, seed), hash(ix + 1, iy + 1, iz + 1, seed), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  return noiseInCell(ix, iy, iz, x - ix, y - iy, z - iz, seed);
}

/** Frequency, amplitude and seed of octave k. */
export function octave(k: number, seed: number) {
  return { freq: BASE_FREQUENCY * 2 ** k, amp: 0.5 ** (k + 1), seed: seed + k * OCTAVE_SEED_STEP };
}

/** Sum of octaves from..to-1 at a point on the unit sphere. */
export function heightRange(p: Vec3Like, from: number, to: number, seed = DEFAULT_SEED): number {
  let sum = 0;
  for (let k = from; k < to; k++) {
    const o = octave(k, seed);
    sum += o.amp * valueNoise(p.x * o.freq, p.y * o.freq, p.z * o.freq, o.seed);
  }
  return sum;
}

/** Terrain height with the given number of octaves; 0 is the coastline. */
export function terrainHeight(p: Vec3Like, octaves: number, seed = DEFAULT_SEED): number {
  return heightRange(p, 0, octaves, seed);
}

/** Octaves used by game logic at a quadtree level. */
export function octavesFor(level: number): number {
  return level + 2;
}

/** Terrain colour (RGB 0..1) from height and |latitude| (|y| of the unit point). */
export function colorFor(h: number, lat: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (h < 0) {
    const t = Math.min(1, -h / 0.5);
    r = 0.1 - 0.08 * t; g = 0.35 - 0.27 * t; b = 0.6 - 0.35 * t;
  } else if (h < 0.03) {
    r = 0.76; g = 0.7; b = 0.5;
  } else if (h < 0.35) {
    const t = (h - 0.03) / 0.32;
    r = 0.25 - 0.13 * t; g = 0.5 - 0.15 * t; b = 0.2 - 0.08 * t;
  } else if (h < 0.55) {
    r = 0.45; g = 0.4; b = 0.35;
  } else {
    r = 0.95; g = 0.95; b = 0.97;
  }
  if (lat > 0.88) {
    const t = Math.min(1, (lat - 0.88) / 0.05);
    r += (0.95 - r) * t; g += (0.95 - g) * t; b += (0.97 - b) * t;
  }
  return [r, g, b];
}

/** Terrain at game-logic resolution for a quadtree level: f(seed, point, level). */
export function terrainAt(p: Vec3Like, level: number, seed = DEFAULT_SEED) {
  const len = Math.hypot(p.x, p.y, p.z);
  const u = { x: p.x / len, y: p.y / len, z: p.z / len };
  const height = terrainHeight(u, octavesFor(level), seed);
  return { height, color: colorFor(height, Math.abs(u.y)) };
}

/** Per-tile split of octave k: integer lattice base and fraction at the tile centre (unit sphere). */
export function octaveSplit(center: Vec3Like, k: number, seed = DEFAULT_SEED) {
  const o = octave(k, seed);
  const cx = center.x * o.freq, cy = center.y * o.freq, cz = center.z * o.freq;
  const base: [number, number, number] = [Math.floor(cx), Math.floor(cy), Math.floor(cz)];
  return { ...o, base, frac: [cx - base[0], cy - base[1], cz - base[2]] as [number, number, number] };
}

/**
 * The shader's evaluation of one split octave at a tile-local offset (unit-sphere
 * units), with float32 rounding where the GPU has it. Used to test precision.
 */
export function splitNoise(split: ReturnType<typeof octaveSplit>, local: Vec3Like): number {
  const f = Math.fround;
  const freq = f(split.freq);
  const q = [
    f(f(split.frac[0]) + f(f(local.x) * freq)),
    f(f(split.frac[1]) + f(f(local.y) * freq)),
    f(f(split.frac[2]) + f(f(local.z) * freq)),
  ];
  const fl = q.map(Math.floor);
  return noiseInCell(
    split.base[0] + fl[0], split.base[1] + fl[1], split.base[2] + fl[2],
    f(q[0] - fl[0]), f(q[1] - fl[1]), f(q[2] - fl[2]),
    split.seed,
  );
}
