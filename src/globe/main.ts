/**
 * globe/main.ts — Three.js 3D globe with hex grid.
 * Minimal working version for T-GC3-001.
 */
import * as THREE from 'three';
import { buildCityTerrain, risingMaterial, type CityTerrain, type Site } from './cityView';
import { bestOf, isUp, placeAll, spots, standsOnTile, PLACE_RINGS } from '../game/placement';
import { type Actor } from '../game/commands';
import { attitudeWord, reasons, type Relation } from '../game/diplomacy';
import { worth } from '../game/trade';
import { createTradeCard, type TradeView } from '../ui/tradeCard';
import { attachInput, GlobeCamera } from './camera';
import { buildHexGrid } from './hexGrid';
import { backTarget, diveTarget, frameDistances, LEVEL_NAMES, levelForDist, regionAt, regionCenter, regionPath, sameRegion, type FlightTarget, type RegionRef, type ViewLevel } from './levels';
import { neighbors, pointToTile, tileCenter, TILE_COUNT } from './hexTiles';
import { Regions } from './regions';
import { hash, terrainHeight } from './terrain';
import { terrainColor, TileManager } from './tiles';
import { createLevelBar } from '../ui/levelBar';
import { createStartScreen, RING_EXTENT } from '../ui/startScreen';
import { chooseStartCity, chooseStartSite, cityTiles } from '../game/start';
import { tileInfo, TileTypeTable } from '../game/terrainTypes';
import { createGlyphAtlas } from './glyphAtlas';
import { SURFACE_SIZE, type PatternData } from './surfacePatterns';
import { projectionErrorPx } from './precision';
import { MapState, withNeighbors } from '../game/mapping';
import { paintMapped } from './fogMap';
import { GameClock, type Speed } from '../game/clock';
import { findPath, tilesInRings } from '../game/pathfinding';
import { borderRings, cultureGain, HOLD_BY_BORDER } from '../game/culture';
import { CONNECTED_SHIELD, isStrategic, type StrategicKind } from '../game/connection';
import { FAIR_SITE, goodSite, SITE_SPACING } from '../game/sites';
import { createCityLabels } from '../ui/cityLabels';
import { createUnitMarkers, nextUnit, type UnitMark } from '../ui/unitMarkers';
import { createTileYields } from '../ui/tileYields';
import { createResearchCard, type ResearchView } from '../ui/researchCard';
import { createListCard, type ListTab, type ListView } from '../ui/listCard';
import { ADVANCES, ADVANCE_LIST, NEEDS, isKind, opensFrom, studyName, treeLayout, type Advance, type LuxRate, type Study, type TaxRate } from '../game/science';
import { GOVERNMENTS, governed } from '../game/government';
import { createTileCard, type TileView } from '../ui/tileCard';
import { createAreaPanel, type AreaPanel, type AreaStat, type AreaView } from '../ui/areaPanel';
import { createCityQuick } from '../ui/cityQuick';
import { createWarPanel, type CityRef } from '../ui/nuclearPanel';
import { StrikeLayer } from './strikes';
import { createSounds } from '../ui/sound';
import { economy, type CityEconomy } from '../game/economy';
import { heldIn, type Conquest } from '../game/conquest';
import { nativeStrength, type NativeCity } from '../game/cityStates';
import { RIVALS, type RivalUnit } from '../game/rivals';
import { oklchToSrgb } from './colors';
import { tribeBand, TRIBE_MOVE_DAYS } from '../game/nomads';
import { advisorOfLevel, ADVISOR_LEVEL_NAMES, PLANET_ADVISORS, PLANET_ADVISOR_LIST, TOWN_ADVISORS, TOWN_ADVISOR_LIST, TOWN_OF_CITY, type AdvisorLevel, type PlanetAdvisor, type TownAdvisor } from '../game/advisors';
import { ERA_NAMES, personOf, ROLES, type Person } from '../game/persons';
import { eraOpenedBy } from '../game/eras';
import { describeBonus } from '../game/bonuses';
import { CITY_ADVISORS, CITY_ADVISOR_LIST, PROVINCE_ADVISORS, PROVINCE_ADVISOR_LIST, STATE_ADVISORS, STATE_ADVISOR_LIST, type CityAdvisor, type ProvinceAdvisor, type StateAdvisor } from '../game/advisors';
import { createAdvisorCard, type AdvisorView } from '../ui/advisorCard';
import { createCodexCard } from '../ui/codexCard';
import { createScienceTree, type NodeState, type TreeView } from '../ui/scienceTree';
import { ADVANCE_LORE } from '../game/advanceLore';
import { advanceEffects, advanceRef, BUILD_PURPOSE, buildRef, CHAIN_PURPOSE, codexPage, personRef, resourceRef } from '../game/codex';
import { city as cityRef, plain, unit as unitRef, type Rich, type RichLinks } from '../ui/richText';
import { narrate } from '../game/history';
import { along, ARRIVE_AT, MAX_CARRIERS, tripsOf, type Trip } from './carriers';
import { createOnboarding } from '../ui/onboarding';
import { goalCount, levelGoal } from '../game/goals';
import { TERRAIN_RULES, RESOURCES, type ResourceKind, type Terrain } from '../game/terrainTypes';
import { unitStatus, Units, type Mode, type SettlerTask, type Unit, type UnitKind } from '../game/units';
import { IMPROVEMENT_NAMES } from '../game/improvements';
import { UnitLayer } from './unitLayer';
import { glowMesh, moveWell, newWell, pressWell, releaseWell, starMaterial, stepWell, wellUniforms } from './gravityWell';
import { PulseLayer, type PulseKind } from './pulses';
import { validateSave, type SaveData } from '../game/save';
import { pending, type GameState } from '../sim/state';
import type { SimEvents } from '../sim/events';
import { DETAIL, RADIUS } from '../sim/world';
import { advisorsAnswer, dayBegun, daysFinishedAtOnce, firstChoices, firstScopes, suggestedStudy, dayRunning, opponentsNow, saveState, startDay, stepDay, CITY_LEVEL_RINGS, bind, startGame, game, levelState, prepareDay, raidPlan, rise, riseCheck, roadBuilt, setGame, setSwitches, simulateDay, NO_YIELD, TILE_ANGLE, type TribeNow, UNIT_BUILDS, weighTrade, areaShare, army, bordersNow, canSail, chosenAdvisor, cityDetail, cityYields, coastal, conquestNow, dispatch, eraNow, foundAt, foundKinds, ground, hasWonder, homeState, idleSettler, joinedShields, joiningOf, joinsNow, kindAt, kindMask, knownKind, knownRivalCities, moodOf, nameOf, nativeAt, nativeMs, nativeSyncMs, natives, nearCitiesOf, nearForeign, peopleStudy, provinceHasLand, provinceOfTile, provinceShare, provinceStage, rates, resourceNear, reveal, rivalCityAt, rivalStartStates, scanNatives, sendTribe, setTargetState, shieldless, soldiersIn, startRaid, stateNameOf, stateShare, stateStage, supportOf, terrainNear, terrainOf, tilesOfArea, tilesOfState, tribeAt, tribesNow, unitsOpen, unreachable, visibleNatives, visibleRivalCities, visibleTribes, warNeed, workedByCity, workerBuilders, world, yieldOf } from '../sim/game';
import { clearSave, loadSave, storeSave } from '../game/saveStore';
import { createGameHud, type AdvisorButton, type GameHudState } from '../ui/gameHud';
import { advance } from '../game/progress';
import { AREA_PLAN_NAMES, type AreaPlan, type StateLine } from '../game/units';
import { createChips, createLevelPanels, createUnlockCard, type Chip, type ScreenRect } from '../ui/levelUi';
import { isRuin, ruinAt, type Yield } from '../game/discoveries';
import { createAdvanceCard, type AdvanceView } from '../ui/advanceCard';
import { createDiscoveryCard, type ChoiceKind } from '../ui/discoveryCard';
import { CHAIN_BUILDINGS, CHAIN_RULES, GOODS, has as stockOf, readySettlements, settlementDone, settlementSteps, SETTLEMENT_SIZE, siteMissing, waitsForBase, BUILD_DAYS, type Good } from '../game/chains';
import { cityLuxury, isWonder, sizeLimit, SIZE_LIMIT, tileOutput, BUILDS, buyCost, cityGold, cityRings, cityScience, cityYield, daysToBuild, daysToGrow, granary, isBuilding, CITY_RINGS, UPKEEP, isTerrainBuilding, TERRAIN_BUILDINGS, type TerrainBuilding, isResourceBuilding, RESOURCE_BUILDINGS, type ResourceBuilding, type Build, type Building, type City, type CityYield, type Focus } from '../game/cities';
import { frameDays, type DayWork } from '../game/dayQueue';
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
// The globe's radius and its grid's detail, the same as the simulation's world (src/sim/world.ts)

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
  quickCity = null;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  // Ray against the sphere itself: works at every zoom level; at the city level against the risen ground
  const hit = cityLevel.pick(ndc) ?? rig.raycast(ndc);
  // In the nuclear war a tap on a country opens what can be done to it (STORY-126)
  if (warPanel) {
    if (hit) warPanel.tapState(regions.stateOf(hit));
    return;
  }
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
/** The war of leaders at the planet level, a trial that leaves the game alone (?planet, STORY-097). */
const planetTrial = params.has('planet');
let screen: Screen = params.has('free') || planetTrial ? 'free' : 'start';
/**
 * The old start, for the tests of the game's mechanics: scouts and a settler at the city area
 * (?classic). A new game starts at the city level in a built capital (STORY-070).
 */
const classic = params.has('classic');
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
/** The camera's reach for the open level: the city level (4) stays close to the capital (STORY-070). */
const lockFor = (level: number) => (level === 4 ? frames[3] * CITY_LEVEL_AT * 0.95 : level > 0 ? lockDist(level) : MAX_DIST);
/** Where the camera stands at the city level: its city rises. */
const cityViewDist = () => frames[3] * CITY_LEVEL_AT * 0.7;

/** The seed of the address, kept when the trial of the war of leaders opens and closes (STORY-119). */
const seedQuery = () => (params.has('seed') ? `seed=${encodeURIComponent(params.get('seed')!)}` : '');
const startScreen = screen === 'start' ? createStartScreen(hud, newGame, () => {
  const seed = seedQuery();
  location.href = `${location.pathname}?planet${seed ? `&${seed}` : ''}`;
}) : null;
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
// The nuclear war's own panel tells where you are: no level bar under its speech (STORY-126)
levelBar.setVisible(screen === 'free' && !planetTrial);

// ─── Fog of war (STORY-024) ───────────────────────
// In the game everything not yet mapped is fog; ?free shows the world as it is.
const mapState = new MapState();
tiles.fogOn.value = screen === 'free' ? 0 : 1;
// The start screen's planet is a silhouette without borders (design 1a)
const BORDER_STRENGTH = tiles.borderStrength.value;
if (screen === 'start') tiles.borderStrength.value = 0;

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
  if (classic) {
    const startCity = chooseStartCity(regions, seed);
    setGame({ seed, startCity });
    introTarget = regions.centers[2][startCity].clone();
  } else {
    // A varied site with one special resource (STORY-070), and the flight down to it
    const site = chooseStartSite(regions, seed, {
      terrainOf,
      hasResource: t => (terrainOf(t), (tileTypes.codes[t] & 16) !== 0),
      good: t => Number.isFinite(world.cost(t)) && world.siteScore(t) >= FAIR_SITE,
    });
    setGame({ seed, startCity: site.city, capital: site.tile });
    introTarget = tileCenter(site.tile);
  }
  screen = 'intro';
  tiles.borderStrength.value = BORDER_STRENGTH;
  // Storyboard 2a: the landing tile and its 6 neighbours are mapped first
  reveal(withNeighbors(pointToTile(introTarget)));
  flyIn(introTarget, classic ? frames[3] : cityViewDist());
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
  setGame({ seed: continuing.seed, startCity: continuing.startCity });
  screen = 'intro';
  // Back where the game was: the capital, else the settler's camp
  introTarget = tileCenter(continuing.cities[0]?.tile ?? continuing.units.camp).clone();
  tiles.borderStrength.value = BORDER_STRENGTH;
  reveal(continuing.mapped);
  flyIn(introTarget);
}

/** The game as it is now, for the save slot; null outside play. */
function snapshot(): SaveData | null {
  if (!play || screen !== 'playing') return null;
  const s = saveState();
  return s && { ...s, savedAt: Date.now(), speed: clock.speed, paused: clock.paused, selected: play.selected };
}

let lastSaveAt = -Infinity;
let lastSaveDay = -1;
/** Save when a day has passed since the last save and SAVE_EVERY_MS has gone by, or now when forced. */
function autosave(force = false): Promise<boolean> {
  const now = performance.now();
  // Not in the middle of a day: the save would work it out to its end in one frame (Utu's review of STORY-117)
  if (!force && (clock.day === lastSaveDay || now - lastSaveAt < SAVE_EVERY_MS || dayRunning())) return Promise.resolve(false);
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
function flyIn(target: THREE.Vector3, dist = frames[3]) {
  if (!startScreen) return;
  const reduce = reduceMotion();
  startScreen.hide(!reduce);
  if (reduce) {
    // Straight cut, softened by a 200 ms fade (Web Animations follow the wall clock)
    const cut = document.createElement('div');
    cut.className = 'cut-fade';
    document.body.appendChild(cut);
    cut.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => cut.remove());
    legs.push({ to: { point: target, dist, level: 3 }, durationS: 0 });
  } else {
    // Storyboard 2a: turn onto the target at planet distance (1 s), then descend (2 s)
    legs.push({ to: { point: target, dist: rig.dist, level: 0 }, durationS: 1 });
    legs.push({ to: { point: target, dist, level: 3 }, durationS: 2 });
  }
}

// ─── Play: day clock, units and the HUD (STORY-025) ─
// After landing, a day passes every 1.5 s / speed. Units act on their own each day;
// the player sets scouts' modes and the flag, and the settler's city site.
const clock = new GameClock();
/** The capital's carriers of the day (STORY-101): shown at the city level, they change nothing. */
let carrierTrips: { city: number; trips: Trip[] } | null = null;
/** The settler an advisor sent to a site today: the view selects it (STORY-050). */
let sentUnit: Unit | null = null;
/** What the simulation tells the view (STORY-095). */
const viewEvents: SimEvents = {
  notice: text => discoveryCard.notice(text),
  moment: (kind, tile) => moment(kind, tile ?? pointToTile(rig.target)),
  revealed: fresh => {
    paintMapped(tiles.fogData, fresh);
    tiles.tileCodesChanged();
    tiles.fogChanged();
  },
  // Each move walks from tile to tile: the centre is the city's tile, a building its own. Only
  // the city whose level is shown walks them (STORY-091: more cities than the capital have chains)
  carriers: (c, moves, siteTile) => {
    if (c.tile !== cityLevel.city) return;
    carrierTrips = {
      city: c.tile,
      trips: tripsOf(moves, at => (at === 'centre' ? c.tile : at === 'site' ? siteTile : (c.placed?.[at] ?? null)), (a, b) => {
        const path = findPath(a, b, () => 1, 400);
        return path ? [a, ...path] : null;
      }),
    };
  },
  firstCity: c => { if (play) play.openCity = c.id; },
  cityLost: () => { if (play) play.openCity = null; },
  treaty: () => updateTreatyCard(),
  // A level rose (STORY-087): the zoom opens to it, its card tells what opened, and its advisors
  // are asked for once the card is closed (STORY-096, STORY-105)
  rise: (opened, title, text) => {
    lockedLevel = opened;
    rig.maxDist = lockFor(opened);
    unlockCard.show(title, text);
    if (!classic && opened <= 3) pickPending = opened;
  },
  // Selected once the frame's days are done, as when the card took it
  sent: u => { sentUnit = u; },
  over: by => {
    shownCard = 'over';
    discoveryCard.show({
      day: clock.day,
      kicker: 'Peli päättyi',
      title: by ? `${by.name} valtasi viimeisen kaupunkisi` : 'Viimeinen kaupunkisi tuhoutui',
      body: `Päivä ${clock.day}. Tallennus poistetaan, ja uusi peli alkaa aloitusnäytöstä.`,
      options: [{ kind: 'site', title: 'Uusi peli', effect: 'Aloitusnäyttöön' }],
      note: 'Peli on pysähtynyt.',
    });
  },
};
bind({ regions, tileTypes, mapState, clock, events: viewEvents, classic });
const unitLayer = new UnitLayer(RADIUS);
scene.add(unitLayer.group);
unitLayer.raise = tile => cityLevel.raise(tile);
// The game's moments glow out from their tiles (STORY-035)
const pulses = new PulseLayer(RADIUS);
scene.add(pulses.group);
const moment = (kind: PulseKind, tile: number) => pulses.add(kind, tile, performance.now());
/** The game's state and the view's: the open cards, the selected unit and the HUD (STORY-095). */
interface Play extends GameState {
  selected: number;
  flagTool: boolean;
  /** The city whose card is open. */
  openCity: number | null;
  /** The tapped hex whose card is open (STORY-055). */
  tileOpen: number | null;
  /** The building the player is moving, by its city's tile (STORY-071). */
  moving: { city: number; building: Building } | null;
  /** The rival whose diplomacy card is open (STORY-076), and whose trade card (STORY-078). */
  diplomacyOpen: number | null;
  tradeOpen: number | null;
  /** The advisor card (STORY-049). */
  advisorOpen: boolean;
  researchOpen: boolean;
  /** The science tree is open, and the advance on show; null shows the one under study (STORY-109). */
  scienceOpen: boolean;
  scienceSelected: Advance | null;
  /** The list of cities and units is open, and which tab (STORY-042). */
  listOpen: boolean;
  listTab: ListTab;
  hud: ReturnType<typeof createGameHud>;
  /** The level panel at the top of the HUD (STORY-098). */
  area: AreaPanel;
}
let play: Play | null = null;

function startPlay(startCity: number, saved?: SaveData) {
  const hud: ReturnType<typeof createGameHud> = createGameHud(hud_root, {
    togglePause: () => { clock.paused = !clock.paused; },
    setSpeed: (speed: Speed) => { clock.speed = speed; clock.paused = false; },
    // The player's acts are commands (STORY-112): a unit by its id
    setMode: (mode: Mode) => { const u = play?.units.units[play.selected]; if (u) dispatch({ kind: 'mode', unit: u.id, mode }, 'player'); },
    setTask: (task: SettlerTask) => { const u = play?.units.units[play.selected]; if (u) dispatch({ kind: 'task', unit: u.id, task }, 'player'); },
    toggleFlagTool: () => { if (play) play.flagTool = !play.flagTool; },
    found: () => { const site = play?.units.currentSite(); if (site !== null && site !== undefined) dispatch({ kind: 'found', tile: site }, 'player'); },
    nextSite: () => { dispatch({ kind: 'skip' }, 'player'); },
    nextUnit: () => {
      if (!play) return;
      play.selected = (play.selected + 1) % play.units.units.length;
      // Bring it into view at the current distance
      rig.flyTo(tileCenter(play.units.units[play.selected].tile), rig.dist, reduceMotion() ? 0 : 0.5);
    },
    openResearch: () => { if (play) play.researchOpen = true; },
    openScience: () => {
      if (!play) return;
      play.scienceOpen = true;
      play.scienceSelected = null;
    },
    goalHint: () => { const g = play && levelGoal(play.progress.openLevel); if (g) discoveryCard.notice(g.level === 4 ? settlementHint() : g.level === 3 ? settlementsHint() : g.hint); },
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
    // A face in the HUD chooses that advisor of the level in view (STORY-105)
    chooseAdvisor: (id: string) => { dispatch({ kind: 'advise', level: advisorLevel(), advisor: id }, 'player'); },
  });
  // The first scout is selected, as in the design
  play = startGame(startCity, saved, {
    selected: 1, flagTool: false, openCity: null, tileOpen: null, moving: null, diplomacyOpen: null, tradeOpen: null, advisorOpen: false,
    researchOpen: false, scienceOpen: false, scienceSelected: null, listOpen: false, listTab: 'cities' as ListTab, hud,
    area: createAreaPanel(hud.element.querySelector<HTMLElement>('.hud-meter-row')!, hud.element.querySelector<HTMLElement>('.hud-top')!, areaAction),
  });
  // A saved game goes on where it was: its selected unit and the clock's speed too
  if (!saved) return;
  play.selected = Math.min(saved.selected, play.units.units.length - 1);
  clock.speed = saved.speed;
  clock.paused = saved.paused;
  lastSaveDay = saved.day;
}


/** Food, shields and trade within a city's two rings of a site. */
function siteYield(tile: number) {
  return tilesInRings(tile, CITY_RINGS).reduce((sum, id) => {
    const y = yieldOf(id, id === tile);
    return { food: sum.food + y.food, shield: sum.shield + y.shield, trade: sum.trade + y.trade };
  }, { food: 0, shield: 0, trade: 0 });
}

/** The card's choice on a site: build there (index 0) or later. */
function chooseSite(index: number, by: Actor = 'player') {
  if (!play) return;
  discoveryCard.hide();
  // The offer's card selects the settler; from the hex card it stays unselected, so that taps open hexes
  const settler = idleSettler();
  if (dispatch({ kind: 'site', accept: index === 0 }, by) && index === 0 && settler) play.selected = play.units.units.indexOf(settler);
}

// Under the labels and the chips: the unit markers above the city areas (STORY-115)
const unitMarkers = createUnitMarkers(hud_root, units => pickUnits(units));
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
  // The first tap opens the city's quick panel, the second its card (STORY-098)
  if (quickCity !== id) {
    quickCity = id;
    return;
  }
  openCityCard(id);
});

/**
 * A unit marker tapped above the city areas (STORY-115): its unit is selected and the view
 * turns to it at the same distance. A merged marker gives its units in turn (own).
 */
function pickUnits(units: number[]) {
  if (!play || !units.length) return;
  play.selected = nextUnit(units, play.selected);
  rig.flyTo(tileCenter(play.units.units[play.selected].tile), rig.dist, reduceMotion() ? 0 : 0.5);
}

/**
 * A city's quick panel at the level in view, the region's card closed (STORY-114), and what else
 * would hide it as a rich link closes it. A city out of view is turned to at the same distance.
 */
function quickCityAt(tile: number) {
  if (!play) return;
  const id = play.cities.findIndex(c => c.tile === tile);
  if (id < 0) return;
  regionCard = null;
  play.advisorOpen = false;
  play.openCity = null;
  play.tileOpen = null;
  closeCodex();
  if (!toScreen(tileCenter(tile))) rig.flyTo(tileCenter(tile), rig.dist, reduceMotion() ? 0 : 0.5);
  quickCity = id;
}

function openCityCard(id: number) {
  if (!play) return;
  quickCity = null;
  play.openCity = id;
  // From the province or state level, fly to the city
  if (viewLevel !== 3) fly({ point: tileCenter(play.cities[id].tile), dist: frames[3], level: 3 });
}

/**
 * Where the links in the game's texts lead (STORY-103): a city to itself, with its quick panel,
 * and a unit to where it stands now, selected. The view goes no further out than the level lock.
 */
const richLinks: RichLinks = {
  city: tile => {
    if (!play) return;
    const id = play.cities.findIndex(c => c.tile === tile);
    if (id < 0) return;
    play.advisorOpen = false;
    play.openCity = null;
    play.tileOpen = null;
    closeCodex();
    fly({ point: tileCenter(tile), dist: Math.min(cityViewDist(), rig.maxDist), level: 3 });
    quickCity = id;
  },
  unit: id => {
    if (!play) return false;
    const index = play.units.units.findIndex(u => u.id === id);
    if (index < 0) return false;
    play.selected = index;
    play.advisorOpen = false;
    play.openCity = null;
    play.tileOpen = null;
    closeCodex();
    fly({ point: tileCenter(play.units.units[index].tile), dist: Math.min(frames[3], rig.maxDist), level: 3 });
    return true;
  },
  unitAlive: id => !!play?.units.units.some(u => u.id === id),
  page: key => openCodex(key),
};

/** The Tietokirja's pages read since it opened, the one on show last (STORY-104). */
let codexTrail: string[] = [];
const codexCard = createCodexCard(hud_root, {
  close: () => closeCodex(),
  back: () => {
    codexTrail.pop();
    if (!codexTrail.length) codexTrail = ['index'];
    showCodex();
  },
  links: richLinks,
});
function showCodex() {
  const page = codexPage(codexTrail[codexTrail.length - 1], knownKind) ?? codexPage('index', knownKind)!;
  codexCard.show(page, codexTrail.length > 1 || page.key !== 'index');
}
/** Open a page of the Tietokirja: a link from another page goes on from it, any other starts anew. */
function openCodex(key: string) {
  codexTrail = codexCard.visible ? [...codexTrail, key] : [key];
  showCodex();
}
function closeCodex() {
  codexCard.hide();
  codexTrail = [];
  // The advance card it covered comes back at once, the focus on the row that opened it
  if (advanceCard.visible) advanceCard.cover(false);
}

/** The player buys in a city: the card's and the quick panel's button. */
function buyCity(c: City) {
  const price = buyCost(c);
  if (dispatch({ kind: 'buy', city: c.tile }, 'player')) discoveryCard.notice([cityRef(c.tile, c.name), ' osti: ', buildRef(c.build), ` · ${price} kultaa`]);
}

// ─── The nuclear war, a trial (?planet, STORY-126) ─
// Five leaders, the player last, each with five land states around a capital spread over the
// globe (the seed's). The war goes in rounds as the old game's did (src/game/nuclear.ts), and
// its flights and blasts are drawn in this scene (src/globe/strikes.ts, rule 1).
const strikes = planetTrial ? new StrikeLayer(RADIUS) : null;
// The war's sounds: made only in the trial, started by the first tap (STORY-127)
const sounds = planetTrial ? createSounds() : null;
if (strikes) scene.add(strikes.group);
const warPanel = planetTrial && strikes ? (() => {
  const seed = params.has('seed') ? Number(params.get('seed')) : 42;
  const centers = regions.centers[0];
  const land = centers.map((c, s) => (terrainOf(pointToTile(c)) !== 'ocean' ? s : -1)).filter(s => s >= 0);
  // Capitals far apart: the seed's first, then each time the land state farthest from those taken
  const capitals = [land[seed % land.length]];
  while (capitals.length < 5) {
    capitals.push(land.reduce((best, s) => {
      const d = Math.min(...capitals.map(c => centers[c].angleTo(centers[s])));
      return d > best.d ? { s, d } : best;
    }, { s: -1, d: -1 }).s);
  }
  // Each realm: its capital and the four land states nearest to it not yet taken
  const taken = new Set(capitals);
  const realms = capitals.map(c => [c]);
  for (let round = 0; round < 4; round++) {
    realms.forEach(r => {
      const s = land.filter(x => !taken.has(x)).sort((a, b) => centers[r[0]].angleTo(centers[a]) - centers[r[0]].angleTo(centers[b]))[0];
      if (s !== undefined) { r.push(s); taken.add(s); }
    });
  }
  const point = (t: CityRef) => centers[realms[t.leader][t.city]];
  return createWarPanel(hud_root, {
    cityAt: t => toScreen(point(t)),
    fly: (kind, from, to, color, speed, stopped) => strikes.launch(kind, point(from), point(to), color, performance.now(), speed, stopped),
    blast: (at, cls, small) => strikes.blast(point(at), cls, performance.now(), small),
    pulse: (kind, at) => moment(kind, pointToTile(point(at))),
    // The camera turns to the middle of the way and steps out enough to see both ends
    look: (from, to, speed) => {
      const a = point(from);
      const b = point(to);
      const mid = a.clone().add(b);
      if (mid.lengthSq() < 1e-6) mid.copy(a);
      const half = Math.min(THREE.MathUtils.degToRad(78), a.angleTo(b) / 2 + THREE.MathUtils.degToRad(14));
      const dist = Math.min(RADIUS * 3.2, Math.max(RADIUS * 2, RADIUS / Math.cos(half) - RADIUS));
      rig.flyTo(mid.normalize(), dist, reduceMotion() ? 0 : 0.6 / speed);
    },
    clear: () => strikes.clear(),
    sounds: sounds!,
    tint: list => tiles.setStateTints(list && list.map(t => ({ state: t.state, color: new THREE.Color(t.color), amount: t.amount }))),
    reduceMotion,
    // Back to the start screen, where a saved game waits as it was (STORY-119)
    leave: () => {
      const seed = seedQuery();
      location.href = `${location.pathname}${seed ? `?${seed}` : ''}`;
    },
  }, seed, realms);
})() : null;
// For tests: the war, and the flights and blasts running
if (warPanel) Object.assign(window, { globeWar: Object.assign(warPanel, { strikes: () => strikes?.state, layer: strikes, sound: () => ({ started: sounds!.started, muted: sounds!.muted }) }) });

function updateWar(_dt: number) {
  if (!warPanel || !strikes) return;
  const now = performance.now();
  warPanel.update(now);
  strikes.update(now, camera, window.innerHeight, reduceMotion());
}

// ─── Level panel and city quick panels (STORY-098) ─
// The top of the HUD tells the level, the era and the area in view, and opens into the
// area's infographic and quick actions. A city's label tells in small what it builds and
// how it grows; a tap opens its quick panel.

/** The city whose quick panel is open (its id), or null. */
let quickCity: number | null = null;
const cityQuick = createCityQuick(hud_root, {
  action: (id, city) => {
    const c = play?.cities[city];
    if (!c) return;
    if (id === 'card') openCityCard(city);
    else if (id === 'fly') fly({ point: tileCenter(c.tile), dist: cityViewDist(), level: 3 });
    else if (id === 'buy') buyCity(c);
  },
  close: () => { quickCity = null; },
});

/** The cities' yields, worked out once a day or when a city changes, not in every frame. */
let yieldsCache: { key: string; yields: CityYield[] } | null = null;
function yieldsNow(): CityYield[] {
  const p = play!;
  const key = `${clock.day}|${p.gov}|${p.tax}|${p.lux}|${p.cities.map(c => `${c.size}:${c.build}:${c.focus}:${c.buildings.length}`).join(',')}`;
  if (yieldsCache?.key !== key) yieldsCache = { key, yields: cityYields() };
  return yieldsCache.yields;
}

const daysWord = (n: number | null) => (n === null ? 'ei etene' : n === 0 ? 'huomenna' : `${n} pv`);

/**
 * When the city's build is done: "huomenna", "3 pv", or, for a settler in a city too small,
 * "vaatii koon 2" and whether the city grows at all (PLAYTEST-002: "valmis huomenna" for 140 days).
 */
function buildWhen(c: City, y: CityYield): string {
  const pop = BUILDS[c.build].pop;
  if (pop && c.size <= pop) return `vaatii koon ${pop + 1}${y.surplus <= 0 ? ', ei kasva' : ''}`;
  return daysWord(daysToBuild(c, y));
}

/** A city of chains' site in short: "Saha · puuttuu 2 kiveä" or "Saha · 2 pv" (STORY-088). */
function siteText(c: City): string | null {
  const s = c.chain;
  const missing = s && siteMissing(s);
  if (!s?.site || !missing) return null;
  const state = missing.planks || missing.stones ? `puuttuu ${goodsText(missing.planks, missing.stones)}` : daysWord(Math.max(1, BUILD_DAYS - s.site.days));
  return `${BUILDS[s.site.building].name} · ${state}`;
}

/** What the city builds and how it grows, in small under its name. */
function labelInfo(c: City, y: CityYield): string {
  if (y.disorder) return 'Levottomuutta';
  const site = siteText(c);
  const build = c.build !== 'coinage' ? `${BUILDS[c.build].name} ${buildWhen(c, y)}` : site ? site.replace(' · ', ' ') : `Kultaa +${Math.max(0, y.shield)}`;
  return `${build} · ruokaa ${signed(y.surplus)}`;
}

/** The city's figures, a short line each: the quick panel and the city level's panel. */
function cityLines(c: City, y: CityYield): string[] {
  const grow = daysToGrow(c, y);
  const growth = y.surplus < 0 ? 'näkee nälkää' : grow === null ? 'ei kasva' : `kasvaa ${daysWord(grow)}`;
  // The site of a city of chains first, then what its shields build (STORY-088)
  const builds = [siteText(c), c.build === 'coinage' ? null : `${BUILDS[c.build].name} · ${buildWhen(c, y)}`].filter(Boolean);
  const build = builds.length ? `Rakentaa ${builds.join(' ja ')}` : `Tekee kultaa +${Math.max(0, y.shield)}/pv`;
  const mood = moodOf(c, y);
  const soldiers = soldiersIn(c.tile).length;
  return [
    `Koko ${c.size} · ruokaa ${signed(y.surplus)}/pv, ${growth}`,
    build,
    `Tuotantoa +${Math.max(0, y.shield)} · kauppaa +${y.trade} · tiedettä +${cityScience(c, y, rates().tax, rates().lux)}`,
    `${y.disorder ? 'Levottomuutta' : `${mood.happy + mood.content} tyytyväistä, ${mood.unhappy} tyytymätöntä`} · ${soldiers ? `puolustajia ${soldiers}` : 'ei puolustajia'}`,
    ...(c.buildings.length ? [`Rakennukset: ${c.buildings.map(b => BUILDS[b].name).join(', ')}`] : []),
  ];
}

function updateCityQuick(lift: number) {
  const p = play!;
  const c = quickCity === null ? undefined : p.cities[quickCity];
  if (!c || viewLevel === 0 || p.openCity !== null) {
    quickCity = null;
    cityQuick.update(null);
    return;
  }
  const y = yieldsNow()[c.id];
  const price = buyCost(c);
  const actions = [
    { id: 'card', label: 'Kaupunkikortti' },
    ...(cityInView() !== c ? [{ id: 'fly', label: 'Lennä kaupunkiin' }] : []),
    ...(ownHand() && price > 0 && price <= p.gold ? [{ id: 'buy', label: `Osta ${BUILDS[c.build].name} · ${price} kultaa` }] : []),
  ];
  const at = toScreen(tileCenter(c.tile));
  cityQuick.update({ id: c.id, name: c.name, lines: cityLines(c, y), actions, x: at?.[0] ?? null, y: at ? at[1] - lift : null });
}

/** A quick action of the level panel. */
function areaAction(id: string) {
  if (!play) return;
  const c = cityInView();
  if (id === 'advisor') play.hud.element.querySelector<HTMLButtonElement>('.hud-advisor')?.click();
  else if (id === 'card' && c) openCityCard(c.id);
  else if (id === 'area' && c) fly({ point: tileCenter(c.tile), dist: frames[3], level: 3 });
  else if (id === 'up' && viewLevel > lockedLevel) {
    const to = upTarget(rig.target);
    if (to) fly(to);
  } else if (id === 'list') play.hud.element.querySelector<HTMLButtonElement>('.hud-city')?.click();
  else if (id === 'codex') openCodex('index');
}

/** The four figures of the player's cities among these. */
function areaStats(cities: City[]): AreaStat[] {
  const yields = yieldsNow();
  let people = 0, shield = 0, trade = 0, science = 0;
  for (const c of cities) {
    const y = yields[c.id];
    people += c.size;
    shield += Math.max(0, y.shield);
    trade += y.trade;
    science += cityScience(c, y, rates().tax, rates().lux);
  }
  return [
    { label: 'Asukkaita', value: String(people) },
    { label: 'Tuotanto/pv', value: String(shield) },
    { label: 'Kauppa/pv', value: String(trade) },
    { label: 'Tiede/pv', value: String(science) },
  ];
}

/** The level panel's view: where the view is, and when open, what is there. */
function areaView(): AreaView {
  const p = play!;
  const era = ERA_NAMES[eraNow()];
  const city = cityInView();
  const open = p.area.open;
  const advisor = { id: 'advisor', label: `Neuvonantaja: ${levelAdvisor(advisorLevel()).name}` };
  const up = viewLevel > lockedLevel ? [{ id: 'up', label: 'Taso ylös', key: '-' }] : [];
  const codex = { id: 'codex', label: 'Tietokirja' };
  if (city) {
    return {
      kicker: 'Kaupunki', name: city.name,
      stats: open ? areaStats([city]) : [],
      rows: open ? [{ label: 'Aikakausi', value: era }, ...cityLines(city, yieldsNow()[city.id]).map((value, k) => ({ label: ['Kasvu', 'Tuotanto', 'Tuotot', 'Mieliala', 'Rakennukset'][k], value }))] : [],
      // Out to the city area once it is open (STORY-070)
      actions: [{ id: 'card', label: 'Kaupunkikortti' }, advisor, ...(lockedLevel < 4 ? [{ id: 'area', label: 'Kaupunkialueelle' }] : []), codex],
    };
  }
  const ref = viewLevel > 0 ? path[viewLevel - 1] : undefined;
  if (!ref) {
    const won = conquestNow();
    return {
      kicker: 'Planeetta', name: 'Koko maailma',
      stats: open ? areaStats(p.cities) : [],
      rows: open ? [
        { label: 'Aikakausi', value: era },
        { label: 'Valtiot', value: `${won.conquered.size} vallattu` },
        { label: 'Kaupungit', value: p.cities.length ? someOf(p.cities.map(c => `${c.name} (${c.size})`)) : 'ei kaupunkeja' },
        { label: 'Kassa', value: `${p.gold} kultaa` },
        // The leaders' war (STORY-097) comes later (Sami 2026-11-22)
        { label: 'Ydinsota', value: 'tulossa myöhemmin' },
      ] : [],
      actions: [advisor, ...up, codex],
    };
  }
  const name = ref.level === 0 ? stateNameOf(ref.id).name : nameOf(ref.level, ref.id).name;
  const divisor = [49, 7, 1][ref.level];
  const inside = open ? p.cities.filter(c => Math.floor(world.cityOf(c.tile) / divisor) === ref.id) : [];
  return {
    kicker: LEVEL_NAMES[viewLevel], name,
    stats: open ? areaStats(inside) : [],
    rows: open ? [{ label: 'Aikakausi', value: era }, ...regionView(ref).rows.map(r => ({ label: r.label, value: plain(r.value) }))] : [],
    actions: [advisor, ...(viewLevel === 3 && ownHand() ? [{ id: 'list', label: 'Luettelo' }] : []), ...up, codex],
  };
}

// What the open city's tiles bring in, over the map and under the card (STORY-039)
const tileYields = createTileYields(hud_root);

/**
 * The player's cities whose labels the level shows (STORY-114), in the order they are placed:
 * at the state level the capital and each province's largest, at the province level the
 * province's own cities, at the city area all.
 */
function labelledCities(): City[] {
  const p = play!;
  if (viewLevel === 3) return p.cities;
  const province = (c: City) => provinceOfTile(c.tile);
  const bySize = [...p.cities].sort((a, b) => Number(b.capital) - Number(a.capital) || b.size - a.size || a.id - b.id);
  if (viewLevel === 2) {
    const here = path[1]?.id;
    return bySize.filter(c => province(c) === here);
  }
  // The capital comes first, so it is its own province's city
  const seen = new Set<number>();
  return bySize.filter(c => !seen.has(province(c)) && !!seen.add(province(c)));
}

function updateCityLabels() {
  if (!play) return;
  const lift = labelLift();
  // City-states have negative ids: -1 - their place among those in view (STORY-063)
  const shown = visibleNatives();
  // The open quick panel's city keeps its label (STORY-098), placed first (STORY-114)
  const cities = labelledCities().filter(c => c.id !== quickCity);
  if (quickCity !== null && play.cities[quickCity]) cities.unshift(play.cities[quickCity]);
  const labelRects = cityLabels.update(viewLevel === 0 ? [] : [
    ...cities.map(c => {
      const at = toScreen(tileCenter(c.tile));
      // Above the city's houses at the city-area level, on the city further out. At the city
      // area a small line tells what it builds and how it grows (STORY-098); not at the city
      // level, where the wider label would cover the city's own tiles and the top panel tells it
      const info = viewLevel === 3 && rig.dist > frames[3] * CITY_LEVEL_AT ? labelInfo(c, yieldsNow()[c.id]) : undefined;
      return { id: c.id, name: c.name, size: c.size, x: at?.[0] ?? null, y: at ? at[1] - lift : null, info, open: quickCity === c.id };
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
  ], viewLevel === 1 || viewLevel === 2 ? chipRects : null);
  updateCityQuick(lift);
  updateUnitMarkers(labelRects);
}

/** The JS time of the unit markers in the last frames, for the 8 ms measure (STORY-115). */
const markerMs: number[] = [];

/** Each of the player's units as a marker at the province and state levels (STORY-115), clear of the chips and labels. */
function updateUnitMarkers(labelRects: ScreenRect[]) {
  const started = performance.now();
  if (!play || (viewLevel !== 1 && viewLevel !== 2)) unitMarkers.update(null, [], { left: 0, top: 0, right: 0, bottom: 0 });
  else {
    // Not under the top or the bottom panel
    const band = panelEdges();
    const marks: UnitMark[] = play.units.units.map((u, index) => {
      const at = toScreen(tileCenter(u.tile));
      const shown = at !== null && at[1] > band.top && at[1] < band.bottom;
      return { index, label: u.name, x: shown ? at[0] : null, y: shown ? at[1] : null, selected: index === play!.selected };
    });
    unitMarkers.update(marks, [...chipRects, ...labelRects], { left: 0, top: band.top, right: innerWidth, bottom: band.bottom });
  }
  markerMs.push(performance.now() - started);
  if (markerMs.length > 240) markerMs.shift();
}

// ─── The city level (STORY-069) ───────────────────
// Close to one of the player's cities its three rings rise into relief, with light and
// shadows, trees, rocks, houses and buildings (cityView.ts, docs/design/kaupunkitaso.md).
// It rises in 0.6 s by the wall clock and sinks back as the camera leaves.
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
  const groundMaterial = risingMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), relief);
  const groundDepth = risingMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), relief);
  /** Things on the ground, raised with it: where each stands at rest and how far it rises. */
  let props: { object: THREE.Object3D | THREE.InstancedMesh; spots: { base: THREE.Vector3; rise: THREE.Vector3; yaw: number; scale: number }[] }[] = [];
  let terrain: CityTerrain | null = null;
  let mesh: THREE.Mesh | null = null;
  let city: number | null = null;
  let dressed = '';
  /** Tiles a moved building may go to, the best ones gold (STORY-071). */
  let marked: { tile: number; best: boolean }[] = [];
  /** The ground at full relief, for taps on it. */
  let pickMesh: THREE.Mesh | null = null;
  const ray = new THREE.Raycaster();
  const up = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const yawQ = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  // The carriers (STORY-101): a body and a load each, at most MAX_CARRIERS, in tile spacings
  const S = RADIUS * TILE_ANGLE;
  // A light smock so a carrier reads against grass and forest
  const carrierBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.03 * S, 0.065 * S, 2, 6).translate(0, 0.065 * S, 0), flat(0xe6d8b8), MAX_CARRIERS);
  const carrierLoad = new THREE.InstancedMesh(new THREE.BoxGeometry(0.065 * S, 0.045 * S, 0.065 * S).translate(0, 0.15 * S, 0), new THREE.MeshLambertMaterial({ flatShading: true }), MAX_CARRIERS);
  for (const im of [carrierBody, carrierLoad]) {
    im.count = 0;
    im.castShadow = true;
    im.frustumCulled = false;
    group.add(im);
  }
  const GOOD_COLOR = Object.fromEntries(Object.entries({ log: 0x7a5232, plank: 0xc8a26a, stone: 0x9a968e, wheat: 0xe0c35a, flour: 0xf2efe6, bread: 0xb9773a, fish: 0x6f9fc0 })
    .map(([g, hex]) => [g, new THREE.Color(hex)])) as Record<Good, THREE.Color>;
  const legA = new THREE.Vector3();
  const legB = new THREE.Vector3();
  const local = new THREE.Vector3();
  const inverseUp = new THREE.Quaternion();
  const one = new THREE.Vector3();

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
    } else if (kind === 'fishery') {
      // A hut by the shore and a boat with a sail (STORY-070)
      add(box(0.1, 0.07, 0.09), 0x8a6a48);
      add(roof(0.09, 0.06), 0x5d4a3a, 0, 0.07 * s, 0);
      add(box(0.12, 0.025, 0.04), 0x6b4a2f, 0.12 * s, 0, 0.04 * s);
      add(new THREE.ConeGeometry(0.03 * s, 0.09 * s, 3).translate(0, 0.07 * s, 0), 0xf2efe6, 0.12 * s, 0, 0.04 * s);
    } else if (kind === 'sawmill') {
      add(box(0.12, 0.08, 0.1), 0x9a7650);
      add(roof(0.1, 0.06), 0x5d4a3a, 0, 0.08 * s, 0);
      for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.14 * s, 6).rotateZ(Math.PI / 2).translate(0, 0.018 * s, 0), 0x7a5232, 0.03 * s, k * 0.034 * s, 0.1 * s);
    } else if (kind === 'quarry') {
      for (let k = 0; k < 3; k++) add(box(0.2 - k * 0.05, 0.05, 0.16 - k * 0.04), 0xa9a49a, k * 0.02 * s, k * 0.05 * s, 0);
    } else if (kind === 'field') {
      add(box(0.3, 0.012, 0.24), 0xc9b85a);
      for (const z of [-0.08, 0, 0.08]) add(box(0.28, 0.016, 0.02), 0x8f7f38, 0, 0, z * s);
    } else if (kind === 'lumberjack') {
      // A hut and a pile of logs (STORY-088)
      add(box(0.1, 0.07, 0.08), 0x8a6a48);
      add(roof(0.08, 0.06), 0x4f6b3a, 0, 0.07 * s, 0);
      for (const [y, z] of [[0, -0.02], [0, 0.02], [0.034, 0]]) add(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.12 * s, 6).rotateZ(Math.PI / 2).translate(0, 0.016 * s, 0), 0x7a5232, 0.02 * s, y * s, (0.1 + z) * s);
    } else if (kind === 'mill') {
      // A windmill: a tower, a cap and four sails (STORY-088)
      add(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.2 * s, 8).translate(0, 0.1 * s, 0), 0xe6dcc4);
      add(roof(0.065, 0.06, 8), 0x9a4630, 0, 0.2 * s, 0);
      for (let k = 0; k < 4; k++) add(box(0.025, 0.13, 0.008).rotateZ((k * Math.PI) / 2 + 0.3), 0xf2efe6, 0, 0.17 * s, 0.07 * s);
    } else if (kind === 'bakery') {
      // A house with an oven's chimney (STORY-088)
      add(box(0.14, 0.08, 0.11), 0xd9c38a);
      add(roof(0.11, 0.07), 0x9a4630, 0, 0.08 * s, 0);
      add(box(0.025, 0.07, 0.025), 0x8c3b2a, 0.04 * s, 0.1 * s, 0.02 * s);
    } else if (kind in RESOURCE_BUILDINGS) {
      // A resource building (STORY-073): a hut, its roof and sign in the colour of what it gives
      const r = RESOURCE_BUILDINGS[kind as ResourceBuilding];
      const tone = r.food ? 0x6f9a3a : r.shield ? 0xb5652a : 0xc9a227;
      add(box(0.14, 0.09, 0.12), 0xd8c9a8);
      add(roof(0.12, 0.08), tone, 0, 0.09 * s, 0);
      add(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.16 * s, 5).translate(0, 0.08 * s, 0), 0x5d4a3a, 0.11 * s, 0, 0.08 * s);
      add(box(0.07, 0.045, 0.012), tone, 0.11 * s, 0.13 * s, 0.08 * s);
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
    // Terrain buildings stand on their terrain, the fishery on a shore (STORY-070)
    const onTerrain = (b: TerrainBuilding) => {
      const fits = (x: Site) => b === 'fishery' ? neighbors(x.tile).some(n => terrainOf(n) === 'ocean') : (TERRAIN_BUILDINGS[b] as readonly Terrain[]).includes(terrainOf(x.tile));
      const site = byCentre.find(x => !used.has(x.key) && fits(x) && placed.every(p => p.distanceTo(x.base) > 0.2 * s));
      if (site) { used.add(site.key); placed.push(site.base); }
      return site;
    };
    // Each building on its tile (STORY-071): the free site nearest the tile's centre
    const { sites, origin } = terrain;
    const onTile = (t: number) => {
      const at = tileCenter(t).multiplyScalar(RADIUS).sub(origin);
      const site = sites.filter(x => x.tile === t && !used.has(x.key) && placed.every(p => p.distanceTo(x.base) > 0.2 * s))
        .sort((a, b) => a.base.distanceToSquared(at) - b.base.distanceToSquared(at))[0];
      if (site) { used.add(site.key); placed.push(site.base); }
      return site;
    };
    for (const b of c.buildings.filter(standsOnTile)) {
      const t = c.placed?.[b];
      const site = t !== undefined ? onTile(t) : isTerrainBuilding(b) ? onTerrain(b) : take();
      if (site) building(b, site, s);
    }
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
    // Special resources: a gem in the colour of what they give, floating over the tile's centre (STORY-070)
    const gems: Site[] = [];
    const gemColors: THREE.Color[] = [];
    for (const t of new Set(terrain.sites.map(x => x.tile))) {
      if (!(tileTypes.codes[t] & 16)) continue;
      const at = tileCenter(t).multiplyScalar(RADIUS).sub(terrain.origin);
      const site = terrain.sites.filter(x => x.tile === t).reduce((a, b) => (b.base.distanceToSquared(at) < a.base.distanceToSquared(at) ? b : a));
      gems.push(site);
      const k = TERRAIN_RULES[terrainOf(t)].resource;
      const r = RESOURCES[k];
      gemColors.push(new THREE.Color(!knownKind(k) ? 0x9a9a9a : r.food ? 0x7fc35a : r.shield ? 0xd98a3d : 0xe8c547));
    }
    if (gems.length) {
      instanced(new THREE.OctahedronGeometry(0.06 * s, 0).translate(0, 0.32 * s, 0), new THREE.MeshLambertMaterial({ flatShading: true, emissive: 0x222222 }), gems.map(site => ({ base: site.base, rise: site.rise, yaw: 0, scale: 1 })));
      const im = props[props.length - 1].object as THREE.InstancedMesh;
      gemColors.forEach((c, i) => im.setColorAt(i, c));
    }
    // Where a moved building may go: a hexagonal ring over each tile, gold where it does best
    if (marked.length) {
      instanced(new THREE.RingGeometry(0.3 * s, 0.4 * s, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), marked.map(m => {
        const at = tileCenter(m.tile);
        return { base: at.clone().multiplyScalar(RADIUS * (1 + 2e-6)).sub(origin), rise: at.clone().multiplyScalar(terrain!.heightAt(m.tile) + 0.06 * s), yaw: 0, scale: 1 };
      }));
      const im = props[props.length - 1].object as THREE.InstancedMesh;
      im.castShadow = false;
      marked.forEach((m, i) => im.setColorAt(i, new THREE.Color(m.best ? 0xe8c547 : 0xf2efe6)));
    }
    place();
  };

  return {
    group,
    relief,
    /** Height of the raised ground at a tile, for the units standing on it. */
    raise: (tile: number) => (terrain && relief.value > 0 ? terrain.heightAt(tile) * relief.value : 0),
    /**
     * The day's carriers at a part of the day (STORY-101): each walks its path over the risen
     * ground, from tile centre to tile centre, and is gone once it has arrived.
     */
    walk(trips: readonly Trip[], dayPart: number) {
      let n = 0;
      if (terrain && relief.value > 0 && dayPart < ARRIVE_AT + 0.05) {
        const at = (t: number, out: THREE.Vector3) => {
          const c = tileCenter(t);
          return out.copy(c).multiplyScalar(RADIUS * (1 + 2e-6)).sub(terrain!.origin).addScaledVector(c, terrain!.heightAt(t) * relief.value);
        };
        inverseUp.copy(up).invert();
        const k = relief.value;
        one.set(k, k, k);
        for (let i = 0; i < Math.min(trips.length, MAX_CARRIERS); i++) {
          const trip = trips[i];
          const { leg, f } = along(trip.path.length, dayPart, i);
          at(trip.path[leg], legA);
          at(trip.path[leg + 1], legB);
          // Facing the way it walks, in the city's own frame
          local.subVectors(legB, legA).applyQuaternion(inverseUp);
          q.copy(up).multiply(yawQ.setFromAxisAngle(Y, Math.atan2(-local.z, local.x)));
          v.copy(legA).lerp(legB, f);
          m.compose(v, q, one);
          carrierBody.setMatrixAt(n, m);
          carrierLoad.setMatrixAt(n, m);
          carrierLoad.setColorAt(n, GOOD_COLOR[trip.good]);
          n++;
        }
      }
      carrierBody.count = carrierLoad.count = n;
      if (n) {
        carrierBody.instanceMatrix.needsUpdate = carrierLoad.instanceMatrix.needsUpdate = true;
        if (carrierLoad.instanceColor) carrierLoad.instanceColor.needsUpdate = true;
      }
    },
    get carriers() { return carrierBody.count; },
    get city() { return city; },
    get stats() {
      return { city, relief: relief.value, triangles: mesh ? mesh.geometry.getAttribute('position').count / 3 : 0, props: props.map(p => (p.object instanceof THREE.InstancedMesh ? p.object.count : 1)).reduce((a, b) => a + b, 0), carriers: carrierBody.count };
    },
    /** Build the ground of a city, once it has sunk from another. */
    build(c: City) {
      if (mesh) { group.remove(mesh); mesh.geometry.dispose(); }
      terrain = buildCityTerrain({
        centre: c.tile, rings: CITY_LEVEL_RINGS, terrainOf, radius: RADIUS, lift: 2e-6, colorOf: terrainColor,
        detail: cityDetail,
      });
      mesh = new THREE.Mesh(terrain.geometry, groundMaterial);
      mesh.customDepthMaterial = groundDepth;
      // The ground at full relief, for taps (STORY-071)
      if (pickMesh) pickMesh.geometry.dispose();
      const pos = terrain.geometry.getAttribute('position').array;
      const rise = terrain.geometry.getAttribute('rise').array;
      const full = new Float32Array(pos.length);
      for (let i = 0; i < full.length; i++) full[i] = pos[i] + rise[i];
      pickMesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(full, 3)), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      group.position.copy(terrain.origin);
      up.setFromUnitVectors(Y, tileCenter(c.tile));
      city = c.tile;
      dressed = '';
    },
    /** Dress the city again when it has grown or built. */
    /** Mark the tiles a moved building may go to, or none (STORY-071). */
    mark(list: { tile: number; best: boolean }[]) {
      marked = list;
      dressed = '';
    },
    /** The point of the risen ground under the screen point, once the land has risen. */
    pick(ndc: THREE.Vector2): THREE.Vector3 | null {
      if (!pickMesh || !terrain || relief.value < 1) return null;
      pickMesh.position.copy(terrain.origin);
      pickMesh.updateMatrixWorld();
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(pickMesh)[0]?.point ?? null;
    },
    dressFor(c: City) {
      const key = `${c.size}|${c.capital}|${c.buildings.join(',')}|${JSON.stringify(c.placed ?? {})}|${hasWonder('greatwall')}|${kindMask()}`;
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
  // The carriers walk by the game's clock and stop with it; with reduced motion there are none
  cityLevel.walk(!reduceMotion() && carrierTrips && carrierTrips.city === cityLevel.city ? carrierTrips.trips : [], clock.fraction);
}
const rivalCss = (k: number) => `rgb(${oklchToSrgb(...(RIVALS[k].color as unknown as [number, number, number])).map(v => Math.round(v * 255)).join(', ')})`;

/** A tribe on the hex card: its band and when its camp moves on. */
function tribeLine(t: TribeNow): string {
  const b = tribeBand(game!.seed, t.tribe, clock.day);
  const moves = TRIBE_MOVE_DAYS - ((clock.day + t.tribe.phase) % TRIBE_MOVE_DAYS);
  return `${t.tribe.name} · ${b.size} ${b.unit === 'legion' ? 'miekkamiestä' : 'ratsumiestä'} · leiri siirtyy ${moves} pv päästä`;
}
/**
 * Milliseconds a frame for finding them: a state's terrain takes 60 to 150 ms (a province
 * 7 to 26 ms, Intel UHD, Chromium), too long for a frame.
 */
const NATIVE_BUDGET_MS = 3;

const cityCard = createCityCard(hud_root, {
  links: richLinks,
  close: () => { if (play) play.openCity = null; },
  // Shields in store are kept: both builds are units, so Freeciv has no change penalty
  setFocus: (focus: Focus) => { if (play && play.openCity !== null) dispatch({ kind: 'focus', city: play.cities[play.openCity].tile, focus }, 'player'); },
  setBuild: (build: Build) => {
    if (!play || play.openCity === null) return;
    dispatch({ kind: 'build', city: play.cities[play.openCity].tile, build }, 'player');
  },
  openResearch: () => { if (play) play.researchOpen = true; },
  buy: () => {
    if (play && play.openCity !== null) buyCity(play.cities[play.openCity]);
  },
});

/** "3 lankkua ja 2 kiveä" */
const goodsText = (planks: number, stones: number) => [planks && `${planks} ${planks === 1 ? 'lankku' : 'lankkua'}`, stones && `${stones} ${stones === 1 ? 'kivi' : 'kiveä'}`].filter(Boolean).join(' ja ');
/** What the stock holds, the most first: "lankkuja 5, kiveä 2". */
const STOCK_WORDS: Record<(typeof GOODS)[number], [string, string]> = { log: ['tukki', 'tukkeja'], plank: ['lankku', 'lankkuja'], stone: ['kivi', 'kiveä'], wheat: ['vilja', 'viljaa'], flour: ['jauhot', 'jauhoja'], bread: ['leipä', 'leipiä'], fish: ['kala', 'kaloja'] };

/** The stock, the site and the chain buildings of a city of chains, for its card (STORY-088). */
function chainView(c: City): CityView['chain'] {
  const s = c.chain;
  if (!s) return undefined;
  const goods = GOODS.filter(g => stockOf(s, g) > 0).map(g => `${STOCK_WORDS[g][stockOf(s, g) === 1 ? 0 : 1]} ${stockOf(s, g)}`);
  const missing = siteMissing(s);
  const site = s.site && missing ? `Työmaa: ${BUILDS[s.site.building].name}, ${missing.planks || missing.stones ? `puuttuu ${goodsText(missing.planks, missing.stones)}` : `valmis ${Math.max(1, BUILD_DAYS - s.site.days)} pv`}` : null;
  return {
    line: [`Varasto: ${goods.length ? goods.join(', ') : 'tyhjä'}`, site, settlementDone(c.buildings, c.size) ? 'Valmis settlementti' : null].filter(Boolean).join(' · '),
    builds: CHAIN_BUILDINGS.filter(b => !c.buildings.includes(b) && spots(c, b, ground).length > 0).map(b => {
      const base = waitsForBase(c.buildings, b);
      const busy = s.site !== null && s.site.building !== b;
      return {
        kind: b, name: BUILDS[b].name, selected: s.site?.building === b, locked: base || busy,
        cost: goodsText(CHAIN_RULES[b].planks, CHAIN_RULES[b].stones), purpose: CHAIN_PURPOSE[b],
        eta: s.site?.building === b ? 'työmaalla' : base ? 'metsurin, sahan ja louhoksen jälkeen' : busy ? 'kun työmaa valmistuu' : 'aloita työmaa',
      };
    }),
  };
}

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
    advisor: (a => a.id === 'none' ? null : [`Neuvonantaja ${a.name}`, ...(a.person ? [' (', personRef(a.person), ')'] : []), ` hoitaa ${a.level === 'town' ? 'työmaat ja rakentamisen' : 'painotuksen ja rakentamisen'}.`])(levelAdvisor(c.chain && play!.progress.openLevel === 4 ? 'town' : 'city')),
    own: ownHand(),
    gold: play?.gold ?? 0,
    income: cityGold(c, y, rates().tax, rates().lux) - c.buildings.reduce((sum, b) => sum + UPKEEP[b], 0),
    research: researchLine(),
    buy: price ? { name: BUILDS[c.build].name, price, can: price <= (play?.gold ?? 0) } : null,
    buildings: c.buildings.map(b => BUILDS[b].name),
    story: narrate(c, game?.seed ?? 0, eraNow(), terrainOf(c.tile)),
    kicker: `${c.capital ? 'Pääkaupunki' : 'Kaupunki'} · ${nameOf(2, regions.tileTable()[c.tile]).name}`,
    name: c.name,
    size: c.size,
    growth: c.food / granary(c.size),
    growText: y.surplus < 0 ? 'nälkää' : c.size >= sizeLimit(c) ? 'vesijohto puuttuu' : grow === null ? 'ei kasva' : `kasvaa ${grow} pv`,
    yields: [y.surplus, y.shield, y.trade],
    // A terrain building only where its terrain is (STORY-070)
    chain: chainView(c),
    // The worker is the province level's, and not shown below it (STORY-093)
    builds: (Object.keys(BUILDS) as Build[]).filter(kind => !(kind === 'worker' && !provinceStage()) && !(isBuilding(kind) && c.buildings.includes(kind)) && !(isWonder(kind) && hasWonder(kind)) && !(isTerrainBuilding(kind) && !terrainNear(c, kind)) && !(isResourceBuilding(kind) && !resourceNear(c, kind)) && !shieldless(c, kind)).map(kind => {
      const b = BUILDS[kind];
      const ready = daysToBuild({ ...c, build: kind }, y);
      const need = NEEDS[kind];
      // Units wait for the city area, which the ready settlement opens (STORY-089)
      const later = UNIT_BUILDS.has(kind) && !unitsOpen();
      const locked = (need !== undefined && !play!.research.known.has(need)) || later;
      return {
        kind, name: b.name, selected: kind === c.build, locked,
        cost: kind === 'coinage' ? 'Tuotanto kullaksi' : `${b.cost} tuotantoa${b.pop ? ` ja ${b.pop} asukas` : ''}${isBuilding(kind) && UPKEEP[kind] ? `, ${UPKEEP[kind]} ${UPKEEP[kind] === 1 ? 'kulta' : 'kultaa'}/pv` : ''}`, purpose: BUILD_PURPOSE[kind],
        eta: later ? 'kun kaupunkialue avautuu' : locked && need ? `vaatii: ${ADVANCES[need].name}` : kind === 'coinage' ? `+${Math.max(0, y.shield)} kultaa/pv` : ready === null ? 'ei tuotantoa' : c.size <= b.pop ? `vaatii koon ${b.pop + 1}${y.surplus <= 0 ? ', kaupunki ei kasva: vaihda painotus Ruokaan' : ''}` : ready === 0 ? 'valmis huomenna' : `valmis ${ready} pv`,
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
/** Land tiles of the border in a province. */
const borderLandIn = (province: number) => {
  let n = 0;
  for (const t of bordersNow().owned.keys()) if (provinceOfTile(t) === province && Number.isFinite(world.cost(t))) n++;
  return n;
};

/** A strategic resource tile's join, for its hex card. */
function joinLine(tile: number, kind: StrategicKind): string {
  if (!bordersNow().owned.has(tile)) return 'rajojen ulkopuolella: raja ei vielä ulotu tänne';
  if (joinsNow().network.has(tile)) return `yhdistetty tiellä: läänin kaupungit +${CONNECTED_SHIELD[kind]} tuotantoa`;
  return unreachable.has(tile) ? 'ei yhdistetty: maata pitkin ei pääse kaupunkiin' : 'ei yhdistetty: työläinen rakentaa tien';
}

/** The province's rows at the province level (STORY-093): culture, joined kinds and workers. */
function provinceRows(province: number): { label: string; value: string }[] {
  const p = play!;
  const cities = p.cities.filter(c => provinceOfTile(c.tile) === province);
  const joins = joinsNow();
  const joined = [...(joins.kinds.get(province) ?? [])].map(k => `${RESOURCES[k].name} +${CONNECTED_SHIELD[k]}`);
  const waiting = joins.waiting.filter(r => r.province === province).length;
  const workers = p.units.units.filter(u => u.kind === 'worker' && provinceOfTile(u.tile) === province).length;
  return [
    ...(cities.length ? [{ label: 'Kulttuuri', value: `${cities.reduce((s, c) => s + (c.culture ?? 0), 0)} · +${cities.reduce((s, c) => s + cultureGain(c), 0)} päivässä` }] : []),
    { label: 'Yhdistetyt', value: joined.length ? `${joined.join(', ')} tuotantoa joka kaupunkiin` : waiting ? 'ei vielä: resurssi odottaa tietä' : 'ei strategisia resursseja rajojen sisällä' },
    ...(waiting && joined.length ? [{ label: 'Odottaa tietä', value: `${waiting} resurssia` }] : []),
    ...(workers ? [{ label: 'Työläiset', value: String(workers) }] : []),
  ];
}

/**
 * The level whose advisors the card and the buttons show: the city level while it is the only
 * one open or the view is close on the capital of chains (STORY-105), else the level in view.
 */
const advisorLevel = (): AdvisorLevel => (viewLevel === 3 ? (!classic && !!play && (play.progress.openLevel === 4 || !!cityInView()?.chain) ? 'town' : 'city') : viewLevel === 2 ? 'province' : viewLevel === 1 ? 'state' : 'planet');

/** Each level's advisors: their ids, role names and what they do, the own hand first. */
const LEVEL_ADVISORS: Record<AdvisorLevel, { list: readonly string[]; names: Record<string, { name: string; does: string }> }> = {
  town: { list: TOWN_ADVISOR_LIST, names: TOWN_ADVISORS },
  city: { list: CITY_ADVISOR_LIST, names: CITY_ADVISORS },
  province: { list: PROVINCE_ADVISOR_LIST, names: PROVINCE_ADVISORS },
  state: { list: STATE_ADVISOR_LIST, names: STATE_ADVISORS },
  planet: { list: PLANET_ADVISOR_LIST, names: PLANET_ADVISORS },
};

/** A level's advisor: the role, its name, and the person of this era in it (none in the own hand). */
function levelAdvisor(level: AdvisorLevel, id = chosenAdvisor(level)): { id: string; level: AdvisorLevel; name: string; does: string; person: Person | null } {
  const role = LEVEL_ADVISORS[level].names[id];
  return { id, level, name: role.name, does: role.does, person: personOf(level, id, eraNow()) };
}

/** The HUD's advisor buttons of a level (STORY-105): the three faces, then the own hand. */
function advisorButtons(level: AdvisorLevel): AdvisorButton[] {
  const chosen = chosenAdvisor(level);
  const list = LEVEL_ADVISORS[level].list;
  return [...list.filter(id => id !== 'none'), 'none'].map(id => {
    const a = levelAdvisor(level, id);
    return { id, role: a.name, person: a.person, does: a.does, chosen: id === chosen };
  });
}

const advisorCard = createAdvisorCard(hud_root, {
  links: richLinks,
  close: () => { if (play) play.advisorOpen = false; },
  choose: (id: string) => {
    dispatch({ kind: 'advise', level: advisorLevel(), advisor: id }, 'player');
  },
});

function updateAdvisorCard() {
  const level = advisorLevel();
  if (!play || !play.advisorOpen || discoveryCard.visible) {
    if (advisorCard.visible) advisorCard.hide();
    return;
  }
  const log = level === 'town' ? play.townLog : level === 'city' ? play.advisorLog : level === 'province' ? play.provinceLog : level === 'state' ? play.stateLog : play.planetLog;
  const view: AdvisorView = {
    level: `${ADVISOR_LEVEL_NAMES[level]} · ${ERA_NAMES[eraNow()]}`,
    options: advisorButtons(level).map(b => ({ id: b.id, name: b.role, does: b.does, selected: b.chosen, person: b.person })),
    log,
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
    // Above the city areas its quick panel, as from the province card (STORY-114, STORY-115)
    if (viewLevel === 3) play.openCity = id;
    else quickCityAt(play.cities[id].tile);
  },
  unit: (index: number) => {
    if (!play) return;
    play.listOpen = false;
    play.selected = index;
    rig.flyTo(tileCenter(play.units.units[index].tile), rig.dist, reduceMotion() ? 0 : 0.5);
  },
  rival: (id: number) => openDiplomacy(id),
});

function listView(): ListView {
  const yields = cityYields();
  return {
    tab: play!.listTab === 'diplomacy' && !stateStage() ? 'cities' : play!.listTab,
    diplomacyTab: stateStage(),
    cities: play!.cities.map((c, i) => {
      const y = yields[i];
      const ready = daysToBuild(c, y);
      const when = c.build === 'coinage' ? `+${Math.max(0, y.shield)} kultaa/pv` : ready === null ? 'ei tuotantoa' : BUILDS[c.build].pop >= c.size ? buildWhen(c, y) : ready === 0 ? 'valmis huomenna' : `${ready} pv`;
      return {
        id: c.id, name: c.name, size: `Koko ${c.size}`,
        line: [...(y.disorder ? ['LEVOTTOMUUKSIA'] : []), `${BUILDS[c.build].name} · ${when}`, `ruokaa ${y.surplus < 0 ? '−' : '+'}${Math.abs(y.surplus)}`, ...(c.buildings.length ? [c.buildings.map(b => BUILDS[b].name).join(', ')] : [])].join(' · '),
      };
    }),
    units: play!.units.units.map((u, index) => ({
      index, name: u.name, kind: KIND_NAMES[u.kind],
      line: unitStatus(play!.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name),
      // By province (STORY-115)
      group: nameOf(1, provinceOfTile(u.tile)).name,
    })),
    economy: economyRows(yields),
    diplomacy: play!.rivals.flatMap((r, k) => {
      const t = play!.ties[k];
      return t?.met ? [{ id: k, name: r.name, state: STATE_NAMES[t.state], line: `asenne ${attitudeWord(t.attitude)} · ${knownRivalCities(k).length} tunnettua kaupunkia` }] : [];
    }),
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
      resources: worked[i].filter(t => tileTypes.codes[t] & 16 && knownKind(TERRAIN_RULES[terrainOf(t)].resource)).map(t => RESOURCES[TERRAIN_RULES[terrainOf(t)].resource].name),
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
  // At the city area, and above it at the province and state levels (STORY-115); the planet
  // level closes it, so it does not come back on the way down
  if (play?.listOpen && viewLevel === 0) play.listOpen = false;
  if (!play || !play.listOpen || viewLevel === 0 || discoveryCard.visible) {
    if (listCard.visible) listCard.hide();
    return;
  }
  const view = listView();
  if (listCard.visible) listCard.update(view);
  else listCard.show(view);
}

// ─── Level goals (STORY-087) ──────────────────────
// Each level's goal counts the output of the level below it; reaching it opens the next level.

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
  return r.target ? `Tutkimus: ${studyName(r.target)} ${Math.min(r.bulbs, r.cost)}/${r.cost}` : 'Tutkimus: valitse seuraava';
}

const researchCard = createResearchCard(hud_root, {
  close: () => { if (play) play.researchOpen = false; },
  choose: (advance: Study) => { dispatch({ kind: 'study', target: advance }, 'player'); },
  setTax: (tax: number) => { dispatch({ kind: 'tax', tax: tax as TaxRate }, 'player'); },
  setLux: (lux: number) => { dispatch({ kind: 'lux', lux: lux as LuxRate }, 'player'); },
  revolution: () => { dispatch({ kind: 'revolution' }, 'player'); },
});

// The science tree (STORY-109): the advances by what they need, each with its picture, what it
// is, what it does in the game and a saying of its time
const TREE_LAYOUT = treeLayout();
const scienceTree = createScienceTree(hud_root, {
  close: () => { if (play) play.scienceOpen = false; },
  select: (a: Advance) => { if (play) play.scienceSelected = a; },
  choose: (a: Advance) => {
    if (dispatch({ kind: 'study', target: a }, 'player')) discoveryCard.notice(['Tutkitaan: ', advanceRef(a)]);
  },
  links: richLinks,
});

function scienceView(): TreeView {
  const r = play!.research;
  const open = r.available(foundKinds);
  const stateOf = (a: Advance): NodeState => (r.known.has(a) ? 'known' : r.target === a ? 'target' : open.includes(a) ? 'open' : 'locked');
  const perDay = scienceRates().science + peopleStudy();
  const firstOpen = open.find((s): s is Advance => !isKind(s));
  const sel = play!.scienceSelected ?? (r.target && !isKind(r.target) ? r.target : firstOpen ?? ADVANCE_LIST[0]);
  const state = stateOf(sel);
  const page = codexPage(`advance/${sel}`, knownKind)!;
  const days = state === 'target' && perDay > 0 ? Math.max(1, Math.ceil((r.cost - r.bulbs) / perDay)) : null;
  const missing = ADVANCES[sel].needs.filter(n => !r.known.has(n)).map(n => ADVANCES[n].name);
  const kinds = ADVANCES[sel].from && !ADVANCES[sel].from!.some(k => r.kinds.has(k)) ? ADVANCES[sel].from!.map(k => studyName(k, knownKind(k))) : [];
  const status = state === 'known' ? 'Tunnettu'
    : state === 'target' ? `Tutkitaan ${Math.min(r.bulbs, r.cost)} / ${r.cost}${days ? ` · valmis ${days} pv` : ''}`
    : state === 'open' ? `Voi tutkia · ${r.costOf(sel)} tiedettä`
    : `Vaatii ensin: ${[...missing, ...(kinds.length ? [`resurssin ${kinds.join(' tai ')}`] : [])].join(', ')}`;
  return {
    rates: `Tiedettä +${perDay}/pv · tunnetaan ${r.known.size} / ${ADVANCE_LIST.length}`,
    nodes: TREE_LAYOUT.map(n => ({
      ...n, name: ADVANCES[n.advance].name, state: stateOf(n.advance), needs: ADVANCES[n.advance].needs,
      progress: r.target === n.advance && r.cost ? Math.min(1, r.bulbs / r.cost) : null,
    })),
    selected: { advance: sel, name: ADVANCES[sel].name, state, status, what: ADVANCE_LORE[sel].what, effect: page.text, facts: page.facts, quote: ADVANCE_LORE[sel].quote },
  };
}

function updateScienceTree() {
  if (!play || !play.scienceOpen) {
    if (scienceTree.visible) scienceTree.hide();
    return;
  }
  const view = scienceView();
  if (scienceTree.visible) scienceTree.update(view);
  else scienceTree.show(view);
}

/** The government and what it means (STORY-047). */
function governmentLine(): string {
  const p = play!;
  if (p.gov === 'anarchy') return `Hallitus: Anarkia vielä ${Math.max(1, p.anarchyUntil - clock.day)} pv · ei veroja eikä tiedettä, kaikki kauppa ylellisyyteen`;
  if (p.gov === 'monarchy') return 'Hallitus: Monarkia · ruudut tuottavat täysin, ei ilmaisia yksiköitä, sotilaat rauhoittavat enintään kolme';
  return `Hallitus: ${GOVERNMENTS.despotism.name} · ruudun yli kahden tuotosta menee yksi hukkaan${p.research.known.has('monarchy') ? '' : '. Monarkia-tutkimus avaa paremman.'}`;
}

/** The studies open, with their price and what they open: the research card's and an advance card's choices. */
function studyOptions(): { advance: Study; name: string; cost: string; opens: string; selected: boolean }[] {
  const r = play!.research;
  // What an advance opens: the buildings that need it, and the advances that need it
  const opens = (a: Advance) => [
    ...(Object.keys(NEEDS) as Build[]).filter(b => NEEDS[b] === a).map(b => BUILDS[b].name),
    ...(Object.keys(ADVANCES) as Advance[]).filter(n => ADVANCES[n].needs.includes(a)).map(n => `tutkimuksen ${ADVANCES[n].name}`),
    ...(a === 'monarchy' ? ['hallitusmuodon Monarkia'] : []),
    ...(a === 'mapmaking' ? ['kulun rannikkovesillä'] : []),
  ];
  return r.available(foundKinds).map(a => ({
    advance: a, name: studyName(a), cost: `${r.costOf(a)} tiedettä`, selected: a === r.target,
    // A kind: what its study shows, and the advances it opens (STORY-072)
    opens: isKind(a) ? `Paljastaa lajin kartalla ja sen tuoton${opensFrom(a).length ? ` · avaa tutkimuksen ${opensFrom(a).map(n => ADVANCES[n].name).join(' ja ')}` : ''} · kansa tutkii mukana` : `Avaa: ${opens(a).join(', ')}`,
  }));
}

// ─── An advance's card (STORY-118) ────────────────
// The game waits on it until the next study is chosen (the sim's learned decision); the
// advisor's choice waits ready on it, and none in the player's own hand.
const advanceCard = createAdvanceCard(hud_root, {
  answer: (study, first) => {
    const a = play?.learned[0];
    if (!a || !dispatch({ kind: 'learned', study, first }, 'player')) return;
    advanceCard.hide();
    if (study) discoveryCard.notice(['Tutkitaan: ', isKind(study) ? resourceRef(study, knownKind(study), true) : advanceRef(study), ...(first ? [' · ', buildRef(first.build), first.scope === 'all' ? ' ensin joka kaupungissa' : ' ensin pääkaupungissa'] : [])]);
  },
  links: richLinks,
});

function updateAdvanceCard() {
  const p = play;
  const a = p?.learned[0];
  if (!p || !a || discoveryCard.visible || unlockCard.visible || onboarding.visible) {
    if (advanceCard.visible) advanceCard.hide();
    return;
  }
  // A page of the Tietokirja opened from the card covers it (STORY-120)
  advanceCard.cover(codexCard.visible);
  const options = studyOptions();
  const chosen = ownHand() ? p.research.target : suggestedStudy();
  const advisor = p.stateAdvisor === 'none' ? null : STATE_ADVISORS[p.stateAdvisor].name;
  advanceCard.show({
    advance: a,
    kicker: `Uusi keksintö · peli pysähtyi · Päivä ${clock.day}`,
    name: ADVANCES[a].name,
    facts: advanceEffects(a),
    options: options.map(o => ({ study: o.advance, name: o.name, cost: o.cost, opens: o.opens })),
    chosen,
    // Below the state level the people's choice waits ready (own rule, Utu's review: told as the default)
    suggestion: chosen === null ? null : chosen === p.research.target ? 'Tutkimus jatkuu, ellet valitse muuta.' : advisor ? `${advisor} ehdottaa tätä.` : 'Oletus: kansa tutkii tätä, ellet valitse muuta.',
    firsts: firstChoices(a).map(b => ({ build: b, name: BUILDS[b].name, scopes: firstScopes(b) })),
    more: p.learned.length - 1,
    era: eraOpened(a),
  });
}

/** The era an advance opens, with the three persons it brings to the level in view (STORY-120). */
function eraOpened(a: Advance): AdvanceView['era'] {
  const era = eraOpenedBy(a);
  if (!era) return null;
  const level = advisorLevel();
  return {
    name: ERA_NAMES[era],
    persons: ROLES[level].map(role => {
      const person = personOf(level, role, era)!;
      return { person, bonus: describeBonus(level, person.bonus), page: `advisor/${level}/${role}` };
    }),
  };
}

function researchView(): ResearchView {
  const r = play!.research;
  const rates = scienceRates();
  // A kind of resource the people study themselves too, a bulb a day from each city (STORY-072)
  const perDay = rates.science + peopleStudy();
  const days = r.target && perDay > 0 ? Math.max(1, Math.ceil((r.cost - r.bulbs) / perDay)) : null;
  return {
    rates: `Tiedettä +${rates.science}/pv · kultaa ${rates.gold < 0 ? '−' : '+'}${Math.abs(rates.gold)}/pv${rates.luxury ? ` · ylellisyyttä +${rates.luxury}` : ''}`,
    current: r.target
      ? `Tutkitaan: ${studyName(r.target)} · ${Math.min(r.bulbs, r.cost)}/${r.cost}${days ? ` · valmis ${days} pv` : ''}`
      : 'Valitse, mitä tutkitaan. Tiede kertyy odottamaan.',
    progress: r.cost ? r.bulbs / r.cost : 0,
    hint: perDay > 0 ? null : 'Tiedettä ei tule: tiede syntyy kaupasta. Kauppaa tuovat tiet ruoho-, tasanko- ja aavikkomaalla (uudisasukas: Kehitä) ja meriruudut; pienempi kullan osuus siirtää kauppaa tieteeseen.',
    options: studyOptions(),
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

/** Room between the top panel and the middle of a city label: half its height and a margin. */
const LABEL_CLEARANCE = 32;
/** How far a city's label stands above it: at the city level it goes up over the walls (STORY-069). */
function labelLift(): number {
  return viewLevel === 3 ? 48 + 100 * cityLevel.relief.value : 0;
}

/**
 * Move the view so that a city stands midway between the top panel and the card: the
 * point now on the screen where the city should move from becomes the centre. Its label
 * stays below the top panel, so that it can be tapped again (STORY-075: at the city level
 * the raised label went under the panel).
 */
function keepAboveCard(tile: number) {
  const at = toScreen(tileCenter(tile));
  if (!at) return;
  const top = document.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? 0;
  const goal = [window.innerWidth / 2, Math.max((top + cityCard.top()) / 2, top + labelLift() + LABEL_CLEARANCE)];
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
  else if (shownCard === 'treaty') chooseTreaty(index);
  else if (shownCard === 'over') void clearSave().then(() => location.reload());
});

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

const pct = (x: number) => `${Math.round(x * 100)} %`;
/** What the raid card's buttons do, in their order. */
let raidChoices: ('build' | 'buy' | 'later')[] = ['build', 'later'];

/** The card on a band's first sight: build a soldier, buy one, or trust the defence. */
function updateRaidAlert() {
  const band = play?.raids.band;
  if (!play || !band || !play.raidAlert) return;
  const lead = band.bandits[0].tile;
  if (!discoveryCard.visible) {
    shownCard = 'raid';
    moment('raid', lead);
    const c = play.cities.find(x => x.tile === band.city)!;
    const soldiers = soldiersIn(c.tile).length;
    const plan = raidPlan(c);
    const [who, they] = band.tribe ? ['paimentolaisia', 'paimentolaiset'] : ['rosvoja', 'rosvot'];
    const name = plan.soldier === 'phalanx' ? 'falangi' : 'soturi';
    const Name = plan.soldier === 'phalanx' ? 'Falangi' : 'Soturi';
    // The chances are for the whole band, fight after fight (STORY-108)
    const keeps = (x: number) => `kaupunki kestää ${pct(x)}`;
    const choices: { kind: 'build' | 'buy' | 'later'; option: { kind: ChoiceKind; title: string; effect: string } }[] = [
      { kind: 'build', option: { kind: 'defend', title: `Rakenna ${name}`, effect: plan.ready === null ? 'Kaupungilla ei ole tuotantoa' : plan.inTime ? `Valmis ${Math.max(1, plan.ready)} pv, ennen ${who} · ${keeps(plan.withOne)}` : `Valmis vasta ${plan.ready} pv: ${they} ehtivät ensin` } },
    ];
    if (!plan.inTime && plan.price > 0 && plan.price <= play.gold) {
      choices.push({ kind: 'buy', option: { kind: 'defend', title: `Osta ${name}`, effect: `${plan.price} kultaa, valmis huomenna · ${keeps(plan.withOne)}` } });
    }
    choices.push({ kind: 'later', option: { kind: 'later', title: 'Luota puolustukseen', effect: soldiers ? keeps(plan.now) : `Ilman sotilasta ${they} ryöstävät kaupungin` } });
    raidChoices = choices.map(x => x.kind);
    discoveryCard.show({
      day: clock.day,
      kicker: `Uhka · ${c.name}`,
      title: band.tribe ? `${band.tribe} hyökkää` : 'Rosvoja liikkeellä',
      body: `${band.tribe ? `${plan.n} paimentolaista` : plan.n === 1 ? 'Rosvo' : `${plan.n} rosvoa`} on matkalla kohti kaupunkia ja perillä noin ${plan.arrive} päivässä. ${soldiers ? `Kaupungissa on ${soldiers} ${soldiers === 1 ? 'sotilas' : 'sotilasta'}.` : 'Kaupungissa ei ole sotilaita.'} Jokainen ${plan.n === 1 ? 'hyökkääjä' : 'hyökkääjistä'} taistelee, kunnes se kaatuu tai kaupungissa ei ole enää sotilaita. ${Name} on ${plan.soldier === 'phalanx' ? 'paras puolustaja' : 'heikko puolustaja: falangi tai muuri auttaa'}.`,
      options: choices.map(x => x.option),
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

function chooseRaid(index: number, by: Actor = 'player') {
  if (!play) return;
  discoveryCard.hide();
  const choice = by === 'player' ? raidChoices[index] : index === 0 ? 'build' : 'later';
  raidChoices = ['build', 'later'];
  dispatch({ kind: 'raid', choice }, by);
}

// ─── Province and state levels (STORY-026) ────────
// Each level opens the next when its goal is reached (STORY-087), and has its own chips and actions.
/** The advisors of a level that opened, asked for as soon as its card is closed: no day passes between (STORY-095). */
function showPickPending() {
  if (pickPending === null || unlockCard.visible || onboarding.visible) return;
  showPick(pickPending);
  pickPending = null;
}
const unlockCard = createUnlockCard(hud_root, () => {
  // From the city level out to its city area, round the city (STORY-070)
  if (viewLevel === 3 && rig.dist < frames[3] * CITY_LEVEL_AT) {
    fly({ point: rig.target.clone().normalize(), dist: frames[3], level: 3 });
    return;
  }
  const to = upTarget(rig.target);
  if (to) fly(to);
}, () => showPickPending());
const chips = createChips(hud_root, id => {
  const level = viewLevel as 0 | 1 | 2;
  const ref = { level, id } as RegionRef;
  if (sameRegion(ref, selection)) fly(diveTarget(regions, ref, frames));
  else selection = ref;
});
const levelPanels = createLevelPanels(hud_root, {
  setPlan: (plan: AreaPlan) => { const a = selectedArea(); if (a !== null) dispatch({ kind: 'plan', area: a, plan }, 'player'); },
  // An expedition: the scouts toward the area's centre
  expedition: () => { const a = selectedArea(); if (a !== null) dispatch({ kind: 'flag', tile: pointToTile(regions.centers[2][a]) }, 'player'); },
  setLine: (line: StateLine) => { dispatch({ kind: 'line', line }, 'player'); },
  setTargetState: () => {
    const s = selection?.level === 0 ? selection.id : null;
    if (s !== null) dispatch({ kind: 'aim', state: s }, 'player');
  },
  // The target province, and the scouts toward its centre
  setTarget: () => {
    const p = selectedProvince();
    if (p !== null && dispatch({ kind: 'target', province: p }, 'player')) dispatch({ kind: 'flag', tile: pointToTile(regions.centers[1][p]) }, 'player');
  },
});

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

/** The selected area at the province level, else the area under the view. */
function selectedArea(): number | null {
  if (viewLevel !== 2) return null;
  return selection?.level === 2 ? selection.id : path.length >= 2 ? regionPath(regions, rig.target, 3)[2].id : null;
}
function selectedProvince(): number | null {
  if (viewLevel !== 1) return null;
  return selection?.level === 1 ? selection.id : regionPath(regions, rig.target, 2)[1].id;
}

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

// ─── Onboarding (STORY-096) ───────────────────────
// A new game greets and tells what to do: the player chooses the advisors, and the people
// carry them out. The three advisors of a level come as big cards, at the start and with each
// level that has advisors of its own; Ohjaan itse brings every menu out. The old start
// (?classic) is for the mechanics' tests and keeps every menu.

/** The level whose advisor choice waits for the rise card to close, or null. */
let pickPending: number | null = null;
/** The level the advisor cards are for, and whether the tour follows them. */
let pickFor: AdvisorLevel = 'city';
let tourNext = false;

const onboarding = createOnboarding(hud_root, {
  start: () => showPick(play?.progress.openLevel ?? 4),
  pick: id => {
    dispatch({ kind: 'advise', level: pickFor, advisor: id }, 'player');
    if (tourNext) onboarding.tour();
    tourNext = false;
  },
  done: () => {},
});


/** The player's own hand: every menu shows. Under an advisor of the level played, only the goal, the time and the advisor. */
function ownHand(): boolean {
  if (classic || !play) return true;
  return chosenAdvisor(advisorOfLevel(play.progress.openLevel)) === 'none';
}

/** Each level's question in the big advisor cards. */
const PICK_TITLES: Record<AdvisorLevel, string> = { town: 'Kuka hoitaa kaupunkiasi?', city: 'Kuka hoitaa kaupunkialuetta?', province: 'Kuka hoitaa lääniäsi?', state: 'Kuka hoitaa valtiotasi?', planet: 'Kuka hoitaa suhteet muihin valtioihin?' };

/** The three advisors of a level as big cards, each with this era's person (STORY-105). */
function showPick(level: number) {
  pickFor = advisorOfLevel(level);
  onboarding.pick({
    kicker: `${ADVISOR_LEVEL_NAMES[pickFor]} · ${ERA_NAMES[eraNow()]}`,
    title: PICK_TITLES[pickFor],
    options: advisorButtons(pickFor).filter(b => b.id !== 'none').map(b => ({ id: b.id, name: b.role, does: b.does, person: b.person })),
  });
}

/** Chips and panels of the province and state levels, and the unlocks. */
function updateLevels() {
  if (!play || !game) return;
  const won = conquestNow();
  showPickPending();
  // A rise due between the days (a loaded game, a card answered) comes as the frame's
  if (!discoveryCard.visible && !unlockCard.visible && !onboarding.visible) riseCheck();
  const list: Chip[] = [];
  // A province held tells its cities (STORY-114): its chip stands for them at the state level.
  // A city holds its province (STORY-016), so the count says it, and the chip stays narrow on a phone.
  const perProvince = new Map<number, number>();
  if (viewLevel === 1) for (const c of play.cities) perProvince.set(provinceOfTile(c.tile), (perProvince.get(provinceOfTile(c.tile)) ?? 0) + 1);
  const held = (province: number) => {
    const n = perProvince.get(province) ?? 0;
    return n ? `${n} ${n === 1 ? 'kaupunki' : 'kaupunkia'}` : 'Hallussa';
  };
  if (viewLevel === 2 || viewLevel === 1) {
    const level = viewLevel === 2 ? 2 : 1;
    const parent = path[level - 1]?.id ?? 0;
    for (let k = 0; k < 7; k++) {
      const id = parent * 7 + k;
      const at = toScreen(regions.centers[level][id]);
      const share = level === 2 ? areaShare(id) : provinceShare(id);
      const sub = level === 2
        ? share === 0 ? 'Sumussa' : AREA_PLAN_NAMES[play.units.areaPlans.get(id) ?? 'explore']
        : id === play.targetProvince ? 'Tavoite' : !provinceHasLand(id) ? 'Ei maata' : won.held.has(id) ? held(id) : `Kartoitettu ${Math.round(share * 100)} %`;
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
  chipRects = chips.update(list, list.length ? panelEdges() : { top: 0, bottom: window.innerHeight }, viewLevel === 0);
}

/** Where the level's chips stood this frame, for the city labels (STORY-114). */
let chipRects: ScreenRect[] = [];

// "−" zooms out a level on a desktop (the unlock card's hint)
window.addEventListener('keydown', e => {
  if (e.key === 'i' && play && !e.ctrlKey && !e.metaKey && !e.altKey) play.area.toggle();
  if ((e.key === '-' || e.key === 'Subtract') && viewLevel > lockedLevel) {
    const to = upTarget(rig.target);
    if (to) fly(to);
  }
});

/** A tap at the city-area level: a unit, or the flag's tile with the flag tool. Returns true if used. */
function tapPlay(x: number, y: number, width: number, height: number, hit: THREE.Vector3 | null): boolean {
  if (!play) return false;
  if (play.flagTool && hit) {
    // The exploring scouts toward it, on land in an open state (Units.sendTo)
    dispatch({ kind: 'flag', tile: pointToTile(hit) }, 'player');
    play.flagTool = false;
    return true;
  }
  // Moving a building (STORY-071): a tap on a marked tile puts it there
  if (play.moving) {
    const { city, building } = play.moving;
    const c = play.cities.find(x => x.tile === city);
    if (hit && c && dispatch({ kind: 'move', city: c.tile, building, tile: pointToTile(hit) }, 'player')) {
      play.tileOpen = c.placed![building]!;
      stopMoving();
    }
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
  // (With no units yet, at the new start, neither is there: the tap opens the hex's card)
  const selected = play.units.units[play.selected];
  if (selected && selected === play.units.settler) return dispatch({ kind: 'pick', tile }, 'player');
  // What the hex holds (STORY-055)
  play.tileOpen = tile;
  play.openCity = null;
  play.listOpen = play.researchOpen = play.advisorOpen = false;
  return true;
}

const tileCard = createTileCard(hud_root, {
  // A city in a region's card opens its quick panel where the view is (STORY-114); elsewhere a link flies down to it
  links: { ...richLinks, city: tile => (viewLevel < 3 && regionCard !== null ? quickCityAt(tile) : richLinks.city(tile)) },
  close: () => {
    if (!play) return;
    if (play.moving) stopMoving();
    play.tileOpen = null;
    // A region's card closed: the selection stays for the level's actions (STORY-067)
    regionCard = null;
  },
  // Cancel a move; move a building on the hex (STORY-071); or into the region, as a second tap does
  action: i => {
    if (play?.moving) return stopMoving();
    // The hex's buttons (STORY-071, STORY-074, STORY-076)
    if (play && play.tileOpen !== null && viewLevel === 3) return tileActions[i]?.();
    if (selection) fly(diveTarget(regions, selection, frames));
  },
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
    // A city holds a province, and at the province level a border too (STORY-093)
    const byCity = p.cities.some(c => provinceOfTile(c.tile) === ref.id);
    const land = provinceStage() ? borderLandIn(ref.id) : 0;
    rows.push({ label: 'Tila', value: !provinceHasLand(ref.id) ? 'ei maata, lasketaan hallussa olevaksi' : byCity ? 'hallussa: kaupunki läänissä' : won.held.has(ref.id) ? `hallussa: rajasi kattavat ${land} maaruutua` : land ? `ei hallussa: rajasi kattavat ${land} / ${HOLD_BY_BORDER} maaruutua` : 'ei hallussa' });
    if (provinceStage()) provinceRows(ref.id).forEach(r => rows.push(r));
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
        const k = TERRAIN_RULES[terrain].resource;
        const name = knownKind(k) ? RESOURCES[k].name : 'tuntematon';
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
  // A province's and an area's cities all, as links to their quick panels (STORY-114); a state's in short
  rows.push({ label: 'Kaupungit', value: !cities.length ? 'ei kaupunkeja' : ref.level === 0 ? someOf(cities.map(c => `${c.name} (${c.size})`))
    : [...cities].sort((a, b) => b.size - a.size || a.id - b.id).flatMap((c, i): Rich => [...(i ? [', '] : []), cityRef(c.tile, c.name), ` (${c.size})`]) });
  const natives = visibleNatives().filter(n => inside.has(n.tile));
  if (natives.length) rows.push({ label: 'Kaupunkivaltiot', value: someOf(natives.map(n => `${n.name} (${nativeStrength(n, clock.day).size})`)) });
  const rivalCities = visibleRivalCities().filter(x => inside.has(x.city.tile));
  if (rivalCities.length) rows.push({ label: 'Kilpailijat', value: someOf(rivalCities.map(x => `${x.city.name} (${x.rival.name})`)) });
  const tribes = visibleTribes().filter(t => inside.has(t.camp));
  if (tribes.length) rows.push({ label: 'Paimentolaiset', value: tribes.map(t => t.tribe.name).join(', ') });
  const kicker = ref.level === 0 ? 'Valtio' : ref.level === 1 ? `Lääni · ${stateNameOf(Math.floor(ref.id / 7)).name}` : `Kaupunkialue · ${nameOf(1, Math.floor(ref.id / 7)).name}`;
  const title = ref.level === 0 ? stateNameOf(ref.id).name : nameOf(ref.level, ref.id).name;
  const view: TileView = { kicker, title, rows, actions: ['Sukella sisään'] };
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
  // A kind not studied is unknown (STORY-072)
  const found = tileTypes.codes[id] & 16 ? TERRAIN_RULES[terrain].resource : null;
  const kind = found && knownKind(found) ? found : null;
  const { city, owner, worked, y } = tileYieldNow(id);
  const done = (['irrigation', 'mine', 'road'] as const).filter(k => p.improvements.has(id, k)).map(k => IMPROVEMENT_NAMES[k]);
  // The units here, each a link that selects it (STORY-103)
  const units = p.units.units.filter(u => u.tile === id).flatMap((u, i): Rich => (i ? [', ', unitRef(u.id, u.name)] : [unitRef(u.id, u.name)]));
  const bonus = p.bonuses.get(id);
  const cost = world.cost(id);
  const native = nativeAt(id);
  const tribe = tribeAt(id);
  const rival = rivalCityAt(id);
  const rows: TileView['rows'] = [
    { label: 'Tuottaa', value: `ruokaa ${y.food} · tuotantoa ${y.shield} · kauppaa ${y.trade} päivässä` },
    ...(kind ? [{ label: 'Erikoisresurssi', value: `${RESOURCES[kind].name} (${plus(RESOURCES[kind])})` }]
      : found ? [{ label: 'Erikoisresurssi', value: `tuntematon: tutkimus ${studyName(found)} paljastaa sen ja sen tuoton` }] : []),
    // A strategic resource at the province level: joined by road, waiting, or outside the border (STORY-093)
    ...(kind && isStrategic(kind) && provinceStage() ? [{ label: 'Yhteys', value: joinLine(id, kind) }] : []),
    { label: 'Parannukset', value: city ? 'kaupungin keskus: kastelu ja tie' : done.length ? done.join(', ') : 'ei' },
    ...(bonus ? [{ label: 'Löytö', value: plus(bonus) }] : []),
    ...(tribe ? [{ label: 'Paimentolaiset', value: tribeLine(tribe) }] : []),
    ...((native || tribe || rival) && p.war.target === id ? [{ label: 'Sotaretki', value: `Kenraalin kohde · ${army().length} / ${warNeed(id)} hyökkääjää${p.war.marching ? ' · hyökkäys käynnissä' : ''}` }] : []),
    rival ? { label: 'Kilpailija', value: `${rival.rival.name}: ${rival.city.name}, koko ${rival.city.size}` } :
    native ? { label: 'Kaupunkivaltio', value: nativeLine(native) } : { label: 'Kaupunki', value: city ? [cityRef(city.tile, city.name), `, koko ${city.size}`] : owner ? [cityRef(owner.tile, owner.name), `: ${worked ? 'asukas työstää ruutua' : 'alueella, ei työstetä'}`] : 'ei kaupungin alueella' },
    ...cityRows(id, city ?? owner ?? null),
    ...(units.length ? [{ label: 'Yksiköt', value: units }] : []),
    ...(p.raids.band?.bandits.some(b => b.tile === id) ? [{ label: 'Uhka', value: 'Rosvoja ruudulla' }] : []),
    { label: 'Kulku', value: Number.isFinite(cost) ? `${cost} pv` : coastal(id) ? (canSail() ? 'rannikkovesi: 1 pv' : 'rannikkovesi: Kartanteko avaa kulun') : 'avomeri: ei kulkua' },
    ...(p.units.isOpen(id, world) ? [] : [{ label: 'Valtio', value: 'lukossa, kunnes kotivaltio on vallattu' }]),
    ...placementRows(id),
  ];
  const settle = settleAction(id);
  const met = rival ? p.rivals.indexOf(rival.rival) : -1;
  const actions: { label: string; run: () => void }[] = [
    ...movable(id).map(m => ({ label: `Siirrä ${BUILDS[m.building].name.toLowerCase()}`, run: () => startMoving(m) })),
    ...(settle ? [{ label: settle, run: () => { dispatch({ kind: 'settle', tile: id }, 'player'); } }] : []),
    // A rival met: its diplomacy (STORY-076)
    ...(met >= 0 && p.ties[met]?.met ? [{ label: `Diplomatia: ${rival!.rival.name}`, run: () => openDiplomacy(met) }] : []),
  ];
  tileActions = actions.map(a => a.run);
  return { kicker, title: kind ? `${TERRAIN_RULES[terrain].name} · ${RESOURCES[kind].name}` : found ? `${TERRAIN_RULES[terrain].name} · tuntematon resurssi` : TERRAIN_RULES[terrain].name, rows, ...(actions.length ? { actions: actions.map(a => a.label) } : {}) };
}

/** What the hex card's buttons do, in their order; set with its view. */
let tileActions: (() => void)[] = [];

// ─── Diplomacy (STORY-076) ─────────────────────────
// Sami 2026-10-20: "diplomatia määrää", and the rival's attitude steers it (diplomacy.ts,
// docs/design/diplomatia.md). A rival is met when one of its cities shows on the map; its card
// tells what is known of it and what can be done with it.

const STATE_NAMES: Record<Relation, string> = { peace: 'rauha', war: 'sota', alliance: 'liitto' };

/** Which card is shown: a site offer's or a raid's. */
let shownCard: 'site' | 'raid' | 'treaty' | 'over' | null = null;

/** The card of a proposal waiting, also one saved waiting (STORY-095). */
function updateTreatyCard() {
  const p = play;
  if (!p?.treaty || discoveryCard.visible) return;
  const { rival: k, kind } = p.treaty;
  const r = p.rivals[k];
  const t = p.ties[k];
  shownCard = 'treaty';
  discoveryCard.show({
    day: clock.day,
    kicker: `Diplomatia · ${r.name}`,
    title: kind === 'alliance' ? 'Liittoehdotus' : 'Rauhanehdotus',
    body: kind === 'alliance' ? `${r.name} on ${attitudeWord(t.attitude)} ja ehdottaa liittoa.` : `${r.name} on sotinut ${clock.day - t.since} päivää ja ehdottaa rauhaa.`,
    options: [
      { kind: 'treaty', title: kind === 'alliance' ? 'Solmi liitto' : 'Tee rauha', effect: kind === 'alliance' ? 'Asenne paranee joka päivä' : 'Sota päättyy' },
      { kind: 'later', title: 'Kieltäydy', effect: kind === 'alliance' ? 'Suhde pysyy rauhana' : 'Sota jatkuu' },
    ],
    note: kind === 'alliance' ? 'Liitossa asenne nousee päivä päivältä.' : 'Rauhassa asenne palaa vähitellen kohti varautunutta.',
  });
}

function chooseTreaty(index: number) {
  discoveryCard.hide();
  dispatch({ kind: 'treaty', accept: index === 0 }, 'player');
}

function openDiplomacy(k: number) {
  if (!play || !play.ties[k]?.met) return;
  play.listOpen = false;
  play.tileOpen = null;
  play.openCity = null;
  play.diplomacyOpen = k;
}

/** The diplomacy card: what is known of the rival and what can be done with it. */
function diplomacyView(k: number): TileView {
  const p = play!;
  const r = p.rivals[k];
  const t = p.ties[k];
  const near = nearCitiesOf(k);
  const known = knownRivalCities(k);
  return {
    kicker: 'Diplomatia',
    title: r.name,
    rows: [
      { label: 'Suhde', value: `${STATE_NAMES[t.state]} · ${clock.day - t.since} pv` },
      { label: 'Asenne', value: `${attitudeWord(t.attitude)} (${t.attitude > 0 ? '+' : ''}${t.attitude})` },
      { label: 'Syyt', value: reasons(t, near.length > 0).join(' · ') || 'ei muutoksia' },
      { label: 'Kaupungit', value: known.length ? `${someOf(known.map(c => `${c.name} (${c.size})`))} · ${known.length} tunnettua` : 'ei tunnettuja' },
      { label: 'Sotavoima', value: `${r.units.filter(u => u.kind === 'warrior').length} soturia · ${r.army().length} hyökkääjää` },
      { label: 'Keksinnöt', value: r.research.known.size ? someOf([...r.research.known].map(a => ADVANCES[a].name)) : 'ei vielä yhtään' },
      ...(t.state === 'war' && r.war.target !== null ? [{ label: 'Sotaretki', value: `kohteena ${p.cities.find(c => c.tile === r.war.target)?.name ?? '—'} · ${r.war.marching ? 'joukko marssii' : `kokoaa joukkoa ${r.army().length} / ${r.enemy?.need ?? '?'}`}` }] : []),
      { label: 'Rajat', value: near.length ? `lähellä: ${near.map(c => c.name).join(', ')}` : 'kaukana' },
      ...(t.state === 'war' ? [{ label: 'Rauha', value: clock.day - t.since < 10 ? `ei ennen kuin sota on kestänyt 10 päivää (${10 - (clock.day - t.since)} pv)` : t.attitude >= -60 || t.lost > 0 ? 'se voi hyväksyä rauhan' : 'liian vihamielinen rauhaan' }] : []),
    ],
    actions: t.state === 'peace' ? ['Vaihda', 'Julista sota', 'Ehdota liittoa'] : t.state === 'war' ? ['Ehdota rauhaa'] : ['Vaihda', 'Pura liitto'],
  };
}

const diplomacyCard = createTileCard(hud_root, {
  close: () => { if (play) play.diplomacyOpen = null; },
  action: i => {
    if (!play || play.diplomacyOpen === null) return;
    const k = play.diplomacyOpen;
    const act = diplomacyView(k).actions![i];
    if (act === 'Vaihda') {
      play.diplomacyOpen = null;
      play.tradeOpen = k;
      tradeGive = tradeGet = 'nothing';
      return;
    }
    // The rest are commands (STORY-112); the game tells what came of them
    const pact = ({ 'Julista sota': 'war', 'Pura liitto': 'break', 'Ehdota liittoa': 'alliance', 'Ehdota rauhaa': 'peace' } as const)[act as 'Julista sota'];
    if (pact) dispatch({ kind: 'pact', rival: k, act: pact }, 'player');
  },
}, 'diplomacy');

function updateDiplomacyCard() {
  if (!play) return;
  const other = play.openCity !== null || researchCard.visible || listCard.visible || advisorCard.visible || discoveryCard.visible || tileCard.visible || tradeCard.visible;
  if (other && play.diplomacyOpen !== null && diplomacyCard.visible) play.diplomacyOpen = null;
  const k = play.diplomacyOpen;
  if (k === null || other || !play.ties[k]?.met) {
    if (diplomacyCard.visible) diplomacyCard.hide();
    return;
  }
  const view = diplomacyView(k);
  if (diplomacyCard.visible) diplomacyCard.update(view);
  else diplomacyCard.show(view);
}

// ─── Trades (STORY-078) ────────────────────────────
// What can be traded and how the rival weighs it are the game's (sim/game.ts); the card keeps
// what the player has chosen.

let tradeGive = 'nothing';
let tradeGet = 'nothing';

function tradeView(k: number): TradeView {
  const p = play!;
  const r = p.rivals[k];
  const t = p.ties[k];
  const w = weighTrade(k, tradeGive, tradeGet);
  const verdict = w.f === null ? `${r.name} ei vaihda: ${t.state === 'war' ? 'olette sodassa' : 'se on vihamielinen'}`
    : !w.got && !w.given ? 'Valitse, mitä annat ja mitä saat.'
    : w.ok ? `${r.name} hyväksyy (${attitudeWord(t.attitude)}: arvo ${w.got} vastaan ${w.given})`
    : `${r.name} haluaa enemmän: tarjoat arvoa ${w.got}, se vaatii ${Math.ceil(w.given * w.f)} (${attitudeWord(t.attitude)})`;
  return {
    title: r.name,
    give: w.items.give.map(x => ({ id: x.id, name: x.name, worth: x.id === 'nothing' ? '' : `arvo ${worth(x.item, r.research.known.size)}`, selected: x.id === w.give.id })),
    get: w.items.get.map(x => ({ id: x.id, name: x.name, worth: x.id === 'nothing' ? '' : `arvo ${worth(x.item, p.research.known.size)}`, selected: x.id === w.get.id })),
    verdict,
    canOffer: w.f !== null && (w.got > 0 || w.given > 0),
  };
}

/** The player offers the trade on the card, as a command (STORY-112): accepted, the card starts over. */
function offerTrade(k: number) {
  const w = weighTrade(k, tradeGive, tradeGet);
  if (dispatch({ kind: 'trade', rival: k, give: w.give.id, get: w.get.id }, 'player')) tradeGive = tradeGet = 'nothing';
}

const tradeCard = createTradeCard(hud_root, {
  // Back to the rival's diplomacy card
  close: () => { if (play && play.tradeOpen !== null) { play.diplomacyOpen = play.tradeOpen; play.tradeOpen = null; } },
  give: id => { tradeGive = id; },
  get: id => { tradeGet = id; },
  offer: () => { if (play?.tradeOpen !== null && play?.tradeOpen !== undefined) offerTrade(play.tradeOpen); },
});

function updateTradeCard() {
  if (!play) return;
  const k = play.tradeOpen;
  const other = play.openCity !== null || researchCard.visible || listCard.visible || advisorCard.visible || discoveryCard.visible || tileCard.visible;
  if (other && k !== null && tradeCard.visible) play.tradeOpen = null;
  if (play.tradeOpen === null || other || !play.ties[play.tradeOpen]?.met) {
    if (tradeCard.visible) tradeCard.hide();
    return;
  }
  const view = tradeView(play.tradeOpen);
  if (tradeCard.visible) tradeCard.update(view);
  else tradeCard.show(view);
}

// ─── A city here (STORY-074) ───────────────────────
// Sami 2026-10-20: a tap on a hex also tells the city's whole yield, and sends a settler there.

const yieldText = (y: Yield) => `ruokaa ${y.food} · tuotantoa ${y.shield} · kauppaa ${y.trade}`;

/** Why no city may be founded on a hex, or null: land in an open state, clear of foreign cities and three rings from the player's. */
function settleBlock(tile: number): string | null {
  const p = play!;
  if (!Number.isFinite(world.cost(tile))) return 'ei maata';
  if (!p.units.isOpen(tile, world)) return 'valtio on lukossa';
  if (nearForeign(tile)) return 'liian lähellä vierasta kaupunkia';
  const near = new Set(tilesInRings(tile, SITE_SPACING - 1));
  if (p.cities.some(c => near.has(c.tile))) return 'liian lähellä omaa kaupunkia';
  return null;
}

/** The hex card's rows of a city: its whole yield, or what a city founded here would yield; once a day. */
let cityRowsCache: { key: string; rows: TileView['rows'] } | null = null;
function cityRows(id: number, c: City | null): TileView['rows'] {
  const p = play!;
  const key = `${id}|${clock.day}|${p.gov}|${p.pendingSite}|${p.units.settler?.path.length ?? -1}|${p.cities.map(x => `${x.size},${x.buildings.length},${x.best?.length ?? 0},${x.focus}`).join(';')}`;
  if (cityRowsCache?.key === key) return cityRowsCache.rows;
  let rows: TileView['rows'];
  if (c) {
    const y = cityYields()[p.cities.indexOf(c)];
    rows = [{ label: 'Kaupungin tuotto', value: `${c.name}: ${yieldText(y)} päivässä · ruoan ylijäämä ${y.surplus}` }];
  } else if (settleBlock(id) === 'ei maata') {
    rows = [];
  } else {
    // At size 1 the centre and the best free tile; the area is the two rings
    const taken = new Set(workedByCity().flat());
    const here: City = { id: -1, name: '', tile: id, capital: false, size: 1, food: 0, shields: 0, build: 'coinage', buildings: [], focus: 'balanced' };
    const start = cityYield(here, yieldOf, taken, undefined, p.gov);
    const area = tilesInRings(id, 2).reduce((sum, t) => {
      const y = tileOutput(here, yieldOf(t, t === id), p.gov);
      return { food: sum.food + y.food, shield: sum.shield + y.shield, trade: sum.trade + y.trade };
    }, NO_YIELD);
    const block = settleBlock(id);
    const settler = p.units.settler;
    const going = settler && p.units.founding && p.units.currentSite() === id;
    rows = [
      { label: 'Kaupunki tässä', value: `alussa ${yieldText(start)} päivässä` },
      { label: 'Koko alue', value: `kaksi rengasta: ${yieldText(area)} päivässä` },
      { label: 'Uudisasukas', value: block ? `ei kaupunkia: ${block}` : going ? 'matkalla perustamaan kaupunkia' : p.pendingSite === id ? `${p.cities[0]?.name ?? 'Kaupunki'} rakentaa uudisasukasta tänne` : !unitsOpen() ? 'avautuu, kun kaupunki on valmis settlementti' : idleSettler() ? 'vapaa uudisasukas voi lähteä' : 'pääkaupunki voi rakentaa sellaisen' },
    ];
  }
  cityRowsCache = { key, rows };
  return rows;
}

/** The hex card's button for a city here: send a free settler, or have the capital build one. */
function settleAction(id: number): string | null {
  const p = play!;
  if (!mapState.isMapped(id) || p.cities.some(c => tilesInRings(c.tile, cityRings(c.size)).includes(id)) || settleBlock(id)) return null;
  if (p.pendingSite === id || (p.units.founding && p.units.currentSite() === id)) return null;
  if (idleSettler()) return 'Lähetä uudisasukas';
  return unitsOpen() && p.cities.length ? 'Rakenna uudisasukas tänne' : null;
}

// ─── Buildings on their tiles (STORY-071) ──────────
// The governor puts each building on its best ground (placement.ts); at the city level the
// player may move one: its card's button marks where it may go, and a tap puts it there.

const PLACE_NAMES = { up: 'ylhäällä, keskustaa korkeammalla', low: 'alhaalla, keskustan tasolla tai alempana', mountains: 'vuorella' } as const;

/** A hex's height and buildings next to one of the player's cities. */
function placementRows(id: number): TileView['rows'] {
  const c = play!.cities.find(x => x.tile !== id && tilesInRings(x.tile, PLACE_RINGS).includes(id));
  if (!c || terrainOf(id) === 'ocean') return [];
  const here = c.buildings.filter(b => c.placed?.[b] === id);
  return [
    { label: 'Korkeus', value: terrainOf(id) === 'mountains' ? 'jyrkkä vuori: vain louhos' : isUp(c, id, ground) ? PLACE_NAMES.up : PLACE_NAMES.low },
    ...(here.length ? [{ label: 'Rakennukset', value: here.map(b => `${BUILDS[b].name}${c.best?.includes(b) ? ` (paras paikka: ${bestOf(c, b)!.gives})` : ''}`).join(', ') }] : []),
  ];
}

/** Buildings on a hex the player may move: at the city level of their city, risen. */
function movable(tile: number): { city: number; building: Building }[] {
  const c = play?.cities.find(x => x.tile === cityLevel.city);
  if (!c || cityLevel.relief.value < 1) return [];
  return c.buildings.filter(b => c.placed?.[b] === tile).map(b => ({ city: c.tile, building: b }));
}

function startMoving(m: { city: number; building: Building }) {
  const c = play!.cities.find(x => x.tile === m.city)!;
  play!.moving = m;
  play!.tileOpen = null;
  cityLevel.mark(spots(c, m.building, ground));
}

function stopMoving() {
  if (play) play.moving = null;
  cityLevel.mark([]);
}

/** The card while a building moves: where it does best, and how to put it there. */
function movingView(c: City, b: Building): TileView {
  const best = bestOf(c, b);
  return {
    kicker: c.name, title: `Siirrä: ${BUILDS[b].name}`,
    rows: [
      { label: 'Paras paikka', value: best ? `${typeof best.at === 'string' ? PLACE_NAMES[best.at] : best.at.map(t => TERRAIN_RULES[t].name.toLowerCase()).join(' tai ')}: ${best.gives}` : 'ei erityistä paikkaa' },
      { label: 'Valitse', value: 'Napauta merkittyä ruutua. Kultainen merkki on paras paikka.' },
    ],
    actions: ['Peru'],
  };
}

function updateTileCard() {
  if (!play) return;
  // Another card closes this one
  const other = play.openCity !== null || researchCard.visible || listCard.visible || advisorCard.visible || discoveryCard.visible;
  if (other) play.tileOpen = null;
  // A building on the move: its card, until a tile is tapped, it is cancelled or the land sinks (STORY-071)
  if (play.moving) {
    const c = play.cities.find(x => x.tile === play!.moving!.city);
    if (!c || other || cityLevel.city !== c.tile || cityLevel.relief.value < 1) stopMoving();
    else {
      const view = movingView(c, play.moving.building);
      if (tileCard.visible) tileCard.update(view);
      else tileCard.show(view);
      return;
    }
  }
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

/** The city level's goal step by step (STORY-089): what the capital still needs to be a ready settlement. */
function settlementHint(): string {
  const c = play!.cities.find(x => x.capital) ?? play!.cities[0];
  if (!c) return levelGoal(4)!.hint;
  const step = settlementSteps(c.buildings, c.size);
  return `Valmis settlementti avaa kaupunkialueen: ${[
    step.base ? 'perusta valmis' : 'perusta (metsuri, saha ja louhos)',
    step.food ? 'ruokaketju valmis' : 'ruokaketju (pelto, mylly ja leipomo tai kalastamo)',
    `asukkaita ${Math.min(c.size, SETTLEMENT_SIZE)} / ${SETTLEMENT_SIZE}`,
  ].join(' · ')}.`;
}

/**
 * The city area's goal step by step (STORY-092): the ready settlements, and each city still
 * growing with what it lacks, and with fewer than three cities the settlers there are.
 */
function settlementsHint(): string {
  const p = play!;
  const ready = readySettlements(p.cities);
  const growing = p.cities.filter(c => c.chain && !settlementDone(c.buildings, c.size)).map(c => {
    const step = settlementSteps(c.buildings, c.size);
    return `${c.name} ${!step.base ? 'tarvitsee perustan' : !step.food ? 'tarvitsee ruokaketjun' : `koko ${c.size} / ${SETTLEMENT_SIZE}`}`;
  });
  const settlers = p.units.units.filter(u => u.kind === 'settler').length;
  return [
    `Valmiita settlementtejä ${Math.min(ready, 3)} / 3`,
    ...(growing.length ? [`kasvamassa: ${growing.join(', ')}`] : []),
    p.cities.length < 3 ? (settlers ? `uudisasukkaita ${settlers}: perusta niillä kaupunkeja` : 'perusta lisää kaupunkeja uudisasukkailla') : null,
  ].filter(Boolean).join(' · ') + '.';
}

/** The top panel's meter: how far the deepest open level's goal is (STORY-087), then the states conquered. */
function meterOf(): Pick<GameHudState, 'mapped' | 'meterName' | 'unlockAt' | 'meterText'> {
  const goal = levelGoal(play!.progress.openLevel);
  if (!goal) {
    const won = conquestNow().conquered.size;
    return { mapped: 1, meterName: 'Valtiot', unlockAt: null, meterText: { value: `${won} vallattu`, label: `Valtioita vallattu ${won}` } };
  }
  const n = goalCount(goal, levelState());
  const value = `${n} / ${goal.need}${goal.unit ? ` ${goal.unit}` : ''}`;
  return { mapped: n / goal.need, meterName: goal.name, unlockAt: 1, meterText: { value, label: `${goal.text}: ${n} / ${goal.need}` } };
}

/** Distance between tile centres in world units near the camera target. */
const tileSpacing = () => (RADIUS * Math.acos(1 / Math.sqrt(5))) / 330;

/**
 * Golden runs (STORY-095): a test steps the game a day at a time, with no clock, and the frames
 * leave the game alone meanwhile, so the run does not depend on how fast the frames come.
 */
let stepMode = false;

/** Days that passed and wait to be worked out a slice a frame (STORY-117, dayQueue.ts). */
let daysDue = 0;
const dayWork: DayWork = {
  running: () => dayRunning(),
  start: () => startDay(++clock.day),
  step: ms => stepDay(ms),
  held: () => !!play && (pending(play).length > 0 || unlockCard.visible),
  now: () => performance.now(),
};
/** The play update's JS time in the last frames, for the 8 ms measure (STORY-117). */
const playMs: number[] = [];
/** The slices of the stepped days when measured (STORY-117): the budget, and each slice's time. */
let sliceBudget = 0;
const sliceMs: number[] = [];

function updatePlay(dt: number) {
  tiles.knownResources.value = kindMask();
  if (!play) return;
  const selectedUnit = play.units.units[play.selected];
  // Between the days only: the units' regions and the open states for the view too, the
  // city-states' search and the cards an advisor answers, as when a day took one frame
  if (!dayRunning()) {
    prepareDay();
    scanNatives(NATIVE_BUDGET_MS);
  }
  const blocked = pending(play).length || unlockCard.visible || onboarding.visible;
  if (stepMode) {
    // Golden runs: a whole day a frame; the frame budget's measure works it out in slices
    if (!blocked && sliceBudget) {
      startDay(++clock.day);
      for (let done = false; !done; ) {
        const started = performance.now();
        done = stepDay(sliceBudget);
        sliceMs.push(performance.now() - started);
      }
    } else if (!blocked) simulateDay(++clock.day);
  } else {
    // The clock's days wait in a queue, and the clock's day is the one last begun, so that a
    // command and a save take the day the game is on (Utu's review: the clock ran ahead of the
    // days worked out). A device too slow for the queue plays slower rather than stutters (own).
    let fresh = 0;
    if (!blocked) {
      fresh = clock.advance(dt);
      clock.day -= fresh;
    }
    daysDue = frameDays(daysDue, fresh, clock.paused, !!blocked, dayWork);
  }
  play.selected = Math.max(0, play.units.units.indexOf(selectedUnit));
  // The cards an advisor answers itself, also those waiting in a loaded game
  if (!dayRunning()) advisorsAnswer();
  if (sentUnit) {
    play.selected = Math.max(0, play.units.units.indexOf(sentUnit));
    sentUnit = null;
  }
  // The cards of a day come at its end, when an advisor may already have answered them (Utu's review)
  if (!dayRunning()) {
    updateTreatyCard();
    updateSiteOffer();
    updateAdvanceCard();
  }
  updateListCard();
  updateCityCard();
  updateResearchCard();
  updateScienceTree();
  updateAdvisorCard();
  updateTileCard();
  updateDiplomacyCard();
  updateTradeCard();
  const u = play.units.units[play.selected];
  const state: GameHudState = {
    day: clock.day,
    speed: clock.speed,
    paused: clock.paused,
    ...meterOf(),
    level: viewLevel,
    unit: u && ownHand() ? { name: u.name, status: unitStatus(play.units, u, world, id => TERRAIN_RULES[terrainOf(id)].name), kind: u.kind === 'settler' && u !== play.units.settler ? 'waiting' : u.kind, mode: u.mode, task: u.kind === 'settler' ? u.task : null } : null,
    flagTool: play.flagTool,
    city: play.cities[0]?.name ?? null,
    goal: (g => g && { text: g.text, reward: g.reward })(levelGoal(play.progress.openLevel)),
    advisor: levelAdvisor(advisorLevel()).name,
    advisors: advisorButtons(advisorLevel()),
    own: ownHand(),
    // The list also where the advisor runs the province or the state (STORY-115)
    list: viewLevel !== 0 && (ownHand() || viewLevel === 1 || viewLevel === 2),
    science: play.cities.length > 0,
    research: !play.cities.length || play.researchOpen || !ownHand() ? null
      : play.research.target ? { text: `Tiede · ${studyName(play.research.target)} ${Math.min(100, Math.floor((play.research.bulbs / play.research.cost) * 100))} %`, choose: false }
      : play.research.available(foundKinds).length ? { text: 'Valitse tutkimus', choose: true } : null,
  };
  play.hud.update(state);
  play.area.update(areaView());
  void autosave();
  unitLayer.update({
    units: play.units.units,
    // At the city level the city stands in 3D: no flat figure for it (STORY-069)
    cities: play.cities.map(c => c.tile).filter(t => !(t === cityLevel.city && cityLevel.relief.value > 0)),
    scale: 1 - 0.6 * cityLevel.relief.value,
    natives: visibleNatives().map(n => n.tile),
    camps: visibleTribes().map(t => t.camp),
    rivals: visibleRivalCities().map(x => ({ tile: x.city.tile, rival: x.rival.id })),
    // No ring before the first unit (STORY-070)
    selected: play.units.units[play.selected] ? play.selected : null,
    flag: play.units.flag,
    site: play.units.currentSite(),
    founding: play.units.founding,
    improvements: play.improvements.entries(),
    bandits: play.raids.band?.bandits ?? [],
    areas: play.cities.map(c => ({ centre: c.tile, rings: cityRings(c.size) })),
    // The border, at the province level of the view once the province is open (STORY-093)
    territory: viewLevel === 2 && provinceStage() ? bordersNow().tiles : [],
    spacing: tileSpacing(),
  }, camera.position);
  updateLevels();
  // After the chips: the labels keep off them (STORY-114)
  updateCityLabels();
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
  // Landed: the old start maps the start city area; a new game only the city's rings, so the
  // game starts at the city level alone and the scout opens the area (Sami 2026-11-20,
  // STORY-017). Zooming out waits for the unlock (STORY-026)
  const capital = game?.capital ?? continuing?.cities[0]?.tile;
  const cityAlone = !classic && (continuing?.progress.openLevel ?? 4) === 4 && capital !== undefined;
  if (game) reveal(cityAlone ? tilesInRings(capital!, CITY_LEVEL_RINGS) : cityTiles(regions, game.startCity));
  if (game) startPlay(game.startCity, continuing ?? undefined);
  // A new game greets (STORY-096); a continued one and the old start do not
  if (game && !continuing && !classic) {
    tourNext = true;
    onboarding.welcome();
  }
  screen = 'playing';
  introTarget = null;
  lockedLevel = continuing?.progress.openLevel ?? (classic ? 3 : 4);
  rig.maxDist = lockFor(lockedLevel);
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
/** The main thread's time in the last frames, ms, for measuring (STORY-101). */
const frameMs: number[] = [];
let framesDrawn = 0;
function animate(now = performance.now()) {
  const started = performance.now();
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
  if (!stepMode) {
    const playStarted = performance.now();
    updatePlay(dt);
    playMs.push(performance.now() - playStarted);
    if (playMs.length > 600) playMs.shift();
  }
  updateWar(dt);
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
  frameMs.push(performance.now() - started);
  framesDrawn++;
  if (frameMs.length > 240) frameMs.shift();
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
  if (lockedLevel > 0) rig.maxDist = lockFor(lockedLevel);
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
  /** Every notice told lately, also those a frame of several days covered at once. */
  notices: () => [...discoveryCard.log],
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
  // Tests of other things turn an advance's card off with the rest (STORY-118)
  setDiscoveries: (on: boolean) => setSwitches({ discoveries: on, siteOffers: on, raids: on, advanceCards: on }),
  setAdvanceCards: (on: boolean) => setSwitches({ advanceCards: on }),
  /** Study this, as the research card's choice (STORY-118). */
  study: (target: Study) => dispatch({ kind: 'study', target }, 'player'),
  setRaids: (on: boolean) => setSwitches({ raids: on }),
  /** Golden runs (STORY-095): days only by step(), one at a time; step() tells whether a day passed. */
  stepMode: (on: boolean) => { stepMode = on; lastFrame = performance.now(); },
  step: () => {
    const before = clock.day;
    updatePlay(0);
    return clock.day > before;
  },
  /** An advisor chosen as the player does, through the command (STORY-095). */
  advise: (level: AdvisorLevel, advisor: string) => dispatch({ kind: 'advise', level, advisor }, 'player'),
  /** The game's state for a golden run: the save without the wall clock and the clock's speed, and the notices. */
  golden: () => {
    const s = snapshot();
    if (!s) return null;
    const { savedAt: _at, speed: _speed, paused: _paused, ...rest } = s;
    // The city-states and tribes are not saved but found anew: their tiles count too
    return { ...rest, notices: [...discoveryCard.log], ...opponentsNow() };
  },
  /** Long test games: a faster clock and the advisors of every level (STORY-060). */
  fastForward: (speed: number) => { clock.speed = speed as Speed; clock.paused = false; },
  setAdvisors: (a: { town?: TownAdvisor; city?: CityAdvisor; province?: ProvinceAdvisor; state?: StateAdvisor; planet?: PlanetAdvisor }) => {
    if (!play) return;
    // The city area's advisor alone sets the city level's too, the one it stands for (STORY-105)
    if (a.town ?? a.city) play.townAdvisor = a.town ?? TOWN_OF_CITY[a.city!];
    if (a.city) play.cityAdvisor = a.city;
    if (a.province) play.provinceAdvisor = a.province;
    if (a.state) play.stateAdvisor = a.state;
    if (a.planet) play.planetAdvisor = a.planet;
  },
  /** Found a city on a tile, and give a city buildings (STORY-069 tests). */
  foundHere: (tile: number) => { if (play) { foundAt(tile); play.openCity = null; } },
  giveBuildings: (city: number, list: Building[]) => {
    if (!play) return;
    play.cities[city].buildings.push(...list.filter(b => !play!.cities[city].buildings.includes(b)));
    placeAll(play.cities[city], ground);
  },
  /** Where a city's buildings stand, which do best, and where one may move (STORY-071). */
  placement: (city: number, building?: Building) => {
    const c = play!.cities[city];
    return { placed: { ...c.placed }, best: [...(c.best ?? [])], spots: building ? spots(c, building, ground) : [], moving: play!.moving };
  },
  /** A city on a hex (STORY-074): why not, the card's button, the settler on its way, the waiting site, the yields and builds. */
  site: (tile: number) => ({ block: settleBlock(tile), action: settleAction(tile), going: play!.units.founding ? play!.units.currentSite() : null, pending: play!.pendingSite, yields: cityYields(), builds: play!.cities.map(c => c.build) }),
  /** A rival's units placed by hand, its advances, its campaign and a target state for the Kenraali (STORY-077). */
  rivalUnits: (k: number, kind: RivalUnit['kind'], tile: number, n: number) => {
    const r = play!.rivals[k];
    for (let i = 0; i < n; i++) r.units.push({ id: 100_000 + r.units.length + i, kind, tile, path: [], wait: 0, home: 0, site: null });
  },
  rivalLearn: (k: number, a: Advance) => play!.rivals[k].research.known.add(a),
  rivalWar: (k: number) => ({ ...play!.rivals[k].war.save(), enemy: play!.rivals[k].enemy, army: play!.rivals[k].army().length }),
  setRivalCitySize: (k: number, i: number, size: number) => { play!.rivals[k].cities[i].size = size; },
  aimAt: (state: number) => setTargetState(state, null),
  over: () => play?.over ?? false,
  /** The ties with the rivals, and their attitude set by hand (STORY-076). */
  ties: () => (play ? play.ties.map((t, k) => ({ ...t, name: play!.rivals[k].name })) : []),
  setAttitude: (k: number, a: number) => { if (play?.ties[k]) play.ties[k].attitude = a; },
  /** Kinds of resource known and found, and the study (STORY-072). */
  setKinds: (list: ResourceKind[]) => { if (play) { play.research.kinds.clear(); for (const k of list) play.research.kinds.add(k); } },
  researchOptions: () => (play ? play.research.available(foundKinds) : []),
  kinds: () => ({ known: play ? [...play.research.kinds] : [], found: [...foundKinds], target: play?.research.target ?? null }),
  /** A tile's centre on the screen, on the risen ground at the city level. */
  tileScreen: (tile: number) => toScreen(tileCenter(tile).multiplyScalar(1 + cityLevel.raise(tile) / RADIUS)),
  /** The city level (STORY-069): its city, relief, triangles and things on the ground. */
  cityLevel: () => cityLevel.stats,
  cityShadows: (on: boolean) => cityLevel.shadows(on),
  /** The city level's distance for a city: the camera there sees it rise. */
  cityLevelDist: () => cityViewDist(),
  /** The rivals: start states, cities and units (STORY-068). */
  /** The province level (STORY-093): the border, the provinces it holds, the joins, the workers and the cities' culture. */
  province: () => {
    if (!play) return null;
    const joins = joinsNow();
    return {
      open: provinceStage(), owned: bordersNow().tiles.length, byBorder: bordersNow().held,
      joined: [...joins.kinds].map(([province, kinds]) => ({ province, kinds: [...kinds] })),
      waiting: joins.waiting.map(r => ({ ...r })), unreachable: [...unreachable],
      workers: play.units.units.filter(u => u.kind === 'worker').map(u => ({ name: u.name, tile: u.tile, home: u.home, job: u.job && { ...u.job }, joining: joiningOf.get(u.id) ?? null })),
      cities: play.cities.map(c => ({ tile: c.tile, size: c.size, culture: c.culture ?? 0, gain: cultureGain(c), rings: borderRings(c.size, c.culture ?? 0), shields: joinedShields(c), province: provinceOfTile(c.tile) })),
      builders: [...workerBuilders()],
      territoryEdges: unitLayer.territoryEdges,
      // The province level's goal (STORY-111)
      target: play.targetProvince, keepAlso: [...play.units.keepAlso], held: [...conquestNow().held], homeState: homeState(),
    };
  },
  setCulture: (city: number, culture: number) => { if (play) play.cities[city].culture = culture; },
  addRoad: (tile: number) => { if (play) { play.improvements.add(tile, 'road'); roadBuilt(); } },
  /** Tiles with a strategic resource, known or not, within rings of a city, nearest first (STORY-093). */
  strategicAround: (city: number, rings: number) => {
    if (!play) return [];
    return tilesInRings(play.cities[city].tile, rings).flatMap(t => {
      terrainOf(t);
      const k = kindAt(t);
      return k && isStrategic(k) ? [{ tile: t, kind: k }] : [];
    });
  },
  /** The opponents shown on the map and in play (STORY-094): none before the state level. */
  opponentsShown: () => ({ natives: visibleNatives().length, camps: visibleTribes().length, rivals: visibleRivalCities().length }),
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
  nativeSyncMs: () => nativeSyncMs,
  /** The card of a region at any level (STORY-067). */
  regionView: (level: 0 | 1 | 2, id: number) => (play ? regionView({ level, id } as RegionRef) : null),
  /** A tile's score as a city site (STORY-065). */
  siteScore: (id: number) => world.siteScore(id),
  /** The card a tapped hex would show (STORY-055). */
  // The rows as plain text, as the tests read them; the card itself colours and links them (STORY-103)
  /** The main thread's ms in the last frames (STORY-101). */
  frameMs: () => [...frameMs],
  markerMs: () => [...markerMs],
  playMs: () => [...playMs],
  /** The day last begun, and the days a save or a command worked out at once (STORY-117, Utu's review). */
  dayBegun: () => dayBegun,
  daysFinishedAtOnce: () => daysFinishedAtOnce,
  /** Stepped days worked out in slices of this budget (0: a whole day at once), and the slices' times. */
  sliceDays: (budget: number) => { sliceBudget = budget; sliceMs.length = 0; },
  sliceMs: () => [...sliceMs],
  /** How far into the day the clock is, 0 to 1 (STORY-101). */
  dayPart: () => clock.fraction,
  /** Frames drawn since the page opened (STORY-101). */
  frames: () => framesDrawn,
  /** Carriers for measuring: n walking from the city on view to tiles two rings out (STORY-101). */
  carryTest: (n: number) => {
    const c = play?.cities.find(x => x.tile === cityLevel.city);
    if (!c) return 0;
    const ring = tilesInRings(c.tile, 2).filter(t => t !== c.tile);
    const goods: Good[] = ['log', 'plank', 'stone', 'wheat', 'flour', 'bread', 'fish'];
    carrierTrips = {
      city: c.tile,
      trips: Array.from({ length: n }, (_, i) => ({ path: [c.tile, ...(findPath(c.tile, ring[i % ring.length], () => 1, 400) ?? [])], good: goods[i % goods.length] })).filter(t => t.path.length >= 2),
    };
    return carrierTrips.trips.length;
  },
  /** The JS time of one frame's carrier walk, ms, over `calls` frames of the day (STORY-101). */
  carryBench: (calls: number) => {
    const trips = carrierTrips?.trips ?? [];
    const t = performance.now();
    for (let i = 0; i < calls; i++) cityLevel.walk(trips, (i % 100) / 100 * ARRIVE_AT);
    return (performance.now() - t) / calls;
  },
  tileView: (id: number) => {
    if (!play) return null;
    const v = tileView(id);
    return { ...v, rows: v.rows.map(r => ({ label: r.label, value: plain(r.value) })) };
  },
  /** Found a city on the first land tile of a province that has none (STORY-016). */
  /** Open the next level as if its goal were reached: its gold and its card (STORY-087). */
  rise: () => {
    const g = play && levelGoal(play.progress.openLevel);
    if (!g) return null;
    const opened = advance(play!.progress, { settlement: 3, settlements: g.need, provinces: g.need });
    if (opened !== null) rise(opened, g);
    return opened;
  },
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
  /** What the threatened city can do against the band (STORY-108). */
  raidPlan: () => {
    const band = play?.raids.band;
    const c = band && play!.cities.find(x => x.tile === band.city);
    return c ? raidPlan(c) : null;
  },
  setSiteOffers: (on: boolean) => setSwitches({ siteOffers: on }),
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
      learned: play ? [...play.learned] : [],
      gold: play?.gold ?? null,
      commands: play?.commands.entries.map(e => ({ day: e.day, by: e.by, kind: e.cmd.kind })) ?? [],
      research: play ? { ...play.research.save(), cost: play.research.cost } : null, tax: play?.tax ?? null, lux: play?.lux ?? null, gov: play?.gov ?? null, townAdvisor: play?.townAdvisor ?? null, cityAdvisor: play?.cityAdvisor ?? null, provinceAdvisor: play?.provinceAdvisor ?? null, tileOpen: play?.tileOpen ?? null, stateAdvisor: play?.stateAdvisor ?? null, planetAdvisor: play?.planetAdvisor ?? null, targetState: play?.targetState ?? null, targetProvince: play?.targetProvince ?? null, goal: (play && levelGoal(play.progress.openLevel)?.text) ?? null,
    };
  },
};
(window as any).globeLevels = {
  get state() {
    return { level: viewLevel, path, selection, frames, flying: rig.flying };
  },
};

console.log('[GlobeCiv3] 3D globe ready');
