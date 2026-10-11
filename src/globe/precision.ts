/**
 * precision.ts — how far from exact the GPU puts the surface (STORY-006).
 *
 * Tile vertices are relative to the tile centre, and three.js multiplies view × model on
 * the CPU in float64 (tiles.ts), so the GPU sees only small camera-relative values. This
 * measures the screen error of that float32 path against an exact float64 projection,
 * and of a naive float32 path with absolute world coordinates for comparison. Moved here
 * from the STORY-004 prototype (src/spike/metrics.ts).
 */
import * as THREE from 'three';
import { tileToSphere } from './cubeSphere';
import type { TileNode } from './tiles';

const f = Math.fround;

/** 4×4 column-major matrix × vec4 with float32 rounding after every operation, like a GPU without FMA. */
function mulF32(m: number[], x: number, y: number, z: number, w: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    let acc = f(f(m[i]) * f(x));
    acc = f(acc + f(f(m[i + 4]) * f(y)));
    acc = f(acc + f(f(m[i + 8]) * f(z)));
    acc = f(acc + f(f(m[i + 12]) * f(w)));
    out.push(acc);
  }
  return out;
}

function mul64(m: number[], x: number, y: number, z: number, w: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 4; i++) out.push(m[i] * x + m[i + 4] * y + m[i + 8] * z + m[i + 12] * w);
  return out;
}

/** Screen error in pixels of a tile's corners and inner points: camera-relative and naive float32. */
export function projectionErrorPx(node: TileNode, camera: THREE.PerspectiveCamera, R: number, width: number, height: number) {
  const view = camera.matrixWorldInverse.elements;
  const proj = camera.projectionMatrix.elements;
  const modelView = new THREE.Matrix4().multiplyMatrices(camera.matrixWorldInverse, node.mesh!.matrixWorld).elements;
  const toPx = (clip: number[], ref: number[]) =>
    Math.hypot(((clip[0] / clip[3] - ref[0] / ref[3]) * width) / 2, ((clip[1] / clip[3] - ref[1] / ref[3]) * height) / 2);

  let rtc = 0, naive = 0;
  const d = new THREE.Vector3();
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5], [0.25, 0.75]]) {
    tileToSphere(node.tile, i, j, d);
    const wx = d.x * R, wy = d.y * R, wz = d.z * R;
    const vExact = mul64(view, wx, wy, wz, 1);
    const exact = mul64(proj, vExact[0], vExact[1], vExact[2], vExact[3]);

    const lx = f(wx - node.center.x), ly = f(wy - node.center.y), lz = f(wz - node.center.z);
    const vRtc = mulF32(modelView, lx, ly, lz, 1);
    rtc = Math.max(rtc, toPx(mulF32(proj, vRtc[0], vRtc[1], vRtc[2], vRtc[3]), exact));

    const vNaive = mulF32(view, f(wx), f(wy), f(wz), 1);
    naive = Math.max(naive, toPx(mulF32(proj, vNaive[0], vNaive[1], vNaive[2], vNaive[3]), exact));
  }
  return { rtc, naive };
}
