/**
 * surfacePatterns.ts — surface detail of the tiles at city-area zoom.
 *
 * Four greyscale patterns in one RGBA texture: water (R), fields (G), forest (B) and
 * relief (A). The tile shader takes the colour from the Kartografi tokens and uses a
 * pattern only as light and shade, one excerpt per tile.
 *
 * Fields, forest and relief are ported from the terrain shaders Claude made at Sami's
 * request (Assets/shaders.ts, 2026-10-10): the fields lost their fixed river, and only the
 * luminance is kept. The noise helpers are common techniques. The water is this game's
 * own: Assets' sea was derived from the Seascape shader (CC BY-NC-SA 3.0), which does not
 * fit GPL v3 (docs/spikes/assets-maastoshaderit.md).
 *
 * The patterns are computed on the CPU in a worker (surfaceWorker.ts): compiling them as a
 * shader blocked the main thread for about 1.8 s on Intel UHD with Direct3D.
 */

/** Pattern texture size; a tile's excerpt spans about a third of it. */
export const SURFACE_SIZE = 512;

const fract = (x: number) => x - Math.floor(x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** GLSL smoothstep, also with edge0 > edge1 as the shaders use it. */
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function h1(x: number, y: number): number {
  let px = fract(x * 123.34);
  let py = fract(y * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d;
  py += d;
  return fract(px * py);
}

function vn(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  return mix(mix(h1(ix, iy), h1(ix + 1, iy), fx), mix(h1(ix, iy + 1), h1(ix + 1, iy + 1), fx), fy);
}

/** Fractal noise; each octave turns by the matrix [1.6 −1.2; 1.2 1.6]. */
function fbm(x: number, y: number, octaves = 5): number {
  let s = 0, a = 0.5;
  for (let i = 0; i < octaves; i++) {
    s += a * vn(x, y);
    [x, y] = [1.6 * x - 1.2 * y, 1.2 * x + 1.6 * y];
    a *= 0.5;
  }
  return s;
}

/** Own: swell lines as on old sea charts, crests bent by slow noise and broken into dashes. */
export function water(u: number, v: number): number {
  const x = u * 9, y = v * 9;
  const row = y + fbm(x * 0.25, y * 0.25) * 2.5;
  const crest = Math.abs(fract(row) - 0.5) * 2;
  const line = 1 - smoothstep(0, 0.2, crest);
  const dash = smoothstep(0.35, 0.6, vn(x * 1.3, Math.floor(row) * 7.3));
  return 0.45 + 0.35 * line * dash + 0.2 * (fbm(x * 0.7, y * 0.7) - 0.5);
}

const FIELD_COLOURS = [[0.78, 0.66, 0.28], [0.45, 0.55, 0.2], [0.55, 0.4, 0.25], [0.3, 0.45, 0.2], [0.85, 0.78, 0.5]];

/** Fields: a patchwork of plots with furrows and dark hedges (Assets plain, no river). */
export function fields(u: number, v: number): number {
  const px = u * 6, py = v * 6;
  const qx = px + (fbm(px * 0.7, py * 0.7) - 0.5) * 1.6;
  const qy = py + (fbm(px * 0.7 + 7, py * 0.7 + 7) - 0.5) * 1.6;
  const idx = Math.floor(qx), idy = Math.floor(qy);
  const fx = qx - idx, fy = qy - idy;
  let [r, g, b] = FIELD_COLOURS[Math.min(4, Math.floor(h1(idx, idy) * 5))];
  const ang = h1(idx + 5, idy + 5) * 3.14;
  const furrow = (Math.sin((qx * Math.cos(ang) + qy * Math.sin(ang)) * 70) * 0.5 + 0.5) * 0.14 + 0.86;
  const grain = 0.85 + 0.3 * fbm(qx * 3, qy * 3);
  r *= furrow * grain; g *= furrow * grain; b *= furrow * grain;
  const edge = smoothstep(0.02, 0.06, Math.min(fx, 1 - fx, fy, 1 - fy));
  return lum(mix(0.08, r, edge), mix(0.18, g, edge), mix(0.07, b, edge));
}

/** Forest: tree crowns lit from the top left over dark ground, with glades (Assets forest). */
export function forest(u: number, v: number): number {
  const px = u * 15, py = v * 15;
  const ipx = Math.floor(px), ipy = Math.floor(py);
  const glade = smoothstep(0.58, 0.68, fbm(px * 0.12 + 3, py * 0.12 + 3));
  let r = mix(0.02, 0.2, glade), g = mix(0.06, 0.32, glade), b = mix(0.03, 0.12, glade);
  let best = -1;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const idx = ipx + i, idy = ipy + j;
      const cx = idx + 0.5 + (h1(idx, idy) - 0.5) * 0.8;
      const cy = idy + 0.5 + (h1(idx + 17.3, idy + 17.3) - 0.5) * 0.8;
      const rad = Math.max((0.55 + 0.3 * h1(idx + 3, idy + 3)) * smoothstep(0.68, 0.58, fbm(cx * 0.12 + 3, cy * 0.12 + 3)), 0.05);
      const ox = (px - cx) / rad, oy = (py - cy) / rad;
      const d = Math.hypot(ox, oy);
      const layer = h1(idx + 9, idy + 9);
      const cr = smoothstep(1, 0.6, d);
      if (cr > 0.01 && layer > best) {
        best = layer;
        const lit = 0.5 + 0.5 * (ox * -0.6 + oy * 0.8);
        const k = h1(idx + 1, idy + 1);
        const shade = (0.5 + 0.9 * lit * (1 - d * 0.5)) * (0.65 + 0.45 * (1 - d));
        r = mix(r, mix(0.04, 0.12, k) * shade, cr);
        g = mix(g, mix(0.18, 0.4, k) * shade, cr);
        b = mix(b, mix(0.07, 0.12, k) * shade, cr);
      }
    }
  }
  return lum(r, g, b) * (0.9 + 0.2 * fbm(px * 0.3, py * 0.3));
}

function height(x: number, y: number): number {
  let base = 0, ridge = 0, a = 0.5;
  for (let i = 0; i < 6; i++) {
    const n = vn(x, y);
    base += a * n;
    ridge += a * (1 - Math.abs(2 * n - 1));
    [x, y] = [1.6 * x - 1.2 * y, 1.2 * x + 1.6 * y];
    a *= 0.5;
  }
  return clamp01((ridge * 0.7 + base * 0.3 - 0.3) * 2.2);
}

/** Relief: ridged heights shaded from the top left, with contour lines (Assets mountain). */
export function relief(u: number, v: number): number {
  const x = u * 3.2 + 5, y = v * 3.2 + 2;
  const e = 0.015;
  const h0 = height(x, y);
  const nx = -(height(x + e, y) - h0) / e, ny = -(height(x, y + e) - h0) / e;
  const shade = (nx * -0.6 + ny * 0.6 + 0.8) / Math.hypot(nx, ny, 1) / Math.hypot(0.6, 0.6, 0.8);
  const cl = fract(h0 * 18);
  const c = (0.3 + 0.9 * shade) * (0.6 + 0.4 * h0) * (1 - 0.2 * smoothstep(0.08, 0, Math.min(cl, 1 - cl)));
  // Compressed around the middle to fit a byte (steep slopes in shadow went below 0)
  return 0.5 + (c - 0.5) * 0.7;
}

export interface PatternData {
  size: number;
  /** RGBA bytes, row by row from the bottom (texture v = 0 first). */
  data: Uint8Array;
  /** Mean and standard deviation of each channel (0–1), to turn a texel into light and shade. */
  mean: [number, number, number, number];
  std: [number, number, number, number];
}

/** Compute the four patterns; deterministic. */
export function computePatterns(size = SURFACE_SIZE): PatternData {
  const data = new Uint8Array(size * size * 4);
  const sum = [0, 0, 0, 0];
  const sq = [0, 0, 0, 0];
  const patterns = [water, fields, forest, relief];
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size - 0.5;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5;
      for (let c = 0; c < 4; c++) {
        const byte = Math.round(clamp01(patterns[c](u, v)) * 255);
        data[(y * size + x) * 4 + c] = byte;
        sum[c] += byte / 255;
        sq[c] += (byte / 255) ** 2;
      }
    }
  }
  const n = size * size;
  const mean = sum.map(s => s / n) as PatternData['mean'];
  const std = sq.map((s, c) => Math.sqrt(Math.max(s / n - mean[c] ** 2, 1e-6))) as PatternData['std'];
  return { size, data, mean, std };
}
