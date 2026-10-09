/**
 * globe/main.ts — Three.js 3D globe with hex grid.
 * Minimal working version for T-GC3-001.
 */
import * as THREE from 'three';
import { attachInput, GlobeCamera } from './camera';
import { buildHexGrid } from './hexGrid';
import { TileManager } from './tiles';

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

// ─── Camera rig ───────────────────────────────────
// Starts where the old OrbitControls view was. With the tiled surface the camera
// can descend to quadtree level 17.
const rig = new GlobeCamera(RADIUS, camera, {
  minDist: RADIUS * 2e-5,
  maxDist: RADIUS * 6,
  startDist: Math.hypot(0, 3, 12) - RADIUS,
});
rig.target.set(0, 3, 12).normalize();
rig.forward.set(0, 1, 0);
rig.apply();
attachInput(renderer.domElement, rig);

// ─── Surface (cube-sphere quadtree) ───────────────
const tiles = new TileManager(RADIUS);
scene.add(tiles.group);

// Render hex dots
const dotsGeo = new THREE.BufferGeometry();
const positions: number[] = [];
const colors: number[] = [];
for (const node of nodes) {
  const p = node.position.clone().normalize().multiplyScalar(RADIUS * 1.002);
  positions.push(p.x, p.y, p.z);
  // Color: light blue dots
  colors.push(0.3, 0.5, 0.8);
}
dotsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
dotsGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const dotsMat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, depthTest: true });
const dotsMesh = new THREE.Points(dotsGeo, dotsMat);
scene.add(dotsMesh);

// Wireframe for edges
const edgeGeo = new THREE.BufferGeometry();
const edgePositions: number[] = [];
for (const [i1, i2] of edges) {
  const p1 = nodes[i1].position.clone().normalize().multiplyScalar(RADIUS * 1.003);
  const p2 = nodes[i2].position.clone().normalize().multiplyScalar(RADIUS * 1.003);
  edgePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
}
edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
const edgeMat = new THREE.LineBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.4 });
const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
scene.add(edgeLines);

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

// ─── Double-click flies to a hex ──────────────────
let lastClickTime = 0;
renderer.domElement.addEventListener('click', (event: MouseEvent) => {
  const now = Date.now();
  const isDouble = now - lastClickTime < 400;
  lastClickTime = now;
  if (!isDouble) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  // Ray against the sphere itself: works at every zoom level, unlike a points threshold
  const hit = rig.raycast(mouse);
  if (hit) {
    const point = hit.normalize();
    // Find closest node
    let bestIdx = -1, bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = point.distanceToSquared(nodes[i].position.clone().normalize());
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    console.log(`[GlobeCiv3] Double-clicked hex #${bestIdx} (${nodes[bestIdx]?.neighbors.length ?? 0} neighbors)`);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rig.flyTo(nodes[bestIdx].position, Math.min(rig.dist, RADIUS * 0.25), reduceMotion ? 0 : 1);
  }
});

// ─── Animation loop ───────────────────────────────
let lastFrame = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  // Real elapsed time, not clamped: a 1 s flight must last 1 s even when frames are slow
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  rig.update(dt);
  tiles.update(camera, renderer.domElement.clientHeight, dt);
  // The hex grid floats ~0.015 above the surface; hide it before the camera reaches it
  dotsMesh.visible = edgeLines.visible = rig.altitude() > RADIUS * 0.02;
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
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Export globals ───────────────────────────────
(window as any).globeScene = scene;
(window as any).globeNodes = nodes;
(window as any).globeCamera = rig;
(window as any).globeTiles = tiles;

console.log('[GlobeCiv3] 3D globe ready');
