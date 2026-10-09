/**
 * terrain.ts — deterministic 3D value noise and band-limited terrain colours.
 *
 * Interim: taken from the STORY-004 prototype for STORY-008. STORY-009 adds
 * tests for determinism and seams and moves colour to per-texel resolution.
 *
 * A tile at level L samples octaves 0..L+1 for colour A and 0..L+2 for colour B.
 * The shader blends A → B as the tile grows on screen, so at the moment a tile
 * splits (B fully shown) its children (A, which has the same octaves) match it.
 */

const BASE_FREQUENCY = 1.5;
const SEED = 1337;

function hash(ix: number, iy: number, iz: number, seed: number): number {
  let h = seed ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(iz, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), fx);
  const x10 = lerp(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), fx);
  const x01 = lerp(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), fx);
  const x11 = lerp(hash(ix, iy + 1, iz + 1, seed), hash(ix + 1, iy + 1, iz + 1, seed), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

/** Terrain height (fBm) with the given number of octaves; 0 is the coastline. */
export function terrainHeight(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = BASE_FREQUENCY;
  for (let k = 0; k < octaves; k++) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq, SEED + k * 1013);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

/** Octave count of colour A for a tile level; colour B has one more. */
export function octavesFor(level: number): number {
  return level + 2;
}

function colorFor(h: number, lat: number, out: Float32Array, o: number): void {
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
  out[o] = r; out[o + 1] = g; out[o + 2] = b;
}

/**
 * Writes colour A (octaves 0..n-1) and colour B (octaves 0..n) for a unit-sphere
 * point into the given arrays at offset o.
 */
export function terrainColors(
  x: number, y: number, z: number, level: number,
  outA: Float32Array, outB: Float32Array, o: number,
): void {
  const n = octavesFor(level);
  let sum = 0;
  let amp = 0.5;
  let freq = BASE_FREQUENCY;
  for (let k = 0; k < n; k++) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq, SEED + k * 1013);
    amp *= 0.5;
    freq *= 2;
  }
  const top = amp * valueNoise(x * freq, y * freq, z * freq, SEED + n * 1013);
  const lat = Math.abs(y);
  colorFor(sum, lat, outA, o);
  colorFor(sum + top, lat, outB, o);
}
