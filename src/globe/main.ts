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
import { SURFACE_SIZE, type PatternData } from './surfacePatterns';
import { MapState, withNeighbors } from '../game/mapping';
import { paintMapped } from './fogMap';
import { GameClock, type Speed } from '../game/clock';
import { tilesInRings } from '../game/pathfinding';
import { TERRAINS, TERRAIN_RULES, RESOURCES, type Terrain } from '../game/terrainTypes';
import { unitStatus, Units, type Mode, type World } from '../game/units';
import { UnitLayer } from './unitLayer';
import { createGameHud, type GameHudState } from '../ui/gameHud';
import { advance, startProgress, UNLOCK_SHARE, type Progress } from '../game/progress';
import { areaName, directionFrom, distinctNames, landscapeOf, MIDDLE, provinceName, type RegionName } from '../game/names';
import { AREA_PLAN_NAMES, type AreaPlan, type StateLine } from '../game/units';
import { createChips, createLevelPanels, createUnlockCard, type Chip } from '../ui/levelUi';
import { applyFind, discoveryAt, discoverySentence, FINDS, type Discovery, type Yield } from '../game/discoveries';
import { createDiscoveryCard } from '../ui/discoveryCard';
import { BUILDS, cityDay, cityYield, daysToBuild, daysToGrow, foundCity, granary, nextBuild, shortfall, workedTiles, workedYield, CITY_RINGS, type City, type CityYield, type Support } from '../game/cities';
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
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });
  el.addEventListener('pointermove', e => {
    if (!last || screen !== 'start') return;
    const under = grabbed && rig.raycast(ndcAt(e.clientX, e.clientY));
    // Orbit so that the ray through the pointer meets the grabbed point again
    if (grabbed && under) orbitStart(new THREE.Quaternion().setFromUnitVectors(under.normalize(), grabbed));
    else turnStartPlanet(e.clientX - last[0], e.clientY - last[1]);
    last = [e.clientX, e.clientY];
  });
  for (const type of ['pointerup', 'pointercancel'] as const) el.addEventListener(type, () => { last = grabbed = null; });
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
const clock = new GameClock();
const unitLayer = new UnitLayer(RADIUS);
scene.add(unitLayer.group);
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
  /** Discoveries waiting for a choice, the shown one first (STORY-027). */
  discoveries: Discovery[];
  /** Extra yield on tiles from finds; STORY-028's cities count it. */
  bonuses: Map<number, Yield>;
  /** Finds kept so far. */
  found: number;
  /** Cities in founding order, the capital first (STORY-028), and the one whose card is open. */
  cities: City[];
  openCity: number | null;
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
};

function startPlay(startCity: number) {
  const units = new Units(pointToTile(regions.centers[2][startCity]), world);
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
    toggleFlagTool: () => { if (play) play.flagTool = !play.flagTool; },
    found: () => { if (play) play.units.found(world); },
    nextSite: () => { if (play) play.units.nextSite(); },
    nextUnit: () => {
      if (!play) return;
      play.selected = (play.selected + 1) % play.units.units.length;
      // Bring it into view at the current distance
      rig.flyTo(tileCenter(play.units.units[play.selected].tile), rig.dist, reduceMotion() ? 0 : 0.5);
    },
    openCity: () => {
      if (!play || !play.cities.length) return;
      play.openCity = play.openCity === null ? 0 : (play.openCity + 1) % play.cities.length;
    },
  });
  // The first scout is selected, as in the design
  play = { units, selected: 1, flagTool: false, province: provinceTiles, state: stateTiles, progress: startProgress(), targetProvince: -1, discoveries: [], bonuses: new Map(), found: 0, cities: [], openCity: null, hud };
}

// ─── Cities (STORY-028) ───────────────────────────
// The settler sent to its site founds a city. A city works its centre and one tile per
// citizen, grows and builds; what it builds joins the units.

/** A worked tile's food, shields and trade: terrain, resource and an irrigated centre (Freeciv civ1), plus finds. */
function yieldOf(id: number, centre: boolean) {
  const terrain = terrainOf(id);
  const y = workedYield({ terrain, resource: tileTypes.codes[id] & 16 ? TERRAIN_RULES[terrain].resource : null }, centre);
  const b = play?.bonuses.get(id);
  return b ? { food: y.food + b.food, shield: y.shield + b.shield, trade: y.trade + b.trade } : y;
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

function foundAt(tile: number) {
  if (!play) return;
  const city = foundCity(play.cities, tile);
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
    const done = cityDay(c, yields[i]);
    if (done) play!.units.spawn(done, c.tile, world, c.id);
  });
}

const cityCard = createCityCard(hud_root, {
  close: () => { if (play) play.openCity = null; },
  changeBuild: () => { if (play && play.openCity !== null) nextBuild(play.cities[play.openCity]); },
});

function cityView(c: City, y: CityYield): CityView {
  const grow = daysToGrow(c, y);
  const ready = daysToBuild(c, y);
  const build = BUILDS[c.build];
  return {
    kicker: `${c.capital ? 'Pääkaupunki' : 'Kaupunki'} · ${nameOf(2, regions.tileTable()[c.tile]).name}`,
    name: c.name,
    size: c.size,
    growth: c.food / granary(c.size),
    growText: y.surplus < 0 ? 'nälkää' : grow === null ? 'ei kasva' : `kasvaa ${grow} pv`,
    yields: [y.surplus, y.shield, y.trade],
    build: `${build.name} · ${ready === null ? 'ei tuotantoa' : ready === 0 ? `odottaa kokoa ${build.pop + 1}` : `valmis ${ready} pv`}`,
  };
}

/** The open city's card, at the city-area level and not over a discovery. */
function updateCityCard() {
  if (!play) return;
  const id = play.openCity;
  if (id === null || viewLevel !== 3 || discoveryCard.visible) {
    if (cityCard.visible) cityCard.hide();
    return;
  }
  const view = cityView(play.cities[id], cityYields()[id]);
  if (cityCard.visible) cityCard.update(view);
  else cityCard.show(view);
}

// ─── Discoveries (STORY-027) ──────────────────────
// About one land tile in 60 holds a discovery (from the seed). The scout that maps it
// stops the game; the player keeps one of two finds.
const discoveryCard = createDiscoveryCard(hud_root, index => {
  if (!play) return;
  const d = play.discoveries.shift();
  if (!d) return;
  discoveryCard.hide();
  play.found++;
  discoveryCard.notice(applyFind(d.finds[index], d, play.units, world, play.bonuses));
});

function noteDiscoveries(fresh: number[]) {
  if (!play || !game || !discoveriesOn) return;
  for (const tile of fresh) {
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
  }
}

/** Show the first waiting discovery and keep its ring on the tile. */
function updateDiscovery() {
  if (!play) return;
  const d = play.discoveries[0];
  if (!d) return;
  if (!discoveryCard.visible) {
    discoveryCard.show({
      day: clock.day,
      kicker: `Löytö · ${play.units.units.find(u => u.id === d.finder)?.name ?? 'Tiedustelija'}`,
      title: nameOf(2, regions.tileTable()[d.tile]).name,
      body: discoverySentence(d.finds),
      options: d.finds.map(kind => ({ kind, title: FINDS[kind].title, effect: FINDS[kind].effect })),
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
  const opened = play.discoveries.length ? null : advance(play.progress, mapState.share(play.province), mapState.share(play.state));
  if (opened !== null) {
    lockedLevel = opened;
    rig.maxDist = lockDist(opened);
    unlockCard.show(opened === 2 ? 'Lääni kartoitettu, zoomaa ulos' : 'Valtio kartoitettu, zoomaa ulos');
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
  const days = play.discoveries.length ? 0 : clock.advance(dt);
  const selectedUnit = play.units.units[play.selected];
  for (let d = 0; d < days; d++) {
    scouting = true;
    const founded = play.units.day(world);
    scouting = false;
    founded.forEach(foundAt);
    cityDays();
    if (play.discoveries.length) {
      clock.day -= days - d - 1;
      break;
    }
  }
  play.selected = Math.max(0, play.units.units.indexOf(selectedUnit));
  updateDiscovery();
  updateCityCard();
  const u = play.units.units[play.selected];
  const state: GameHudState = {
    day: clock.day,
    speed: clock.speed,
    paused: clock.paused,
    mapped: mapState.share(play.progress.meter === 'province' ? play.province : play.state),
    meterName: play.progress.meter === 'province' ? 'Lääni' : 'Valtio',
    unlockAt: play.progress.meter === 'done' ? null : UNLOCK_SHARE,
    level: viewLevel,
    unit: { name: u.name, status: unitStatus(play.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name), kind: u.kind === 'settler' && u !== play.units.settler ? 'waiting' : u.kind, mode: u.mode },
    flagTool: play.flagTool,
    city: play.cities[0]?.name ?? null,
  };
  play.hud.update(state);
  unitLayer.update({
    units: play.units.units,
    cities: play.cities.map(c => c.tile),
    selected: play.selected,
    flag: play.units.flag,
    site: play.units.currentSite(),
    founding: play.units.founding,
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
  if (game) startPlay(game.startCity);
  screen = 'playing';
  introTarget = null;
  lockedLevel = 3;
  rig.maxDist = lockDist();
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
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  // Real elapsed time, not clamped: a 1 s flight must last 1 s even when frames are slow
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  rig.update(dt);
  alignNorth(dt);
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
  if (lockedLevel > 0) rig.maxDist = lockDist(lockedLevel);
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
  setDiscoveries: (on: boolean) => { discoveriesOn = on; },
};
(window as any).globeHexTiles = { pointToTile, tileCenter, neighbors };
(window as any).globeGame = {
  get state() {
    return {
      screen, seed: game?.seed ?? null, startCity: game?.startCity ?? null, lockedLevel, lockDist: lockDist(), mapped: mapState.count,
      day: clock.day, speed: clock.speed, paused: clock.paused,
      units: play?.units.units.map(u => ({ name: u.name, kind: u.kind, tile: u.tile, mode: u.mode, path: u.path.length })) ?? [],
      selected: play?.selected ?? null, flag: play?.units.flag ?? null, site: play?.units.currentSite() ?? null,
      openLevel: play?.progress.openLevel ?? null, areaPlans: play ? [...play.units.areaPlans] : [], stateLine: play?.units.stateLine ?? null,
      discovery: play?.discoveries[0] ?? null, found: play?.found ?? 0, bonuses: play ? [...play.bonuses] : [],
      cities: play ? play.cities.map((c, i) => ({ ...c, yield: cityYields()[i] })) : [], openCity: play?.openCity ?? null,
    };
  },
};
(window as any).globeLevels = {
  get state() {
    return { level: viewLevel, path, selection, frames, flying: rig.flying };
  },
};

console.log('[GlobeCiv3] 3D globe ready');
