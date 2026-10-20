/**
 * globe/main.ts — Three.js 3D globe with hex grid.
 * Minimal working version for T-GC3-001.
 */
import * as THREE from 'three';
import { buildCityTerrain, risingMaterial, type CityTerrain, type Site } from './cityView';
import { attachInput, GlobeCamera } from './camera';
import { buildHexGrid } from './hexGrid';
import { backTarget, diveTarget, frameDistances, levelForDist, regionAt, regionCenter, regionPath, sameRegion, type FlightTarget, type RegionRef, type ViewLevel } from './levels';
import { neighbors, pointToTile, tileCenter, TILE_COUNT } from './hexTiles';
import { Regions } from './regions';
import { hash, heightRange, terrainHeight } from './terrain';
import { terrainColor, TileManager } from './tiles';
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
import { FAIR_SITE, feedsCity, goodSite, OFFER_EVERY_DAYS, QUIET_DAYS, SITE_SPACING } from '../game/sites';
import { createCityLabels } from '../ui/cityLabels';
import { createTileYields } from '../ui/tileYields';
import { createResearchCard, type ResearchView } from '../ui/researchCard';
import { createListCard, type ListTab, type ListView } from '../ui/listCard';
import { ADVANCES, LUX_RATES, NEEDS, Research, type Advance } from '../game/science';
import { GOVERNMENTS, governed, revolutionDays, type Government } from '../game/government';
import { createTileCard, type TileView } from '../ui/tileCard';
import { economy, type CityEconomy } from '../game/economy';
import { conquest, heldIn, type Conquest } from '../game/conquest';
import { nativeCities, nativeStrength, NATIVE_CLEARANCE, NATIVE_SPACING, type NativeCity } from '../game/cityStates';
import { RIVALS, Rival, rivalStarts, type RivalWorld } from '../game/rivals';
import { oklchToSrgb } from './colors';
import { RANSOM_GOLD, tribeBand, tribeCamp, tribeOf, tribeRaids, TRIBE_MOVE_DAYS, TRIBE_REACH, type Tribe } from '../game/nomads';
import { armyNeeded, attackWins, ATTACK, ATTACKERS, isAttacker, warRoll, War, type WarEvent, type WarWorld } from '../game/war';
import { PLANET_ADVISORS, PLANET_ADVISOR_LIST, planetTarget, type PlanetAdvisor } from '../game/advisors';
import { CITY_ADVISORS, CITY_ADVISOR_LIST, PROVINCE_ADVISORS, PROVINCE_ADVISOR_LIST, STATE_ADVISORS, STATE_ADVISOR_LIST, STATE_PLANS, cityAdvice, expeditionTarget, exploreTarget, luxuryStep, nextAdvance, provinceBuild, settleAreas, type CityAdvisor, type ProvinceAdvisor, type StateAdvisor } from '../game/advisors';
import { createAdvisorCard } from '../ui/advisorCard';
import { advanceGoals, GOALS } from '../game/goals';
import { TERRAINS, TERRAIN_RULES, RESOURCES, type Terrain } from '../game/terrainTypes';
import { directionName, unitStatus, Units, type Mode, type SettlerTask, type Unit, type UnitKind, type World } from '../game/units';
import { bestJob, Improvements, IMPROVEMENT_NAMES } from '../game/improvements';
import { banditWins, raidRoll, raidStart, Raids, uprising, type RaidEvent, type RaidWorld } from '../game/raids';
import { UnitLayer } from './unitLayer';
import { glowMesh, moveWell, newWell, pressWell, releaseWell, starMaterial, stepWell, wellUniforms } from './gravityWell';
import { PulseLayer, type PulseKind } from './pulses';
import { SAVE_VERSION, validateSave, type SaveData } from '../game/save';
import { loadSave, storeSave } from '../game/saveStore';
import { createGameHud, type GameHudState } from '../ui/gameHud';
import { advance, startProgress, UNLOCK_SHARE, type Progress } from '../game/progress';
import { areaName, directionFrom, distinctNames, landscapeOf, MIDDLE, provinceName, stateName, type RegionName } from '../game/names';
import { AREA_PLAN_NAMES, type AreaPlan, type StateLine } from '../game/units';
import { createChips, createLevelPanels, createUnlockCard, type Chip } from '../ui/levelUi';
import { CONSOLATION_GOLD, RUIN_GOLD, isRuin, ruinAt, type Yield } from '../game/discoveries';
import { createDiscoveryCard } from '../ui/discoveryCard';
import { cityLuxury, cityMood, isWonder, sizeLimit, SIZE_LIMIT, tileOutput, withMood, BUILDS, isSoldier, buy, buyCost, cityDay, cityGold, cityRings, cityScience, cityYield, daysToBuild, daysToGrow, foundCity, granary, isBuilding, payUpkeep, shortfall, workedTiles, workedYield, CITY_RINGS, UPKEEP, type Build, type Building, type City, type CityYield, type Focus, type Support } from '../game/cities';
import { createCityCard, type CityView } from '../ui/cityCard';

// ─── Scene setup ──────────────────────────────────
const container = document.getElementById('globe-container')!;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Shadows only at the city level, whose light is the only one that casts them (STORY-069)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
/** The farthest the camera goes: the whole planet (open in the game once the home state is conquered). */
const MAX_DIST = RADIUS * 8;
const rig = new GlobeCamera(RADIUS, camera, {
  minDist: RADIUS * 2e-5,
  maxDist: MAX_DIST,
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
  else {
    selection = ref;
    // A tap on the map tells what the land holds (STORY-067); a chip only selects
    regionCard = ref && `${ref.level}:${ref.id}`;
  }
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
/**
 * One level up. In the game the planet level stops just past its threshold, where the open
 * states' chips have room (STORY-053); the whole planet is a zoom further out.
 */
function upTarget(point: THREE.Vector3): FlightTarget | null {
  const to = backTarget(regions, point, viewLevel, frames);
  if (to && to.level === 0 && screen === 'playing') to.dist = planetDist();
  return to;
}
/** The game's planet-level distance: 15 % past the state level's threshold. */
const planetDist = () => Math.sqrt(frames[0] * frames[1]) * 1.15;

const levelBar = createLevelBar(hud, () => {
  const to = upTarget(flight ? flight.point : rig.target);
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
    discoveries: [],
    bonuses: [...play.bonuses].map(([t, y]) => [t, { ...y }] as [number, Yield]),
    found: play.found, cities: play.cities.map(c => ({ ...c, buildings: [...c.buildings] })), offers: play.offers.map(o => ({ ...o })), offered: [...play.offered],
    lastOfferDay: Number.isFinite(play.lastOfferDay) ? play.lastOfferDay : null, pendingSite: play.pendingSite,
    improvements: play.improvements.entries(), raids: play.raids.save(), war: play.war.save(), rivals: play.rivals.map(r => r.save()), raidAlert: play.raidAlert, gold: play.gold,
    research: play.research.save(), tax: play.tax, lux: play.lux, gov: play.gov, anarchyUntil: play.anarchyUntil, cityAdvisor: play.cityAdvisor, provinceAdvisor: play.provinceAdvisor, stateAdvisor: play.stateAdvisor, planetAdvisor: play.planetAdvisor, targetState: play.targetState, goal: play.goal,
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
unitLayer.raise = tile => cityLevel.raise(tile);
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
  /** Extra yield on tiles from finds before STORY-052; STORY-028's cities count it. */
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
  war: War;
  rivals: Rival[];
  raidAlert: boolean;
  /** The treasury: trade comes in as gold, and buildings and buying cost it (STORY-038). */
  gold: number;
  /** Advances known and researched, and the share of trade that becomes gold (STORY-040). */
  research: Research;
  tax: number;
  /** The share of trade that becomes luxury (STORY-046). */
  lux: number;
  /** The government, and the day anarchy ends, or −1 (STORY-047). */
  gov: Government;
  anarchyUntil: number;
  /** The tapped hex whose card is open (STORY-055). */
  tileOpen: number | null;
  /** The city-level advisor, its card, and what it did lately (STORY-049). */
  cityAdvisor: CityAdvisor;
  advisorOpen: boolean;
  advisorLog: string[];
  /** The province-level advisor and what it did lately (STORY-050). */
  provinceAdvisor: ProvinceAdvisor;
  provinceLog: string[];
  /** The state-level advisor, what it did lately, and the days without disorder (STORY-051). */
  stateAdvisor: StateAdvisor;
  stateLog: string[];
  calmDays: number;
  /** The planet-level advisor, what it did lately, and the target state, or −1 (STORY-057). */
  planetAdvisor: PlanetAdvisor;
  planetLog: string[];
  targetState: number;
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
/** Tests of the clock and the units turn ruins off (they change gold, units and advances). */
let discoveriesOn = true;
/** Site offers stop the game too; tests of other things turn them off with discoveries. */
let siteOffersOn = true;
/** Raids as well (STORY-034). */
let raidsOn = true;
/**
 * Coastal sea: ocean next to land. With Kartanteko units go there at a day a tile (STORY-059;
 * Freeciv civ1 units.ruleset Trireme: Map Making, move_rate 3, flag CoastStrict). Own
 * simplification: no ship is built, as the units move by themselves.
 */
const coastal = (id: number) => terrainOf(id) === 'ocean' && neighbors(id).some(n => terrainOf(n) !== 'ocean');
const canSail = () => play?.research.known.has('mapmaking') ?? false;

/** A tile's part of a site score: its food twice, shields and trade. */
function siteValue(t: number) {
  const rule = TERRAIN_RULES[terrainOf(t)];
  const res = tileTypes.codes[t] & 16 ? RESOURCES[rule.resource] : NO_YIELD;
  return 2 * (rule.food + res.food) + rule.shield + res.shield + rule.trade + res.trade;
}

const world: World = {
  cost: id => (terrainOf(id) === 'ocean' ? Infinity : TERRAIN_RULES[terrainOf(id)].move),
  travel: id => (terrainOf(id) !== 'ocean' ? TERRAIN_RULES[terrainOf(id)].move : canSail() && coastal(id) ? 1 : Infinity),
  isMapped: id => mapState.isMapped(id),
  hasResource: id => (tileTypes.codes[id] & 16) !== 0,
  reveal: ids => {
    const fresh = reveal(ids);
    if (scouting) noteDiscoveries(fresh);
  },
  cityOf: id => regions.tileTable()[id],
  // A city site is as good as the food, shields and trade within two rings (food counts twice);
  // one that cannot feed its first citizen is no site (STORY-065)
  siteScore: id => (feedsCity(id, (t, centre) => terrainYield(t, centre).food) ? tilesInRings(id, 2).reduce((sum, t) => sum + siteValue(t), 0) : 0),
  nextJob: u => nextJob(u),
  improve: (tile, kind) => {
    if (!play) return;
    play.improvements.add(tile, kind);
    moment('improve', tile);
    discoveryCard.notice(`${IMPROVEMENT_NAMES[kind]} valmis · ${TERRAIN_RULES[terrainOf(tile)].name.toLowerCase()}`);
  },
};

function startPlay(startCity: number, saved?: SaveData) {
  // A state with land: 10 of its 49 city areas or more centred on land (a sample, not a scan)
  const hasLand = (state: number) => Array.from({ length: 49 }, (_, k) => pointToTile(regions.centers[2][state * 49 + k])).filter(t => Number.isFinite(world.cost(t))).length >= 10;
  rivalStartStates = rivalStarts(game!.seed, Math.floor(startCity / 49), regions.neighbors, hasLand);
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
    openResearch: () => { if (play) play.researchOpen = true; },
    goalHint: () => { if (play && GOALS[play.goal]) discoveryCard.notice(GOALS[play.goal].hint); },
    openList: () => {
      if (!play) return;
      play.listOpen = !play.listOpen;
      play.openCity = null;
      play.researchOpen = false;
      play.advisorOpen = false;
    },
    openAdvisor: () => {
      if (!play) return;
      play.advisorOpen = !play.advisorOpen;
      play.openCity = null;
      play.researchOpen = false;
      play.listOpen = false;
    },
  });
  // The first scout is selected, as in the design
  play = { units, selected: 1, flagTool: false, province: provinceTiles, state: stateTiles, progress: startProgress(), targetProvince: -1, bonuses: new Map(), found: 0, cities: [], openCity: null, offers: [], offered: [], lastOfferDay: -Infinity, pendingSite: null, improvements: new Improvements(), raids: new Raids(), war: new War(), rivals: RIVALS.slice(0, rivalStartStates.length).map((_, k) => new Rival(k)), raidAlert: false, gold: START_GOLD, research: new Research(), tax: START_TAX, lux: 0, gov: 'despotism', anarchyUntil: -1, tileOpen: null, cityAdvisor: 'none', advisorOpen: false, advisorLog: [], provinceAdvisor: 'none', provinceLog: [], stateAdvisor: 'none', stateLog: [], calmDays: 0, planetAdvisor: 'none', planetLog: [], targetState: -1, researchOpen: false, goal: 0, listOpen: false, listTab: 'cities', hud };
  if (!saved) return;
  // A saved game goes on where it was
  Object.assign(play, {
    selected: Math.min(saved.selected, units.units.length - 1), progress: saved.progress, targetProvince: saved.targetProvince,
    bonuses: new Map(saved.bonuses), found: saved.found, cities: saved.cities,
    offers: saved.offers, offered: saved.offered, lastOfferDay: saved.lastOfferDay ?? -Infinity, pendingSite: saved.pendingSite,
    improvements: Improvements.from(saved.improvements), raids: new Raids(saved.raids), war: new War(saved.war), raidAlert: saved.raidAlert,
    // A save from before STORY-068 has no rivals: they start now
    ...(saved.rivals ? { rivals: saved.rivals.map(r => new Rival(r.id, r)) } : {}), gold: saved.gold,
    research: new Research(saved.research), tax: saved.tax, lux: saved.lux, gov: saved.gov, anarchyUntil: saved.anarchyUntil, cityAdvisor: saved.cityAdvisor, provinceAdvisor: saved.provinceAdvisor, stateAdvisor: saved.stateAdvisor, planetAdvisor: saved.planetAdvisor, targetState: saved.targetState, goal: saved.goal,
  });
  clock.day = saved.day;
  clock.speed = saved.speed;
  clock.paused = saved.paused;
  lastSaveDay = saved.day;
  // Finds waiting in a save from before STORY-052 open as ruins
  for (const d of saved.discoveries) openRuin(d.tile, d.finder);
  // A save's city-states are found at once, before a settler can come near one not yet found
  while (nativeScan || nextNativeState() !== null) scanNatives(Infinity);
}

// ─── Cities (STORY-028) ───────────────────────────
// The settler sent to its site founds a city. A city works its centre and one tile per
// citizen, grows and builds; what it builds joins the units.

const NO_YIELD: Yield = { food: 0, shield: 0, trade: 0 };

/** Gold at the start: Freeciv GAME_DEFAULT_GOLD (common/game.h); the civ1 ruleset's own setting is 0. */
const START_GOLD = 50;
/** Half the trade is gold at the start (own; Freeciv's player default is all science). */
const START_TAX = 50;

/** A tile's food, shields and trade from its terrain and resource alone, as the centre or worked: the same in every game of a seed. */
function terrainYield(id: number, centre: boolean) {
  const terrain = terrainOf(id);
  return workedYield({ terrain, resource: tileTypes.codes[id] & 16 ? TERRAIN_RULES[terrain].resource : null }, centre);
}

/** A worked tile's food, shields and trade: terrain, resource, an irrigated centre and improvements (Freeciv civ1), plus finds. */
function yieldOf(id: number, centre: boolean) {
  const terrain = terrainOf(id);
  const y = terrainYield(id, centre);
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
    const y = cityYield(c, yieldOf, taken, supportOf(c), play!.gov);
    for (const t of workedTiles(c, yieldOf, taken)) taken.add(t);
    return withMood(y, moodOf(c, y));
  });
}

/** A city's mood: its soldiers calm citizens (STORY-044); the gardens make one happy (STORY-045). */
const moodOf = (c: City, y: CityYield) =>
  cityMood(c, soldiersIn(c.tile).length, play?.cities.length ?? 1, hasWonder('gardens'), cityLuxury(c, y, rates().tax, rates().lux), play?.gov);
/** The tax and luxury rates in force: in anarchy all trade is luxury (STORY-047). */
const rates = () => (!play ? { tax: 50, lux: 0 } : play.gov === 'anarchy' ? { tax: 0, lux: 100 } : { tax: play.tax, lux: play.lux });
/** A wonder is in one of the cities (STORY-045). */
const hasWonder = (w: Build) => play?.cities.some(c => c.buildings.includes(w as never)) ?? false;
/** A city's walls, or the Great Wall's in every city. */
const hasWalls = (c: City) => c.buildings.includes('walls') || hasWonder('greatwall');
/** Cities told that they need an aqueduct to grow. */
const atLimit = new Set<number>();
/** Cities in disorder on the last day, for the notices when it starts and ends. */
const unrest = new Set<number>();

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

/**
 * Each day a city takes the fewest citizens off the tiles as entertainers that keeps it out of
 * disorder, as Freeciv's city governor does (STORY-061: in a long game the empire size put
 * more and more cities in disorder, which makes no shields, gold or science). If none helps,
 * all work.
 */
function arrangeEntertainers() {
  const p = play!;
  const taken = new Set<number>();
  for (const c of p.cities) {
    let best = 0;
    for (let e = 0; e <= c.size; e++) {
      c.entertainers = e;
      const y = cityYield(c, yieldOf, taken, supportOf(c), p.gov);
      if (!moodOf(c, y).disorder) { best = e; break; }
    }
    c.entertainers = best;
    for (const t of workedTiles(c, yieldOf, taken)) taken.add(t);
  }
}

/** A day of every city: units it cannot pay for leave first (newest first), then it grows and builds. */
function cityDays() {
  if (!play) return;
  // The day anarchy ends, Monarchy begins (STORY-047)
  if (play.gov === 'anarchy' && clock.day >= play.anarchyUntil) {
    play.gov = 'monarchy';
    play.anarchyUntil = -1;
    discoveryCard.notice('Anarkia päättyi: Monarkia on hallitusmuoto');
    if (play.cities[0]) moment('unlock', play.cities[0].tile);
  }
  arrangeEntertainers();
  let yields = cityYields();
  // Disorder starts or ends
  play.cities.forEach((c, i) => {
    if (yields[i].disorder && !unrest.has(c.id)) {
      unrest.add(c.id);
      discoveryCard.notice(`Levottomuuksia: ${c.name} · tyytymättömät pysäyttivät kaupungin`);
      moment('raid', c.tile);
    } else if (!yields[i].disorder && unrest.delete(c.id)) {
      discoveryCard.notice(`${c.name} rauhoittui`);
    }
  });
  play.cities.forEach((c, i) => {
    for (let short = shortfall(c, yields[i], supportOf(c)); short; short = shortfall(c, yields[i], supportOf(c))) {
      const own = play!.units.units.filter(u => u.home === c.id && (short === 'shield' || u.kind === 'settler'));
      play!.units.disband(own[own.length - 1], world);
      yields = cityYields();
    }
    const size = c.size;
    const done = cityDay(c, yields[i]);
    // A full box at the size limit: said once (STORY-054)
    if (c.size >= sizeLimit(c) && c.food >= granary(c.size) && !atLimit.has(c.id)) {
      atLimit.add(c.id);
      discoveryCard.notice(`${c.name} tarvitsee vesijohdon kasvaakseen yli koon ${SIZE_LIMIT}`);
    }
    // Trade comes in as gold, and the buildings' upkeep goes out (STORY-038)
    const paid = payUpkeep(c, play!.gold + cityGold(c, yields[i], rates().tax, rates().lux));
    play!.gold = paid.treasury;
    if (paid.sold.length) discoveryCard.notice(`Kulta loppui: ${c.name} myi ${paid.sold.map(b => BUILDS[b].name.toLowerCase()).join(' ja ')}`);
    if (c.size > size) {
      discoveryCard.notice(`${c.name} kasvoi kokoon ${c.size}${cityRings(c.size) > cityRings(size) ? ', ja sen alue laajeni' : ''}`);
      moment('city', c.tile);
    }
    if (!done) return;
    if (isBuilding(done)) moment(isWonder(done) ? 'unlock' : 'city', c.tile);
    else if (isSoldier(done) || isAttacker(done) || done === 'settler') play!.units.spawn(done, c.tile, world, c.id);
    discoveryCard.notice(`${c.name} rakensi${isWonder(done) ? ' ihmeen' : ''}: ${BUILDS[done].name}`);
  });
  // The cities' science; an advance learned opens what needs it (STORY-040)
  const learned = play.research.add(play.cities.reduce((sum, c, i) => sum + cityScience(c, yields[i], rates().tax, rates().lux), 0));
  if (learned) {
    const opens = (Object.keys(NEEDS) as Build[]).filter(b => NEEDS[b] === learned).map(b => BUILDS[b].name);
    discoveryCard.notice(`Keksintö: ${ADVANCES[learned].name}${learned === 'mapmaking' ? ' · yksiköt kulkevat rannikkovesillä' : ''}${opens.length ? ` · ${opens.join(', ')} avautui` : ''}`);
    if (play.cities[0]) moment('unlock', play.cities[0].tile);
  }
  // A suggested site waiting for a settler gets the first free one
  const free = idleSettler();
  if (free && play.pendingSite !== null) {
    sendSettler(free, play.pendingSite);
    play.pendingSite = null;
    discoveryCard.notice(`${free.name} lähti kaupunkipaikalle`);
  } else if (play.pendingSite !== null && !free && play.cities[0] && !play.cities.some(c => c.build === 'settler')) {
    // The waiting site keeps a settler coming (STORY-060): a soldier against bandits, an
    // advisor or the player may have changed the build, and the site would wait for ever
    play.cities[0].build = 'settler';
  }
  // The best known sites come daily too, not only with freshly mapped land
  noteSiteOffer([]);
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
  // Good sites come from freshly mapped land; after a quiet while, or in the conquest, the best known one
  const quiet = play.cities.length > 0 && clock.day - play.lastOfferDay >= QUIET_DAYS;
  const tile = fresh.find(id => play!.units.isOpen(id, world) && goodSite(id, world.siteScore, isLand, taken) && !nearForeign(id))
    ?? (play.progress.meter === 'conquest' ? provinceSite(taken) : quiet ? nearbySite(taken) : undefined);
  if (tile === undefined) return;
  play.offers.push({ tile, finder: finderOf(tile) });
  play.offered.push(tile);
  play.lastOfferDay = clock.day;
}

/**
 * During the conquest: the best mapped site of the nearest home-state province without a city
 * (STORY-060). Good sites come from freshly mapped land only, and a province mapped before, or
 * one without land in the top quarter, would otherwise never get a city.
 */
function provinceSite(taken: readonly number[]): number | undefined {
  const p = play!;
  const won = conquestNow();
  const from = tileCenter(p.cities[0]?.tile ?? p.units.camp);
  const provinces = Array.from({ length: 7 }, (_, k) => homeState() * 7 + k)
    .filter(pr => !won.held.has(pr))
    .sort((a, b) => from.angleTo(regions.centers[1][a]) - from.angleTo(regions.centers[1][b]));
  const near = new Set(taken.flatMap(t => tilesInRings(t, SITE_SPACING - 1)));
  for (const pr of provinces) {
    let best: number | undefined, top = -Infinity;
    for (let a = pr * 7; a < pr * 7 + 7; a++) {
      if (!tilesOfArea.has(a)) tilesOfArea.set(a, cityTiles(regions, a));
      for (const t of tilesOfArea.get(a)!) {
        if (!mapState.isMapped(t) || !Number.isFinite(world.cost(t)) || near.has(t) || nearForeign(t)) continue;
        const s = world.siteScore(t);
        if (s > top) { top = s; best = t; }
      }
    }
    if (best !== undefined) return best;
  }
  return undefined;
}

/**
 * The best mapped site within twelve rings of the capital, of the median score at least
 * (STORY-060: the scouts may map far and poor land for a long while, and the cities stopped).
 */
function nearbySite(taken: readonly number[]): number | undefined {
  const p = play!;
  const near = new Set(taken.flatMap(t => tilesInRings(t, SITE_SPACING - 1)));
  let best: number | undefined, top = FAIR_SITE - 1;
  for (const t of tilesInRings(p.cities[0].tile, 12)) {
    if (!mapState.isMapped(t) || !Number.isFinite(world.cost(t)) || near.has(t) || !p.units.isOpen(t, world) || nearForeign(t)) continue;
    const s = world.siteScore(t);
    if (s > top) { top = s; best = t; }
  }
  return best;
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
  // A city-state's or a tribe's label opens its hex card (STORY-063, STORY-066)
  if (id < 0) {
    const tile = id <= -2001 ? visibleRivalCities()[-2001 - id]?.city.tile : id <= -1001 ? visibleTribes()[-1001 - id]?.camp : visibleNatives()[-1 - id]?.tile;
    if (tile === undefined) return;
    if (viewLevel !== 3) fly({ point: tileCenter(tile), dist: frames[3], level: 3 });
    play.tileOpen = tile;
    return;
  }
  play.openCity = id;
  // From the province or state level, fly to the city
  if (viewLevel !== 3) fly({ point: tileCenter(play.cities[id].tile), dist: frames[3], level: 3 });
});

// What the open city's tiles bring in, over the map and under the card (STORY-039)
const tileYields = createTileYields(hud_root);

function updateCityLabels() {
  if (!play) return;
  // At the city level its label goes up over the walls (STORY-069)
  const lift = viewLevel === 3 ? 48 + 100 * cityLevel.relief.value : 0;
  // City-states have negative ids: -1 - their place among those in view (STORY-063)
  const shown = visibleNatives();
  cityLabels.update(viewLevel === 0 ? [] : [
    ...play.cities.map(c => {
      const at = toScreen(tileCenter(c.tile));
      // Above the city's houses at the city-area level, on the city further out
      return { id: c.id, name: c.name, size: c.size, x: at?.[0] ?? null, y: at ? at[1] - lift : null };
    }),
    ...shown.map((n, k) => {
      const at = toScreen(tileCenter(n.tile));
      return { id: -1 - k, name: n.name, size: nativeStrength(n, clock.day).size, x: at?.[0] ?? null, y: at ? at[1] - lift : null, foe: 'native' as const };
    }),
    // Rival cities from −2001 down (STORY-068)
    ...visibleRivalCities().map((x, k) => {
      const at = toScreen(tileCenter(x.city.tile));
      return { id: -2001 - k, name: x.city.name, size: x.city.size, x: at?.[0] ?? null, y: at ? at[1] - lift : null, foe: 'rival' as const, color: rivalCss(x.rival.id), owner: x.rival.name };
    }),
    // Tribes from −1001 down (STORY-066), with their band's size
    ...visibleTribes().map((t, k) => {
      const at = toScreen(tileCenter(t.camp));
      return { id: -1001 - k, name: t.tribe.name, size: tribeBand(game!.seed, t.tribe, clock.day).size, x: at?.[0] ?? null, y: at ? at[1] - lift : null, foe: 'tribe' as const };
    }),
  ]);
}

// ─── City-states (STORY-063) ──────────────────────
// The states next to the player's (home and conquered) hold 2 to 4 native cities each, from
// the seed (cityStates.ts; Sami: only in the neighbouring states). A state's are found once,
// its land scored a few milliseconds a frame; they show once mapped.
const nativesOf = new Map<number, NativeCity[]>();
const natives: NativeCity[] = [];
const nativeCenters: THREE.Vector3[] = [];
const TILE_ANGLE = Math.acos(1 / Math.sqrt(5)) / 330;

// ─── The city level (STORY-069) ───────────────────
// Close to one of the player's cities its three rings rise into relief, with light and
// shadows, trees, rocks, houses and buildings (cityView.ts, docs/design/kaupunkitaso.md).
// It rises in 0.6 s by the wall clock and sinks back as the camera leaves.
const CITY_LEVEL_RINGS = 3;
/** The city level begins below this share of the city area's framing distance. */
const CITY_LEVEL_AT = 0.5;
const RISE_SECONDS = 0.6;
const cityLevel = (() => {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const relief = { value: 0 };
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.0005;
  group.add(sun, sun.target, new THREE.HemisphereLight(0xe4ecff, 0x40382a, 0.9));
  const flat = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
  const ground = risingMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), relief);
  const groundDepth = risingMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), relief);
  /** Things on the ground, raised with it: where each stands at rest and how far it rises. */
  let props: { object: THREE.Object3D | THREE.InstancedMesh; spots: { base: THREE.Vector3; rise: THREE.Vector3; yaw: number; scale: number }[] }[] = [];
  let terrain: CityTerrain | null = null;
  let mesh: THREE.Mesh | null = null;
  let city: number | null = null;
  let dressed = '';
  const up = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const yawQ = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);

  const clear = () => {
    for (const p of props) {
      group.remove(p.object);
      p.object.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    }
    props = [];
  };
  /** Place the props at the current relief. */
  const place = () => {
    for (const p of props) {
      p.spots.forEach((s, i) => {
        v.copy(s.base).addScaledVector(s.rise, relief.value);
        q.copy(up).multiply(yawQ.setFromAxisAngle(Y, s.yaw));
        const k = s.scale * Math.max(0.001, relief.value);
        if (p.object instanceof THREE.InstancedMesh) {
          p.object.setMatrixAt(i, m.compose(v, q, new THREE.Vector3(k, k, k)));
        } else {
          p.object.position.copy(v);
          p.object.quaternion.copy(q);
          p.object.scale.setScalar(k);
        }
      });
      if (p.object instanceof THREE.InstancedMesh) p.object.instanceMatrix.needsUpdate = true;
    }
  };
  const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, spots: typeof props[number]['spots']) => {
    const im = new THREE.InstancedMesh(geometry, material, Math.max(1, spots.length));
    im.count = spots.length;
    im.castShadow = im.receiveShadow = true;
    im.frustumCulled = false;
    group.add(im);
    props.push({ object: im, spots });
  };
  /** A building at a site: a few flat-shaded shapes, in tile spacings. */
  const building = (kind: string, site: Site, s: number) => {
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(geo, flat(color));
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      g.add(o);
    };
    const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w * s, h * s, d * s).translate(0, (h * s) / 2, 0);
    const roof = (r: number, h: number, sides = 4) => new THREE.ConeGeometry(r * s, h * s, sides).rotateY(Math.PI / sides).translate(0, (h * s) / 2, 0);
    if (kind === 'palace') {
      add(box(0.3, 0.16, 0.3), 0xe8e0cc);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { add(box(0.07, 0.26, 0.07), 0xe8e0cc, x * 0.15 * s, 0, z * 0.15 * s); add(roof(0.06, 0.08, 6), 0x3d5a9e, x * 0.15 * s, 0.26 * s, z * 0.15 * s); }
      add(roof(0.2, 0.1), 0x8c3b2a, 0, 0.16 * s, 0);
    } else if (kind === 'house') {
      add(box(0.13, 0.09, 0.11), 0xe6dcc4);
      add(roof(0.11, 0.08), 0x9a4630, 0, 0.09 * s, 0);
    } else if (kind === 'granary') {
      add(new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.18 * s, 8).translate(0, 0.09 * s, 0), 0xd9c38a);
      add(roof(0.08, 0.07, 8), 0x9a4630, 0, 0.18 * s, 0);
    } else if (kind === 'temple') {
      add(box(0.24, 0.03, 0.16), 0xf2efe6);
      for (const x of [-0.09, -0.03, 0.03, 0.09]) for (const z of [-0.06, 0.06]) add(box(0.025, 0.12, 0.025), 0xf2efe6, x * s, 0.03 * s, z * s);
      add(roof(0.16, 0.06), 0xf2efe6, 0, 0.15 * s, 0);
    } else if (kind === 'library') {
      add(box(0.2, 0.11, 0.16), 0xc9b48a);
      add(new THREE.SphereGeometry(0.07 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.11 * s, 0), 0x6f8fb3);
    } else if (kind === 'market') {
      for (const [x, z, c] of [[-0.08, 0, 0xc0392b], [0.02, 0.06, 0xe0a52a], [0.08, -0.05, 0x2f8f6b]] as const) { add(box(0.07, 0.05, 0.07), 0xe6dcc4, x * s, 0, z * s); add(roof(0.06, 0.04), c, x * s, 0.05 * s, z * s); }
    } else if (kind === 'aqueduct') {
      for (const x of [-0.12, 0, 0.12]) add(box(0.04, 0.14, 0.05), 0xb7ab98, x * s, 0, 0);
      add(box(0.32, 0.03, 0.05), 0xb7ab98, 0, 0.14 * s, 0);
    } else if (kind === 'colosseum') {
      add(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.1 * s, 14, 1, true).translate(0, 0.05 * s, 0), 0xd8c8a8);
    } else if (kind === 'colossus') {
      add(new THREE.CylinderGeometry(0.03 * s, 0.05 * s, 0.32 * s, 6).translate(0, 0.16 * s, 0), 0xb87333);
      add(new THREE.SphereGeometry(0.04 * s, 6, 4).translate(0, 0.36 * s, 0), 0xb87333);
    } else if (kind === 'gardens') {
      for (let k = 0; k < 3; k++) add(box(0.24 - k * 0.07, 0.05, 0.24 - k * 0.07), 0x4f8f3a, 0, k * 0.05 * s, 0);
    }
    group.add(g);
    props.push({ object: g, spots: [{ base: site.base, rise: site.rise, yaw: 0, scale: 1 }] });
  };
  /** Walls round the centre: fourteen segments on a ring, each on the ground nearest to it. */
  const walls = (sites: Site[], s: number, stone: number) => {
    const n = 14;
    const r = 0.85 * s;
    const e1 = new THREE.Vector3(1, 0, 0).applyQuaternion(up);
    const e2 = new THREE.Vector3(0, 0, 1).applyQuaternion(up);
    const inverse = up.clone().invert();
    const geo = new THREE.BoxGeometry(2 * Math.PI * r / n * 1.05, 0.1 * s, 0.05 * s).translate(0, 0.05 * s, 0);
    instanced(geo, flat(stone), Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2;
      const base = e1.clone().multiplyScalar(Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r);
      const nearest = sites.reduce((b, x) => (x.base.distanceToSquared(base) < b.base.distanceToSquared(base) ? x : b));
      // Along the ring: the segment's length on the local x axis turned to the tangent
      const t = e1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e2, Math.cos(a)).applyQuaternion(inverse);
      return { base, rise: nearest.rise, yaw: Math.atan2(-t.z, t.x), scale: 1 };
    }));
  };

  /** Trees, rocks, houses and buildings of a city at its terrain's sites. */
  const dress = (c: City) => {
    clear();
    if (!terrain) return;
    const s = RADIUS * TILE_ANGLE;
    const roll = (site: Site, k: number) => hash(Math.round(site.base.x * 1e5), Math.round(site.base.z * 1e5), k, 4242) * 0.5 + 0.5;
    const land = terrain.sites.filter(site => terrainOf(site.tile) !== 'ocean');
    const byCentre = [...land].sort((a, b) => a.base.lengthSq() - b.base.lengthSq());
    // The city: its palace or main house, houses by size, then its buildings, nearest first
    const town = byCentre.filter(site => site.tile === c.tile || neighbors(c.tile).includes(site.tile));
    const used = new Set<string>();
    const placed: THREE.Vector3[] = [];
    // The nearest free site with room round it: buildings stand apart
    const take = () => {
      const site = town.find(x => !used.has(x.key) && placed.every(b => b.distanceTo(x.base) > 0.2 * s));
      if (site) { used.add(site.key); placed.push(site.base); }
      return site;
    };
    const centre = take();
    if (centre) building(c.capital ? 'palace' : 'house', centre, s);
    const shown = c.buildings.filter(b => b !== 'walls' && b !== 'greatwall');
    for (const b of shown) { const site = take(); if (site) building(b, site, s); }
    const houses: Site[] = [];
    for (let k = 0; k < Math.min(24, c.size * 2); k++) { const site = take(); if (site) houses.push(site); }
    for (const site of houses) building('house', site, s);
    if (c.buildings.includes('walls') || hasWonder('greatwall')) walls(terrain.sites, s, 0x9a948a);
    // Trees on forest and jungle, rocks on hills and mountains, a few out in the open
    const DENSITY: Partial<Record<Terrain, [number, number]>> = { forest: [0.5, 0], jungle: [0.55, 0], swamp: [0.12, 0], grassland: [0.04, 0.01], plains: [0.03, 0.01], tundra: [0.05, 0.03], hills: [0.08, 0.12], mountains: [0.02, 0.3], desert: [0, 0.05], arctic: [0, 0.06] };
    const free = land.filter(site => !used.has(site.key));
    const trees = free.filter(site => roll(site, 1) < (DENSITY[terrainOf(site.tile)]?.[0] ?? 0));
    const rocks = free.filter(site => !trees.includes(site) && roll(site, 2) < (DENSITY[terrainOf(site.tile)]?.[1] ?? 0));
    const spot = (site: Site, k: number) => ({ base: site.base, rise: site.rise, yaw: roll(site, k) * Math.PI * 2, scale: 0.75 + 0.5 * roll(site, k + 1) });
    instanced(new THREE.ConeGeometry(0.075 * s, 0.26 * s, 6).translate(0, 0.17 * s, 0), flat(0x2f6b3a), trees.map(site => spot(site, 3)));
    instanced(new THREE.CylinderGeometry(0.015 * s, 0.02 * s, 0.05 * s, 5).translate(0, 0.025 * s, 0), flat(0x6b4a2f), trees.map(site => spot(site, 3)));
    instanced(new THREE.IcosahedronGeometry(0.06 * s, 0), flat(0x8d8a84), rocks.map(site => spot(site, 5)));
    place();
  };

  return {
    group,
    relief,
    /** Height of the raised ground at a tile, for the units standing on it. */
    raise: (tile: number) => (terrain && relief.value > 0 ? terrain.heightAt(tile) * relief.value : 0),
    get city() { return city; },
    get stats() {
      return { city, relief: relief.value, triangles: mesh ? mesh.geometry.getAttribute('position').count / 3 : 0, props: props.map(p => (p.object instanceof THREE.InstancedMesh ? p.object.count : 1)).reduce((a, b) => a + b, 0) };
    },
    /** Build the ground of a city, once it has sunk from another. */
    build(c: City) {
      if (mesh) { group.remove(mesh); mesh.geometry.dispose(); }
      terrain = buildCityTerrain({
        centre: c.tile, rings: CITY_LEVEL_RINGS, terrainOf, radius: RADIUS, lift: 2e-6, colorOf: terrainColor,
        detail: p => heightRange(p, 9, 11) / (0.5 ** 10 + 0.5 ** 11),
      });
      mesh = new THREE.Mesh(terrain.geometry, ground);
      mesh.customDepthMaterial = groundDepth;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      group.position.copy(terrain.origin);
      up.setFromUnitVectors(Y, tileCenter(c.tile));
      city = c.tile;
      dressed = '';
    },
    /** Dress the city again when it has grown or built. */
    dressFor(c: City) {
      const key = `${c.size}|${c.capital}|${c.buildings.join(',')}|${hasWonder('greatwall')}`;
      if (key === dressed) return;
      dressed = key;
      dress(c);
    },
    /** Shadows on or off, for measuring what they cost. */
    shadows(on: boolean) { sun.castShadow = on; },
    setRelief(r: number) {
      relief.value = r;
      group.visible = r > 0;
      place();
    },
    /** The light from the top left of the view, over the city, with a shadow camera round its rings. */
    light(dir: THREE.Vector3) {
      const s = RADIUS * TILE_ANGLE;
      const reach = (CITY_LEVEL_RINGS + 1.5) * s * 1.3;
      sun.position.copy(dir).multiplyScalar(reach * 3);
      sun.target.position.set(0, 0, 0);
      const cam = sun.shadow.camera;
      cam.left = cam.bottom = -reach;
      cam.right = cam.top = reach;
      cam.near = reach;
      cam.far = reach * 5;
      cam.updateProjectionMatrix();
    },
  };
})();

/** The player's city the camera is close to: within two tiles of the view's centre. */
function cityInView(): City | null {
  if (!play || viewLevel !== 3 || rig.dist > frames[3] * CITY_LEVEL_AT) return null;
  const at = rig.target.clone().normalize();
  let best: City | null = null;
  let near = 2.5 * TILE_ANGLE;
  for (const c of play.cities) {
    const d = tileCenter(c.tile).angleTo(at);
    if (d < near) { near = d; best = c; }
  }
  return best;
}

/** The city level's day and frame: rise toward the city in view, or sink. */
function updateCityLevel(dt: number) {
  const c = cityInView();
  const r = cityLevel.relief.value;
  // A new city waits until the last one has sunk
  if (c && c.tile !== cityLevel.city && r === 0) cityLevel.build(c);
  const target = c && c.tile === cityLevel.city ? 1 : 0;
  if (c && c.tile === cityLevel.city) cityLevel.dressFor(c);
  const next = reduceMotion() ? target : target > r ? Math.min(target, r + dt / RISE_SECONDS) : Math.max(target, r - dt / RISE_SECONDS);
  if (next !== r) cityLevel.setRelief(next);
  if (next > 0) cityLevel.light(tiles.sunDir.value);
}

// ─── Rival civilizations (STORY-068) ──────────────
// Two or three rivals start two states from home (rivals.ts): their capitals come from the
// scan of their start states, and their cities grow and spread by the player's rules.
let rivalStartStates: number[] = [];
/** Start states scanned for a capital this session, found or not. */
const rivalScanned = new Set<number>();

/** Where a rival may found a city: land outside the player's states, clear of every city and city-state. */
function siteContext() {
  const p = play!;
  return {
    realm: new Set([homeState(), ...conquestNow().conquered]),
    cities: [...p.cities, ...p.rivals.flatMap(r => r.cities)].map(c => tileCenter(c.tile)),
  };
}
function freeForRival(tile: number, ctx: ReturnType<typeof siteContext>): boolean {
  if (!Number.isFinite(world.cost(tile)) || ctx.realm.has(Math.floor(world.cityOf(tile) / 49)) || nearNative(tile)) return false;
  const at = tileCenter(tile);
  return !ctx.cities.some(c => c.angleTo(at) < (SITE_SPACING - 0.5) * TILE_ANGLE);
}

const rivalWorld: RivalWorld = {
  // The rivals' tiles give what their terrain gives; the player's improvements are the player's
  yieldOf: (id, centre) => terrainYield(id, centre),
  cost: id => world.cost(id),
  free: tile => freeForRival(tile, siteContext()),
  // The best fair site within ten rings
  site: from => {
    const ctx = siteContext();
    let best: number | null = null;
    let top = FAIR_SITE - 1;
    for (const t of tilesInRings(from, 10)) {
      if (!freeForRival(t, ctx)) continue;
      const s = world.siteScore(t);
      if (s > top) { top = s; best = t; }
    }
    return best;
  },
  path: (from, to) => findPath(from, to, id => world.cost(id)),
};

/** A day of the rivals: their cities work the tiles the player's leave. */
function rivalsDay() {
  const p = play!;
  if (!p.rivals.some(r => r.cities.length)) return;
  const taken = new Set(workedByCity().flat());
  for (const r of p.rivals) {
    for (const e of r.day(rivalWorld, taken)) {
      if (e.kind === 'founded' && mapState.isMapped(e.city.tile)) discoveryCard.notice(`${r.name} perusti kaupungin ${e.city.name}`);
    }
  }
}

/** The rivals' cities on mapped tiles. */
const visibleRivalCities = () => play!.rivals.flatMap(r => r.cities.filter(c => mapState.isMapped(c.tile)).map(city => ({ rival: r, city })));
const rivalCityAt = (tile: number) => play!.rivals.flatMap(r => r.cities.map(city => ({ rival: r, city }))).find(x => x.city.tile === tile) ?? null;
const rivalCss = (k: number) => `rgb(${oklchToSrgb(...(RIVALS[k].color as unknown as [number, number, number])).map(v => Math.round(v * 255)).join(', ')})`;

// ─── Nomad tribes (STORY-066) ─────────────────────
// A tribe in each state next to the player's (nomads.ts): its camp moves over the state's land,
// from day 120 it raids the nearest city within reach, and the Kenraali can scatter it.
const tribeLand = new Map<number, number[]>();

interface TribeNow { tribe: Tribe; camp: number }
/** The tribes not scattered, with today's camps; none on a city of the player's. */
function tribesNow(): TribeNow[] {
  if (!game || !play) return [];
  const out: TribeNow[] = [];
  for (const [state, land] of tribeLand) {
    if (play.war.routed.has(state)) continue;
    const tribe = tribeOf(game.seed, state);
    const camp = tribeCamp(game.seed, tribe, clock.day, land);
    if (camp !== null && !play.cities.some(c => c.tile === camp)) out.push({ tribe, camp });
  }
  return out;
}
const visibleTribes = () => tribesNow().filter(t => mapState.isMapped(t.camp));
const tribeAt = (tile: number) => tribesNow().find(t => t.camp === tile) ?? null;

/** The tribe's band sets off at the nearest city of the player's, within reach unless `anywhere`. */
function sendTribe(t: TribeNow, anywhere = false): boolean {
  const p = play!;
  const at = tileCenter(t.camp);
  const city = p.cities.reduce<City | null>((best, c) => (!best || tileCenter(c.tile).angleTo(at) < tileCenter(best.tile).angleTo(at) ? c : best), null);
  if (!city || (!anywhere && tileCenter(city.tile).angleTo(at) > TRIBE_REACH * TILE_ANGLE)) return false;
  const band = tribeBand(game!.seed, t.tribe, clock.day);
  if (!p.raids.start(city.tile, t.camp, band.size, id => world.cost(id), { attack: band.attack, tribe: t.tribe.name })) return false;
  p.raidAlert = true;
  return true;
}

/** A tribe on the hex card: its band and when its camp moves on. */
function tribeLine(t: TribeNow): string {
  const b = tribeBand(game!.seed, t.tribe, clock.day);
  const moves = TRIBE_MOVE_DAYS - ((clock.day + t.tribe.phase) % TRIBE_MOVE_DAYS);
  return `${t.tribe.name} · ${b.size} ${b.unit === 'legion' ? 'miekkamiestä' : 'ratsumiestä'} · leiri siirtyy ${moves} pv päästä`;
}

/** Land tiles of a state given the full site score: the best by the yield of a tile and its neighbours. */
const NATIVE_CANDIDATES = 300;
/**
 * Milliseconds a frame for finding them: a state's terrain takes 60 to 150 ms (a province
 * 7 to 26 ms, Intel UHD, Chromium), too long for a frame.
 */
const NATIVE_BUDGET_MS = 3;
/** The state whose land is being scored: its tiles, how far, and the scores so far. */
let nativeScan: { state: number; tiles: number[]; at: number; rough: { tile: number; score: number }[] } | null = null;
let nativeMs = 0;
/** Score the land of the next state wanted for a while; when it is done, its city-states are found. */
function scanNatives(budgetMs: number) {
  if (!game || !play) return;
  const t0 = performance.now();
  if (!nativeScan) {
    const state = nextNativeState();
    if (state === null) return;
    const table = regions.tileTable();
    const tiles: number[] = [];
    for (let t = 0; t < table.length; t++) if (table[t] >= state * 49 && table[t] < state * 49 + 49) tiles.push(t);
    nativeScan = { state, tiles, at: 0, rough: [] };
  }
  const scan = nativeScan;
  while (scan.at < scan.tiles.length && performance.now() - t0 < budgetMs) {
    const t = scan.tiles[scan.at++];
    if (Number.isFinite(world.cost(t))) scan.rough.push({ tile: t, score: neighbors(t).reduce((sum, n) => sum + siteValue(n), siteValue(t)) });
  }
  if (scan.at === scan.tiles.length) {
    nativeScan = null;
    const rough = scan.rough.sort((a, b) => b.score - a.score || a.tile - b.tile);
    // Not next to a city of the player's founded before the state's were found (an older save);
    // later cities keep away from them, so leaving those tiles out gives the same city-states
    const ours = [...play.cities.filter(c => !c.native), ...play.rivals.flatMap(r => r.cities)].map(c => tileCenter(c.tile));
    const land = rough.slice(0, NATIVE_CANDIDATES)
      .filter(l => !ours.some(c => c.angleTo(tileCenter(l.tile)) < NATIVE_CLEARANCE * TILE_ANGLE))
      .map(l => ({ tile: l.tile, score: world.siteScore(l.tile) }));
    const rival = rivalStartStates.indexOf(scan.state);
    if (rival >= 0) {
      // A rival's capital on the best site of its start state (STORY-068)
      rivalScanned.add(scan.state);
      const best = land.filter(l => l.score > 0).sort((a, b) => b.score - a.score || a.tile - b.tile)[0];
      if (best && !play.rivals[rival].cities.length) play.rivals[rival].found(best.tile);
      if (budgetMs < Infinity) nativeMs = Math.max(nativeMs, performance.now() - t0);
      return;
    }
    const near = (a: number, b: number) => tileCenter(a).angleTo(tileCenter(b)) < NATIVE_SPACING * TILE_ANGLE;
    const found = nativeCities(game.seed, scan.state, land, near);
    nativesOf.set(scan.state, found);
    tribeLand.set(scan.state, scan.rough.map(l => l.tile).filter(t => !found.some(n => n.tile === t)).sort((a, b) => a - b));
    natives.push(...found);
    nativeCenters.push(...found.map(n => tileCenter(n.tile)));
  }
  if (budgetMs < Infinity) nativeMs = Math.max(nativeMs, performance.now() - t0);
}

/**
 * The next state to scan: next to home or a conquered state for its city-states and tribe (not
 * home nor a rival's start), then a rival's start state for its capital (STORY-068).
 */
function nextNativeState(): number | null {
  for (const s of [homeState(), ...conquestNow().conquered]) {
    for (const t of regions.neighbors[s]) if (t !== homeState() && !rivalStartStates.includes(t) && !nativesOf.has(t)) return t;
  }
  const k = play!.rivals.findIndex((r, i) => !r.cities.length && !rivalScanned.has(rivalStartStates[i]));
  return k >= 0 ? rivalStartStates[k] : null;
}

/** City-states found so far, not taken, on mapped tiles. */
function visibleNatives(): NativeCity[] {
  return natives.filter(n => mapState.isMapped(n.tile) && !nativeGone(n));
}

/** A city-state taken by the player or destroyed (STORY-064). */
const nativeGone = (n: NativeCity) => play!.war.razed.has(n.tile) || play!.cities.some(c => c.tile === n.tile);
const nativeAt = (tile: number) => natives.find(n => n.tile === tile && !nativeGone(n)) ?? null;
/** Near a rival's city (STORY-068): within the rings kept between cities. */
const nearRival = (tile: number) => {
  if (!play?.rivals.some(r => r.cities.length)) return false;
  const at = tileCenter(tile);
  return play.rivals.some(r => r.cities.some(c => tileCenter(c.tile).angleTo(at) < (SITE_SPACING - 0.5) * TILE_ANGLE));
};
/** No city of the player's may be founded here: next to a city-state or a rival's city. */
const nearForeign = (tile: number) => nearNative(tile) || nearRival(tile);
/** Near a city-state: no city may be founded there. */
const nearNative = (tile: number) => {
  if (!natives.length) return false;
  const at = tileCenter(tile);
  return natives.some((n, i) => nativeCenters[i].angleTo(at) < NATIVE_CLEARANCE * TILE_ANGLE && !nativeGone(n));
};

const cityCard = createCityCard(hud_root, {
  close: () => { if (play) play.openCity = null; },
  // Shields in store are kept: both builds are units, so Freeciv has no change penalty
  setFocus: (focus: Focus) => { if (play && play.openCity !== null) play.cities[play.openCity].focus = focus; },
  setBuild: (build: Build) => {
    const need = NEEDS[build];
    if (!play || play.openCity === null || (need && !play.research.known.has(need))) return;
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
  phalanx: 'Puolustaa kaupunkia, kaksi kertaa soturia vahvempi',
  horseman: 'Hyökkäys 2: Kenraali vie sen sotaretkelle kaupunkivaltiota vastaan',
  swordsman: 'Hyökkäys 3: Kenraali vie sen sotaretkelle kaupunkivaltiota vastaan',
  chariot: 'Hyökkäys 4: Kenraali vie sen sotaretkelle kaupunkivaltiota vastaan',
  catapult: 'Hyökkäys 6, muureja vastaan: Kenraali vie sen sotaretkelle',
  library: 'Tieteeseen 50 % lisää',
  temple: 'Rauhoittaa yhden tyytymättömän asukkaan',
  aqueduct: 'Kaupunki voi kasvaa yli koon 10',
  colosseum: 'Rauhoittaa kolme tyytymätöntä asukasta',
  colossus: 'Ihme: +1 kauppa jokaiseen kaupungin ruutuun, jossa on kauppaa',
  gardens: 'Ihme: yksi onnellinen asukas joka kaupunkiin',
  greatwall: 'Ihme: muurin suoja kaikkiin kaupunkeihin',
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
    ...(() => {
      const m = moodOf(c, y);
      return {
        moodText: `Asukkaat: ${m.happy ? `${m.happy} ${m.happy === 1 ? 'onnellinen' : 'onnellista'} · ` : ''}${m.content} ${m.content === 1 ? 'tyytyväinen' : 'tyytyväistä'}${m.unhappy ? ` · ${m.unhappy} ${m.unhappy === 1 ? 'tyytymätön' : 'tyytymätöntä'}` : ''}${m.calmed ? ` (${m.calmed} rauhoitettu)` : ''}${c.entertainers ? ` · ${c.entertainers} ${c.entertainers === 1 ? 'viihdyttäjä' : 'viihdyttäjää'}` : ''}`,
        disorder: m.disorder
          ? 'Levottomuuksia: ei kasvua, tuotantoa, kultaa eikä tiedettä. Neljä asukasta on tyytyväisiä; jokainen kaupungissa oleva sotilas ja temppeli rauhoittavat yhden lisää, ja ylellisyys (Tutkimus-kortissa) tekee asukkaista onnellisia.'
          : null,
      };
    })(),
    foodText: `Ruokaa ${y.food} · asukkaat syövät ${2 * c.size}${settlers ? ` · uudisasukkaat ${settlers}` : ''} · varastossa ${c.food}/${granary(c.size)}`,
    focus: c.focus,
    areaText: `Alue ${rings} ${rings === 1 ? 'rengas' : 'rengasta'}${nextSize ? ` · laajenee koossa ${nextSize}` : ''}`,
    hint: c.size >= sizeLimit(c) ? `Koko ${SIZE_LIMIT} on raja: kaupunki kasvaa vasta vesijohdon kanssa${play!.research.known.has('construction') ? '' : ' (Rakentaminen-tutkimus)'}.`
      : y.surplus <= 1 ? `Kasvaa hitaasti: ${ways.join(', ')}.` : null,
    advisor: play!.cityAdvisor === 'none' ? null : `Neuvonantaja ${CITY_ADVISORS[play!.cityAdvisor].name} hoitaa painotuksen ja rakentamisen.`,
    gold: play?.gold ?? 0,
    income: cityGold(c, y, rates().tax, rates().lux) - c.buildings.reduce((sum, b) => sum + UPKEEP[b], 0),
    research: researchLine(),
    buy: price ? { name: BUILDS[c.build].name, price, can: price <= (play?.gold ?? 0) } : null,
    buildings: c.buildings.map(b => BUILDS[b].name),
    kicker: `${c.capital ? 'Pääkaupunki' : 'Kaupunki'} · ${nameOf(2, regions.tileTable()[c.tile]).name}`,
    name: c.name,
    size: c.size,
    growth: c.food / granary(c.size),
    growText: y.surplus < 0 ? 'nälkää' : c.size >= sizeLimit(c) ? 'vesijohto puuttuu' : grow === null ? 'ei kasva' : `kasvaa ${grow} pv`,
    yields: [y.surplus, y.shield, y.trade],
    builds: (Object.keys(BUILDS) as Build[]).filter(kind => !(isBuilding(kind) && c.buildings.includes(kind)) && !(isWonder(kind) && hasWonder(kind))).map(kind => {
      const b = BUILDS[kind];
      const ready = daysToBuild({ ...c, build: kind }, y);
      const need = NEEDS[kind];
      const locked = need !== undefined && !play!.research.known.has(need);
      return {
        kind, name: b.name, selected: kind === c.build, locked,
        cost: kind === 'coinage' ? 'Tuotanto kullaksi' : `${b.cost} tuotantoa${b.pop ? ` ja ${b.pop} asukas` : ''}${isBuilding(kind) && UPKEEP[kind] ? `, ${UPKEEP[kind]} ${UPKEEP[kind] === 1 ? 'kulta' : 'kultaa'}/pv` : ''}`, purpose: BUILD_PURPOSE[kind],
        eta: locked && need ? `vaatii: ${ADVANCES[need].name}` : kind === 'coinage' ? `+${Math.max(0, y.shield)} kultaa/pv` : ready === null ? 'ei tuotantoa' : c.size <= b.pop ? `vaatii koon ${b.pop + 1}` : ready === 0 ? 'valmis huomenna' : `valmis ${ready} pv`,
      };
    }),
  };
}

/** The open city's card, at the city-area level and not over a discovery. */
function updateCityCard() {
  if (!play) return;
  const id = play.openCity;
  if (id === null || viewLevel !== 3 || discoveryCard.visible || researchCard.visible || listCard.visible || advisorCard.visible) {
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
    // Kolossi adds a trade where there is trade, and the government may take one (STORY-047)
    const y = tileOutput(c, yieldOf(t, t === c.tile), play!.gov);
    return { x: at?.[0] ?? null, y: at?.[1] ?? null, food: y.food, shield: y.shield, trade: y.trade, centre: t === c.tile };
  }));
}

// ─── Advisors (STORY-049, STORY-050, STORY-051) ───
// The advisors of the city area, province and state levels run their level each day
// (advisors.ts). The higher level goes first: the state's target, then the province's
// builds and expeditions, then the city's.

/** Builds a city may start: known, not built, and no wonder another city has. */
const startable = (c: City) => (Object.keys(BUILDS) as Build[]).filter(kind =>
  !(isBuilding(kind) && c.buildings.includes(kind)) && !(isWonder(kind) && hasWonder(kind)) && (NEEDS[kind] === undefined || play!.research.known.has(NEEDS[kind]!)));

type AdvisorLevel = 'city' | 'province' | 'state' | 'planet';

function advise(text: string, level: AdvisorLevel = 'city') {
  const log = level === 'city' ? 'advisorLog' : level === 'province' ? 'provinceLog' : level === 'state' ? 'stateLog' : 'planetLog';
  play![log] = [`Päivä ${clock.day}: ${text}`, ...play![log]].slice(0, 4);
}

/** The best city site among the mapped land of an area (STORY-050). */
const bestSite = (area: number) => {
  if (!tilesOfArea.has(area)) tilesOfArea.set(area, cityTiles(regions, area));
  return Math.max(0, ...tilesOfArea.get(area)!.filter(t => mapState.isMapped(t) && Number.isFinite(world.cost(t))).map(world.siteScore));
};

function advisorDay() {
  const p = play;
  if (!p) return;
  p.units.keepHome = p.provinceAdvisor === 'defend';
  if (p.planetAdvisor !== 'none') planetAdvisorDay();
  if (p.cityAdvisor === 'none' && p.provinceAdvisor === 'none' && p.stateAdvisor === 'none') return;
  const home = p.units.homeProvince;
  const homeAreas = Array.from({ length: 7 }, (_, k) => home * 7 + k);
  // The campaign first: a city taken today gets its yields with the others
  if (p.stateAdvisor === 'war') warDay();
  const yields = cityYields();
  if (p.stateAdvisor !== 'none') stateAdvisorDay(p.stateAdvisor, yields);
  p.cities.forEach((c, i) => {
    const soldiers = soldiersIn(c.tile).length;
    const available = startable(c);
    const luxury = cityLuxury(c, yields[i], rates().tax, rates().lux);
    const bigger = cityMood({ ...c, size: c.size + 1 }, soldiers, p.cities.length, hasWonder('gardens'), luxury, p.gov);
    const advice = cityAdvice(p.cityAdvisor, c, {
      available, soldiers, unrestNear: !!yields[i].disorder || bigger.disorder, disorder: !!yields[i].disorder,
      threat: p.raids.band?.city === c.tile, soldier: bestSoldier(), settlers: supportOf(c).settlers,
    });
    if (advice && c.focus !== advice.focus) c.focus = advice.focus;
    const border = tilesInRings(c.tile, 3).some(t => Math.floor(world.cityOf(t) / 7) !== home);
    const ordered = provinceBuild(p.provinceAdvisor, { soldiers, border, available, soldier: bestSoldier(), walls: hasWalls(c) });
    // The state's campaign goes first (STORY-064), then the province's builds
    const war = p.stateAdvisor === 'war' ? warBuild(c, available) : null;
    const build = war ?? ordered ?? advice?.build ?? null;
    // A settler for a waiting city site is not changed
    if (build && build !== c.build && !(c.build === 'settler' && p.pendingSite !== null)) {
      c.build = build;
      advise(`${c.name} rakentaa: ${BUILDS[build].name}`, war ? 'state' : ordered ? 'province' : 'city');
    }
    // In disorder a city makes no shields: the Kasvattaja buys the calm (STORY-060), at half the treasury at most
    if (p.cityAdvisor === 'growth' && yields[i].disorder && (c.build === 'temple' || c.build === 'colosseum')) {
      const price = buyCost(c);
      if (price > 0 && price * 2 <= p.gold && buy(c, p.gold)) {
        p.gold -= price;
        advise(`${c.name} osti: ${BUILDS[c.build].name} (${price} kultaa)`);
      }
    }
  });
  if (p.provinceAdvisor === 'settle') {
    const withCity = new Set(p.cities.map(c => world.cityOf(c.tile)));
    const chosen = settleAreas(homeAreas.map(area => ({ area, hasCity: withCity.has(area), share: areaShare(area), best: bestSite(area) })));
    for (const area of homeAreas) {
      const plan = chosen.includes(area) ? 'settle' : 'explore';
      if ((p.units.areaPlans.get(area) ?? 'explore') === plan) continue;
      p.units.setAreaPlan(area, plan, world);
      if (plan === 'settle') advise(`${nameOf(2, area).name} asutettavaksi`, 'province');
    }
  }
  if (p.provinceAdvisor === 'explore') {
    for (const area of homeAreas) if (p.units.areaPlans.get(area) === 'skip') p.units.setAreaPlan(area, 'explore', world);
    if (p.units.flag === null) {
      // The home province first, then the home state
      const areas = provinceShare(home) < UNLOCK_SHARE ? homeAreas : Array.from({ length: 49 }, (_, k) => Math.floor(home / 7) * 49 + k);
      const from = tileCenter(p.units.camp);
      const target = expeditionTarget(areas.map(area => ({ area, share: areaShare(area), distance: from.angleTo(regions.centers[2][area]) })), UNLOCK_SHARE);
      if (target !== null && p.units.sendTo(pointToTile(regions.centers[2][target]), world)) advise(`retkikunta kohti: ${nameOf(2, target).name}`, 'province');
    }
  }
  if (p.cityAdvisor === 'explore') {
    for (const u of p.units.units) if (u.kind === 'scout' && u.mode !== 'explore') p.units.setMode(u, 'explore');
    if (p.units.flag === null) {
      const shares = homeAreas.filter(area => p.units.areaPlans.get(area) !== 'skip').map(area => [area, areaShare(area)] as const);
      const target = exploreTarget(shares);
      if (target !== null && p.units.sendTo(pointToTile(regions.centers[2][target]), world)) advise(`tiedustelijat kohti: ${nameOf(2, target).name}`);
    }
  }
  if (p.cityAdvisor === 'growth' && p.pendingSite === null) {
    for (const u of p.units.units) {
      if (u.kind !== 'settler' || u.home === null || u.task !== 'found' || (p.units.founding && u === p.units.settler)) continue;
      p.units.setTask(u, 'improve', world);
      advise(`${u.name} kehittää maata`);
    }
  }
}

/** Land tiles of each state, counted once (STORY-057). */
const stateLand = new Map<number, number>();
function landOf(state: number): number {
  if (!stateLand.has(state)) {
    const table = regions.tileTable();
    let n = 0;
    for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / 49) === state && Number.isFinite(world.cost(id))) n++;
    stateLand.set(state, n);
  }
  return stateLand.get(state)!;
}
/** Tiles of each state, for its mapped share. */
const stateTilesOf = new Map<number, number[]>();
function stateShare(state: number): number {
  return mapState.share(tilesOfState(state));
}
function tilesOfState(state: number): number[] {
  if (!stateTilesOf.has(state)) {
    const table = regions.tileTable();
    const ids: number[] = [];
    for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / 49) === state) ids.push(id);
    stateTilesOf.set(state, ids);
  }
  return stateTilesOf.get(state)!;
}

/** Make a state the target: the expedition goes there (STORY-057). */
function setTargetState(state: number, by: AdvisorLevel | null) {
  const p = play!;
  if (p.targetState === state) return;
  p.targetState = state;
  p.units.sendTo(pointToTile(regions.centers[0][state]), world);
  if (by) advise(`kohdevaltio: ${stateNameOf(state).name}`, by);
}

/** The planet advisor's day: a new target once the old one is conquered or none is set. */
function planetAdvisorDay() {
  const p = play!;
  const won = conquestNow();
  if (p.targetState >= 0 && !won.conquered.has(p.targetState) && won.open.has(p.targetState)) return;
  const target = planetTarget(p.planetAdvisor, [...won.open].map(state => ({ state, land: landOf(state), mapped: stateShare(state), conquered: won.conquered.has(state) })));
  if (target !== null) setTargetState(target, 'planet');
}

/** The state advisor's day (STORY-051): the line, taxes, science, revolution, luxury, the target and buying. */
function stateAdvisorDay(a: Exclude<StateAdvisor, 'none'>, yields: CityYield[]) {
  const p = play!;
  const plan = STATE_PLANS[a];
  if (p.units.stateLine !== plan.line) p.units.setStateLine(plan.line, world);
  if (p.gov !== 'anarchy') p.tax = plan.tax;
  if (p.research.target === null) {
    const next = nextAdvance(plan.order, p.research.available());
    if (next) {
      p.research.target = next;
      advise(`tutkitaan: ${ADVANCES[next].name}`, 'state');
    }
  }
  if (startRevolution()) advise('vallankumous Monarkiaan', 'state');
  // Luxury a step up while a city is in disorder, a step down after calm days
  const disorder = yields.some(y => y.disorder);
  p.calmDays = disorder ? 0 : p.calmDays + 1;
  const lux = luxuryStep(p.lux, disorder, p.calmDays, LUX_RATES);
  if (lux !== p.lux) {
    p.lux = lux;
    p.calmDays = 0;
    advise(`ylellisyys ${lux} %`, 'state');
  }
  if (a === 'expand') {
    // The nearest province without a city: the home state's first, then the open states' (STORY-016)
    const current = p.targetProvince;
    const won = conquestNow();
    if (current < 0 || won.held.has(current)) {
      const aim = p.targetState >= 0 && won.open.has(p.targetState) && !won.conquered.has(p.targetState) ? [p.targetState] : null;
      const states = !won.conquered.has(homeState()) ? [homeState()] : aim ?? [...won.open];
      const from = tileCenter(p.units.camp);
      const provinces = states.flatMap(s => Array.from({ length: 7 }, (_, k) => s * 7 + k));
      const target = expeditionTarget(provinces.map(id => ({ area: id, share: won.held.has(id) ? 1 : 0, distance: from.angleTo(regions.centers[1][id]) })), 1);
      if (target !== null && target !== current) {
        p.targetProvince = target;
        p.units.sendTo(pointToTile(regions.centers[1][target]), world);
        advise(`tavoitelääni: ${nameOf(1, target).name}`, 'state');
      }
    }
  }
  if (a === 'war') {
    for (const c of p.cities) {
      if (p.raids.band?.city !== c.tile || !(isSoldier(c.build) || c.build === 'walls')) continue;
      const price = buy(c, p.gold);
      if (!price) continue;
      p.gold -= price;
      advise(`osti: ${c.name} · ${BUILDS[c.build].name} (${price} kultaa)`, 'state');
    }
  }
}

/** The level whose advisor the card and the button show: the city area, the province or the state, else none. */
const advisorLevel = (): AdvisorLevel | null => (viewLevel === 3 ? 'city' : viewLevel === 2 ? 'province' : viewLevel === 1 ? 'state' : 'planet');

const advisorCard = createAdvisorCard(hud_root, {
  close: () => { if (play) play.advisorOpen = false; },
  choose: (id: string) => {
    const level = advisorLevel();
    if (!play || !level) return;
    if (level === 'city' && (CITY_ADVISOR_LIST as readonly string[]).includes(id)) {
      play.cityAdvisor = id as CityAdvisor;
      play.advisorLog = [];
    } else if (level === 'province' && (PROVINCE_ADVISOR_LIST as readonly string[]).includes(id)) {
      play.provinceAdvisor = id as ProvinceAdvisor;
      play.provinceLog = [];
    } else if (level === 'state' && (STATE_ADVISOR_LIST as readonly string[]).includes(id)) {
      play.stateAdvisor = id as StateAdvisor;
      play.stateLog = [];
    } else if (level === 'planet' && (PLANET_ADVISOR_LIST as readonly string[]).includes(id)) {
      play.planetAdvisor = id as PlanetAdvisor;
      play.planetLog = [];
    }
  },
});

function updateAdvisorCard() {
  const level = advisorLevel();
  if (!play || !play.advisorOpen || !level || discoveryCard.visible) {
    if (advisorCard.visible) advisorCard.hide();
    return;
  }
  const view = level === 'city' ? {
    level: 'Kaupunkialue',
    options: CITY_ADVISOR_LIST.map(id => ({ id, name: CITY_ADVISORS[id].name, does: CITY_ADVISORS[id].does, selected: id === play!.cityAdvisor })),
    log: play.advisorLog,
  } : level === 'province' ? {
    level: 'Lääni',
    options: PROVINCE_ADVISOR_LIST.map(id => ({ id, name: PROVINCE_ADVISORS[id].name, does: PROVINCE_ADVISORS[id].does, selected: id === play!.provinceAdvisor })),
    log: play.provinceLog,
  } : level === 'state' ? {
    level: 'Valtio',
    options: STATE_ADVISOR_LIST.map(id => ({ id, name: STATE_ADVISORS[id].name, does: STATE_ADVISORS[id].does, selected: id === play!.stateAdvisor })),
    log: play.stateLog,
  } : {
    level: 'Planeetta',
    options: PLANET_ADVISOR_LIST.map(id => ({ id, name: PLANET_ADVISORS[id].name, does: PLANET_ADVISORS[id].does, selected: id === play!.planetAdvisor })),
    log: play.planetLog,
  };
  if (advisorCard.visible) advisorCard.update(view);
  else advisorCard.show(view);
}

// ─── The list of cities and units (STORY-042) ─────
const KIND_NAMES: Record<string, string> = { scout: 'tiedustelija', settler: 'uudisasukas', warrior: 'soturi', phalanx: 'falangi', horseman: 'ratsumies', swordsman: 'miekkamies', chariot: 'sotavaunut', catapult: 'katapultti' };

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
        line: [...(y.disorder ? ['LEVOTTOMUUKSIA'] : []), `${BUILDS[c.build].name} · ${when}`, `ruokaa ${y.surplus < 0 ? '−' : '+'}${Math.abs(y.surplus)}`, ...(c.buildings.length ? [c.buildings.map(b => BUILDS[b].name).join(', ')] : [])].join(' · '),
      };
    }),
    units: play!.units.units.map((u, index) => ({
      index, name: u.name, kind: KIND_NAMES[u.kind],
      line: unitStatus(play!.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name),
    })),
    economy: economyRows(yields),
  };
}

const signed = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;

/** The economy tab (STORY-048): the realm's day in total, then city by city. */
function economyRows(yields: CityYield[]): ListView['economy'] {
  const p = play!;
  const worked = workedByCity();
  const days: CityEconomy[] = p.cities.map((c, i) => {
    const y = yields[i];
    const unitUpkeep = y.disorder ? 0 : Math.max(0, supportOf(c).units - GOVERNMENTS[p.gov].freeUnits);
    return {
      food: y.food, surplus: y.surplus, shield: Math.max(0, y.shield) + unitUpkeep, unitUpkeep, trade: y.trade,
      gold: cityGold(c, y, rates().tax, rates().lux), coinage: c.build === 'coinage' && !y.disorder ? Math.max(0, y.shield) : 0,
      science: cityScience(c, y, rates().tax, rates().lux), luxury: cityLuxury(c, y, rates().tax, rates().lux),
      buildingUpkeep: c.buildings.reduce((sum, b) => sum + UPKEEP[b], 0),
      resources: worked[i].filter(t => tileTypes.codes[t] & 16).map(t => RESOURCES[TERRAIN_RULES[terrainOf(t)].resource].name),
    };
  });
  const e = economy(days);
  const split = p.gov === 'anarchy' ? 'anarkia: kaikki ylellisyyteen' : `vero ${p.tax} %, ylellisyys ${p.lux} %`;
  return [
    { title: 'Kassa', right: `${p.gold} kultaa`, line: `tulot +${e.gold}/pv · rakennusten ylläpito −${e.buildingUpkeep}/pv · yhteensä ${signed(e.net)}/pv` },
    ...(p.cities.length ? [
      { title: 'Ruoka', right: `+${e.food}/pv`, line: `asukkaat ja uudisasukkaat syövät ${e.food - e.surplus} · ylijäämä ${signed(e.surplus)} kasvuun` },
      { title: 'Tuotanto', right: `+${e.shield}/pv`, line: `yksiköiden ylläpito −${e.unitUpkeep}${e.coinage ? ` · Kultaa-tuotannosta kultaa +${e.coinage}` : ''}` },
      { title: 'Kauppa', right: `+${e.trade}/pv`, line: `kultaa +${e.gold - e.coinage} · tiedettä +${e.science} · ylellisyyttä +${e.luxury} (${split})` },
      { title: 'Erikoisresurssit', right: `${e.resources.reduce((n, r) => n + r[1], 0)} ruutua`, line: e.resources.length ? e.resources.map(([name, n]) => `${name} ${n}`).join(' · ') : 'Kaupungit eivät vielä työstä erikoisresursseja.' },
      ...p.cities.map((c, i) => ({
        title: c.name, right: `Koko ${c.size}`,
        line: `ruokaa +${days[i].food} · tuotantoa +${days[i].shield} · kauppaa +${days[i].trade} · kultaa +${days[i].gold} · tiedettä +${days[i].science}`,
      })),
    ] : [{ title: 'Ei vielä kaupunkeja', right: '', line: 'Kaupungit tuovat ruokaa, tuotantoa ja kauppaa. Uudisasukas perustaa kaupungin.' }]),
  ];
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
    advisor: play.cityAdvisor !== 'none' || play.provinceAdvisor !== 'none' || play.stateAdvisor !== 'none',
    monarchy: play.gov === 'monarchy',
    provinces: heldIn(conquestNow(), homeState()),
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
  if (!play) return { science: 0, luxury: 0, gold: 0 };
  const yields = cityYields();
  return {
    science: play.cities.reduce((sum, c, i) => sum + cityScience(c, yields[i], rates().tax, rates().lux), 0),
    luxury: play.cities.reduce((sum, c, i) => sum + cityLuxury(c, yields[i], rates().tax, rates().lux), 0),
    gold: play.cities.reduce((sum, c, i) => sum + cityGold(c, yields[i], rates().tax, rates().lux) - c.buildings.reduce((u, b) => u + UPKEEP[b], 0), 0),
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
  setLux: (lux: number) => { if (play) play.lux = lux; },
  revolution: () => { startRevolution(); },
});

/** A revolution to Monarchy once it is known: some days of anarchy first (STORY-047). */
function startRevolution(): boolean {
  if (!play || !game || play.gov !== 'despotism' || !play.research.known.has('monarchy')) return false;
  play.gov = 'anarchy';
  play.anarchyUntil = clock.day + revolutionDays(game.seed, clock.day);
  discoveryCard.notice(`Vallankumous: anarkiaa ${play.anarchyUntil - clock.day} pv, sitten Monarkia`);
  return true;
}

/** The government and what it means (STORY-047). */
function governmentLine(): string {
  const p = play!;
  if (p.gov === 'anarchy') return `Hallitus: Anarkia vielä ${Math.max(1, p.anarchyUntil - clock.day)} pv · ei veroja eikä tiedettä, kaikki kauppa ylellisyyteen`;
  if (p.gov === 'monarchy') return 'Hallitus: Monarkia · ruudut tuottavat täysin, ei ilmaisia yksiköitä, sotilaat rauhoittavat enintään kolme';
  return `Hallitus: ${GOVERNMENTS.despotism.name} · ruudun yli kahden tuotosta menee yksi hukkaan${p.research.known.has('monarchy') ? '' : '. Monarkia-tutkimus avaa paremman.'}`;
}

function researchView(): ResearchView {
  const r = play!.research;
  const rates = scienceRates();
  const days = r.target && rates.science > 0 ? Math.max(1, Math.ceil((r.cost - r.bulbs) / rates.science)) : null;
  // What an advance opens: the buildings that need it, and the advances that need it
  const opens = (a: Advance) => [
    ...(Object.keys(NEEDS) as Build[]).filter(b => NEEDS[b] === a).map(b => BUILDS[b].name),
    ...(Object.keys(ADVANCES) as Advance[]).filter(n => ADVANCES[n].needs.includes(a)).map(n => `tutkimuksen ${ADVANCES[n].name}`),
    ...(a === 'monarchy' ? ['hallitusmuodon Monarkia'] : []),
    ...(a === 'mapmaking' ? ['kulun rannikkovesillä'] : []),
  ];
  return {
    rates: `Tiedettä +${rates.science}/pv · kultaa ${rates.gold < 0 ? '−' : '+'}${Math.abs(rates.gold)}/pv${rates.luxury ? ` · ylellisyyttä +${rates.luxury}` : ''}`,
    current: r.target
      ? `Tutkitaan: ${ADVANCES[r.target].name} · ${Math.min(r.bulbs, r.cost)}/${r.cost}${days ? ` · valmis ${days} pv` : ''}`
      : 'Valitse, mitä tutkitaan. Tiede kertyy odottamaan.',
    progress: r.cost ? r.bulbs / r.cost : 0,
    hint: rates.science > 0 ? null : 'Tiedettä ei tule: tiede syntyy kaupasta. Kauppaa tuovat tiet ruoho-, tasanko- ja aavikkomaalla (uudisasukas: Kehitä) ja meriruudut; pienempi kullan osuus siirtää kauppaa tieteeseen.',
    options: r.available().map(a => ({ advance: a, name: ADVANCES[a].name, cost: `${r.cost} tiedettä`, opens: `Avaa: ${opens(a).join(', ')}`, selected: a === r.target })),
    tax: play!.tax,
    lux: play!.lux,
    government: governmentLine(),
    revolution: play!.gov === 'despotism' && play!.research.known.has('monarchy'),
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

// ─── Ruins (STORY-027, STORY-052) ─────────────────
// About one land tile in 180 holds ruins (from the seed). The scout that maps them opens
// them at once: gold, an advance, a soldier or rarely a scout (discoveries.ts). The card
// stops the game for city sites and bandits only.
const discoveryCard = createDiscoveryCard(hud_root, index => {
  if (!play) return;
  if (shownCard === 'site') chooseSite(index);
  else if (shownCard === 'raid') chooseRaid(index);
});

/** Open ruins: what they hold comes to the player, with a notice and a glow on the tile. */
function openRuin(tile: number, finder: number) {
  if (!play || !game) return;
  const { kind, pick } = ruinAt(game.seed, tile);
  const who = play.units.units.find(u => u.id === finder)?.name ?? 'Tiedustelija';
  const gold = (n: number) => { play!.gold += n; return `${n} kultaa`; };
  let got: string;
  if (RUIN_GOLD[kind]) got = gold(RUIN_GOLD[kind]!);
  else if (kind === 'advance') {
    const can = play.research.available();
    const a = can[Math.min(can.length - 1, Math.floor(pick * can.length))];
    if (a) {
      play.research.known.add(a);
      if (play.research.target === a) play.research.target = null;
      got = `keksintö ${ADVANCES[a].name}`;
    } else got = gold(CONSOLATION_GOLD);
  } else if (kind === 'soldier') {
    // Soldiers stay in a city, so the band joins the capital (Freeciv: on the hut's tile)
    const capital = play.cities[0];
    if (capital) {
      const soldier = bestSoldier();
      play.units.spawn(soldier, capital.tile, world, null);
      got = `${soldier === 'phalanx' ? 'falangi' : 'soturi'} liittyi kaupunkiin ${capital.name}`;
    } else got = gold(CONSOLATION_GOLD);
  } else got = `${play.units.recruit(tile, world).name} liittyi joukkoon`;
  play.found++;
  moment('find', tile);
  discoveryCard.notice(`Rauniot · ${who}: ${got}`);
}

function noteDiscoveries(fresh: number[]) {
  if (!play || !game) return;
  for (const tile of discoveriesOn ? fresh : []) {
    if (!Number.isFinite(world.cost(tile)) || !isRuin(game.seed, tile)) continue;
    // The finder is the scout nearest to the tile
    const at = tileCenter(tile);
    let finder = 0, best = Infinity;
    for (const u of play.units.units) {
      const a = u.kind === 'scout' ? tileCenter(u.tile).angleTo(at) : Infinity;
      if (a < best) { best = a; finder = u.id; }
    }
    openRuin(tile, finder);
  }
  noteSiteOffer(fresh);
}

/** Which card is shown: a site offer's or a raid's. */
let shownCard: 'site' | 'raid' | null = null;

function updateSiteOffer() {
  if (!play) return;
  const o = play.offers[0];
  if (!o) {
    updateRaidAlert();
    return;
  }
  // The Asuttaja takes the site itself (STORY-050)
  if (play.provinceAdvisor === 'settle') {
    chooseSite(0);
    advise(`kaupunkipaikka hyväksytty: ${nameOf(2, regions.tileTable()[o.tile]).name}`, 'province');
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

// ─── Raids (STORY-034) ────────────────────────────
// From day 60 bandits rise 5 to 8 tiles from a city and march on it (raids.ts). Their
// first sight stops the game; the soldiers in the city fight them one by one.

/** Soldiers in the city on a tile. */
const soldiersIn = (tile: number) => (play ? play.units.units.filter(u => (u.kind === 'warrior' || u.kind === 'phalanx') && u.tile === tile) : []);
/** A soldier's defense: Militia 1, Phalanx 2 (Freeciv civ1 units.ruleset). */
const defenseOf = (kind: string) => (kind === 'phalanx' ? 2 : 1);
/** The best soldier a city can build now (STORY-043). */
const bestSoldier = (): 'warrior' | 'phalanx' => (play?.research.known.has('bronze') ? 'phalanx' : 'warrior');

const raidWorld: RaidWorld = {
  cost: id => world.cost(id),
  terrainOf,
  walls: tile => { const c = play?.cities.find(x => x.tile === tile); return c ? hasWalls(c) : false; },
  defenders: tile => soldiersIn(tile).length,
  defense: tile => Math.max(1, ...soldiersIn(tile).map(u => defenseOf(u.kind))),
  // The best defender fights, and falls
  loseDefender: tile => {
    const soldiers = soldiersIn(tile);
    const best = soldiers.reduce((a, b) => (defenseOf(b.kind) > defenseOf(a.kind) ? b : a));
    play!.units.disband(best, world);
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
// ─── Campaigns (STORY-064) ────────────────────────
// The Kenraali sends an army against the nearest city-state of an open state: the three cities
// nearest to it build attackers, which gather in the nearest; it sets off once it can expect
// to beat the defenders, and takes the city.
const army = () => play!.units.units.filter(u => isAttacker(u.kind));
const stagingCity = (tile: number) => {
  const at = tileCenter(tile);
  return play!.cities.reduce<City | null>((best, c) => (!best || tileCenter(c.tile).angleTo(at) < tileCenter(best.tile).angleTo(at) ? c : best), null);
};
/** The cities that build the army: the three nearest to the target (one alone could not pay for it in a long game). */
const armyCities = (tile: number) => {
  const at = tileCenter(tile);
  return play!.cities.map(c => [tileCenter(c.tile).angleTo(at), c] as const).sort((a, b) => a[0] - b[0]).slice(0, 3).map(([, c]) => c);
};
const unitPath = (from: number, to: number) => findPath(from, to, id => world.travel!(id));
/** Campaign paths found not to exist, by city, target and sea travel: a search for one costs up to 20 000 tiles (not saved). */
const noWay = new Set<string>();
function reachable(from: number, to: number): boolean {
  const key = `${from}>${to}>${canSail()}`;
  if (noWay.has(key)) return false;
  if (unitPath(from, to) !== null) return true;
  noWay.add(key);
  return false;
}

const warWorld: WarWorld = {
  defence: tile => {
    const n = nativeAt(tile);
    // A tribe's camp: its band, defense 1 (Cavalry and Legion)
    if (!n) return { full: tribeBand(game!.seed, tribeAt(tile)!.tribe, clock.day).size, defense: 1, walls: false, terrain: terrainOf(tile) };
    const s = nativeStrength(n, clock.day);
    return { full: s.defenders, defense: defenseOf(s.defender), walls: s.walls, terrain: terrainOf(tile) };
  },
  path: unitPath,
  roll: k => warRoll(game!.seed, clock.day, k),
  lose: u => play!.units.disband(u, world),
  // Freeciv: the city loses a citizen, and one of size 1 is destroyed
  take: (tile, u) => {
    const p = play!;
    const n = nativeAt(tile);
    // A tribe scattered pays the ransom (STORY-066)
    if (!n) {
      p.war.routed.add(tribeAt(tile)!.tribe.state);
      p.gold += RANSOM_GOLD;
      return 'routed';
    }
    const size = nativeStrength(n, clock.day).size;
    if (size <= 1) return 'razed';
    const c = foundCity(p.cities, tile);
    Object.assign(c, { name: n.name, size: size - 1, native: true });
    u.tile = tile;
    u.path = [];
    reveal(tilesInRings(tile, CITY_RINGS));
    return 'taken';
  },
};

/** The Kenraali's campaign day: the target, the army gathering, and the fights. */
function warDay() {
  const p = play!;
  // City-states and the camps of the tribes (STORY-066)
  const open = [...visibleNatives(), ...visibleTribes().map(t => ({ tile: t.camp, state: t.tribe.state, name: t.tribe.name }))].filter(n => p.units.isOpen(n.tile, world));
  if (p.war.target === null || !open.some(n => n.tile === p.war.target)) {
    // The planet's target state first, then the nearest to the capital that the army can reach
    const aim = open.filter(n => n.state === p.targetState);
    const from = tileCenter(p.cities[0]?.tile ?? p.units.camp);
    const near = (aim.length ? aim : open).sort((a, b) => from.angleTo(tileCenter(a.tile)) - from.angleTo(tileCenter(b.tile)));
    const next = near.slice(0, 3).find(n => { const c = stagingCity(n.tile); return c !== null && reachable(c.tile, n.tile); }) ?? null;
    p.war.setTarget(next?.tile ?? null);
    if (next) advise(`sotaretken kohde: ${next.name}`, 'state');
  }
  const target = p.war.target;
  if (target === null) {
    // None in sight: the scouts look for the nearest of an open state (the Puolustus line keeps them home otherwise)
    const from = tileCenter(p.cities[0]?.tile ?? p.units.camp);
    const hidden = natives.filter(n => !nativeGone(n) && !mapState.isMapped(n.tile) && p.units.isOpen(n.tile, world))
      .sort((a, b) => from.angleTo(tileCenter(a.tile)) - from.angleTo(tileCenter(b.tile)));
    if (p.units.flag === null && hidden.length && p.units.sendTo(hidden[0].tile, world)) advise(`tiedustelijat etsivät kaupunkivaltiota kohti ${directionName(p.cities[0]?.tile ?? p.units.camp, hidden[0].tile)}`, 'state');
    return;
  }
  const name = nativeAt(target)?.name ?? tribeAt(target)!.tribe.name;
  const troops = army();
  // Before the march the army gathers in the city nearest to the target, and gold buys
  // attackers, at half the treasury at most
  const camp = stagingCity(target);
  const need = warNeed(target);
  if (!p.war.marching && camp && troops.length < need) {
    for (const u of troops) if (u.tile !== camp.tile && !u.path.length) u.path = unitPath(u.tile, camp.tile) ?? [];
    for (const c of armyCities(target)) {
      const price = buyCost(c);
      if (!isAttacker(c.build) || price <= 0 || price * 2 > p.gold || !buy(c, p.gold)) continue;
      p.gold -= price;
      advise(`osti: ${c.name} · ${BUILDS[c.build].name} (${price} kultaa)`, 'state');
    }
  }
  const events = p.war.day(troops, warWorld, clock.day, need);
  if (!events.length) return;
  discoveryCard.notice(`${warNotice(events)} · ${name}`);
  moment(events.some(e => e === 'lost' || e === 'razed') ? 'raid' : 'victory', target);
  if (events.includes('taken')) advise(`${name} vallattu`, 'state');
  if (events.includes('razed')) advise(`${name} tuhoutui`, 'state');
  if (events.includes('routed')) advise(`${name} hajosi · ${RANSOM_GOLD} kultaa lunnaita`, 'state');
}

/** Attackers the Kenraali gathers against a city-state, by the odds of the strongest attacker known. */
function warNeed(target: number): number {
  const d = warWorld.defence(target);
  const best = [...ATTACKERS].reverse().find(k => play!.research.known.has(NEEDS[k]!)) ?? 'horseman';
  return armyNeeded(play!.war.left(target, d.full, clock.day), attackWins(ATTACK[best], d.terrain, d.walls, d.defense));
}

/** What the Kenraali has the cities nearest to the target build: the strongest attacker they can, until the army is big enough. */
function warBuild(c: City, available: Build[]): Build | null {
  const p = play!;
  const target = p.war.target;
  if (target === null || p.war.marching || !armyCities(target).includes(c)) return null;
  if (army().length >= warNeed(target)) return null;
  return [...ATTACKERS].reverse().find(k => available.includes(k)) ?? null;
}

function warNotice(events: WarEvent[]): string {
  const n = (e: WarEvent) => events.filter(x => x === e).length;
  return [
    n('won') === 1 ? 'Hyökkääjä kaatoi puolustajan' : n('won') ? `Hyökkääjät kaatoivat ${n('won')} puolustajaa` : '',
    n('lost') === 1 ? 'Hyökkääjä kaatui' : n('lost') ? `${n('lost')} hyökkääjää kaatui` : '',
    n('taken') ? 'Kaupunki vallattu: se on nyt sinun' : '',
    n('razed') ? 'Kaupunki tuhoutui valtauksessa' : '',
    n('routed') ? `Heimo hajosi: ${RANSOM_GOLD} kultaa lunnaita` : '',
  ].filter(Boolean).join(' · ');
}

function raidNotice(events: RaidEvent[], nomads = false): string {
  const n = (e: RaidEvent) => events.filter(x => x === e).length;
  const [one, many, some] = nomads ? ['Paimentolainen', 'Paimentolaiset', 'paimentolaista'] : ['Rosvo', 'Rosvot', 'rosvoa'];
  return [
    n('won') === 1 ? `${one} kaatoi soturin` : n('won') ? `${many} kaatoivat ${n('won')} soturia` : '',
    n('repelled') === 1 ? `Soturi torjui ${nomads ? 'paimentolaisen' : 'rosvon'}` : n('repelled') ? `Soturit torjuivat ${n('repelled')} ${some}` : '',
    n('plundered') ? `${many} ryöstivät kaupungin` : '',
  ].filter(Boolean).join(' · ');
}

/** A day of the band, then perhaps a new uprising against a city. */
function raidDay() {
  if (!play || !game) return;
  const band = play.raids.band;
  const city = band && play.cities.find(c => c.tile === band.city);
  const events = play.raids.day(raidWorld);
  if (city && events.length) {
    discoveryCard.notice(`${raidNotice(events, !!band.tribe)} · ${city.name}`);
    moment(events.includes('plundered') || events.includes('won') ? 'raid' : 'victory', city.tile);
  }
  if (play.raids.band || !raidsOn || !play.cities.length) return;
  for (const t of tribesNow()) if (tribeRaids(game.seed, t.tribe, clock.day) && sendTribe(t)) return;
  if (!uprising(game.seed, clock.day, play.cities.length)) return;
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
  // The Vartija answers the card itself: the city builds a soldier (STORY-049)
  if (play.cityAdvisor === 'defend') {
    const c = play.cities.find(x => x.tile === band.city);
    chooseRaid(0);
    if (c) advise(`${c.name} rakentaa sotilaan rosvoja vastaan`);
    return;
  }
  if (!discoveryCard.visible) {
    shownCard = 'raid';
    moment('raid', lead);
    const c = play.cities.find(x => x.tile === band.city)!;
    const soldiers = soldiersIn(c.tile).length;
    const soldier = bestSoldier();
    const ready = daysToBuild({ ...c, build: soldier }, cityYields()[play.cities.indexOf(c)]);
    const n = band.bandits.length;
    discoveryCard.show({
      day: clock.day,
      kicker: `Uhka · ${c.name}`,
      title: band.tribe ? `${band.tribe} hyökkää` : 'Rosvoja liikkeellä',
      body: `${band.tribe ? `${n} paimentolaista` : n === 1 ? 'Rosvo' : `${n} rosvoa`} on matkalla kohti kaupunkia ja perillä noin ${play.raids.daysToCity(id => world.cost(id))} päivässä. ${soldiers ? `Kaupungissa on ${soldiers} soturi${soldiers === 1 ? '' : 'a'}.` : 'Kaupungissa ei ole sotureita.'}`,
      options: [
        { kind: 'defend', title: 'Rakenna soturi', effect: ready === null ? 'Kaupungilla ei ole tuotantoa' : `Valmis ${Math.max(1, ready)} pv` },
        { kind: 'later', title: 'Luota puolustukseen', effect: soldiers ? `Soturi voittaa ${band.tribe ? 'paimentolaisen' : 'rosvon'} ${Math.round((1 - banditWins(terrainOf(c.tile), hasWalls(c), raidWorld.defense(c.tile), band.attack)) * 100)} %:n todennäköisyydellä` : `Ilman soturia ${band.tribe ? 'paimentolaiset' : 'rosvot'} ryöstävät kaupungin` },
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
  c.build = bestSoldier();
  discoveryCard.notice(`${c.name} rakentaa ${c.build === 'phalanx' ? 'falangin' : 'soturin'}`);
}

// ─── Province and state levels (STORY-026) ────────
// Mapping 60 % of the home province opens the province level, and 60 % of the home
// state the state level. Each level has its own chips and actions.
const unlockCard = createUnlockCard(hud_root, () => {
  const to = upTarget(rig.target);
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
  setTargetState: () => {
    const s = selection?.level === 0 ? selection.id : null;
    if (play && s !== null) setTargetState(s, null);
  },
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

/** The home state: where the game starts (STORY-016). */
const homeState = () => Math.floor((game?.startCity ?? 0) / 49);

/** Provinces held, states conquered and states open, from the cities (conquest.ts). */
function conquestNow(): Conquest {
  const table = regions.tileTable();
  return conquest(play ? play.cities.map(c => table[c.tile]) : [], homeState(), regions.neighbors, provinceHasLand);
}

/** Whether a province has land, found once (STORY-058: a province without land counts as held). */
const provinceLand = new Map<number, boolean>();
function provinceHasLand(p: number): boolean {
  if (!provinceLand.has(p)) {
    let land = false;
    for (let a = p * 7; a < p * 7 + 7 && !land; a++) {
      if (!tilesOfArea.has(a)) tilesOfArea.set(a, cityTiles(regions, a));
      land = tilesOfArea.get(a)!.some(t => Number.isFinite(world.cost(t)));
    }
    provinceLand.set(p, land);
  }
  return provinceLand.get(p)!;
}

/** The planet panel (STORY-057): the selected state, else home, and whether it can be the target. */
function planetPanel(won: Conquest) {
  const id = selection?.level === 0 ? selection.id : homeState();
  const held = won.conquered.has(id) ? 'vallattu' : `lääniä hallussa ${heldIn(won, id)}/7`;
  return {
    name: stateNameOf(id).name,
    detail: won.open.has(id) ? `${held} · kartoitettu ${Math.round(stateShare(id) * 100)} %` : 'lukossa',
    isTarget: id === play!.targetState,
    canTarget: won.open.has(id) && !won.conquered.has(id),
  };
}

/** A state's name at the planet level: home, else its direction from home. */
function stateNameOf(id: number): RegionName {
  const home = homeState();
  return stateName(id === home, directionFrom(pointToTile(regions.centers[0][home]), pointToTile(regions.centers[0][id])));
}

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

/**
 * The free band between the top panel and the bottom panel, for the chips. After the panels, so
 * that a panel shown in this frame already bounds them. Reading an edge forces a layout in
 * mid-frame, so the edges are read again only when the level, the bottom panel or the window
 * changes, or every half second (STORY-062: they cost a tenth of a late game's frame time).
 */
let chipBand: { key: string; at: number; top: number; bottom: number } | null = null;
function panelEdges(): { top: number; bottom: number } {
  const bottomPanel = hud_root.querySelector<HTMLElement>('.level-bottom:not([hidden])');
  const key = `${viewLevel} ${bottomPanel?.className ?? ''} ${window.innerWidth}x${window.innerHeight}`;
  const now = performance.now();
  if (!chipBand || chipBand.key !== key || now - chipBand.at > 500) {
    const topPanel = hud_root.querySelector<HTMLElement>('.hud-top');
    chipBand = {
      key, at: now,
      top: topPanel && !topPanel.hidden ? topPanel.getBoundingClientRect().bottom : 0,
      bottom: bottomPanel ? bottomPanel.getBoundingClientRect().top : window.innerHeight,
    };
  }
  return chipBand;
}

/** Chips and panels of the province and state levels, and the unlocks. */
function updateLevels() {
  if (!play || !game) return;
  const won = conquestNow();
  const opened = discoveryCard.visible ? null : advance(play.progress, mapState.share(play.province), mapState.share(play.state), won.conquered.has(homeState()));
  if (opened !== null) {
    lockedLevel = opened;
    rig.maxDist = opened > 0 ? lockDist(opened) : MAX_DIST;
    unlockCard.show(opened === 2 ? 'Lääni kartoitettu, zoomaa ulos' : opened === 1 ? 'Valtio kartoitettu, zoomaa ulos' : 'Valtio vallattu, zoomaa ulos');
    if (opened === 0) discoveryCard.notice('Kotivaltio vallattu: naapurivaltiot avautuivat');
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
        : id === play.targetProvince ? 'Tavoite' : !provinceHasLand(id) ? 'Ei maata' : won.held.has(id) ? 'Hallussa' : `Kartoitettu ${Math.round(share * 100)} %`;
      const isSelected = selection?.level === level && selection.id === id;
      list.push({ id, name: nameOf(level, id).name, sub: isSelected ? `${sub} · valittu` : sub, x: at?.[0] ?? null, y: at?.[1] ?? null, selected: isSelected });
    }
  }
  if (viewLevel === 0) {
    // Zoomed out to the whole planet the states are too small for their chips: home only
    const room = rig.dist <= planetDist() * 2;
    for (const id of won.open) {
      if (!room && id !== homeState()) continue;
      const at = toScreen(regions.centers[0][id]);
      const sub = won.conquered.has(id) ? 'Vallattu' : id === play.targetState ? 'Tavoite' : `Lääniä hallussa ${heldIn(won, id)}/7`;
      const isSelected = selection?.level === 0 && selection.id === id;
      list.push({ id, name: stateNameOf(id).name, sub: isSelected ? `${sub} · valittu` : sub, x: at?.[0] ?? null, y: at?.[1] ?? null, selected: isSelected });
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
      detail: `${won.held.has(province) ? 'Hallussa · ' : ''}Kartoitettu ${Math.round(provinceShare(province) * 100)} %`,
      isTarget: province === play.targetProvince,
    },
    viewLevel === 0 ? planetPanel(won) : null,
  );
  chips.update(list, list.length ? panelEdges() : { top: 0, bottom: window.innerHeight }, viewLevel === 0);
}

// "−" zooms out a level on a desktop (the unlock card's hint)
window.addEventListener('keydown', e => {
  if ((e.key === '-' || e.key === 'Subtract') && viewLevel > lockedLevel) {
    const to = upTarget(rig.target);
    if (to) fly(to);
  }
});

/** A tap at the city-area level: a unit, or the flag's tile with the flag tool. Returns true if used. */
function tapPlay(x: number, y: number, width: number, height: number, hit: THREE.Vector3 | null): boolean {
  if (!play) return false;
  if (play.flagTool && hit) {
    const tile = pointToTile(hit);
    if (Number.isFinite(world.cost(tile)) && play.units.isOpen(tile, world)) {
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
    play.tileOpen = null;
    return true;
  }
  if (!hit) return false;
  const tile = pointToTile(hit);
  // With the settler selected a tap picks its site, and its actions stay in view
  if (play.units.units[play.selected] === play.units.settler) return play.units.setSite(tile, world);
  // What the hex holds (STORY-055)
  play.tileOpen = tile;
  play.openCity = null;
  play.listOpen = play.researchOpen = play.advisorOpen = false;
  return true;
}

const tileCard = createTileCard(hud_root, {
  close: () => {
    if (!play) return;
    play.tileOpen = null;
    // A region's card closed: the selection stays for the level's actions (STORY-067)
    regionCard = null;
  },
  // Into the region, as a second tap does
  action: () => { if (selection) fly(diveTarget(regions, selection, frames)); },
});

const plus = (y: { food: number; shield: number; trade: number }) =>
  [y.food ? `+${y.food} ruokaa` : '', y.shield ? `+${y.shield} tuotantoa` : '', y.trade ? `+${y.trade} kauppaa` : ''].filter(Boolean).join(', ');

/** What a hex gives: to the city working it or whose area it is in (the Kolossi and the government count), else under the government alone. */
function tileYieldNow(id: number) {
  const p = play!;
  const city = p.cities.find(c => c.tile === id);
  const worked = workedByCity();
  const by = p.cities.findIndex((_, i) => worked[i].includes(id));
  const owner = by >= 0 ? p.cities[by] : p.cities.find(c => tilesInRings(c.tile, cityRings(c.size)).includes(id));
  const raw = yieldOf(id, !!city);
  return { city, owner, worked: by >= 0, y: owner ? tileOutput(owner, raw, p.gov) : governed(raw, p.gov) };
}

// ─── The region card (STORY-067) ──────────────────
// Sami 2026-10-20: a tap on the map tells what the land holds, at every level. Counted over
// the mapped tiles of the city area, province or state, again each day.
/** The region whose card a tap on the map opened, as "level:id", or null. */
let regionCard: string | null = null;
let regionCache: { key: string; view: TileView } | null = null;

const regionTilesOf = (ref: RegionRef): number[] => {
  const area = (a: number) => {
    if (!tilesOfArea.has(a)) tilesOfArea.set(a, cityTiles(regions, a));
    return tilesOfArea.get(a)!;
  };
  return ref.level === 2 ? area(ref.id) : ref.level === 1 ? Array.from({ length: 7 }, (_, k) => area(ref.id * 7 + k)).flat() : tilesOfState(ref.id);
};

/** Up to four names, then how many more. */
const someOf = (names: string[]) => names.length > 4 ? `${names.slice(0, 4).join(', ')} ja ${names.length - 4} muuta` : names.join(', ');

function regionView(ref: RegionRef): TileView {
  const p = play!;
  const key = `${ref.level}:${ref.id}:${clock.day}:${mapState.count}:${p.cities.length}:${p.rivals.reduce((n, r) => n + r.cities.length, 0)}`;
  if (regionCache?.key === key) return regionCache.view;
  const tiles = regionTilesOf(ref);
  const inside = new Set(tiles);
  const mapped = tiles.filter(t => mapState.isMapped(t));
  const won = conquestNow();
  const rows: TileView['rows'] = [];
  if (ref.level === 0) {
    const home = ref.id === homeState();
    const status = home ? 'kotivaltio' : won.conquered.has(ref.id) ? 'vallattu' : won.open.has(ref.id) ? 'avoin' : 'lukossa, kunnes kotivaltio on vallattu';
    rows.push({ label: 'Tila', value: status + (p.targetState === ref.id ? ' · kohdevaltio' : '') });
    rows.push({ label: 'Läänit', value: `${heldIn(won, ref.id)} / 7 hallussa` });
  } else if (ref.level === 1) {
    rows.push({ label: 'Tila', value: !provinceHasLand(ref.id) ? 'ei maata, lasketaan hallussa olevaksi' : won.held.has(ref.id) ? 'hallussa: kaupunki läänissä' : 'ei hallussa' });
  } else {
    rows.push({ label: 'Painotus', value: AREA_PLAN_NAMES[p.units.areaPlans.get(ref.id) ?? 'explore'] });
  }
  rows.push({ label: 'Kartoitettu', value: `${Math.round((100 * mapped.length) / tiles.length)} %` });
  if (mapped.length) {
    const terrains = new Map<Terrain, number>();
    const resources = new Map<string, number>();
    for (const t of mapped) {
      const terrain = terrainOf(t);
      terrains.set(terrain, (terrains.get(terrain) ?? 0) + 1);
      if (tileTypes.codes[t] & 16) {
        const name = RESOURCES[TERRAIN_RULES[terrain].resource].name;
        resources.set(name, (resources.get(name) ?? 0) + 1);
      }
    }
    // The three most common, of those that round to 1 % at least
    const top = [...terrains].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => Math.round((100 * n) / mapped.length) > 0);
    rows.push({ label: 'Maasto', value: top.map(([t, n]) => `${TERRAIN_RULES[t].name.toLowerCase()} ${Math.round((100 * n) / mapped.length)} %`).join(' · ') });
    const res = [...resources].sort((a, b) => b[1] - a[1]);
    rows.push({ label: 'Erikoisresurssit', value: res.length ? someOf(res.map(([name, n]) => `${name} ${n}`)) : 'ei löydetty' });
  } else {
    rows.push({ label: 'Tiedossa', value: 'Ei vielä mitään: tiedustelijat kartoittavat alueen.' });
  }
  const cities = p.cities.filter(c => inside.has(c.tile));
  rows.push({ label: 'Kaupungit', value: cities.length ? someOf(cities.map(c => `${c.name} (${c.size})`)) : 'ei kaupunkeja' });
  const natives = visibleNatives().filter(n => inside.has(n.tile));
  if (natives.length) rows.push({ label: 'Kaupunkivaltiot', value: someOf(natives.map(n => `${n.name} (${nativeStrength(n, clock.day).size})`)) });
  const rivalCities = visibleRivalCities().filter(x => inside.has(x.city.tile));
  if (rivalCities.length) rows.push({ label: 'Kilpailijat', value: someOf(rivalCities.map(x => `${x.city.name} (${x.rival.name})`)) });
  const tribes = visibleTribes().filter(t => inside.has(t.camp));
  if (tribes.length) rows.push({ label: 'Paimentolaiset', value: tribes.map(t => t.tribe.name).join(', ') });
  const kicker = ref.level === 0 ? 'Valtio' : ref.level === 1 ? `Lääni · ${stateNameOf(Math.floor(ref.id / 7)).name}` : `Kaupunkialue · ${nameOf(1, Math.floor(ref.id / 7)).name}`;
  const title = ref.level === 0 ? stateNameOf(ref.id).name : nameOf(ref.level, ref.id).name;
  const view: TileView = { kicker, title, rows, action: 'Sukella sisään' };
  regionCache = { key, view };
  return view;
}

/** A city-state on the hex card: its size and defence. */
function nativeLine(n: NativeCity): string {
  const s = nativeStrength(n, clock.day);
  const left = play!.war.left(n.tile, s.defenders, clock.day);
  return `${n.name}, koko ${s.size} · ${left} ${s.defender === 'phalanx' ? (left === 1 ? 'falangi' : 'falangia') : (left === 1 ? 'soturi' : 'soturia')}${s.walls ? ' · muuri' : ''}`;
}

/** The tapped hex's card: terrain, resource, yield, improvements, city, units, crossing. */
function tileView(id: number): TileView {
  const p = play!;
  const kicker = nameOf(2, regions.tileTable()[id]).name;
  if (!mapState.isMapped(id)) return { kicker, title: 'Kartoittamaton', rows: [{ label: 'Tiedossa', value: 'Ei vielä mitään: tiedustelija kartoittaa ruudun.' }] };
  const terrain = terrainOf(id);
  const kind = tileTypes.codes[id] & 16 ? TERRAIN_RULES[terrain].resource : null;
  const { city, owner, worked, y } = tileYieldNow(id);
  const done = (['irrigation', 'mine', 'road'] as const).filter(k => p.improvements.has(id, k)).map(k => IMPROVEMENT_NAMES[k]);
  const units = p.units.units.filter(u => u.tile === id).map(u => u.name);
  const bonus = p.bonuses.get(id);
  const cost = world.cost(id);
  const native = nativeAt(id);
  const tribe = tribeAt(id);
  const rival = rivalCityAt(id);
  const rows: TileView['rows'] = [
    { label: 'Tuottaa', value: `ruokaa ${y.food} · tuotantoa ${y.shield} · kauppaa ${y.trade} päivässä` },
    ...(kind ? [{ label: 'Erikoisresurssi', value: `${RESOURCES[kind].name} (${plus(RESOURCES[kind])})` }] : []),
    { label: 'Parannukset', value: city ? 'kaupungin keskus: kastelu ja tie' : done.length ? done.join(', ') : 'ei' },
    ...(bonus ? [{ label: 'Löytö', value: plus(bonus) }] : []),
    ...(tribe ? [{ label: 'Paimentolaiset', value: tribeLine(tribe) }] : []),
    ...((native || tribe) && p.war.target === id ? [{ label: 'Sotaretki', value: `Kenraalin kohde · ${army().length} / ${warNeed(id)} hyökkääjää${p.war.marching ? ' · hyökkäys käynnissä' : ''}` }] : []),
    rival ? { label: 'Kilpailija', value: `${rival.rival.name}: ${rival.city.name}, koko ${rival.city.size}` } :
    native ? { label: 'Kaupunkivaltio', value: nativeLine(native) } : { label: 'Kaupunki', value: city ? `${city.name}, koko ${city.size}` : owner ? `${owner.name}: ${worked ? 'asukas työstää ruutua' : 'alueella, ei työstetä'}` : 'ei kaupungin alueella' },
    ...(units.length ? [{ label: 'Yksiköt', value: units.join(', ') }] : []),
    ...(p.raids.band?.bandits.some(b => b.tile === id) ? [{ label: 'Uhka', value: 'Rosvoja ruudulla' }] : []),
    { label: 'Kulku', value: Number.isFinite(cost) ? `${cost} pv` : coastal(id) ? (canSail() ? 'rannikkovesi: 1 pv' : 'rannikkovesi: Kartanteko avaa kulun') : 'avomeri: ei kulkua' },
    ...(p.units.isOpen(id, world) ? [] : [{ label: 'Valtio', value: 'lukossa, kunnes kotivaltio on vallattu' }]),
  ];
  return { kicker, title: kind ? `${TERRAIN_RULES[terrain].name} · ${RESOURCES[kind].name}` : TERRAIN_RULES[terrain].name, rows };
}

function updateTileCard() {
  if (!play) return;
  // Another card closes this one
  const other = play.openCity !== null || researchCard.visible || listCard.visible || advisorCard.visible || discoveryCard.visible;
  if (other) play.tileOpen = null;
  // Above the city areas the card of the region tapped on the map (STORY-067), until it is closed
  if (viewLevel < 3) {
    if (!selection || other || introTarget || `${selection.level}:${selection.id}` !== regionCard) {
      if (tileCard.visible) tileCard.hide();
      return;
    }
    const view = regionView(selection);
    if (tileCard.visible) tileCard.update(view);
    else tileCard.show(view);
    return;
  }
  const id = play.tileOpen;
  if (id === null || viewLevel !== 3) {
    if (tileCard.visible) tileCard.hide();
    return;
  }
  const view = tileView(id);
  if (tileCard.visible) tileCard.update(view);
  else tileCard.show(view);
  // The hex's yield on the map marks it
  const at = toScreen(tileCenter(id));
  const y = mapState.isMapped(id) ? tileYieldNow(id).y : null;
  tileYields.update(y ? [{ x: at?.[0] ?? null, y: at?.[1] ?? null, food: y.food, shield: y.shield, trade: y.trade, centre: false }] : []);
}

/** The top panel's meter: the mapping of the home province or state, then the provinces held (STORY-016). */
function meterOf(meter: Progress['meter']): Pick<GameHudState, 'mapped' | 'meterName' | 'unlockAt' | 'meterText'> {
  if (meter === 'conquest') {
    const held = heldIn(conquestNow(), homeState());
    return { mapped: held / 7, meterName: 'Läänit', unlockAt: 1, meterText: { value: `${held} / 7 hallussa`, label: `Kotivaltion lääneistä hallussa ${held} seitsemästä` } };
  }
  if (meter === 'done') {
    const won = conquestNow().conquered.size;
    return { mapped: 1, meterName: 'Valtiot', unlockAt: null, meterText: { value: `${won} vallattu`, label: `Valtioita vallattu ${won}` } };
  }
  return {
    mapped: mapState.share(meter === 'province' ? play!.province : play!.state),
    meterName: meter === 'province' ? 'Lääni' : 'Valtio',
    unlockAt: UNLOCK_SHARE,
  };
}

/** Distance between tile centres in world units near the camera target. */
const tileSpacing = () => (RADIUS * Math.acos(1 / Math.sqrt(5))) / 330;

function updatePlay(dt: number) {
  if (!play) return;
  const won = conquestNow();
  // Scouts map first what opens the next level (STORY-060)
  const meter = play.progress.meter;
  // ... and then the provinces of the home state not yet held, where the next cities go
  const held = meter === 'conquest' ? conquestNow().held : null;
  play.units.focus = meter === 'province' ? id => Math.floor(world.cityOf(id) / 7) === play!.units.homeProvince
    : meter === 'state' ? id => Math.floor(world.cityOf(id) / 49) === homeState()
    : held ? id => Math.floor(world.cityOf(id) / 49) === homeState() && !held.has(Math.floor(world.cityOf(id) / 7)) : null;
  play.units.noCity = nearForeign;
  scanNatives(NATIVE_BUDGET_MS);
  play.units.openStates = play.planetAdvisor === 'fortify' ? new Set([homeState(), ...won.conquered]) : won.open;
  const days = play.offers.length || play.raidAlert ? 0 : clock.advance(dt);
  const selectedUnit = play.units.units[play.selected];
  for (let d = 0; d < days; d++) {
    scouting = true;
    const founded = play.units.day(world);
    scouting = false;
    founded.forEach(foundAt);
    cityDays();
    rivalsDay();
    raidDay();
    advisorDay();
    if (play.offers.length || play.raidAlert) {
      clock.day -= days - d - 1;
      break;
    }
  }
  play.selected = Math.max(0, play.units.units.indexOf(selectedUnit));
  updateSiteOffer();
  updateCityLabels();
  updateListCard();
  updateCityCard();
  updateResearchCard();
  updateAdvisorCard();
  updateTileCard();
  checkGoals();
  const u = play.units.units[play.selected];
  const state: GameHudState = {
    day: clock.day,
    speed: clock.speed,
    paused: clock.paused,
    ...meterOf(play.progress.meter),
    level: viewLevel,
    unit: { name: u.name, status: unitStatus(play.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name), kind: u.kind === 'settler' && u !== play.units.settler ? 'waiting' : u.kind, mode: u.mode, task: u.kind === 'settler' ? u.task : null },
    flagTool: play.flagTool,
    city: play.cities[0]?.name ?? null,
    goal: GOALS[play.goal] ? { text: GOALS[play.goal].text, reward: GOALS[play.goal].reward } : null,
    advisor: viewLevel === 3 ? CITY_ADVISORS[play.cityAdvisor].name : viewLevel === 2 ? PROVINCE_ADVISORS[play.provinceAdvisor].name : viewLevel === 1 ? STATE_ADVISORS[play.stateAdvisor].name : PLANET_ADVISORS[play.planetAdvisor].name,
    research: !play.cities.length || play.researchOpen ? null
      : play.research.target ? { text: `Tiede · ${ADVANCES[play.research.target].name} ${Math.min(100, Math.floor((play.research.bulbs / play.research.cost) * 100))} %`, choose: false }
      : play.research.available().length ? { text: 'Valitse tutkimus', choose: true } : null,
  };
  play.hud.update(state);
  void autosave();
  unitLayer.update({
    units: play.units.units,
    // At the city level the city stands in 3D: no flat figure for it (STORY-069)
    cities: play.cities.map(c => c.tile).filter(t => !(t === cityLevel.city && cityLevel.relief.value > 0)),
    scale: 1 - 0.6 * cityLevel.relief.value,
    natives: visibleNatives().map(n => n.tile),
    camps: visibleTribes().map(t => t.camp),
    rivals: visibleRivalCities().map(x => ({ tile: x.city.tile, rival: x.rival.id })),
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
  rig.maxDist = lockedLevel > 0 ? lockDist(lockedLevel) : MAX_DIST;
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
  updateCityLevel(dt);
  // The canvas fills the window: its height without a layout read (STORY-062)
  tiles.update(camera, window.innerHeight, dt);
  starCamera.quaternion.copy(spinInverse).multiply(camera.quaternion);
  stepWell(well, dt);
  wellU.wellPos.value.set(well.x, well.y);
  wellU.wellG.value = well.g;
  wellU.wellBend.value = reduceMotion() ? 0 : 1;
  wellU.aspect.value = camera.aspect;
  wellU.time.value = now / 1000;
  starsMat.uniforms.scale.value = renderer.getDrawingBufferSize(bufferSize).y / 2;
  pulses.update(now, camera, window.innerHeight, reduceMotion());
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
    const sites: { tile: number; kind: string }[] = [];
    for (let rings = 2; sites.length < count && rings <= 40; rings += 2) {
      sites.length = 0;
      for (const tile of tilesInRings(play.units.camp, rings)) {
        if (mapState.isMapped(tile) || !Number.isFinite(world.cost(tile))) continue;
        if (isRuin(game.seed, tile)) sites.push({ tile, kind: ruinAt(game.seed, tile).kind });
      }
    }
    return sites.slice(0, count);
  },
  sendTo: (tile: number) => play?.units.sendTo(tile, world) ?? false,
  /** Learn an advance, or add bulbs (STORY-040). */
  learn: (advance: Advance) => { play?.research.known.add(advance); },
  addBulbs: (n: number) => { if (play) play.research.bulbs += n; },
  /** Set a city's size (STORY-044). */
  setCitySize: (city: number, size: number) => { if (play) play.cities[city].size = size; },
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
  /** Long test games: a faster clock and the advisors of every level (STORY-060). */
  fastForward: (speed: number) => { clock.speed = speed as Speed; clock.paused = false; },
  setAdvisors: (a: { city?: CityAdvisor; province?: ProvinceAdvisor; state?: StateAdvisor; planet?: PlanetAdvisor }) => {
    if (!play) return;
    if (a.city) play.cityAdvisor = a.city;
    if (a.province) play.provinceAdvisor = a.province;
    if (a.state) play.stateAdvisor = a.state;
    if (a.planet) play.planetAdvisor = a.planet;
  },
  /** Found a city on a tile, and give a city buildings (STORY-069 tests). */
  foundHere: (tile: number) => { if (play) { foundAt(tile); play.openCity = null; } },
  giveBuildings: (city: number, list: Building[]) => { if (play) play.cities[city].buildings.push(...list.filter(b => !play!.cities[city].buildings.includes(b))); },
  /** The city level (STORY-069): its city, relief, triangles and things on the ground. */
  cityLevel: () => cityLevel.stats,
  cityShadows: (on: boolean) => cityLevel.shadows(on),
  /** The city level's distance for a city: the camera there sees it rise. */
  cityLevelDist: () => frames[3] * CITY_LEVEL_AT * 0.7,
  /** The rivals: start states, cities and units (STORY-068). */
  rivals: () => (play ? play.rivals.map((r, k) => ({ id: r.id, name: r.name, start: rivalStartStates[k], cities: r.cities.map(c => ({ name: c.name, tile: c.tile, size: c.size, build: c.build })), units: r.units.map(u => u.kind) })) : []),
  /** A unit of any kind in a city, supported by none (STORY-064). */
  spawnUnit: (kind: UnitKind, city: number) => (play ? play.units.spawn(kind, play.cities[city].tile, world, null).name : null),
  /** The tribes and their camps (STORY-066), and a tribe's band sent now at the nearest city. */
  tribes: () => tribesNow().map(t => ({ state: t.tribe.state, name: t.tribe.name, camp: t.camp, mapped: mapState.isMapped(t.camp), band: tribeBand(game!.seed, t.tribe, clock.day), moves: TRIBE_MOVE_DAYS - ((clock.day + t.tribe.phase) % TRIBE_MOVE_DAYS) })),
  tribeRaidNow: (state: number) => { const t = tribesNow().find(x => x.tribe.state === state); return !!t && !play?.raids.band && sendTribe(t, true); },
  /** A unit on any tile, supported by none (STORY-066). */
  spawnUnitAt: (kind: UnitKind, tile: number) => (play ? play.units.spawn(kind, tile, world, null).name : null),
  /** The campaign (STORY-064). */
  war: () => (play ? { ...play.war.save(), army: army().length } : null),
  /** City-states found so far, and the longest frame's search for them in ms (STORY-063). */
  natives: () => natives.map(n => ({ ...n, mapped: mapState.isMapped(n.tile), size: nativeStrength(n, clock.day).size })),
  nativeMs: () => nativeMs,
  /** The card of a region at any level (STORY-067). */
  regionView: (level: 0 | 1 | 2, id: number) => (play ? regionView({ level, id } as RegionRef) : null),
  /** A tile's score as a city site (STORY-065). */
  siteScore: (id: number) => world.siteScore(id),
  /** The card a tapped hex would show (STORY-055). */
  tileView: (id: number) => (play ? tileView(id) : null),
  /** Found a city on the first land tile of a province that has none (STORY-016). */
  foundIn: (province: number) => {
    if (!play) return null;
    const table = regions.tileTable();
    for (let id = 0; id < table.length; id++) {
      if (Math.floor(table[id] / 7) !== province || !Number.isFinite(world.cost(id)) || play.cities.some(c => c.tile === id)) continue;
      foundAt(id);
      play.openCity = null;
      return id;
    }
    return null;
  },
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
      found: play?.found ?? 0, bonuses: play ? [...play.bonuses] : [],
      offer: play?.offers[0] ?? null, offered: play?.offered ?? [], pendingSite: play?.pendingSite ?? null, founding: play?.units.founding ?? false,
      cities: play ? play.cities.map((c, i) => ({ ...c, yield: cityYields()[i], rings: cityRings(c.size), worked: workedByCity()[i] })) : [], openCity: play?.openCity ?? null,
      improvements: play?.improvements.entries() ?? [],
      raid: play?.raids.band ? { city: play.raids.band.city, bandits: play.raids.band.bandits.map(b => ({ tile: b.tile, path: b.path.length })) } : null,
      raidAlert: play?.raidAlert ?? false,
      gold: play?.gold ?? null,
      research: play ? { ...play.research.save(), cost: play.research.cost } : null, tax: play?.tax ?? null, lux: play?.lux ?? null, gov: play?.gov ?? null, cityAdvisor: play?.cityAdvisor ?? null, provinceAdvisor: play?.provinceAdvisor ?? null, tileOpen: play?.tileOpen ?? null, stateAdvisor: play?.stateAdvisor ?? null, planetAdvisor: play?.planetAdvisor ?? null, targetState: play?.targetState ?? null, targetProvince: play?.targetProvince ?? null, goal: play?.goal ?? null,
    };
  },
};
(window as any).globeLevels = {
  get state() {
    return { level: viewLevel, path, selection, frames, flying: rig.flying };
  },
};

console.log('[GlobeCiv3] 3D globe ready');
