/**
 * globe/main.ts — Three.js 3D globe with hex grid.
 * Minimal working version for T-GC3-001.
 */
import * as THREE from 'three';
import { attachInput, GlobeCamera } from './camera';
import { buildHexGrid } from './hexGrid';
import { backTarget, diveTarget, frameDistances, levelForDist, regionAt, regionCenter, regionPath, sameRegion, type FlightTarget, type RegionRef, type ViewLevel } from './levels';
import { neighbors, pointToTile, tileCenter, TILE_COUNT } from './hexTiles';
import { Regions } from './regions';
import { terrainHeight } from './terrain';
import { TileManager } from './tiles';
import { createLevelBar } from '../ui/levelBar';
import { createStartScreen, RING_EXTENT } from '../ui/startScreen';
import { chooseStartCity, cityTiles } from '../game/start';
import { tileInfo, TileTypeTable } from '../game/terrainTypes';
import { createGlyphAtlas } from './glyphAtlas';
import { SURFACE_SIZE, type PatternData } from './surfacePatterns';
import { projectionErrorPx } from './precision';
import { MapState, withNeighbors } from '../game/mapping';
import { paintMapped } from './fogMap';
import { GameClock, type Speed } from '../game/clock';
import { findPath, tilesInRings } from '../game/pathfinding';
import { goodSite, OFFER_EVERY_DAYS } from '../game/sites';
import { createCityLabels } from '../ui/cityLabels';
import { createTileYields } from '../ui/tileYields';
import { createResearchCard, type ResearchView } from '../ui/researchCard';
import { createListCard, type ListTab, type ListView } from '../ui/listCard';
import { ADVANCES, NEEDS, Research, type Advance } from '../game/science';
import { advanceGoals, GOALS } from '../game/goals';
import { TERRAINS, TERRAIN_RULES, RESOURCES, type Terrain } from '../game/terrainTypes';
import { unitStatus, Units, type Mode, type SettlerTask, type Unit, type World } from '../game/units';
import { bestJob, Improvements, IMPROVEMENT_NAMES } from '../game/improvements';
import { banditWins, raidRoll, raidStart, Raids, uprising, type RaidEvent, type RaidWorld } from '../game/raids';
import { UnitLayer } from './unitLayer';
import { glowMesh, moveWell, newWell, pressWell, releaseWell, starMaterial, stepWell, wellUniforms } from './gravityWell';
import { PulseLayer, type PulseKind } from './pulses';
import { SAVE_VERSION, validateSave, type SaveData } from '../game/save';
import { loadSave, storeSave } from '../game/saveStore';
import { createGameHud, type GameHudState } from '../ui/gameHud';
import { advance, startProgress, UNLOCK_SHARE, type Progress } from '../game/progress';
import { areaName, directionFrom, distinctNames, landscapeOf, MIDDLE, provinceName, type RegionName } from '../game/names';
import { AREA_PLAN_NAMES, type AreaPlan, type StateLine } from '../game/units';
import { createChips, createLevelPanels, createUnlockCard, type Chip } from '../ui/levelUi';
import { applyFind, discoveryAt, discoverySentence, FINDS, type Discovery, type Yield } from '../game/discoveries';
import { createDiscoveryCard } from '../ui/discoveryCard';
import { BUILDS, buy, buyCost, cityDay, cityGold, cityRings, cityScience, cityYield, daysToBuild, daysToGrow, foundCity, granary, isBuilding, payUpkeep, shortfall, workedTiles, workedYield, CITY_RINGS, UPKEEP, type Build, type City, type CityYield, type Focus, type Support } from '../game/cities';
import { createCityCard, type CityView } from '../ui/cityCard';

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
// Surface patterns are computed in a worker once needed (a new game, or the city-area
// level in ?free); tiles are plain until they arrive
let surfaceRequested = false;
let surfaceArrivedAt = -Infinity;
function requestSurfacePatterns() {
  if (surfaceRequested) return;
  surfaceRequested = true;
  const worker = new Worker(new URL('./surfaceWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<PatternData & { ms: number }>) => {
    const { size, data, mean, std, ms } = e.data;
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    tiles.surfaceTex.value = tex;
    // Fade in over 0.6 s of wall time (rule 5) rather than pop in; at once with reduced motion
    surfaceArrivedAt = reduceMotion() ? -Infinity : performance.now();
    tiles.surfaceMean.value.set(...mean);
    tiles.surfaceStd.value.set(...std);
    worker.terminate();
    console.log(`[GlobeCiv3] Surface patterns: ${ms.toFixed(0)} ms in a worker`);
  };
  worker.postMessage({ size: SURFACE_SIZE });
}

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
// A press makes a gravity well: the stars swirl in and a glow gathers (STORY-035)
const well = newWell();
const wellU = wellUniforms();
const starsMat = starMaterial(wellU, 0.15);
starScene.add(new THREE.Points(starsGeo, starsMat));
const glowScene = new THREE.Scene();
glowScene.add(glowMesh(wellU));
const glowCamera = new THREE.Camera();
/** View units of a CSS pixel position: NDC with x scaled by the aspect ratio. */
const wellAt = (x: number, y: number): [number, number] => [((x / window.innerWidth) * 2 - 1) * camera.aspect, 1 - (y / window.innerHeight) * 2];

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
let wellPointer: number | null = null;
renderer.domElement.addEventListener('pointerdown', e => {
  presses.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  if (presses.size > 1) pinched = true;
  if (presses.size > 1) {
    wellPointer = null;
    releaseWell(well);
  } else if (!rig.raycast(ndcAt(e.clientX, e.clientY))) {
    wellPointer = e.pointerId;
    pressWell(well, ...wellAt(e.clientX, e.clientY));
  }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerId === wellPointer) moveWell(well, ...wellAt(e.clientX, e.clientY));
});
const release = (e: PointerEvent, tap: boolean) => {
  if (e.pointerId === wellPointer) {
    wellPointer = null;
    releaseWell(well);
  }
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

/** Largest distance that stays at a view level (default: the city area). */
const lockDist = (level = 3) => Math.sqrt(frames[level - 1] * frames[level]) * 0.97;

const startScreen = screen === 'start' ? createStartScreen(hud, newGame) : null;
/** Radius of the start screen's planet in CSS pixels (frameStartPlanet). */
let startRadiusPx = 1;

/** Orbit the start screen's camera by q; the stars counter-turn as with the slow spin. */
function orbitStart(q: THREE.Quaternion) {
  rig.target.applyQuaternion(q);
  rig.forward.applyQuaternion(q);
  rig.apply();
  spinInverse.multiply(q.clone().invert());
}

/** Turn the start screen's planet by dx, dy CSS pixels like a trackball (arrow keys, drags off the planet). */
function turnStartPlanet(dx: number, dy: number) {
  if (screen !== 'start') return;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  // Orbiting the camera the other way moves the surface with the pointer
  orbitStart(new THREE.Quaternion().setFromAxisAngle(up, -dx / startRadiusPx)
    .multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy / startRadiusPx)));
}

/** NDC of a CSS pixel position. */
const ndcAt = (x: number, y: number) => new THREE.Vector2((x / window.innerWidth) * 2 - 1, 1 - (y / window.innerHeight) * 2);

// A drag on the start screen turns the planet (not one that starts on a button), and so
// do the arrow keys; the slow spin goes on after
if (startScreen) {
  const el = startScreen.element;
  let last: [number, number] | null = null;
  /** The surface point under the pointer when the drag started, kept under the pointer. */
  let grabbed: THREE.Vector3 | null = null;
  el.addEventListener('pointerdown', e => {
    if ((e.target as Element).closest('button')) return;
    last = [e.clientX, e.clientY];
    grabbed = rig.raycast(ndcAt(e.clientX, e.clientY))?.normalize() ?? null;
    pressWell(well, ...wellAt(e.clientX, e.clientY));
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });
  el.addEventListener('pointermove', e => {
    if (!last || screen !== 'start') return;
    moveWell(well, ...wellAt(e.clientX, e.clientY));
    const under = grabbed && rig.raycast(ndcAt(e.clientX, e.clientY));
    // Orbit so that the ray through the pointer meets the grabbed point again
    if (grabbed && under) orbitStart(new THREE.Quaternion().setFromUnitVectors(under.normalize(), grabbed));
    else turnStartPlanet(e.clientX - last[0], e.clientY - last[1]);
    last = [e.clientX, e.clientY];
  });
  for (const type of ['pointerup', 'pointercancel'] as const) {
    el.addEventListener(type, () => {
      last = grabbed = null;
      releaseWell(well);
    });
  }
  window.addEventListener('keydown', e => {
    const step = startRadiusPx * 0.15;
    const turn = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (turn && screen === 'start') {
      e.preventDefault();
      turnStartPlanet(turn[0], turn[1]);
    }
  });
}
levelBar.setVisible(screen === 'free');

// ─── Fog of war (STORY-024) ───────────────────────
// In the game everything not yet mapped is fog; ?free shows the world as it is.
const mapState = new MapState();
tiles.fogOn.value = screen === 'free' ? 0 : 1;
// The start screen's planet is a silhouette without borders (design 1a)
const BORDER_STRENGTH = tiles.borderStrength.value;
if (screen === 'start') tiles.borderStrength.value = 0;

/** Map tiles: their terrain, the mapped bit and the coarse fog map, uploaded at once. */
function reveal(ids: Iterable<number>): number[] {
  const fresh = mapState.reveal(ids);
  if (!fresh.length) return fresh;
  const codes = tiles.tileCodes;
  for (const id of fresh) {
    tileTypes.fillTile(id);
    codes[id] |= 32;
  }
  paintMapped(tiles.fogData, fresh);
  tiles.tileCodesChanged();
  tiles.fogChanged();
  return fresh;
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
  startRadiusPx = r;
}

function newGame() {
  if (screen !== 'start' || !startScreen) return;
  requestSurfacePatterns();
  const seed = params.has('seed') ? Number(params.get('seed')) : crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
  const startCity = chooseStartCity(regions, seed);
  game = { seed, startCity };
  screen = 'intro';
  introTarget = regions.centers[2][startCity].clone();
  tiles.borderStrength.value = BORDER_STRENGTH;
  // Storyboard 2a: the landing tile and its 6 neighbours are mapped first
  reveal(withNeighbors(pointToTile(introTarget)));
  flyIn(introTarget);
}

// ─── Saved game (STORY-036) ───────────────────────
// The game saves itself to IndexedDB every SAVE_EVERY_MS of play when a day has passed,
// and whenever the page goes to the background. A valid save offers "Jatka" on the
// start screen; continuing flies to the capital (or the settler) and goes on.
const SAVE_EVERY_MS = 10_000;
/** The checked save the start screen offers, and the one being continued during the fly-in. */
let savedGame: SaveData | null = null;
let continuing: SaveData | null = null;

if (startScreen) {
  void loadSave().then(raw => {
    const save = validateSave(raw, { tiles: TILE_COUNT, cityAreas: regions.centers[2].length });
    if (raw !== null && !save) console.warn('[GlobeCiv3] The saved game is not valid; it is not offered.');
    if (!save || screen !== 'start') return;
    savedGame = save;
    const [first, ...more] = save.cities;
    const where = first ? (more.length ? `${first.name} ja ${more.length} muuta kaupunkia` : first.name) : 'ei kaupunkeja vielä';
    // The meter's region: the home province, then the home state
    const state = Math.floor(save.startCity / 49), province = Math.floor(save.startCity / 7);
    const areas = save.progress.meter === 'province' ? [province * 7, 7] : [state * 49, 49];
    const home = Array.from({ length: areas[1] }, (_, i) => cityTiles(regions, areas[0] + i)).flat();
    const mapped = new Set(save.mapped);
    const pct = Math.round((100 * home.filter(t => mapped.has(t)).length) / Math.max(1, home.length));
    startScreen.offerContinue(`Päivä ${save.day} · ${where}`, pct, continueGame);
    // The actions grew: the planet takes the space left
    frameStartPlanet();
  });
}

function continueGame() {
  if (screen !== 'start' || !startScreen || !savedGame) return;
  requestSurfacePatterns();
  continuing = savedGame;
  game = { seed: continuing.seed, startCity: continuing.startCity };
  screen = 'intro';
  // Back where the game was: the capital, else the settler's camp
  introTarget = tileCenter(continuing.cities[0]?.tile ?? continuing.units.camp).clone();
  tiles.borderStrength.value = BORDER_STRENGTH;
  reveal(continuing.mapped);
  flyIn(introTarget);
}

/** The game as it is now, for the save slot; null outside play. */
function snapshot(): SaveData | null {
  if (!play || !game || screen !== 'playing') return null;
  const mapped: number[] = [];
  mapState.mapped.forEach((m, id) => { if (m) mapped.push(id); });
  return {
    version: SAVE_VERSION, savedAt: Date.now(), seed: game.seed, startCity: game.startCity, day: clock.day, speed: clock.speed, paused: clock.paused, mapped,
    units: play.units.save(), selected: play.selected, progress: { ...play.progress }, targetProvince: play.targetProvince,
    discoveries: play.discoveries.map(d => ({ ...d, finds: [d.finds[0], d.finds[1]] })),
    bonuses: [...play.bonuses].map(([t, y]) => [t, { ...y }] as [number, Yield]),
    found: play.found, cities: play.cities.map(c => ({ ...c, buildings: [...c.buildings] })), offers: play.offers.map(o => ({ ...o })), offered: [...play.offered],
    lastOfferDay: Number.isFinite(play.lastOfferDay) ? play.lastOfferDay : null, pendingSite: play.pendingSite,
    improvements: play.improvements.entries(), raids: play.raids.save(), raidAlert: play.raidAlert, gold: play.gold,
    research: play.research.save(), tax: play.tax, goal: play.goal,
  };
}

let lastSaveAt = -Infinity;
let lastSaveDay = -1;
/** Save when a day has passed since the last save and SAVE_EVERY_MS has gone by, or now when forced. */
function autosave(force = false): Promise<boolean> {
  const now = performance.now();
  if (!force && (clock.day === lastSaveDay || now - lastSaveAt < SAVE_EVERY_MS)) return Promise.resolve(false);
  const data = snapshot();
  if (!data) return Promise.resolve(false);
  lastSaveAt = now;
  lastSaveDay = clock.day;
  return storeSave(data);
}
// A phone sends the page to the background before it may close it
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void autosave(true); });
window.addEventListener('pagehide', () => { void autosave(true); });

/** Hide the start screen and fly in to a city area: a straight cut with reduced motion. */
function flyIn(target: THREE.Vector3) {
  if (!startScreen) return;
  const reduce = reduceMotion();
  startScreen.hide(!reduce);
  if (reduce) {
    // Straight cut, softened by a 200 ms fade (Web Animations follow the wall clock)
    const cut = document.createElement('div');
    cut.className = 'cut-fade';
    document.body.appendChild(cut);
    cut.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => cut.remove());
    legs.push({ to: { point: target, dist: frames[3], level: 3 }, durationS: 0 });
  } else {
    // Storyboard 2a: turn onto the target at planet distance (1 s), then descend (2 s)
    legs.push({ to: { point: target, dist: rig.dist, level: 0 }, durationS: 1 });
    legs.push({ to: { point: target, dist: frames[3], level: 3 }, durationS: 2 });
  }
}

// ─── Play: day clock, units and the HUD (STORY-025) ─
// After landing, a day passes every 1.5 s / speed. Units act on their own each day;
// the player sets scouts' modes and the flag, and the settler's city site.
const clock = new GameClock();
const unitLayer = new UnitLayer(RADIUS);
scene.add(unitLayer.group);
// The game's moments glow out from their tiles (STORY-035)
const pulses = new PulseLayer(RADIUS);
scene.add(pulses.group);
const moment = (kind: PulseKind, tile: number) => pulses.add(kind, tile, performance.now());
interface Play {
  units: Units;
  selected: number;
  flagTool: boolean;
  /** Tiles of the home province and state, for the meter and the unlocks. */
  province: number[];
  state: number[];
  progress: Progress;
  /** The province chosen as the state's target (design 7a), or -1. */
  targetProvince: number;
  /** Discoveries waiting for a choice, the oldest first (STORY-027). They wait until the
   * player opens one (STORY-037: they no longer stop the game), and its card is open. */
  discoveries: Discovery[];
  findOpen: boolean;
  /** Extra yield on tiles from finds; STORY-028's cities count it. */
  bonuses: Map<number, Yield>;
  /** Finds kept so far. */
  found: number;
  /** Cities in founding order, the capital first (STORY-028), and the one whose card is open. */
  cities: City[];
  openCity: number | null;
  /** City sites a scout suggests, the shown one first; every site ever suggested; the day of the last (STORY-032). */
  offers: { tile: number; finder: number }[];
  offered: number[];
  lastOfferDay: number;
  /** A site waiting for the settler the capital is building. */
  pendingSite: number | null;
  /** Irrigation, mines and roads the settlers built (STORY-033). */
  improvements: Improvements;
  /** Bandits on their way to a city, and whether their card waits to be answered (STORY-034). */
  raids: Raids;
  raidAlert: boolean;
  /** The treasury: trade comes in as gold, and buildings and buying cost it (STORY-038). */
  gold: number;
  /** Advances known and researched, and the share of trade that becomes gold (STORY-040). */
  research: Research;
  tax: number;
  researchOpen: boolean;
  /** The current goal (STORY-041). */
  goal: number;
  /** The list of cities and units is open, and which tab (STORY-042). */
  listOpen: boolean;
  listTab: ListTab;
  hud: ReturnType<typeof createGameHud>;
}
let play: Play | null = null;

const terrainOf = (id: number): Terrain => {
  tileTypes.fillTile(id);
  return TERRAINS[(tileTypes.codes[id] & 15) - 1];
};
/** True while the units take their day: tiles mapped then may hold discoveries. */
let scouting = false;
/** Tests of the clock and the units turn discoveries off (they stop the game). */
let discoveriesOn = true;
/** Site offers stop the game too; tests of other things turn them off with discoveries. */
let siteOffersOn = true;
/** Raids as well (STORY-034). */
let raidsOn = true;
const world: World = {
  cost: id => (terrainOf(id) === 'ocean' ? Infinity : TERRAIN_RULES[terrainOf(id)].move),
  isMapped: id => mapState.isMapped(id),
  hasResource: id => (tileTypes.codes[id] & 16) !== 0,
  reveal: ids => {
    const fresh = reveal(ids);
    if (scouting) noteDiscoveries(fresh);
  },
  cityOf: id => regions.tileTable()[id],
  // A city site is as good as the food, shields and trade within two rings (food counts twice)
  siteScore: id => tilesInRings(id, 2).reduce((sum, t) => {
    const terrain = terrainOf(t);
    const rule = TERRAIN_RULES[terrain];
    const res = tileTypes.codes[t] & 16 ? RESOURCES[rule.resource] : { food: 0, shield: 0, trade: 0 };
    return sum + 2 * (rule.food + res.food) + rule.shield + res.shield + rule.trade + res.trade;
  }, 0),
  nextJob: u => nextJob(u),
  improve: (tile, kind) => {
    if (!play) return;
    play.improvements.add(tile, kind);
    moment('improve', tile);
    discoveryCard.notice(`${IMPROVEMENT_NAMES[kind]} valmis · ${TERRAIN_RULES[terrainOf(tile)].name.toLowerCase()}`);
  },
};

function startPlay(startCity: number, saved?: SaveData) {
  const units = new Units(pointToTile(regions.centers[2][startCity]), world, saved?.units);
  const province = Math.floor(startCity / 7);
  const provinceTiles: number[] = [];
  for (let c = province * 7; c < province * 7 + 7; c++) provinceTiles.push(...cityTiles(regions, c));
  const state = Math.floor(startCity / 49);
  const stateTiles: number[] = [];
  for (let c = state * 49; c < state * 49 + 49; c++) stateTiles.push(...cityTiles(regions, c));
  const hud = createGameHud(hud_root, {
    togglePause: () => { clock.paused = !clock.paused; },
    setSpeed: (speed: Speed) => { clock.speed = speed; clock.paused = false; },
    setMode: (mode: Mode) => { if (play) play.units.setMode(play.units.units[play.selected], mode); },
    setTask: (task: SettlerTask) => { if (play) play.units.setTask(play.units.units[play.selected], task, world); },
    toggleFlagTool: () => { if (play) play.flagTool = !play.flagTool; },
    found: () => { if (play) play.units.found(world); },
    nextSite: () => { if (play) play.units.nextSite(); },
    nextUnit: () => {
      if (!play) return;
      play.selected = (play.selected + 1) % play.units.units.length;
      // Bring it into view at the current distance
      rig.flyTo(tileCenter(play.units.units[play.selected].tile), rig.dist, reduceMotion() ? 0 : 0.5);
    },
    openFind: () => { if (play && play.discoveries.length) play.findOpen = true; },
    openResearch: () => { if (play) play.researchOpen = true; },
    goalHint: () => { if (play && GOALS[play.goal]) discoveryCard.notice(GOALS[play.goal].hint); },
    openList: () => {
      if (!play) return;
      play.listOpen = !play.listOpen;
      play.openCity = null;
      play.researchOpen = false;
    },
  });
  // The first scout is selected, as in the design
  play = { units, selected: 1, flagTool: false, province: provinceTiles, state: stateTiles, progress: startProgress(), targetProvince: -1, discoveries: [], findOpen: false, bonuses: new Map(), found: 0, cities: [], openCity: null, offers: [], offered: [], lastOfferDay: -Infinity, pendingSite: null, improvements: new Improvements(), raids: new Raids(), raidAlert: false, gold: START_GOLD, research: new Research(), tax: START_TAX, researchOpen: false, goal: 0, listOpen: false, listTab: 'cities', hud };
  if (!saved) return;
  // A saved game goes on where it was
  Object.assign(play, {
    selected: Math.min(saved.selected, units.units.length - 1), progress: saved.progress, targetProvince: saved.targetProvince,
    discoveries: saved.discoveries, bonuses: new Map(saved.bonuses), found: saved.found, cities: saved.cities,
    offers: saved.offers, offered: saved.offered, lastOfferDay: saved.lastOfferDay ?? -Infinity, pendingSite: saved.pendingSite,
    improvements: Improvements.from(saved.improvements), raids: new Raids(saved.raids), raidAlert: saved.raidAlert, gold: saved.gold,
    research: new Research(saved.research), tax: saved.tax, goal: saved.goal,
  });
  clock.day = saved.day;
  clock.speed = saved.speed;
  clock.paused = saved.paused;
  lastSaveDay = saved.day;
}

// ─── Cities (STORY-028) ───────────────────────────
// The settler sent to its site founds a city. A city works its centre and one tile per
// citizen, grows and builds; what it builds joins the units.

const NO_YIELD: Yield = { food: 0, shield: 0, trade: 0 };

/** Gold at the start: Freeciv GAME_DEFAULT_GOLD (common/game.h); the civ1 ruleset's own setting is 0. */
const START_GOLD = 50;
/** Half the trade is gold at the start (own; Freeciv's player default is all science). */
const START_TAX = 50;

/** A worked tile's food, shields and trade: terrain, resource, an irrigated centre and improvements (Freeciv civ1), plus finds. */
function yieldOf(id: number, centre: boolean) {
  const terrain = terrainOf(id);
  const y = workedYield({ terrain, resource: tileTypes.codes[id] & 16 ? TERRAIN_RULES[terrain].resource : null }, centre);
  const b = play?.bonuses.get(id) ?? NO_YIELD;
  const imp = play?.improvements.yieldOf(id, terrain) ?? NO_YIELD;
  // The centre's irrigation and road are counted already
  return { food: y.food + b.food + (centre ? 0 : imp.food), shield: y.shield + b.shield + imp.shield, trade: y.trade + b.trade + (centre ? 0 : imp.trade) };
}

/** Units a city built and still supports. */
function supportOf(c: City): Support {
  const units = play ? play.units.units.filter(u => u.home === c.id) : [];
  return { units: units.length, settlers: units.filter(u => u.kind === 'settler').length };
}

/** Yields of the cities in founding order; a tile is worked by the first city that takes it. */
function cityYields(): CityYield[] {
  if (!play) return [];
  const taken = new Set<number>();
  return play.cities.map(c => {
    const y = cityYield(c, yieldOf, taken, supportOf(c));
    for (const t of workedTiles(c, yieldOf, taken)) taken.add(t);
    return y;
  });
}

/** Tiles each city works (or would, with `extra` citizens), in founding order; a tile is worked by the first city that takes it. */
function workedByCity(extra = 0): number[][] {
  const taken = new Set<number>();
  return play ? play.cities.map(c => {
    const worked = workedTiles({ ...c, size: c.size + extra }, yieldOf, taken);
    for (const t of worked) taken.add(t);
    return worked;
  }) : [];
}

/**
 * A settler's next improvement (STORY-033): for its own city, or the nearest one, the most
 * worthwhile on a tile the city works, else on the two it works next as it grows. Not on the
 * centre, and not where another settler is working.
 */
function nextJob(u: Unit) {
  if (!play || !play.cities.length) return null;
  const at = tileCenter(u.tile);
  const nearest = play.cities.reduce((a, b) => (tileCenter(b.tile).angleTo(at) < tileCenter(a.tile).angleTo(at) ? b : a));
  const city = play.cities.find(c => c.id === u.home) ?? nearest;
  const busy = new Set(play.units.units.flatMap(o => (o !== u && o.job ? [o.job.tile] : [])));
  const jobIn = (tiles: number[]) => bestJob(tiles.filter(t => t !== city.tile && !busy.has(t)), play!.improvements, terrainOf, neighbors, id => terrainOf(id) === 'ocean');
  const i = play.cities.indexOf(city);
  return jobIn(workedByCity()[i]) ?? jobIn(workedByCity(2)[i]);
}

function foundAt(tile: number) {
  if (!play) return;
  const city = foundCity(play.cities, tile);
  moment('city', tile);
  reveal(tilesInRings(tile, CITY_RINGS));
  play.openCity = city.id;
}

/** A day of every city: units it cannot pay for leave first (newest first), then it grows and builds. */
function cityDays() {
  if (!play) return;
  let yields = cityYields();
  play.cities.forEach((c, i) => {
    for (let short = shortfall(c, yields[i], supportOf(c)); short; short = shortfall(c, yields[i], supportOf(c))) {
      const own = play!.units.units.filter(u => u.home === c.id && (short === 'shield' || u.kind === 'settler'));
      play!.units.disband(own[own.length - 1], world);
      yields = cityYields();
    }
    const size = c.size;
    const done = cityDay(c, yields[i]);
    // Trade comes in as gold, and the buildings' upkeep goes out (STORY-038)
    const paid = payUpkeep(c, play!.gold + cityGold(c, yields[i], play!.tax));
    play!.gold = paid.treasury;
    if (paid.sold.length) discoveryCard.notice(`Kulta loppui: ${c.name} myi ${paid.sold.map(b => BUILDS[b].name.toLowerCase()).join(' ja ')}`);
    if (c.size > size) {
      discoveryCard.notice(`${c.name} kasvoi kokoon ${c.size}${cityRings(c.size) > cityRings(size) ? ', ja sen alue laajeni' : ''}`);
      moment('city', c.tile);
    }
    if (!done) return;
    if (isBuilding(done)) moment('city', c.tile);
    else if (done === 'warrior' || done === 'settler') play!.units.spawn(done, c.tile, world, c.id);
    discoveryCard.notice(`${c.name} rakensi: ${BUILDS[done].name}`);
  });
  // The cities' science; an advance learned opens what needs it (STORY-040)
  const learned = play.research.add(play.cities.reduce((sum, c, i) => sum + cityScience(c, yields[i], play!.tax), 0));
  if (learned) {
    const opens = (Object.keys(NEEDS) as (keyof typeof NEEDS)[]).filter(b => NEEDS[b] === learned).map(b => BUILDS[b].name);
    discoveryCard.notice(`Keksintö: ${ADVANCES[learned].name}${opens.length ? ` · ${opens.join(', ')} avautui` : ''}`);
    if (play.cities[0]) moment('unlock', play.cities[0].tile);
  }
  // A suggested site waiting for a settler gets the first free one
  const free = idleSettler();
  if (free && play.pendingSite !== null) {
    sendSettler(free, play.pendingSite);
    play.pendingSite = null;
    discoveryCard.notice(`${free.name} lähti kaupunkipaikalle`);
  }
}

// ─── City sites and labels (STORY-032) ────────────
// A scout that maps a good site (sites.ts) suggests building a city there; the card stops
// the game like a discovery. Cities have their names on the map.

/** Scout nearest to a tile: the one that found it. */
function finderOf(tile: number): number {
  const at = tileCenter(tile);
  let finder = 0, best = Infinity;
  for (const u of play!.units.units) {
    const a = u.kind === 'scout' ? tileCenter(u.tile).angleTo(at) : Infinity;
    if (a < best) { best = a; finder = u.id; }
  }
  return finder;
}

/** A settler free to go: the active one, unless it is already on its way to found a city; with none, one improving land. */
function idleSettler(): Unit | null {
  if (!play) return null;
  const active = play.units.settler;
  if (active) return play.units.founding ? null : active;
  return play.units.units.find(u => u.kind === 'settler') ?? null;
}

/** Send a free settler to found a city on a site; it stops improving land. */
function sendSettler(settler: Unit, tile: number) {
  play!.units.setTask(settler, 'found', world);
  play!.units.setSite(tile, world);
  play!.units.found(world);
}

function noteSiteOffer(fresh: number[]) {
  if (!play || !siteOffersOn || play.offers.length || clock.day - play.lastOfferDay < OFFER_EVERY_DAYS) return;
  // Only when the city could be built: a free settler, or a city to build one (one waiting site at a time)
  if (play.pendingSite !== null || (!idleSettler() && !play.cities.length)) return;
  const site = play.units.settler ? play.units.currentSite() : null;
  const taken = [...play.cities.map(c => c.tile), ...play.offered, ...(site !== null ? [site] : []), ...(play.pendingSite !== null ? [play.pendingSite] : [])];
  const isLand = (id: number) => Number.isFinite(world.cost(id));
  const tile = fresh.find(id => goodSite(id, world.siteScore, isLand, taken));
  if (tile === undefined) return;
  play.offers.push({ tile, finder: finderOf(tile) });
  play.offered.push(tile);
  play.lastOfferDay = clock.day;
}

/** Food, shields and trade within a city's two rings of a site. */
function siteYield(tile: number) {
  return tilesInRings(tile, CITY_RINGS).reduce((sum, id) => {
    const y = yieldOf(id, id === tile);
    return { food: sum.food + y.food, shield: sum.shield + y.shield, trade: sum.trade + y.trade };
  }, { food: 0, shield: 0, trade: 0 });
}

/** The card's choice on a site: build there (index 0) or later. */
function chooseSite(index: number) {
  if (!play) return;
  const o = play.offers.shift();
  discoveryCard.hide();
  if (!o || index !== 0) return;
  const settler = idleSettler();
  if (settler) {
    sendSettler(settler, o.tile);
    play.selected = play.units.units.indexOf(settler);
    discoveryCard.notice(`${settler.name} lähti perustamaan kaupunkia`);
  } else if (play.cities.length) {
    play.cities[0].build = 'settler';
    play.pendingSite = o.tile;
    discoveryCard.notice(`${play.cities[0].name} rakentaa uudisasukkaan kaupunkipaikalle`);
  }
}

const cityLabels = createCityLabels(hud_root, id => {
  if (!play) return;
  play.openCity = id;
  // From the province or state level, fly to the city
  if (viewLevel !== 3) fly({ point: tileCenter(play.cities[id].tile), dist: frames[3], level: 3 });
});

// What the open city's tiles bring in, over the map and under the card (STORY-039)
const tileYields = createTileYields(hud_root);

function updateCityLabels() {
  if (!play) return;
  cityLabels.update(viewLevel === 0 ? [] : play.cities.map(c => {
    const at = toScreen(tileCenter(c.tile));
    // Above the city's houses at the city-area level, on the city further out
    return { id: c.id, name: c.name, size: c.size, x: at?.[0] ?? null, y: at ? at[1] - (viewLevel === 3 ? 48 : 0) : null };
  }));
}

const cityCard = createCityCard(hud_root, {
  close: () => { if (play) play.openCity = null; },
  // Shields in store are kept: both builds are units, so Freeciv has no change penalty
  setFocus: (focus: Focus) => { if (play && play.openCity !== null) play.cities[play.openCity].focus = focus; },
  setBuild: (build: Build) => {
    if (!play || play.openCity === null || (isBuilding(build) && !play.research.known.has(NEEDS[build]))) return;
    play.cities[play.openCity].build = build;
  },
  openResearch: () => { if (play) play.researchOpen = true; },
  buy: () => {
    if (!play || play.openCity === null) return;
    const c = play.cities[play.openCity];
    const price = buy(c, play.gold);
    if (price === null) return;
    play.gold -= price;
    discoveryCard.notice(`${c.name} osti: ${BUILDS[c.build].name} · ${price} kultaa`);
  },
});

/** What each build does, for the city card (STORY-037, buildings STORY-038). */
const BUILD_PURPOSE: Record<Build, string> = {
  warrior: 'Puolustaa kaupunkia rosvoilta', settler: 'Perustaa uuden kaupungin tai kehittää maata',
  coinage: 'Kaupunki kasvaa rauhassa, ja kassa karttuu',
  library: 'Tieteeseen 50 % lisää',
  granary: 'Säilyttää puolet ruoasta, kun kaupunki kasvaa', walls: 'Soturit kolminkertaisesti vahvempia rosvoja vastaan', market: 'Kaupasta 50 % enemmän kultaa',
};

function cityView(c: City, y: CityYield): CityView {
  const grow = daysToGrow(c, y);
  const price = buyCost(c);
  const settlers = supportOf(c).settlers;
  const rings = cityRings(c.size);
  const nextSize = rings === 1 ? 2 : rings === 2 ? 5 : null;
  // How to grow faster, when it is slow
  const ways = [
    ...(c.focus !== 'food' ? ['valitse Ruoka'] : []),
    'kastele peltoja (uudisasukas: Kehitä)',
    ...(c.buildings.includes('granary') ? [] : ['rakenna viljavarasto']),
    ...(settlers ? [`uudisasukkaat syövät ${settlers} ruokaa: lähetä ne perustamaan kaupunkeja`] : []),
  ];
  return {
    foodText: `Ruokaa ${y.food} · asukkaat syövät ${2 * c.size}${settlers ? ` · uudisasukkaat ${settlers}` : ''} · varastossa ${c.food}/${granary(c.size)}`,
    focus: c.focus,
    areaText: `Alue ${rings} ${rings === 1 ? 'rengas' : 'rengasta'}${nextSize ? ` · laajenee koossa ${nextSize}` : ''}`,
    hint: y.surplus <= 1 ? `Kasvaa hitaasti: ${ways.join(', ')}.` : null,
    gold: play?.gold ?? 0,
    income: cityGold(c, y, play?.tax ?? 100) - c.buildings.reduce((sum, b) => sum + UPKEEP[b], 0),
    research: researchLine(),
    buy: price ? { name: BUILDS[c.build].name, price, can: price <= (play?.gold ?? 0) } : null,
    buildings: c.buildings.map(b => BUILDS[b].name),
    kicker: `${c.capital ? 'Pääkaupunki' : 'Kaupunki'} · ${nameOf(2, regions.tileTable()[c.tile]).name}`,
    name: c.name,
    size: c.size,
    growth: c.food / granary(c.size),
    growText: y.surplus < 0 ? 'nälkää' : grow === null ? 'ei kasva' : `kasvaa ${grow} pv`,
    yields: [y.surplus, y.shield, y.trade],
    builds: (Object.keys(BUILDS) as Build[]).filter(kind => !(isBuilding(kind) && c.buildings.includes(kind))).map(kind => {
      const b = BUILDS[kind];
      const ready = daysToBuild({ ...c, build: kind }, y);
      const locked = isBuilding(kind) && !play!.research.known.has(NEEDS[kind]);
      return {
        kind, name: b.name, selected: kind === c.build, locked,
        cost: kind === 'coinage' ? 'Tuotanto kullaksi' : `${b.cost} tuotantoa${b.pop ? ` ja ${b.pop} asukas` : ''}${isBuilding(kind) ? `, ${UPKEEP[kind]} ${UPKEEP[kind] === 1 ? 'kulta' : 'kultaa'}/pv` : ''}`, purpose: BUILD_PURPOSE[kind],
        eta: locked && isBuilding(kind) ? `vaatii: ${ADVANCES[NEEDS[kind]].name}` : kind === 'coinage' ? `+${Math.max(0, y.shield)} kultaa/pv` : ready === null ? 'ei tuotantoa' : c.size <= b.pop ? `vaatii koon ${b.pop + 1}` : ready === 0 ? 'valmis huomenna' : `valmis ${ready} pv`,
      };
    }),
  };
}

/** The open city's card, at the city-area level and not over a discovery. */
function updateCityCard() {
  if (!play) return;
  const id = play.openCity;
  if (id === null || viewLevel !== 3 || discoveryCard.visible || researchCard.visible || listCard.visible) {
    if (cityCard.visible) cityCard.hide();
    tileYields.update([]);
    return;
  }
  const c = play.cities[id];
  const view = cityView(c, cityYields()[id]);
  if (cityCard.visible) cityCard.update(view);
  else {
    cityCard.show(view);
    framing = c.tile;
  }
  // After a flight to the city, not during it
  if (framing !== null && !rig.flying) {
    keepAboveCard(framing);
    framing = null;
  }
  tileYields.update(workedByCity()[id].map(t => {
    const at = toScreen(tileCenter(t));
    const y = yieldOf(t, t === c.tile);
    return { x: at?.[0] ?? null, y: at?.[1] ?? null, food: y.food, shield: y.shield, trade: y.trade, centre: t === c.tile };
  }));
}

// ─── The list of cities and units (STORY-042) ─────
const KIND_NAMES: Record<string, string> = { scout: 'tiedustelija', settler: 'uudisasukas', warrior: 'soturi' };

const listCard = createListCard(hud_root, {
  close: () => { if (play) play.listOpen = false; },
  tab: (tab: ListTab) => { if (play) play.listTab = tab; },
  city: (id: number) => {
    if (!play) return;
    play.listOpen = false;
    rig.flyTo(tileCenter(play.cities[id].tile), rig.dist, reduceMotion() ? 0 : 0.5);
    play.openCity = id;
  },
  unit: (index: number) => {
    if (!play) return;
    play.listOpen = false;
    play.selected = index;
    rig.flyTo(tileCenter(play.units.units[index].tile), rig.dist, reduceMotion() ? 0 : 0.5);
  },
});

function listView(): ListView {
  const yields = cityYields();
  return {
    tab: play!.listTab,
    cities: play!.cities.map((c, i) => {
      const y = yields[i];
      const ready = daysToBuild(c, y);
      const when = c.build === 'coinage' ? `+${Math.max(0, y.shield)} kultaa/pv` : ready === null ? 'ei tuotantoa' : ready === 0 ? 'valmis huomenna' : `${ready} pv`;
      return {
        id: c.id, name: c.name, size: `Koko ${c.size}`,
        line: [`${BUILDS[c.build].name} · ${when}`, `ruokaa ${y.surplus < 0 ? '−' : '+'}${Math.abs(y.surplus)}`, ...(c.buildings.length ? [c.buildings.map(b => BUILDS[b].name).join(', ')] : [])].join(' · '),
      };
    }),
    units: play!.units.units.map((u, index) => ({
      index, name: u.name, kind: KIND_NAMES[u.kind],
      line: unitStatus(play!.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name),
    })),
  };
}

function updateListCard() {
  if (!play || !play.listOpen || viewLevel !== 3 || discoveryCard.visible) {
    if (listCard.visible) listCard.hide();
    return;
  }
  const view = listView();
  if (listCard.visible) listCard.update(view);
  else listCard.show(view);
}

// ─── Goals (STORY-041) ────────────────────────────
// One goal at a time leads through the game; a goal reached pays its gold.
function checkGoals() {
  if (!play) return;
  const r = advanceGoals(play.goal, {
    cities: play.cities.length,
    biggest: Math.max(0, ...play.cities.map(c => c.size)),
    researching: play.research.target !== null || play.research.known.size > 0,
    advances: play.research.known.size,
    improvements: play.improvements.entries().length,
    buildings: play.cities.reduce((sum, c) => sum + c.buildings.length, 0),
    openLevel: play.progress.openLevel,
  });
  if (!r.done.length) return;
  play.goal = r.index;
  const gold = r.done.reduce((sum, g) => sum + g.reward, 0);
  play.gold += gold;
  discoveryCard.notice(`Tavoite saavutettu: ${r.done.map(g => g.text).join(', ')} · +${gold} kultaa`);
  if (play.cities[0]) moment('victory', play.cities[0].tile);
}

// ─── Science (STORY-040) ──────────────────────────
// Trade splits into gold and science by the tax rate; science brings advances, and
// advances open buildings. The science card chooses the next advance and the rate.

/** Science and gold a day from all cities. */
function scienceRates() {
  if (!play) return { science: 0, gold: 0 };
  const yields = cityYields();
  return {
    science: play.cities.reduce((sum, c, i) => sum + cityScience(c, yields[i], play!.tax), 0),
    gold: play.cities.reduce((sum, c, i) => sum + cityGold(c, yields[i], play!.tax) - c.buildings.reduce((u, b) => u + UPKEEP[b], 0), 0),
  };
}

function researchLine(): string {
  const r = play!.research;
  return r.target ? `Tutkimus: ${ADVANCES[r.target].name} ${Math.min(r.bulbs, r.cost)}/${r.cost}` : 'Tutkimus: valitse seuraava';
}

const researchCard = createResearchCard(hud_root, {
  close: () => { if (play) play.researchOpen = false; },
  choose: (advance: Advance) => { if (play && play.research.available().includes(advance)) play.research.target = advance; },
  setTax: (tax: number) => { if (play) play.tax = tax; },
});

function researchView(): ResearchView {
  const r = play!.research;
  const rates = scienceRates();
  const days = r.target && rates.science > 0 ? Math.max(1, Math.ceil((r.cost - r.bulbs) / rates.science)) : null;
  // What an advance opens: the buildings that need it, and the advances that need it
  const opens = (a: Advance) => [
    ...(Object.keys(NEEDS) as (keyof typeof NEEDS)[]).filter(b => NEEDS[b] === a).map(b => BUILDS[b].name),
    ...(Object.keys(ADVANCES) as Advance[]).filter(n => ADVANCES[n].needs.includes(a)).map(n => `tutkimuksen ${ADVANCES[n].name}`),
  ];
  return {
    rates: `Tiedettä +${rates.science}/pv · kultaa ${rates.gold < 0 ? '−' : '+'}${Math.abs(rates.gold)}/pv`,
    current: r.target
      ? `Tutkitaan: ${ADVANCES[r.target].name} · ${Math.min(r.bulbs, r.cost)}/${r.cost}${days ? ` · valmis ${days} pv` : ''}`
      : 'Valitse, mitä tutkitaan. Tiede kertyy odottamaan.',
    progress: r.cost ? r.bulbs / r.cost : 0,
    hint: rates.science > 0 ? null : 'Tiedettä ei tule: tiede syntyy kaupasta. Kauppaa tuovat tiet ruoho-, tasanko- ja aavikkomaalla (uudisasukas: Kehitä) ja meriruudut; pienempi kullan osuus siirtää kauppaa tieteeseen.',
    options: r.available().map(a => ({ advance: a, name: ADVANCES[a].name, cost: `${r.cost} tiedettä`, opens: `Avaa: ${opens(a).join(', ')}`, selected: a === r.target })),
    tax: play!.tax,
    known: r.known.size ? `Tunnetut: ${[...r.known].map(a => ADVANCES[a].name).join(', ')}` : 'Ei vielä keksintöjä',
  };
}

function updateResearchCard() {
  if (!play || !play.researchOpen || viewLevel !== 3 || discoveryCard.visible || listCard.visible) {
    if (researchCard.visible) researchCard.hide();
    return;
  }
  const view = researchView();
  if (researchCard.visible) researchCard.update(view);
  else researchCard.show(view);
}

/** A city to bring above its card once the camera is still. */
let framing: number | null = null;

/**
 * Move the view so that a city stands midway between the top panel and the card: the
 * point now on the screen where the city should move from becomes the centre.
 */
function keepAboveCard(tile: number) {
  const at = toScreen(tileCenter(tile));
  if (!at) return;
  const top = document.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? 0;
  const goal = [window.innerWidth / 2, (top + cityCard.top()) / 2];
  const centre = rig.raycast(ndcAt(window.innerWidth / 2 - (goal[0] - at[0]), window.innerHeight / 2 - (goal[1] - at[1])));
  if (centre) rig.flyTo(centre.normalize(), rig.dist, reduceMotion() ? 0 : 0.4);
}

// ─── Discoveries (STORY-027) ──────────────────────
// About one land tile in 60 holds a discovery (from the seed). The scout that maps it
// stops the game; the player keeps one of two finds.
const discoveryCard = createDiscoveryCard(hud_root, index => {
  if (!play) return;
  if (shownCard === 'site') {
    chooseSite(index);
    return;
  }
  if (shownCard === 'raid') {
    chooseRaid(index);
    return;
  }
  // Myöhemmin: the find waits
  play.findOpen = false;
  discoveryCard.hide();
  if (index === 2) return;
  const d = play.discoveries.shift();
  if (!d) return;
  play.found++;
  discoveryCard.notice(applyFind(d.finds[index], d, play.units, world, play.bonuses));
});

function noteDiscoveries(fresh: number[]) {
  if (!play || !game) return;
  for (const tile of discoveriesOn ? fresh : []) {
    if (!Number.isFinite(world.cost(tile))) continue;
    const finds = discoveryAt(game.seed, tile, neighbors(tile).some(n => terrainOf(n) === 'ocean'));
    if (!finds) continue;
    // The finder is the scout nearest to the tile
    const at = tileCenter(tile);
    let finder = 0, best = Infinity;
    for (const u of play.units.units) {
      const a = u.kind === 'scout' ? tileCenter(u.tile).angleTo(at) : Infinity;
      if (a < best) { best = a; finder = u.id; }
    }
    play.discoveries.push({ tile, finder, finds });
    moment('find', tile);
    discoveryCard.notice(`${play.units.units.find(u => u.id === finder)?.name ?? 'Tiedustelija'} teki löydön · ${nameOf(2, regions.tileTable()[tile]).name}`);
  }
  noteSiteOffer(fresh);
}

/** Which card is shown: a discovery's, a site offer's or a raid's. */
let shownCard: 'find' | 'site' | 'raid' | null = null;

function updateSiteOffer() {
  if (!play) return;
  const o = play.offers[0];
  if (!o) {
    updateRaidAlert();
    return;
  }
  if (!discoveryCard.visible) {
    shownCard = 'site';
    moment('find', o.tile);
    const settler = idleSettler();
    const y = siteYield(o.tile);
    const days = settler ? Units.days(findPath(settler.tile, o.tile, id => world.cost(id)) ?? [], world) : 0;
    discoveryCard.show({
      day: clock.day,
      kicker: `Kaupunkipaikka · ${play.units.units.find(u => u.id === o.finder)?.name ?? 'Tiedustelija'}`,
      title: nameOf(2, regions.tileTable()[o.tile]).name,
      body: `Tiedustelija löysi hyvän paikan kaupungille. Kahden renkaan säteellä on ruokaa ${y.food}, tuotantoa ${y.shield} ja kauppaa ${y.trade}.`,
      options: [
        { kind: 'site', title: 'Rakenna kaupunki tänne', effect: settler ? `${settler.name} lähtee matkaan · ${days} pv` : `${play.cities[0]?.name ?? 'Kaupunki'} rakentaa uudisasukkaan, joka lähtee tänne` },
        { kind: 'later', title: 'Myöhemmin', effect: 'Tiedustelija jatkaa tutkimista' },
      ],
      note: 'Kaupunki työstää ruutuja kahden renkaan säteellä.',
    });
    const seen = toScreen(tileCenter(o.tile));
    if (!seen || seen[1] > window.innerHeight * 0.55 || seen[0] < 40 || seen[0] > window.innerWidth - 40) {
      rig.flyTo(tileCenter(o.tile), rig.dist, reduceMotion() ? 0 : 0.6);
    }
  }
  const at = toScreen(tileCenter(o.tile));
  discoveryCard.setRing(at?.[0] ?? null, at?.[1] ?? null);
}

/** Show the first waiting discovery and keep its ring on the tile. */
function updateDiscovery() {
  if (!play) return;
  const d = play.discoveries[0];
  if (!d || !play.findOpen) {
    updateSiteOffer();
    return;
  }
  if (!discoveryCard.visible) {
    shownCard = 'find';
    discoveryCard.show({
      day: clock.day,
      kicker: `Löytö · ${play.units.units.find(u => u.id === d.finder)?.name ?? 'Tiedustelija'}`,
      title: nameOf(2, regions.tileTable()[d.tile]).name,
      body: discoverySentence(d.finds),
      options: [...d.finds.map(kind => ({ kind, title: FINDS[kind].title, effect: FINDS[kind].effect })), { kind: 'later' as const, title: 'Myöhemmin', effect: 'Löytö odottaa, kunnes valitset' }],
    });
    // Bring the tile into view above the card, unless it is there already
    const seen = toScreen(tileCenter(d.tile));
    if (!seen || seen[1] > window.innerHeight * 0.55 || seen[0] < 40 || seen[0] > window.innerWidth - 40) {
      rig.flyTo(tileCenter(d.tile), rig.dist, reduceMotion() ? 0 : 0.6);
    }
  }
  const at = toScreen(tileCenter(d.tile));
  discoveryCard.setRing(at?.[0] ?? null, at?.[1] ?? null);
}

// ─── Raids (STORY-034) ────────────────────────────
// From day 60 bandits rise 5 to 8 tiles from a city and march on it (raids.ts). Their
// first sight stops the game; the soldiers in the city fight them one by one.

/** Soldiers in the city on a tile. */
const soldiersIn = (tile: number) => (play ? play.units.units.filter(u => u.kind === 'warrior' && u.tile === tile) : []);

const raidWorld: RaidWorld = {
  cost: id => world.cost(id),
  terrainOf,
  walls: tile => play?.cities.find(c => c.tile === tile)?.buildings.includes('walls') ?? false,
  defenders: tile => soldiersIn(tile).length,
  loseDefender: tile => {
    const soldiers = soldiersIn(tile);
    play!.units.disband(soldiers[soldiers.length - 1], world);
  },
  plunder: tile => {
    const c = play!.cities.find(x => x.tile === tile)!;
    c.food = 0;
    c.shields = 0;
    if (c.size > 1) c.size--;
  },
  roll: k => raidRoll(game!.seed, clock.day, k + 1),
};

/** The day's fights in a few words: "Rosvo kaatoi soturin · Soturit torjuivat 2 rosvoa". */
function raidNotice(events: RaidEvent[]): string {
  const n = (e: RaidEvent) => events.filter(x => x === e).length;
  return [
    n('won') === 1 ? 'Rosvo kaatoi soturin' : n('won') ? `Rosvot kaatoivat ${n('won')} soturia` : '',
    n('repelled') === 1 ? 'Soturi torjui rosvon' : n('repelled') ? `Soturit torjuivat ${n('repelled')} rosvoa` : '',
    n('plundered') ? 'Rosvot ryöstivät kaupungin' : '',
  ].filter(Boolean).join(' · ');
}

/** A day of the band, then perhaps a new uprising against a city. */
function raidDay() {
  if (!play || !game) return;
  const band = play.raids.band;
  const city = band && play.cities.find(c => c.tile === band.city);
  const events = play.raids.day(raidWorld);
  if (city && events.length) {
    discoveryCard.notice(`${raidNotice(events)} · ${city.name}`);
    moment(events.includes('plundered') || events.includes('won') ? 'raid' : 'victory', city.tile);
  }
  if (play.raids.band || !raidsOn || !play.cities.length || !uprising(game.seed, clock.day, play.cities.length)) return;
  startRaid(play.cities[Math.floor(raidRoll(game.seed, clock.day, 100) * play.cities.length)]);
}

/** One or two bandits set off toward a city from known land 5 to 8 tiles away. */
function startRaid(c: City): boolean {
  if (!play || !game) return false;
  const isLand = (id: number) => Number.isFinite(world.cost(id));
  const from = raidStart(c.tile, raidRoll(game.seed, clock.day, 101), id => mapState.isMapped(id), isLand);
  const size = 1 + Math.floor(raidRoll(game.seed, clock.day, 102) * 2);
  if (from === null || !play.raids.start(c.tile, from, size, id => world.cost(id))) return false;
  play.raidAlert = true;
  return true;
}

/** The card on a band's first sight: build a soldier, or trust the defence. */
function updateRaidAlert() {
  const band = play?.raids.band;
  if (!play || !band || !play.raidAlert) return;
  const lead = band.bandits[0].tile;
  if (!discoveryCard.visible) {
    shownCard = 'raid';
    moment('raid', lead);
    const c = play.cities.find(x => x.tile === band.city)!;
    const soldiers = soldiersIn(c.tile).length;
    const ready = daysToBuild({ ...c, build: 'warrior' }, cityYields()[play.cities.indexOf(c)]);
    const n = band.bandits.length;
    discoveryCard.show({
      day: clock.day,
      kicker: `Uhka · ${c.name}`,
      title: 'Rosvoja liikkeellä',
      body: `${n === 1 ? 'Rosvo' : `${n} rosvoa`} on matkalla kohti kaupunkia ja perillä noin ${play.raids.daysToCity(id => world.cost(id))} päivässä. ${soldiers ? `Kaupungissa on ${soldiers} soturi${soldiers === 1 ? '' : 'a'}.` : 'Kaupungissa ei ole sotureita.'}`,
      options: [
        { kind: 'defend', title: 'Rakenna soturi', effect: ready === null ? 'Kaupungilla ei ole tuotantoa' : `Valmis ${Math.max(1, ready)} pv` },
        { kind: 'later', title: 'Luota puolustukseen', effect: soldiers ? `Soturi voittaa rosvon ${Math.round((1 - banditWins(terrainOf(c.tile), c.buildings.includes('walls'))) * 100)} %:n todennäköisyydellä` : 'Ilman soturia rosvot ryöstävät kaupungin' },
      ],
      note: 'Ryöstö vie kaupungin varastot ja asukkaan.',
    });
    const seen = toScreen(tileCenter(lead));
    if (!seen || seen[1] > window.innerHeight * 0.55 || seen[0] < 40 || seen[0] > window.innerWidth - 40) {
      rig.flyTo(tileCenter(lead), rig.dist, reduceMotion() ? 0 : 0.6);
    }
  }
  const at = toScreen(tileCenter(lead));
  discoveryCard.setRing(at?.[0] ?? null, at?.[1] ?? null);
}

function chooseRaid(index: number) {
  if (!play) return;
  play.raidAlert = false;
  discoveryCard.hide();
  const band = play.raids.band;
  const c = band && play.cities.find(x => x.tile === band.city);
  if (index !== 0 || !c) return;
  c.build = 'warrior';
  discoveryCard.notice(`${c.name} rakentaa soturin`);
}

// ─── Province and state levels (STORY-026) ────────
// Mapping 60 % of the home province opens the province level, and 60 % of the home
// state the state level. Each level has its own chips and actions.
const unlockCard = createUnlockCard(hud_root, () => {
  const to = backTarget(regions, rig.target, viewLevel, frames);
  if (to) fly(to);
});
const chips = createChips(hud_root, id => {
  const level = viewLevel as 0 | 1 | 2;
  const ref = { level, id } as RegionRef;
  if (sameRegion(ref, selection)) fly(diveTarget(regions, ref, frames));
  else selection = ref;
});
const levelPanels = createLevelPanels(hud_root, {
  setPlan: (plan: AreaPlan) => { const a = selectedArea(); if (play && a !== null) play.units.setAreaPlan(a, plan, world); },
  expedition: () => { const a = selectedArea(); if (play && a !== null) play.units.sendTo(pointToTile(regions.centers[2][a]), world); },
  setLine: (line: StateLine) => { if (play) play.units.setStateLine(line, world); },
  setTarget: () => {
    const p = selectedProvince();
    if (!play || p === null) return;
    play.targetProvince = p;
    play.units.sendTo(pointToTile(regions.centers[1][p]), world);
  },
});

/** Names of the 7 children of a province (areas) or a state (provinces), cached. */
const nameCache = new Map<string, RegionName[]>();
function childNames(level: 1 | 2, parent: number): RegionName[] {
  const key = `${level}/${parent}`;
  const cached = nameCache.get(key);
  if (cached || !game) return cached ?? [];
  // Directions within the parent: from its centre, the middle child is "Keski-"
  const parentTile = pointToTile(regions.centers[level - 1][parent]);
  const ids = Array.from({ length: 7 }, (_, k) => parent * 7 + k);
  const terrainsOf = (cities: number[]) => cities.flatMap(c => cityTiles(regions, c)).map(terrainOf);
  const dirs = ids.map((id, k) => (k === 0 ? MIDDLE : directionFrom(parentTile, pointToTile(regions.centers[level][id]))));
  const names = level === 2
    ? ids.map((id, k) => areaName(id === game!.startCity, dirs[k], landscapeOf(terrainsOf([id]))))
    : ids.map((id, k) => provinceName(id === Math.floor(game!.startCity / 7), dirs[k], landscapeOf(terrainsOf(Array.from({ length: 7 }, (_, j) => id * 7 + j)))));
  const distinct = distinctNames(names, dirs, level === 2 ? 'area' : 'province');
  nameCache.set(key, distinct);
  return distinct;
}
const nameOf = (level: 1 | 2, id: number) => childNames(level, Math.floor(id / 7))[id % 7];

/** The selected area at the province level, else the area under the view. */
function selectedArea(): number | null {
  if (viewLevel !== 2) return null;
  return selection?.level === 2 ? selection.id : path.length >= 2 ? regionPath(regions, rig.target, 3)[2].id : null;
}
function selectedProvince(): number | null {
  if (viewLevel !== 1) return null;
  return selection?.level === 1 ? selection.id : regionPath(regions, rig.target, 2)[1].id;
}

const tilesOfArea = new Map<number, number[]>();
const areaShare = (city: number) => {
  if (!tilesOfArea.has(city)) tilesOfArea.set(city, cityTiles(regions, city));
  return mapState.share(tilesOfArea.get(city)!);
};
const provinceShare = (p: number) => Array.from({ length: 7 }, (_, k) => areaShare(p * 7 + k)).reduce((a, b) => a + b, 0) / 7;

/** Screen position (CSS px) of a unit-sphere point, or null when behind the globe or off screen. */
const toScreen = (v: THREE.Vector3): [number, number] | null => {
  const world = v.clone().multiplyScalar(RADIUS);
  if (world.dot(camera.position) < RADIUS * RADIUS) return null;
  const p = world.project(camera);
  if (Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) return null;
  return [((p.x + 1) / 2) * window.innerWidth, ((1 - p.y) / 2) * window.innerHeight];
};

/** Chips and panels of the province and state levels, and the unlocks. */
function updateLevels() {
  if (!play || !game) return;
  const opened = discoveryCard.visible ? null : advance(play.progress, mapState.share(play.province), mapState.share(play.state));
  if (opened !== null) {
    lockedLevel = opened;
    rig.maxDist = lockDist(opened);
    unlockCard.show(opened === 2 ? 'Lääni kartoitettu, zoomaa ulos' : 'Valtio kartoitettu, zoomaa ulos');
    moment('unlock', play.cities[0]?.tile ?? pointToTile(rig.target));
  }
  const list: Chip[] = [];
  if (viewLevel === 2 || viewLevel === 1) {
    const level = viewLevel === 2 ? 2 : 1;
    const parent = path[level - 1]?.id ?? 0;
    for (let k = 0; k < 7; k++) {
      const id = parent * 7 + k;
      const at = toScreen(regions.centers[level][id]);
      const share = level === 2 ? areaShare(id) : provinceShare(id);
      const sub = level === 2
        ? share === 0 ? 'Sumussa' : AREA_PLAN_NAMES[play.units.areaPlans.get(id) ?? 'explore']
        : id === play.targetProvince ? 'Tavoite' : `Kartoitettu ${Math.round(share * 100)} %`;
      const isSelected = selection?.level === level && selection.id === id;
      list.push({ id, name: nameOf(level, id).name, sub: isSelected ? `${sub} · valittu` : sub, x: at?.[0] ?? null, y: at?.[1] ?? null, selected: isSelected });
    }
  }
  const area = selectedArea();
  const province = selectedProvince();
  levelPanels.update(
    viewLevel,
    area === null ? null : {
      name: nameOf(2, area).name,
      detail: `Kartoitettu ${Math.round(areaShare(area) * 100)} %`,
      plan: play.units.areaPlans.get(area) ?? 'explore',
      expedition: area === game.startCity ? null : nameOf(2, area).illative,
    },
    province === null ? null : {
      line: play.units.stateLine,
      name: nameOf(1, province).name,
      detail: `Kartoitettu ${Math.round(provinceShare(province) * 100)} %`,
      isTarget: province === play.targetProvince,
    },
  );
  // After the panels, so that a panel shown in this frame already bounds the chips
  const topPanel = hud_root.querySelector<HTMLElement>('.hud-top');
  const bottomPanel = hud_root.querySelector<HTMLElement>('.level-bottom:not([hidden])');
  chips.update(list, {
    top: topPanel && !topPanel.hidden ? topPanel.getBoundingClientRect().bottom : 0,
    bottom: bottomPanel ? bottomPanel.getBoundingClientRect().top : window.innerHeight,
  });
}

// "−" zooms out a level on a desktop (the unlock card's hint)
window.addEventListener('keydown', e => {
  if ((e.key === '-' || e.key === 'Subtract') && viewLevel > lockedLevel) {
    const to = backTarget(regions, rig.target, viewLevel, frames);
    if (to) fly(to);
  }
});

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
  const city = play.cities.find(c => {
    const at = toScreen(tileCenter(c.tile));
    return at !== null && Math.hypot(at[0] - x, at[1] - y) < 30;
  });
  // A unit standing in the tapped city does not hide it (the unit button still selects it)
  const picked = unitLayer.pick(play.units.units, camera, x, y, width, height, 22, tileSpacing());
  if (picked !== null && play.units.units[picked].tile !== city?.tile) {
    play.selected = picked;
    return true;
  }
  if (city) {
    play.openCity = city.id;
    return true;
  }
  const selected = play.units.units[play.selected];
  if (hit && selected === play.units.settler) return play.units.setSite(pointToTile(hit), world);
  return false;
}

/** Distance between tile centres in world units near the camera target. */
const tileSpacing = () => (RADIUS * Math.acos(1 / Math.sqrt(5))) / 330;

function updatePlay(dt: number) {
  if (!play) return;
  const days = play.findOpen || play.offers.length || play.raidAlert ? 0 : clock.advance(dt);
  const selectedUnit = play.units.units[play.selected];
  for (let d = 0; d < days; d++) {
    scouting = true;
    const founded = play.units.day(world);
    scouting = false;
    founded.forEach(foundAt);
    cityDays();
    raidDay();
    if (play.offers.length || play.raidAlert) {
      clock.day -= days - d - 1;
      break;
    }
  }
  play.selected = Math.max(0, play.units.units.indexOf(selectedUnit));
  updateDiscovery();
  updateCityLabels();
  updateListCard();
  updateCityCard();
  updateResearchCard();
  checkGoals();
  const u = play.units.units[play.selected];
  const state: GameHudState = {
    day: clock.day,
    speed: clock.speed,
    paused: clock.paused,
    mapped: mapState.share(play.progress.meter === 'province' ? play.province : play.state),
    meterName: play.progress.meter === 'province' ? 'Lääni' : 'Valtio',
    unlockAt: play.progress.meter === 'done' ? null : UNLOCK_SHARE,
    level: viewLevel,
    unit: { name: u.name, status: unitStatus(play.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name), kind: u.kind === 'settler' && u !== play.units.settler ? 'waiting' : u.kind, mode: u.mode, task: u.kind === 'settler' ? u.task : null },
    flagTool: play.flagTool,
    city: play.cities[0]?.name ?? null,
    finds: play.discoveries.length,
    goal: GOALS[play.goal] ? { text: GOALS[play.goal].text, reward: GOALS[play.goal].reward } : null,
    chooseResearch: play.cities.length > 0 && play.research.target === null && play.research.available().length > 0 && !play.researchOpen,
  };
  play.hud.update(state);
  void autosave();
  unitLayer.update({
    units: play.units.units,
    cities: play.cities.map(c => c.tile),
    selected: play.selected,
    flag: play.units.flag,
    site: play.units.currentSite(),
    founding: play.units.founding,
    improvements: play.improvements.entries(),
    bandits: play.raids.band?.bandits ?? [],
    areas: play.cities.map(c => ({ centre: c.tile, rings: cityRings(c.size) })),
    spacing: tileSpacing(),
  }, camera.position);
  updateLevels();
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
  if (game) startPlay(game.startCity, continuing ?? undefined);
  screen = 'playing';
  introTarget = null;
  lockedLevel = continuing?.progress.openLevel ?? 3;
  rig.maxDist = lockDist(lockedLevel);
  continuing = null;
  startScreen?.remove();
}

/**
 * In the game the map keeps north up (the start screen's compass has P at the top): the
 * heading turns smoothly toward north, by the wall clock, whenever the player is not
 * dragging. Flights and drags otherwise carry their heading along the great circle.
 */
function alignNorth(dt: number) {
  if (screen === 'free' || screen === 'start' || presses.size > 0) return;
  const t = rig.target;
  if (Math.abs(t.y) > 0.98) return;
  const north = new THREE.Vector3(0, 1, 0).addScaledVector(t, -t.y).normalize();
  const heading = rig.forward.clone().addScaledVector(t, -rig.forward.dot(t)).normalize();
  const angle = Math.atan2(heading.clone().cross(north).dot(t), heading.dot(north));
  if (Math.abs(angle) < 1e-5) return;
  rig.forward.applyAxisAngle(t, angle * Math.min(1, dt * 4));
  rig.apply();
}

/** Level, breadcrumb, selection and context for this frame. */
function updateLevel() {
  if (!rig.flying) flight = null;
  viewLevel = levelForDist(rig.dist, frames);
  if (viewLevel === 3) requestSurfacePatterns();
  if (introTarget) selection = viewLevel < 3 ? regionPath(regions, introTarget, viewLevel + 1)[viewLevel] : null;
  if (selection && selection.level !== viewLevel) selection = null;
  // During a flight the breadcrumb and context follow the destination, never deeper
  // than the destination level, so they do not flicker across regions on the way
  const anchor = flight ? flight.point : rig.target;
  const depth = flight ? Math.min(viewLevel, flight.level) : viewLevel;
  path = regionPath(regions, anchor, depth);
  // In the game at the city-area level the fog already shows what is unknown, and the
  // scouts' finds beyond the start area must not look dimmed: no context there
  const context = path.length && !(screen === 'playing' && viewLevel === 3) ? path[path.length - 1] : null;
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
const bufferSize = new THREE.Vector2();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  // Real elapsed time, not clamped: a 1 s flight must last 1 s even when frames are slow
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  rig.update(dt);
  alignNorth(dt);
  tiles.surfaceIn.value = Math.min(1, (now - surfaceArrivedAt) / 600);
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
  stepWell(well, dt);
  wellU.wellPos.value.set(well.x, well.y);
  wellU.wellG.value = well.g;
  wellU.wellBend.value = reduceMotion() ? 0 : 1;
  wellU.aspect.value = camera.aspect;
  wellU.time.value = now / 1000;
  starsMat.uniforms.scale.value = renderer.getDrawingBufferSize(bufferSize).y / 2;
  pulses.update(now, camera, renderer.domElement.clientHeight, reduceMotion());
  renderer.clear();
  renderer.render(starScene, starCamera);
  renderer.clearDepth();
  renderer.render(scene, camera);
  if (well.g > 0) renderer.render(glowScene, glowCamera);
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
  if (lockedLevel > 0) rig.maxDist = lockDist(lockedLevel);
});
frameStartPlanet();

// ─── Export globals ───────────────────────────────
(window as any).globeScene = scene;
(window as any).globeNodes = nodes;
(window as any).globeCamera = rig;
(window as any).globeTiles = tiles;
// For tests (STORY-006): the deepest drawn tile, its screen error and the depth range
(window as any).globePrecision = () => {
  camera.updateMatrixWorld();
  let rtc = 0, naive = 0, level = 0;
  const levels = new Set<number>();
  for (const node of tiles.drawnNodes()) {
    if (!node.mesh) continue;
    node.mesh.updateMatrixWorld();
    const err = projectionErrorPx(node, camera, RADIUS, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
    rtc = Math.max(rtc, err.rtc);
    naive = Math.max(naive, err.naive);
    level = Math.max(level, node.tile.level);
    levels.add(node.tile.level);
  }
  return { level, levels: [...levels], rtc, naive, near: camera.near, far: camera.far, altitude: camera.position.length() - RADIUS };
};
(window as any).globeTerrain = { terrainHeight };
(window as any).globeRegions = regions;
(window as any).globeTileTypes = { tileInfo, codes: tileTypes.codes };
(window as any).globeMap = { isMapped: (id: number) => mapState.isMapped(id) };
// For tests: map tiles without waiting for the scouts
(window as any).globeDebug = {
  reveal: (ids: number[]) => reveal(ids),
  /** Unmapped land tiles holding discoveries, nearest to the camp first (STORY-027). */
  discoverySites: (count: number) => {
    if (!play || !game) return [];
    const sites: { tile: number; finds: string[] }[] = [];
    for (let rings = 2; sites.length < count && rings <= 40; rings += 2) {
      sites.length = 0;
      for (const tile of tilesInRings(play.units.camp, rings)) {
        if (mapState.isMapped(tile) || !Number.isFinite(world.cost(tile))) continue;
        const finds = discoveryAt(game.seed, tile, neighbors(tile).some(n => terrainOf(n) === 'ocean'));
        if (finds) sites.push({ tile, finds });
      }
    }
    return sites.slice(0, count);
  },
  sendTo: (tile: number) => play?.units.sendTo(tile, world) ?? false,
  /** Learn an advance, or add bulbs (STORY-040). */
  learn: (advance: Advance) => { play?.research.known.add(advance); },
  addBulbs: (n: number) => { if (play) play.research.bulbs += n; },
  /** Set the treasury (STORY-038). */
  setGold: (gold: number) => { if (play) play.gold = gold; },
  /** Save now (STORY-036); resolves to whether the browser stored it. */
  saveNow: () => autosave(true),
  /** A settler from a city, as if the city had built it (STORY-033). */
  spawnSettler: (city: number) => {
    if (!play) return null;
    const c = play.cities[city];
    return play.units.spawn('settler', c.tile, world, c.id).name;
  },
  /** A tile's yield when worked, and the tiles each city works. */
  yieldOf: (id: number) => yieldOf(id, false),
  worked: () => workedByCity(),
  /** Discoveries, site offers and raids all stop the game: off together, site offers or raids back on alone. */
  setDiscoveries: (on: boolean) => { discoveriesOn = on; siteOffersOn = on; raidsOn = on; },
  setRaids: (on: boolean) => { raidsOn = on; },
  /** Bandits set off toward a city now (STORY-034). */
  raidNow: (city: number) => (play ? startRaid(play.cities[city]) : false),
  setSiteOffers: (on: boolean) => { siteOffersOn = on; },
  /** Unmapped good city sites near the camp, nearest first (STORY-032). */
  goodSites: (count: number) => {
    if (!play) return [];
    const isLand = (id: number) => Number.isFinite(world.cost(id));
    const taken = [...play.cities.map(c => c.tile), ...(play.units.currentSite() !== null ? [play.units.currentSite()!] : [])];
    return tilesInRings(play.units.camp, 24).filter(id => !mapState.isMapped(id) && goodSite(id, world.siteScore, isLand, taken)).slice(0, count);
  },
};
(window as any).globeHexTiles = { pointToTile, tileCenter, neighbors };
// For tests (STORY-035): the well, the pulses, and a pulse at the view's centre
(window as any).globeFeel = {
  get well() { return { ...well }; },
  get pulses() { return pulses.state; },
  pulse: (kind: PulseKind) => moment(kind, pointToTile(rig.target)),
};
(window as any).globeGame = {
  get state() {
    return {
      screen, seed: game?.seed ?? null, startCity: game?.startCity ?? null, lockedLevel, lockDist: lockDist(), mapped: mapState.count,
      day: clock.day, speed: clock.speed, paused: clock.paused,
      units: play?.units.units.map(u => ({ name: u.name, kind: u.kind, tile: u.tile, mode: u.mode, path: u.path.length, task: u.task, job: u.job })) ?? [],
      selected: play?.selected ?? null, flag: play?.units.flag ?? null, site: play?.units.currentSite() ?? null,
      openLevel: play?.progress.openLevel ?? null, areaPlans: play ? [...play.units.areaPlans] : [], stateLine: play?.units.stateLine ?? null,
      discovery: play?.discoveries[0] ?? null, found: play?.found ?? 0, bonuses: play ? [...play.bonuses] : [],
      offer: play?.offers[0] ?? null, offered: play?.offered ?? [], pendingSite: play?.pendingSite ?? null, founding: play?.units.founding ?? false,
      cities: play ? play.cities.map((c, i) => ({ ...c, yield: cityYields()[i], rings: cityRings(c.size), worked: workedByCity()[i] })) : [], openCity: play?.openCity ?? null,
      improvements: play?.improvements.entries() ?? [],
      raid: play?.raids.band ? { city: play.raids.band.city, bandits: play.raids.band.bandits.map(b => ({ tile: b.tile, path: b.path.length })) } : null,
      raidAlert: play?.raidAlert ?? false,
      gold: play?.gold ?? null,
      research: play ? { ...play.research.save(), cost: play.research.cost } : null, tax: play?.tax ?? null, goal: play?.goal ?? null,
    };
  },
};
(window as any).globeLevels = {
  get state() {
    return { level: viewLevel, path, selection, frames, flying: rig.flying };
  },
};

console.log('[GlobeCiv3] 3D globe ready');
