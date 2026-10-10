/**
 * colors.ts — design tokens (OKLCH, tokens.css) as shader colours.
 *
 * The tile shader writes its colour straight to the sRGB framebuffer without colour
 * management, so tokens are converted to gamma-encoded sRGB in 0…1.
 */

/** OKLCH (lightness 0…1, chroma, hue in degrees) → gamma-encoded sRGB, clamped to 0…1. */
export function oklchToSrgb(L: number, C: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map(c => {
    const v = Math.min(1, Math.max(0, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

/** GLSL vec3 literal of an OKLCH token. */
export function glslOklch(L: number, C: number, hDeg: number): string {
  return `vec3(${oklchToSrgb(L, C, hDeg).map(v => v.toFixed(5)).join(', ')})`;
}
