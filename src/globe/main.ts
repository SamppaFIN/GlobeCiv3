/**
 * globe/main.ts — Three.js 3D globe with hex grid.
 * Minimal working version for T-GC3-001.
 */
import * as THREE from 'three';
import { attachInput, GlobeCamera } from './camera';
import { buildHexGrid } from './hexGrid';
import { backTarget, diveTarget, frameDistances, levelForDist, regionAt, regionCenter, regionPath, sameRegion, type FlightTarget, type RegionRef, type ViewLevel } from './levels';
import { Regions } from './regions';
import { terrainHeight } from './terrain';
import { TileManager } from './tiles';
import { createLevelBar } from '../ui/levelBar';

// ─── Scene setup ──────────────────────────────────
const container = document.getElementById('globe-container')!;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Background is the clear colour so the separate star pass shows through
renderer.setClearColor(0x0a0a14);
renderer.autoClear = false;
container.appendChild(renderer.domElement);

// ─── Lights ───────────────────────────────────────
const ambient = new THREE.AmbientLight(0x334466, 2);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(10, 5, 10);
scene.add(sun);

// ─── Globe + Hex Grid ─────────────────────────────
const RADIUS = 5;
const DETAIL = 5; // 362 nodes: 12 pentagons, 350 hexagons

const { nodes, edges } = buildHexGrid(RADIUS, DETAIL);

console.log(`[GlobeCiv3] Hex nodes: ${nodes.length}, edges: ${edges.length}`);

// Each hex node is the centre of a region; borders are drawn per pixel on the surface
const regions = new Regions(nodes);

// ─── Camera rig ───────────────────────────────────
// Starts where the old OrbitControls view was. With the tiled surface the camera
// can descend to quadtree level 17.
const rig = new GlobeCamera(RADIUS, camera, {
  minDist: RADIUS * 2e-5,
  maxDist: RADIUS * 8,
  startDist: Math.hypot(0, 3, 12) - RADIUS,
});
rig.target.set(0, 3, 12).normalize();
rig.forward.set(0, 1, 0);
rig.apply();
attachInput(renderer.domElement, rig);

// ─── Surface (cube-sphere quadtree) ───────────────
const tiles = new TileManager(RADIUS, regions);
scene.add(tiles.group);
const setNarrowPx = () => {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  tiles.narrowPx.value = Math.min(size.x, size.y);
};
setNarrowPx();

// ─── Stars ────────────────────────────────────────
// Own scene and camera: the globe camera's far plane ends at the horizon
const starScene = new THREE.Scene();
const starCamera = new THREE.PerspectiveCamera(45, camera.aspect, 1, 200);
const starsGeo = new THREE.BufferGeometry();
const starsPos: number[] = [];
for (let i = 0; i < 2000; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 50 + Math.random() * 30;
  starsPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 });
starScene.add(new THREE.Points(starsGeo, starsMat));

// ─── View levels: a tap selects a region, a second tap dives into it ─
// The level follows from the camera distance, so wheel, pinch and taps agree.
// A double-click is two taps: select, then dive.
let frames = frameDistances(RADIUS, regions.inradius, camera.fov, camera.aspect);
let viewLevel: ViewLevel = levelForDist(rig.dist, frames);
let selection: RegionRef | null = null;
let path: RegionRef[] = [];
let flight: FlightTarget | null = null;

function fly(to: FlightTarget) {
  selection = null;
  flight = to;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  rig.flyTo(to.point, to.dist, reduceMotion ? 0 : 1);
}

function onTap(clientX: number, clientY: number) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  // Ray against the sphere itself: works at every zoom level
  const hit = rig.raycast(ndc);
  const ref = hit ? regionAt(regions, hit, viewLevel) : null;
  if (ref && sameRegion(ref, selection)) fly(diveTarget(regions, ref, frames));
  else selection = ref;
}

// A tap is one pointer that goes down and up within 8 px and 500 ms; drags and pinches are not taps
const presses = new Map<number, { x: number; y: number; t: number }>();
let pinched = false;
renderer.domElement.addEventListener('pointerdown', e => {
  presses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  if (presses.size > 1) pinched = true;
});
const release = (e: PointerEvent, tap: boolean) => {
  const press = presses.get(e.pointerId);
  presses.delete(e.pointerId);
  const wasPinch = pinched;
  if (presses.size === 0) pinched = false;
  if (!tap || !press || wasPinch) return;
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8 || performance.now() - press.t > 500) return;
  onTap(e.clientX, e.clientY);
};
renderer.domElement.addEventListener('pointerup', e => release(e, true));
renderer.domElement.addEventListener('pointercancel', e => release(e, false));

const levelBar = createLevelBar(document.getElementById('hud')!, () => {
  const to = backTarget(regions, flight ? flight.point : rig.target, viewLevel, frames);
  if (to) fly(to);
});

/** Level, breadcrumb, selection and context for this frame. */
function updateLevel() {
  if (!rig.flying) flight = null;
  viewLevel = levelForDist(rig.dist, frames);
  if (selection && selection.level !== viewLevel) selection = null;
  // During a flight the breadcrumb and context follow the destination, never deeper
  // than the destination level, so they do not flicker across regions on the way
  const anchor = flight ? flight.point : rig.target;
  const depth = flight ? Math.min(viewLevel, flight.level) : viewLevel;
  path = regionPath(regions, anchor, depth);
  const context = path.length ? path[path.length - 1] : null;
  tiles.setHighlight(
    selection ? { level: selection.level, center: regionCenter(regions, selection) } : null,
    context ? { level: context.level, center: regionCenter(regions, context) } : null,
  );
  levelBar.update({ level: viewLevel, path, selection });
}

// ─── Animation loop ───────────────────────────────
let lastFrame = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  // Real elapsed time, not clamped: a 1 s flight must last 1 s even when frames are slow
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  rig.update(dt);
  updateLevel();
  tiles.update(camera, renderer.domElement.clientHeight, dt);
  starCamera.quaternion.copy(camera.quaternion);
  renderer.clear();
  renderer.render(starScene, starCamera);
  renderer.clearDepth();
  renderer.render(scene, camera);
}
animate();

// ─── Resize handler ───────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = starCamera.aspect = window.innerWidth / window.innerHeight;
  starCamera.updateProjectionMatrix();
  rig.apply();
  frames = frameDistances(RADIUS, regions.inradius, camera.fov, camera.aspect);
  renderer.setSize(window.innerWidth, window.innerHeight);
  setNarrowPx();
});

// ─── Export globals ───────────────────────────────
(window as any).globeScene = scene;
(window as any).globeNodes = nodes;
(window as any).globeCamera = rig;
(window as any).globeTiles = tiles;
(window as any).globeTerrain = { terrainHeight };
(window as any).globeRegions = regions;
(window as any).globeLevels = {
  get state() {
    return { level: viewLevel, path, selection, frames, flying: rig.flying };
  },
};

console.log('[GlobeCiv3] 3D globe ready');
