/**
 * metrics.ts — frame statistics, precision (jitter) estimate and bench summary.
 */
import * as THREE from 'three';
import { tileToSphere } from './cubeSphere';
import type { FrameStats, TileNode } from './tiles';

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

/**
 * Screen error in pixels between the exact float64 projection of tile vertices and
 * (a) the camera-relative float32 path this prototype uses and
 * (b) a naive float32 path with absolute world coordinates on the GPU.
 */
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

export interface FrameSample extends FrameStats {
  dtMs: number;
}

export function summarize(samples: FrameSample[]) {
  const fps = (ms: number) => Math.round((1000 / ms) * 10) / 10;
  const sorted = samples.map(s => s.dtMs).sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  const perLevel: Record<number, { frames: number; avgFps: number; worstMs: number; avgDrawn: number }> = {};
  for (let level = 0; level <= 17; level++) {
    const s = samples.filter(x => x.maxLevel === level);
    if (!s.length) continue;
    const a = s.reduce((acc, x) => acc + x.dtMs, 0) / s.length;
    perLevel[level] = {
      frames: s.length,
      avgFps: fps(a),
      worstMs: Math.round(Math.max(...s.map(x => x.dtMs)) * 10) / 10,
      avgDrawn: Math.round(s.reduce((acc, x) => acc + x.drawn, 0) / s.length),
    };
  }
  const created = samples.reduce((a, s) => a + s.created, 0);
  const genMs = samples.reduce((a, s) => a + s.genMs, 0);
  return {
    frames: samples.length,
    avgFps: fps(avg),
    p1LowFps: fps(p99),
    worstFrameMs: Math.round(sorted[sorted.length - 1] * 10) / 10,
    maxDrawn: Math.max(...samples.map(s => s.drawn)),
    maxMeshes: Math.max(...samples.map(s => s.meshes)),
    reachedLevel: Math.max(...samples.map(s => s.maxLevel)),
    tilesCreated: created,
    genMsPerTile: created ? Math.round((genMs / created) * 100) / 100 : 0,
    maxGenMsPerFrame: Math.round(Math.max(...samples.map(s => s.genMs)) * 10) / 10,
    perLevel,
  };
}

export function gpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
}
