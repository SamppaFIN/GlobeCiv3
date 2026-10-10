/**
 * fogMap.ts — the coarse fog map for the far view.
 *
 * The six faces of a cube, FOG_FACE × FOG_FACE texels each, side by side in one 8-bit
 * texture (255 = mapped). A direction belongs to the face of its largest component,
 * and (u, v) are the other two components divided by it. The shader's fogUv() uses the
 * same convention. Mapped tiles are painted over their footprint, so bilinear sampling
 * gives a soft fog edge where tiles are too small to draw.
 */
import * as THREE from 'three';
import { neighbors, tileCenter } from './hexTiles';

export const FOG_FACE = 256;
export const FOG_WIDTH = 6 * FOG_FACE;

/** Texel index of a direction (need not be normalised). */
export function fogTexel(x: number, y: number, z: number): number {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let face: number, u: number, v: number;
  if (ax >= ay && ax >= az) { face = x > 0 ? 0 : 1; u = y / ax; v = z / ax; }
  else if (ay >= az) { face = y > 0 ? 2 : 3; u = x / ay; v = z / ay; }
  else { face = z > 0 ? 4 : 5; u = x / az; v = y / az; }
  const i = Math.min(FOG_FACE - 1, Math.floor(((u + 1) / 2) * FOG_FACE));
  const j = Math.min(FOG_FACE - 1, Math.floor(((v + 1) / 2) * FOG_FACE));
  return j * FOG_WIDTH + face * FOG_FACE + i;
}

/** GLSL: texture coordinates of a direction in the fog map, as fogTexel(). */
export const FOG_UV_GLSL = /* glsl */ `
  vec2 fogUv(vec3 d) {
    vec3 a = abs(d);
    float face;
    vec2 uv;
    if (a.x >= a.y && a.x >= a.z) { face = d.x > 0.0 ? 0.0 : 1.0; uv = d.yz / a.x; }
    else if (a.y >= a.z) { face = d.y > 0.0 ? 2.0 : 3.0; uv = d.xz / a.y; }
    else { face = d.z > 0.0 ? 4.0 : 5.0; uv = d.xy / a.z; }
    uv = clamp((uv + 1.0) * 0.5, 0.5 / ${FOG_FACE}.0, 1.0 - 0.5 / ${FOG_FACE}.0);
    return vec2((face + uv.x) / 6.0, uv.y);
  }
`;

export function createFogTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(FOG_WIDTH * FOG_FACE), FOG_WIDTH, FOG_FACE, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const c = new THREE.Vector3();
const n = new THREE.Vector3();

/** Paint mapped tiles into the fog map: the centre and points toward each neighbour. */
export function paintMapped(data: Uint8Array, tiles: readonly number[]): void {
  for (const id of tiles) {
    tileCenter(id, c);
    data[fogTexel(c.x, c.y, c.z)] = 255;
    for (const nb of neighbors(id)) {
      tileCenter(nb, n);
      // Halfway to the neighbour is the shared edge: stay just inside the tile
      n.sub(c).multiplyScalar(0.45).add(c);
      data[fogTexel(n.x, n.y, n.z)] = 255;
    }
  }
}
