/**
 * spike/main.ts — STORY-004 infinite zoom prototype.
 *
 * URL parameters:
 *   ?bench        fly from orbit to level 17 and back, then log "[bench] {json}"
 *   ?dist=<n>     start at distance n × R and set window.__ready when tiles settle
 *   ?tint=1       tint tiles by quadtree level
 */
import * as THREE from 'three';
import { attachInput, GlobeCamera } from './camera';
import { TileManager } from './tiles';
import { gpuName, projectionErrorPx, summarize, type FrameSample } from './metrics';
import { octavesFor, terrainHeight } from './noise';

const R = 5;
const params = new URLSearchParams(location.search);
const w = window as unknown as Record<string, unknown>;

const container = document.getElementById('app')!;
const hud = document.getElementById('hud')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05060c);
renderer.autoClear = false;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
const tiles = new TileManager(R);
scene.add(tiles.group);

const rig = new GlobeCamera(R, camera);

/**
 * A coastline point at full (level 17) octave resolution: walk north from a start
 * point until land and sea swap, then bisect. Coasts have detail at every scale,
 * which makes seams and popping visible if they exist.
 */
function findCoast(): THREE.Vector3 {
  const octaves = octavesFor(17) + 1;
  const start = new THREE.Vector3(0.35, 0.42, 0.84).normalize();
  const axis = new THREE.Vector3(1, 0, 0);
  const h = (v: THREE.Vector3) => terrainHeight(v.x, v.y, v.z, octaves);
  const at = (angle: number) => start.clone().applyAxisAngle(axis, -angle);
  const sign0 = Math.sign(h(start));
  let lo = 0, hi = 0;
  for (let a = 0.005; a < Math.PI; a += 0.005) {
    if (Math.sign(h(at(a))) !== sign0) { lo = a - 0.005; hi = a; break; }
  }
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (Math.sign(h(at(m))) === sign0) lo = m; else hi = m;
  }
  return at((lo + hi) / 2);
}
const COAST = findCoast();
rig.target.copy(COAST);
rig.forward.set(0, 1, 0);
if (params.has('dist')) rig.dist = Number(params.get('dist')) * R;
rig.apply();

// Stars live in their own scene and camera so they never touch the globe's near/far
const starScene = new THREE.Scene();
const starCam = new THREE.PerspectiveCamera(45, camera.aspect, 1, 5000);
{
  const pts: number[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 3000; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
    pts.push(1000 * Math.sin(ph) * Math.cos(th), 1000 * Math.sin(ph) * Math.sin(th), 1000 * Math.cos(ph));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  starScene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false })));
}

let tint = params.get('tint') === '1';
const setTint = (on: boolean) => { tint = on; tiles.tintAmount.value = on ? 0.45 : 0; };
setTint(tint);

// ─── Bench ────────────────────────────────────────
const ROUTE = { startDist: R * 5, endDist: rig.minDist, downS: 30, holdS: 4, upS: 15 };
interface Bench { t: number; samples: FrameSample[]; jitter: { rtc: number; naive: number } | null; zoomErrPx: number }
let bench: Bench | null = null;

function zoomCursorErrorPx(): number {
  const { clientWidth: cw, clientHeight: ch } = renderer.domElement;
  let worst = 0;
  for (const startDist of [R * 3, R * 1e-3]) {
    for (const [x, y] of [[0.3, 0.2], [-0.4, -0.1], [0.1, -0.5]]) {
      rig.dist = startDist;
      rig.apply();
      const ndc = new THREE.Vector2(x, y);
      for (let k = 0; k < 5; k++) {
        const p = rig.zoomAt(ndc, 0.7);
        if (p) worst = Math.max(worst, rig.screenErrorPx(p, ndc, cw, ch));
      }
    }
  }
  return worst;
}

function startBench(): void {
  const zoomErrPx = zoomCursorErrorPx();
  rig.target.copy(COAST);
  rig.forward.set(0, 1, 0);
  rig.dist = ROUTE.startDist;
  rig.apply();
  bench = { t: 0, samples: [], jitter: null, zoomErrPx };
}

function stepBench(dt: number): void {
  if (!bench) return;
  bench.t += dt;
  const { startDist, endDist, downS, holdS, upS } = ROUTE;
  const t = bench.t;
  const u = t < downS ? t / downS : t < downS + holdS ? 1 : 1 - (t - downS - holdS) / upS;
  const k = Math.min(1, Math.max(0, u));
  rig.dist = Math.exp(Math.log(startDist) + (Math.log(endDist) - Math.log(startDist)) * k);
  rig.apply();
}

function finishBench(): void {
  if (!bench) return;
  const result = {
    device: {
      gpu: gpuName(renderer),
      userAgent: navigator.userAgent,
      devicePixelRatio: renderer.getPixelRatio(),
      viewport: `${renderer.domElement.clientWidth}×${renderer.domElement.clientHeight}`,
    },
    route: ROUTE,
    ...summarize(bench.samples.slice(3)),
    jitterPx: bench.jitter,
    zoomCursorErrorPx: Math.round(bench.zoomErrPx * 1000) / 1000,
  };
  bench = null;
  w.__bench = result;
  console.log('[bench] ' + JSON.stringify(result));
  benchText = `BENCH VALMIS\n${result.device.gpu}\nFPS ka ${result.avgFps}, 1 % alin ${result.p1LowFps}, pahin frame ${result.worstFrameMs} ms\n` +
    `syvin taso ${result.reachedLevel}, ruutuja enint. ${result.maxDrawn}, generointi ${result.genMsPerTile} ms/ruutu\n` +
    `värinä ${result.jitterPx?.rtc.toFixed(3)} px (naiivi ${result.jitterPx?.naive.toFixed(1)} px), zoom-kursori ${result.zoomCursorErrorPx} px`;
}

// ─── Input and UI ─────────────────────────────────
attachInput(renderer.domElement, rig, () => { bench = null; });
document.getElementById('bench')!.addEventListener('click', startBench);
document.getElementById('tint')!.addEventListener('click', () => setTint(!tint));
window.addEventListener('keydown', e => {
  if (e.key === 'l' || e.key === 'L') setTint(!tint);
  if (e.key === 'b' || e.key === 'B') startBench();
});
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = starCam.aspect = window.innerWidth / window.innerHeight;
  starCam.updateProjectionMatrix();
  rig.apply();
});

// ─── Loop ─────────────────────────────────────────
let last = performance.now();
let frameTimes: number[] = [];
let lastStats = tiles.update(camera, renderer.domElement.clientHeight, 0);
let jitterNow = { rtc: 0, naive: 0 };
let hudAt = 0;
let jitterAt = 0;
let stableFrames = 0;
let benchText = '';

function frame(now: number): void {
  const dtMs = now - last;
  last = now;
  const dt = Math.min(dtMs / 1000, 0.1);

  stepBench(dt);
  rig.apply();
  const stats = tiles.update(camera, renderer.domElement.clientHeight, dt);
  lastStats = stats;

  starCam.quaternion.copy(camera.quaternion);
  renderer.clear();
  renderer.render(starScene, starCam);
  renderer.clearDepth();
  renderer.render(scene, camera);

  frameTimes.push(dtMs);
  if (frameTimes.length > 120) frameTimes.shift();

  const deepest = tiles.deepestDrawn();
  if (deepest && now - jitterAt > 500) {
    jitterAt = now;
    jitterNow = projectionErrorPx(deepest, camera, R, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
  }

  if (bench) {
    bench.samples.push({ ...stats, dtMs });
    const { downS, holdS, upS } = ROUTE;
    if (!bench.jitter && bench.t > downS + holdS / 2 && deepest) {
      bench.jitter = projectionErrorPx(deepest, camera, R, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
    }
    if (bench.t > downS + holdS + upS) finishBench();
  }

  if (params.has('dist') && !w.__ready) {
    stableFrames = stats.queue === 0 && stats.created === 0 ? stableFrames + 1 : 0;
    if (stableFrames >= 20) {
      w.__ready = { level: stats.maxLevel, drawn: stats.drawn };
      console.log('[ready] ' + JSON.stringify(w.__ready));
    }
  }

  if (now - hudAt > 250) {
    hudAt = now;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const worst = Math.max(...frameTimes);
    hud.textContent =
      `FPS ${(1000 / avg).toFixed(1)}   pahin ${worst.toFixed(1)} ms\n` +
      `taso ${lastStats.maxLevel}   ruudut ${lastStats.drawn}   välimuisti ${lastStats.meshes}   jono ${lastStats.queue}\n` +
      `luotu ${lastStats.created}/frame   generointi ${lastStats.genMs.toFixed(1)} ms\n` +
      `korkeus ${rig.altitude().toExponential(2)}   near ${camera.near.toExponential(1)}   far ${camera.far.toExponential(1)}\n` +
      `värinä ${jitterNow.rtc.toFixed(3)} px (naiivi ${jitterNow.naive.toFixed(1)} px)` +
      (bench ? `\nBENCH ${bench.t.toFixed(1)} s / ${ROUTE.downS + ROUTE.holdS + ROUTE.upS} s` : benchText ? `\n\n${benchText}` : '');
  }

  requestAnimationFrame(frame);
}

if (params.has('bench')) startBench();
w.__spike = { rig, tiles, camera };
requestAnimationFrame(frame);
