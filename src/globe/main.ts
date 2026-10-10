/**
 * globe/main.ts — Three.js 3D globe with hex grid.
 * Minimal working version for T-GC3-001.
 */
import * as THREE from 'three';
import { attachInput, GlobeCamera } from './camera';
import { buildHexGrid } from './hexGrid';
import { backTarget, diveTarget, frameDistances, levelForDist, regionAt, regionCenter, regionPath, sameRegion, type FlightTarget, type RegionRef, type ViewLevel } from './levels';
import { neighbors, pointToTile, tileCenter } from './hexTiles';
import { Regions } from './regions';
import { terrainHeight } from './terrain';
import { TileManager } from './tiles';
import { createLevelBar } from '../ui/levelBar';
import { createStartScreen, RING_EXTENT } from '../ui/startScreen';
import { chooseStartCity, cityTiles } from '../game/start';
import { tileInfo, TileTypeTable } from '../game/terrainTypes';
import { createGlyphAtlas } from './glyphAtlas';
import { MapState, withNeighbors } from '../game/mapping';
import { paintMapped } from './fogMap';
import { GameClock, type Speed } from '../game/clock';
import { tilesInRings } from '../game/pathfinding';
import { TERRAINS, TERRAIN_RULES, RESOURCES, type Terrain } from '../game/terrainTypes';
import { unitStatus, Units, type Mode, type World } from '../game/units';
import { UnitLayer } from './unitLayer';
import { createGameHud, type GameHudState } from '../ui/gameHud';

// ─── Scene setup ──────────────────────────────────
const container = document.getElementById('globe-container')!;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Transparent clear: the page's Kartografi gradient is the background, stars are drawn over it
renderer.setClearColor(0x000000, 0);
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
// Builds the tile table (city area of each of the ~1.09 M hex tiles) once, as a texture
const tileTableStart = performance.now();
const tiles = new TileManager(RADIUS, regions);
console.log(`[GlobeCiv3] Hex tile table: ${(performance.now() - tileTableStart).toFixed(0)} ms`);
tiles.glyphAtlas.value = createGlyphAtlas();

// ─── Tile terrain types near the view (STORY-023) ─
// Computed a city area at a time (about 62 tiles) for the city areas around the camera
// target at the city-area level; uploads are batched to at most five a second.
const tileTypes = new TileTypeTable(tiles.tileCodes);
let typesPending = false;
let lastTypeUpload = 0;
function updateTileTypes(now: number) {
  if (viewLevel < 3) return;
  const reach = Math.cos(regions.inradius[2] * 4);
  const cities = regions.centers[2];
  const start = performance.now();
  for (let c = 0; c < cities.length; c++) {
    if (cities[c].dot(rig.target) < reach || tileTypes.has(c)) continue;
    tileTypes.fill(c, cityTiles(regions, c));
    typesPending = true;
    if (performance.now() - start > 4) break;
  }
  if (typesPending && now - lastTypeUpload > 200) {
    tiles.tileCodesChanged();
    typesPending = false;
    lastTypeUpload = now;
  }
}
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

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fly(to: FlightTarget, durationS = 1) {
  selection = null;
  flight = to;
  rig.flyTo(to.point, to.dist, reduceMotion() ? 0 : durationS);
}

function onTap(clientX: number, clientY: number) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  // Ray against the sphere itself: works at every zoom level
  const hit = rig.raycast(ndc);
  if (play && viewLevel === 3 && tapPlay(clientX - rect.left, clientY - rect.top, rect.width, rect.height, hit)) return;
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

const hud = document.getElementById('hud')!;
const hud_root = hud;
const levelBar = createLevelBar(hud, () => {
  const to = backTarget(regions, flight ? flight.point : rig.target, viewLevel, frames);
  if (to) fly(to);
});

// ─── Start screen, new game and fly-in (STORY-021) ───────────
// ?free skips the start screen and the zoom lock (engine tests, development).
// ?seed=N fixes the game seed, so the same seed starts in the same place.
const params = new URLSearchParams(window.location.search);
type Screen = 'start' | 'intro' | 'playing' | 'free';
let screen: Screen = params.has('free') ? 'free' : 'start';
let game: { seed: number; startCity: number } | null = null;
/** Zooming out is allowed down to this view level (0: no lock). STORY-026 lowers it. */
let lockedLevel = 0;
/** Fly-in legs still to fly, and the start city's centre while flying in. */
const legs: { to: FlightTarget; durationS: number }[] = [];
let introTarget: THREE.Vector3 | null = null;
/** Planet rotation on the start screen: one turn in 80 s (design 1a). */
const SPIN_RAD_PER_S = (2 * Math.PI) / 80;
const spinAxis = new THREE.Vector3(0, 1, 0);
const spinStep = new THREE.Quaternion();
/** Inverse of the accumulated spin, so the stars stay still while the camera orbits. */
const spinInverse = new THREE.Quaternion();

/** Largest distance that stays at the city-area view level. */
const lockDist = () => Math.sqrt(frames[2] * frames[3]) * 0.97;

const startScreen = screen === 'start' ? createStartScreen(hud, newGame) : null;
levelBar.setVisible(screen === 'free');

// ─── Fog of war (STORY-024) ───────────────────────
// In the game everything not yet mapped is fog; ?free shows the world as it is.
const mapState = new MapState();
tiles.fogOn.value = screen === 'free' ? 0 : 1;
// The start screen's planet is a silhouette without borders (design 1a)
const BORDER_STRENGTH = tiles.borderStrength.value;
if (screen === 'start') tiles.borderStrength.value = 0;

/** Map tiles: their terrain, the mapped bit and the coarse fog map, uploaded at once. */
function reveal(ids: Iterable<number>) {
  const fresh = mapState.reveal(ids);
  if (!fresh.length) return;
  const codes = tiles.tileCodes;
  for (const id of fresh) {
    tileTypes.fillTile(id);
    codes[id] |= 32;
  }
  paintMapped(tiles.fogData, fresh);
  tiles.tileCodesChanged();
  tiles.fogChanged();
}

/**
 * Frame the planet between the title and the actions: radius at most 38 % of the width
 * (as in the design), ring included. The globe is centred, so the free space is used
 * symmetrically around the middle of the screen.
 */
function frameStartPlanet() {
  if (!startScreen) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { top, bottom } = startScreen.freeSpace();
  const room = Math.min(h / 2 - top, bottom - h / 2) - 12;
  const r = Math.max(40, Math.min(0.38 * w, room / RING_EXTENT));
  // A sphere seen from distance D spans the half-angle asin(R / D)
  const half = Math.atan((r / (h / 2)) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  rig.dist = RADIUS / Math.sin(half) - RADIUS;
  rig.apply();
  startScreen.placeRing(w / 2, h / 2, r);
}

function newGame() {
  if (screen !== 'start' || !startScreen) return;
  const seed = params.has('seed') ? Number(params.get('seed')) : crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
  const startCity = chooseStartCity(regions, seed);
  game = { seed, startCity };
  screen = 'intro';
  introTarget = regions.centers[2][startCity].clone();
  tiles.borderStrength.value = BORDER_STRENGTH;
  // Storyboard 2a: the landing tile and its 6 neighbours are mapped first
  reveal(withNeighbors(pointToTile(introTarget)));
  const reduce = reduceMotion();
  startScreen.hide(!reduce);
  if (reduce) {
    // Straight cut, softened by a 200 ms fade (Web Animations follow the wall clock)
    const cut = document.createElement('div');
    cut.className = 'cut-fade';
    document.body.appendChild(cut);
    cut.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => cut.remove());
    legs.push({ to: { point: introTarget, dist: frames[3], level: 3 }, durationS: 0 });
  } else {
    // Storyboard 2a: turn onto the target at planet distance (1 s), then descend (2 s)
    legs.push({ to: { point: introTarget, dist: rig.dist, level: 0 }, durationS: 1 });
    legs.push({ to: { point: introTarget, dist: frames[3], level: 3 }, durationS: 2 });
  }
}

// ─── Play: day clock, units and the HUD (STORY-025) ─
// After landing, a day passes every 1.5 s / speed. Units act on their own each day;
// the player sets scouts' modes and the flag, and the settler's city site.
/** Share of a province that unlocks the next level (STORY-026 acts on it). */
const UNLOCK_SHARE = 0.6;
const clock = new GameClock();
const unitLayer = new UnitLayer(RADIUS);
scene.add(unitLayer.group);
interface Play {
  units: Units;
  selected: number;
  flagTool: boolean;
  /** Tiles of the start province, for the mapping meter. */
  province: number[];
  hud: ReturnType<typeof createGameHud>;
}
let play: Play | null = null;

const terrainOf = (id: number): Terrain => {
  tileTypes.fillTile(id);
  return TERRAINS[(tileTypes.codes[id] & 15) - 1];
};
const world: World = {
  cost: id => (terrainOf(id) === 'ocean' ? Infinity : TERRAIN_RULES[terrainOf(id)].move),
  isMapped: id => mapState.isMapped(id),
  hasResource: id => (tileTypes.codes[id] & 16) !== 0,
  reveal: ids => reveal(ids),
  // A city site is as good as the food, shields and trade within two rings (food counts twice)
  siteScore: id => tilesInRings(id, 2).reduce((sum, t) => {
    const terrain = terrainOf(t);
    const rule = TERRAIN_RULES[terrain];
    const res = tileTypes.codes[t] & 16 ? RESOURCES[rule.resource] : { food: 0, shield: 0, trade: 0 };
    return sum + 2 * (rule.food + res.food) + rule.shield + res.shield + rule.trade + res.trade;
  }, 0),
};

function startPlay(startCity: number) {
  const units = new Units(pointToTile(regions.centers[2][startCity]), world);
  const province = Math.floor(startCity / 7);
  const provinceTiles: number[] = [];
  for (let c = province * 7; c < province * 7 + 7; c++) provinceTiles.push(...cityTiles(regions, c));
  const hud = createGameHud(hud_root, {
    togglePause: () => { clock.paused = !clock.paused; },
    setSpeed: (speed: Speed) => { clock.speed = speed; clock.paused = false; },
    setMode: (mode: Mode) => { if (play) play.units.setMode(play.units.units[play.selected], mode); },
    toggleFlagTool: () => { if (play) play.flagTool = !play.flagTool; },
    found: () => { if (play) play.units.found(world); },
    nextSite: () => { if (play) play.units.nextSite(); },
  });
  // The first scout is selected, as in the design
  play = { units, selected: 1, flagTool: false, province: provinceTiles, hud };
}

/** A tap at the city-area level: a unit, or the flag's tile with the flag tool. Returns true if used. */
function tapPlay(x: number, y: number, width: number, height: number, hit: THREE.Vector3 | null): boolean {
  if (!play) return false;
  if (play.flagTool && hit) {
    const tile = pointToTile(hit);
    if (Number.isFinite(world.cost(tile))) {
      play.units.flag = tile;
      for (const u of play.units.units) if (u.kind === 'scout' && u.mode === 'explore') u.path = [];
    }
    play.flagTool = false;
    return true;
  }
  const picked = unitLayer.pick(play.units.units, camera, x, y, width, height, 22, tileSpacing());
  if (picked === null) return false;
  play.selected = picked;
  return true;
}

/** Distance between tile centres in world units near the camera target. */
const tileSpacing = () => (RADIUS * Math.acos(1 / Math.sqrt(5))) / 330;

function updatePlay(dt: number) {
  if (!play) return;
  const days = clock.advance(dt);
  for (let d = 0; d < days; d++) play.units.day(world);
  const u = play.units.units[play.selected];
  const state: GameHudState = {
    day: clock.day,
    speed: clock.speed,
    paused: clock.paused,
    mapped: mapState.share(play.province),
    unlockAt: UNLOCK_SHARE,
    unit: { name: u.name, status: unitStatus(play.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name), kind: u.kind, mode: u.mode },
    flagTool: play.flagTool,
  };
  play.hud.update(state);
  unitLayer.update({
    units: play.units.units,
    selected: play.selected,
    flag: play.units.flag,
    site: play.units.currentSite(),
    founding: play.units.founding,
    spacing: tileSpacing(),
  }, camera.position);
}

/** Advance the start screen and the fly-in for this frame. */
function updateGameFlow(dt: number) {
  if (screen === 'start') {
    if (!reduceMotion()) {
      spinStep.setFromAxisAngle(spinAxis, -SPIN_RAD_PER_S * dt);
      rig.target.applyQuaternion(spinStep);
      rig.forward.applyQuaternion(spinStep);
      rig.apply();
      spinInverse.multiply(spinStep.invert());
    }
    return;
  }
  if (screen !== 'intro' || rig.flying) return;
  const leg = legs.shift();
  if (leg) {
    fly(leg.to, leg.durationS);
    return;
  }
  // Landed: the start city area is mapped, it is the game's view, and zooming out
  // waits for the unlock (STORY-026)
  if (game) reveal(cityTiles(regions, game.startCity));
  if (game) startPlay(game.startCity);
  screen = 'playing';
  introTarget = null;
  lockedLevel = 3;
  rig.maxDist = lockDist();
  startScreen?.remove();
}

/** Level, breadcrumb, selection and context for this frame. */
function updateLevel() {
  if (!rig.flying) flight = null;
  viewLevel = levelForDist(rig.dist, frames);
  if (introTarget) selection = viewLevel < 3 ? regionPath(regions, introTarget, viewLevel + 1)[viewLevel] : null;
  if (selection && selection.level !== viewLevel) selection = null;
  // During a flight the breadcrumb and context follow the destination, never deeper
  // than the destination level, so they do not flicker across regions on the way
  const anchor = flight ? flight.point : rig.target;
  const depth = flight ? Math.min(viewLevel, flight.level) : viewLevel;
  path = regionPath(regions, anchor, depth);
  const context = path.length ? path[path.length - 1] : null;
  tiles.setHighlight(
    selection ? { ...selection, center: regionCenter(regions, selection) } : null,
    context ? { ...context, center: regionCenter(regions, context) } : null,
  );
  levelBar.update({ level: viewLevel, path, selection: introTarget ? null : selection, canGoBack: viewLevel > lockedLevel });
}

// ─── Animation loop ───────────────────────────────
const lightX = new THREE.Vector3();
const lightY = new THREE.Vector3();
const lightZ = new THREE.Vector3();
const lightBasis = camera.matrixWorld;
let lastFrame = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  // Real elapsed time, not clamped: a 1 s flight must last 1 s even when frames are slow
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  rig.update(dt);
  updateGameFlow(dt);
  updateLevel();
  // Light from the top left of the view (design: light from the top left), so the
  // part of the world in view is always lit: a map, not a day and night side
  lightBasis.extractBasis(lightX, lightY, lightZ);
  tiles.sunDir.value.copy(lightX.multiplyScalar(-0.45)).addScaledVector(lightY, 0.55).addScaledVector(lightZ, 0.7).normalize();
  tiles.screenUp.value.copy(lightY);
  updateTileTypes(now);
  updatePlay(dt);
  tiles.update(camera, renderer.domElement.clientHeight, dt);
  starCamera.quaternion.copy(spinInverse).multiply(camera.quaternion);
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
  if (screen === 'start') frameStartPlanet();
  if (lockedLevel === 3) rig.maxDist = lockDist();
});
frameStartPlanet();

// ─── Export globals ───────────────────────────────
(window as any).globeScene = scene;
(window as any).globeNodes = nodes;
(window as any).globeCamera = rig;
(window as any).globeTiles = tiles;
(window as any).globeTerrain = { terrainHeight };
(window as any).globeRegions = regions;
(window as any).globeTileTypes = { tileInfo, codes: tileTypes.codes };
(window as any).globeMap = { isMapped: (id: number) => mapState.isMapped(id) };
(window as any).globeHexTiles = { pointToTile, tileCenter, neighbors };
(window as any).globeGame = {
  get state() {
    return {
      screen, seed: game?.seed ?? null, startCity: game?.startCity ?? null, lockedLevel, lockDist: lockDist(), mapped: mapState.count,
      day: clock.day, speed: clock.speed, paused: clock.paused,
      units: play?.units.units.map(u => ({ name: u.name, kind: u.kind, tile: u.tile, mode: u.mode, path: u.path.length })) ?? [],
      selected: play?.selected ?? null, flag: play?.units.flag ?? null, site: play?.units.currentSite() ?? null,
    };
  },
};
(window as any).globeLevels = {
  get state() {
    return { level: viewLevel, path, selection, frames, flying: rig.flying };
  },
};

console.log('[GlobeCiv3] 3D globe ready');
