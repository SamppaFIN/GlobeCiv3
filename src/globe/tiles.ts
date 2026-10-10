/**
 * tiles.ts — quadtree LOD over the cube sphere.
 *
 * Tile vertices are stored relative to the tile centre, and the centre lives in
 * mesh.position as a float64 JS number. Three.js multiplies view × model on the
 * CPU in float64, so the GPU only sees small camera-relative values.
 */
import * as THREE from 'three';
import { children, MAX_LEVEL, tileToSphere, type Tile } from './cubeSphere';
import { glslOklch, oklchToSrgb } from './colors';
import { CORNERS, EDGE_BASE, FACE_ADJACENT, FACE_BASE, FACE_CENTROIDS, FACE_EDGES, FACE_INVERSES, FACES, FREQUENCY, TILE_COUNT } from './hexTiles';
import { ATLAS_COLUMNS, ATLAS_ROWS } from './glyphAtlas';
import { SURFACE_SIZE } from './surfacePatterns';
import { createFogTexture, FOG_UV_GLSL } from './fogMap';
import { TERRAINS } from '../game/terrainTypes';
import { hierarchyAt, MAX_TILE_REGIONS, Regions, type RegionEntry } from './regions';
import { DEFAULT_SEED, heightRange, octaveSplit } from './terrain';

const SEG = 16;
export const SPLIT_PX = 256;
export const MERGE_PX = 128;
/** Octaves evaluated per pixel, from the tile level upward (finer ones fade out below a pixel). */
const PIXEL_OCTAVES = 10;
const PRUNE_AFTER_FRAMES = 300;
/** Quadtree level from which tiles carry hex data (hex tiles are too small to see above it). */
const HEX_FIRST_LEVEL = 4;
/** Icosahedron faces a quadtree tile can overlap (5 around a corner). */
const MAX_HEX_FACES = 5;

/** Width of the per-tile data texture: tile id → texel (id mod width, id div width). */
const TILE_TEX_WIDTH = 2048;

/**
 * Per-face tables for the shader, one row per face: texels 0–2 the inverse corner matrix
 * (point → unnormalised barycentrics) by columns, 3 the centroid, 4 the corner ids,
 * 5 the edge opposite each corner slot, 6 the packed face across that edge (hexTiles.ts),
 * 7–9 the corners (columns of the corner matrix).
 */
function faceTexture(): THREE.DataTexture {
  const W = 10;
  const data = new Float32Array(W * 20 * 4);
  const put = (f: number, k: number, v: number[]) => data.set(v, (f * W + k) * 4);
  for (let f = 0; f < 20; f++) {
    const e = FACE_INVERSES[f].elements;
    for (let c = 0; c < 3; c++) put(f, c, [e[c * 3], e[c * 3 + 1], e[c * 3 + 2], 0]);
    put(f, 3, [FACE_CENTROIDS[f].x, FACE_CENTROIDS[f].y, FACE_CENTROIDS[f].z, 0]);
    put(f, 4, [...FACES[f], 0]);
    put(f, 5, [...FACE_EDGES[f], 0]);
    put(f, 6, [...FACE_ADJACENT[f], 0]);
    FACES[f].forEach((c, k) => put(f, 7 + k, [CORNERS[c].x, CORNERS[c].y, CORNERS[c].z, 0]));
  }
  const tex = new THREE.DataTexture(data, W, 20, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  return tex;
}

/** Per-tile codes (terrainTypes.ts tileCode) as an 8-bit integer texture, filled on demand. */
function codeTexture(): THREE.DataTexture {
  const height = Math.ceil(TILE_COUNT / TILE_TEX_WIDTH);
  const tex = new THREE.DataTexture(new Uint8Array(TILE_TEX_WIDTH * height), TILE_TEX_WIDTH, height, THREE.RedIntegerFormat, THREE.UnsignedByteType);
  tex.internalFormat = 'R8UI';
  tex.needsUpdate = true;
  return tex;
}

/** Terrain colours from tokens.css (--terrain-*), raw sRGB in TERRAINS order; ocean is its shallow end. */
const TERRAIN_TOKENS: Record<string, [number, number, number]> = {
  ocean: [0.47, 0.072, 228], arctic: [0.9, 0.02, 240], desert: [0.8, 0.08, 82], forest: [0.5, 0.09, 148],
  grassland: [0.67, 0.12, 132], hills: [0.63, 0.07, 92], jungle: [0.45, 0.11, 162], mountains: [0.6, 0.02, 60],
  plains: [0.75, 0.09, 105], swamp: [0.48, 0.06, 122], tundra: [0.66, 0.04, 160],
};
const terrainColors = TERRAINS.map(t => new THREE.Vector3(...oklchToSrgb(...TERRAIN_TOKENS[t])));
/**
 * Surface pattern of each terrain (surfacePatterns.ts): the channel (0 water, 1 fields,
 * 2 forest, 3 relief) and how strongly it shades the token colour.
 */
const SURFACE_OF: Record<(typeof TERRAINS)[number], [number, number]> = {
  ocean: [0, 1], arctic: [3, 0.35], desert: [3, 0.35], forest: [2, 1], grassland: [1, 0.5], hills: [3, 0.7],
  jungle: [2, 1], mountains: [3, 1], plains: [1, 0.6], swamp: [0, 0.6], tundra: [3, 0.4],
};
const surfaceOf = TERRAINS.map(t => new THREE.Vector2(...SURFACE_OF[t]));

/** City area of every hex tile as a 16-bit integer texture (Regions.tileTable). */
function tileTexture(table: Uint16Array): THREE.DataTexture {
  const height = Math.ceil(TILE_COUNT / TILE_TEX_WIDTH);
  const data = new Uint16Array(TILE_TEX_WIDTH * height);
  data.set(table);
  const tex = new THREE.DataTexture(data, TILE_TEX_WIDTH, height, THREE.RedIntegerFormat, THREE.UnsignedShortType);
  tex.internalFormat = 'R16UI';
  tex.needsUpdate = true;
  return tex;
}

const hexShader = /* glsl */ `
  #define HEX_F ${FREQUENCY}.0
  #define HEX_FI ${FREQUENCY}
  #define MAX_HEX_FACES ${MAX_HEX_FACES}
  #define EDGE_BASE ${EDGE_BASE}
  #define FACE_BASE ${FACE_BASE}
  #define PER_FACE ${((FREQUENCY - 1) * (FREQUENCY - 2)) / 2}
  #define TILE_TEX_WIDTH ${TILE_TEX_WIDTH}
  uniform highp sampler2D faceTex;
  uniform highp usampler2D tileTex;
  uniform highp usampler2D tileTypeTex;
  uniform sampler2D glyphAtlas;
  uniform vec3 terrainColors[${TERRAINS.length}];
  uniform float surfaceOn;
  uniform float surfaceIn;
  uniform sampler2D surfaceTex;
  uniform vec4 surfaceMean;
  uniform vec4 surfaceStd;
  uniform vec2 surfaceOf[${TERRAINS.length}];
  // World direction that is up on the screen, for upright glyphs
  uniform vec3 screenUp;
  // Fog of war (STORY-024): on in the game, off in ?free. The coarse fog map is read
  // with the pixel's world direction (tile centre + vLocal).
  uniform float fogOn;
  uniform sampler2D fogMap;
  uniform vec3 tileWorldCenter;
  ${FOG_UV_GLSL}
  // --fog: oklch(0.18 0.02 265) at 0.88, so the terrain's hue still shows through
  const vec3 FOG = ${glslOklch(0.18, 0.02, 265)};
  const float FOG_OPACITY = 0.88;
  #define ATLAS_COLUMNS ${ATLAS_COLUMNS}.0
  #define ATLAS_ROWS ${ATLAS_ROWS}.0
  // Tokens (tokens.css): ocean depth, ink and the resource marker (design 2b)
  const vec3 OCEAN_DEEP = ${glslOklch(0.3, 0.06, 246)};
  const vec3 INK = ${glslOklch(0.82, 0.04, 80)};
  const vec3 INK_DARK = ${glslOklch(0.26, 0.03, 60)};
  const vec3 MARKER_FILL = ${glslOklch(0.2, 0.02, 260)};
  // Atlas cell span in tile circumradii: terrain glyph (g = 0.26 of 64 / 40) and resource icon
  const float GLYPH_CELL = 0.832;
  const float ICON_CELL = 0.64;
  // --hex-edge: oklch(0.22 0.02 260 / 0.35)
  const vec3 HEX_EDGE_COLOR = ${glslOklch(0.22, 0.02, 260)};
  const float HEX_EDGE_ALPHA = 0.35;

  vec4 faceRow(int f, int k) { return texelFetch(faceTex, ivec2(k, f), 0); }

  // Lattice offset of neighbour k, in the order of hexTiles.ts NEIGHBOR_OFFSETS
  ivec3 neighborOffset(int k) {
    ivec3 o = k % 3 == 0 ? ivec3(1, -1, 0) : k % 3 == 1 ? ivec3(1, 0, -1) : ivec3(0, 1, -1);
    return k < 3 ? o : -o;
  }

  // Canonical tile id of lattice point w (sum F) of face f, as hexTiles.ts tileIdAt: one
  // negative coordinate is unfolded into the face across that edge; -1 if no tile exists
  int tileId(int f, ivec3 w) {
    // One exit: ANGLE's HLSL backend warns about early returns here
    int result = -1;
    bool valid = true;
    int q = w.x < 0 ? 0 : w.y < 0 ? 1 : w.z < 0 ? 2 : -1;
    if (q >= 0) {
      int code = int(faceRow(f, 6)[q]);
      int wq = w[q];
      int wx = w[(q + 1) % 3] + wq;
      int wy = w[(q + 2) % 3] + wq;
      valid = wx >= 0 && wy >= 0;
      ivec3 n = ivec3(0);
      n[(code / 16) % 4] = -wq;
      n[(code / 4) % 4] = wx;
      n[code % 4] = wy;
      f = code / 64;
      w = n;
    }
    if (valid) {
      ivec3 corner = ivec3(faceRow(f, 4).xyz);
      int z = w.x == 0 ? 0 : w.y == 0 ? 1 : w.z == 0 ? 2 : -1;
      if (w.y == 0 && w.z == 0) result = corner.x;
      else if (w.x == 0 && w.z == 0) result = corner.y;
      else if (w.x == 0 && w.y == 0) result = corner.z;
      else if (z >= 0) {
        // On the edge opposite slot z: count from its lower-numbered corner
        int a = (z + 1) % 3;
        int b = (z + 2) % 3;
        int hiWeight = corner[a] > corner[b] ? w[a] : w[b];
        result = EDGE_BASE + int(faceRow(f, 5)[z]) * (HEX_FI - 1) + hiWeight - 1;
      } else {
        result = FACE_BASE + f * PER_FACE + (w.x - 1) * (HEX_FI - 1) - (w.x - 1) * w.x / 2 + w.y - 1;
      }
    }
    return result;
  }

  int tileCity(int id) {
    return int(texelFetch(tileTex, ivec2(id % TILE_TEX_WIDTH, id / TILE_TEX_WIDTH), 0).r);
  }

  int tileCodeAt(int id) {
    return int(texelFetch(tileTypeTex, ivec2(id % TILE_TEX_WIDTH, id / TILE_TEX_WIDTH), 0).r);
  }

  // Offset on the unit sphere from the tile centre's lattice coordinates to the lattice
  // point dl lattice units away: normalize(qc + dq) − normalize(qc) without cancellation
  vec3 latticeLocal(int face, vec3 ucn, vec3 dl) {
    mat3 corners = mat3(faceRow(face, 7).xyz, faceRow(face, 8).xyz, faceRow(face, 9).xyz);
    vec3 qc = corners * ucn;
    vec3 dq = corners * (dl / HEX_F);
    float n0 = length(qc);
    float n1 = length(qc + dq);
    return dq / n1 - qc * (2.0 * dot(qc, dq) + dot(dq, dq)) / (n0 * n1 * (n0 + n1));
  }

  // Coverage of atlas cell c at uv (0..1, y up) for a cell cellPx screen pixels wide
  float atlas(int c, vec2 uv, float cellPx) {
    vec2 cell = vec2(float(c % int(ATLAS_COLUMNS)), float(c / int(ATLAS_COLUMNS)));
    vec2 auv = vec2((cell.x + uv.x) / ATLAS_COLUMNS, 1.0 - (cell.y + 1.0 - uv.y) / ATLAS_ROWS);
    return textureLod(glyphAtlas, auv, log2(max(64.0 / cellPx, 1.0))).a;
  }
`;

export interface TileNode {
  tile: Tile;
  center: THREE.Vector3;
  dir: THREE.Vector3;
  bsRadius: number;
  angRadius: number;
  arc: number;
  mesh: THREE.Mesh | null;
  material: THREE.ShaderMaterial | null;
  kids: TileNode[] | null;
  split: boolean;
  lastSplitFrame: number;
  queued: boolean;
}

const vertexShader = /* glsl */ `
  attribute float baseHeight;
  attribute vec3 borderHint;
  attribute vec3 regionSlot;
  varying float vBase;
  varying vec3 vHint;
  flat varying vec3 vSlot;
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vBase = baseHeight;
    vHint = borderHint;
    vSlot = regionSlot;
    vLocal = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Region borders per pixel. Positions and candidate centres are in tile-local
// coordinates, so precision holds at every level. The border between regions i
// and j is the plane bisecting their centres; the signed distance from p is
// (|p - cj|² - |p - ci|²) / (2 |cj - ci|), a true distance in world units, so the
// line width is set from the world size of one pixel and stays ~1.5 px at every zoom.
// Terrain per pixel: the vertex carries octaves below the tile level, and the
// shader adds octaves from that level upward. Each octave lattice coordinate is
// an integer base plus a small fraction at the tile centre (terrain.ts octaveSplit),
// so float32 suffices. An octave fades out as its wavelength shrinks from 3 px to
// 1.5 px; this depends on the pixel, not the tile level, so parent and child tiles
// agree. hash3 matches terrain.ts hash() bit for bit.
const fragmentShader = /* glsl */ `
  ${hexShader}
  #define MAX_REGIONS ${MAX_TILE_REGIONS}
  #define PIXEL_OCTAVES ${PIXEL_OCTAVES}
  uniform int stateCount;
  // xyz: centre in tile-local coordinates; w: first child slot * 8 + child count
  uniform vec4 regionData[MAX_REGIONS];
  // Nominal inradius of a province and a city area in world units
  uniform vec2 regionRadii;
  uniform vec3 borderColor;
  uniform float borderStrength;
  uniform float radius;
  uniform ivec3 noiseBase[PIXEL_OCTAVES];
  uniform vec3 noiseFrac[PIXEL_OCTAVES];
  uniform vec3 noiseParams[PIXEL_OCTAVES]; // frequency, amplitude, seed
  uniform vec3 sunDir;
  uniform vec3 tint;
  uniform float tintAmount;
  varying float vBase;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vHint;
  flat varying vec3 vSlot;
  // Largest triangle edge of this tile in world units
  uniform float hintSlack;
  // Selected region (accent outline and glow) and the region the camera is inside
  // (the world outside it is dimmed). Level -1 means none. Centres are tile-local and
  // computed exactly like the candidate list, so a match is an exact float32 equality.
  uniform int focusLevel;
  uniform vec3 focusLocal;
  uniform int contextLevel;
  uniform vec3 contextLocal;
  uniform vec3 accentColor;
  // Narrower side of the drawing buffer in device pixels
  uniform float narrowPx;
  // Hex tiles: the icosahedron faces this quadtree tile overlaps (0 below HEX_FIRST_LEVEL).
  // Per face: xyz of hexFace is the integer part of the lattice coordinates at the tile
  // centre and w the face; hexFrac.xyz is their fraction and w the face's score
  // dot(centre, centroid − first face's centroid); hexBary.xyz are the normalised
  // barycentrics at the centre and w their unnormalised sum (world units).
  uniform int hexFaceCount;
  uniform ivec4 hexFace[MAX_HEX_FACES];
  uniform vec4 hexFrac[MAX_HEX_FACES];
  uniform vec4 hexBary[MAX_HEX_FACES];
  // Tile spacings per world unit at the tile centre
  uniform float hexScale;
  // Region ids of the selection and the context at their levels (tile membership)
  uniform int focusId;
  uniform int contextId;

  float hash3(ivec3 c, uint seed) {
    uint h = seed ^ (uint(c.x) * 0x27d4eb2du) ^ (uint(c.y) * 0x165667b1u) ^ (uint(c.z) * 0x1b873593u);
    h = (h ^ (h >> 15u)) * 0x85ebca6bu;
    h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
    h ^= h >> 16u;
    return float(h) / 4294967295.0 * 2.0 - 1.0;
  }

  float noiseCell(ivec3 c, vec3 f, uint seed) {
    vec3 u = f * f * (3.0 - 2.0 * f);
    float x00 = mix(hash3(c, seed), hash3(c + ivec3(1, 0, 0), seed), u.x);
    float x10 = mix(hash3(c + ivec3(0, 1, 0), seed), hash3(c + ivec3(1, 1, 0), seed), u.x);
    float x01 = mix(hash3(c + ivec3(0, 0, 1), seed), hash3(c + ivec3(1, 0, 1), seed), u.x);
    float x11 = mix(hash3(c + ivec3(0, 1, 1), seed), hash3(c + ivec3(1, 1, 1), seed), u.x);
    return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
  }

  // Port of terrain.ts colorFor()
  vec3 terrainColor(float h, float lat) {
    vec3 c;
    if (h < 0.0) {
      float t = min(1.0, -h / 0.5);
      c = vec3(0.1 - 0.08 * t, 0.35 - 0.27 * t, 0.6 - 0.35 * t);
    } else if (h < 0.03) {
      c = vec3(0.76, 0.7, 0.5);
    } else if (h < 0.35) {
      float t = (h - 0.03) / 0.32;
      c = vec3(0.25 - 0.13 * t, 0.5 - 0.15 * t, 0.2 - 0.08 * t);
    } else if (h < 0.55) {
      c = vec3(0.45, 0.4, 0.35);
    } else {
      c = vec3(0.95, 0.95, 0.97);
    }
    if (lat > 0.88) c = mix(c, vec3(0.95, 0.95, 0.97), min(1.0, (lat - 0.88) / 0.05));
    return c;
  }

  void main() {
    vec3 local = vLocal / radius;
    float px = max(length(dFdx(local)), length(dFdy(local)));
    float h = vBase;
    for (int i = 0; i < PIXEL_OCTAVES; i++) {
      vec3 prm = noiseParams[i];
      // Full weight at a wavelength of 3 px or more, none at 1.5 px
      float w = clamp(1.0 / (1.5 * prm.x * px) - 1.0, 0.0, 1.0);
      if (w <= 0.0) break;
      // This and all finer octaves add at most 2 × amplitude. If h is farther than that
      // from every colour threshold (coast 0, beach 0.03, rock 0.35, snow 0.55), they
      // cannot change the terrain class, only shade it slightly: stop here.
      float edge = min(min(abs(h), abs(h - 0.03)), min(abs(h - 0.35), abs(h - 0.55)));
      if (edge > 2.0 * prm.y) break;
      vec3 q = noiseFrac[i] + local * prm.x;
      vec3 fl = floor(q);
      h += w * prm.y * noiseCell(noiseBase[i] + ivec3(fl), q - fl, uint(prm.z));
    }
    // Derivatives must be taken in uniform control flow
    float heightWidth = fwidth(h);
    vec3 n = normalize(vNormal);
    vec3 color = mix(terrainColor(h, abs(n.y)), tint, tintAmount);
    color *= 0.3 + 0.7 * max(dot(n, sunDir), 0.0);
    if (stateCount > 1) {
      float w = max(length(dFdx(vLocal)), length(dFdy(vLocal)));
      // Lower levels fade in as their inradius grows from 6 % to 11 % of the narrower
      // screen side. At a view level's framing distance (levels.ts) its children
      // measure about 11.5 % and its grandchildren 4.3 %, so each level shows exactly
      // the level below it. While a level is invisible its loops are skipped entirely.
      float provinceFade = smoothstep(0.06, 0.11, regionRadii.x / w / narrowPx);
      float cityFade = smoothstep(0.06, 0.11, regionRadii.y / w / narrowPx);

      // ── Hex tile under the pixel ──
      // Lattice coordinates L = F u / sum(u) with u = FACE_INV (centre + vLocal), split as
      // L = (integer + fraction at the centre) + F (ul − ucn sl) / (sc + sl): only small
      // values reach float32, so tiles stay exact at every zoom level.
      float hexFade = 0.0;
      float snapT = 0.0;
      float spacing = 1.0 / hexScale;
      float e1 = 1e30;
      float e2 = 1e30;
      int hq = 0;
      int n1 = 0;
      int n2 = 1;
      vec3 hr = vec3(0.0);
      ivec3 lattice = ivec3(0);
      int latticeFace = 0;
      vec3 hexDelta = vec3(0.0);
      int ownId = -1;
      int nearId1 = -1;
      int nearId2 = -1;
      if (hexFaceCount > 0) {
        float spacingPx = spacing / w;
        // Hex edges fade in at city-area zoom (a tile spacing of 3 → 5.5 % of the narrow
        // side; 6.9 % at the city-area framing distance), borders snap to tile edges once
        // a tile is 4 → 8 px wide, where the steps would show
        hexFade = smoothstep(0.03, 0.055, spacingPx / narrowPx);
        snapT = smoothstep(4.0, 8.0, spacingPx);
        if (hexFade > 0.0 || snapT > 0.0) {
          // The face with the nearest centroid; scores are relative to the first face
          vec3 firstCentroid = faceRow(hexFace[0].w, 3).xyz;
          float bestScore = 0.0;
          for (int q = 1; q < MAX_HEX_FACES; q++) {
            if (q >= hexFaceCount) break;
            float score = hexFrac[q].w + dot(vLocal, faceRow(hexFace[q].w, 3).xyz - firstCentroid);
            if (score > bestScore) { bestScore = score; hq = q; }
          }
          int face = hexFace[hq].w;
          vec3 ul = mat3(faceRow(face, 0).xyz, faceRow(face, 1).xyz, faceRow(face, 2).xyz) * vLocal;
          float sl = ul.x + ul.y + ul.z;
          vec4 bary = hexBary[hq];
          vec3 fl = hexFrac[hq].xyz + HEX_F * (ul - bary.xyz * sl) / (bary.w + sl);
          // Nearest lattice point: round each coordinate, then fix the one that moved most
          ivec3 base = hexFace[hq].xyz;
          float target = HEX_F - float(base.x + base.y + base.z);
          hr = floor(fl + 0.5);
          if (hr.x + hr.y + hr.z != target) {
            vec3 dr = abs(hr - fl);
            if (dr.x >= dr.y && dr.x >= dr.z) hr.x = target - hr.y - hr.z;
            else if (dr.y >= dr.z) hr.y = target - hr.x - hr.z;
            else hr.z = target - hr.x - hr.y;
          }
          // Distance to the hex edge facing neighbour n is (1 − d·n) / 2 spacings; keep the
          // two nearest edges (no local arrays: they can spill to slow memory)
          vec3 d = fl - hr;
          float b1 = -1e9;
          float b2 = -1e9;
          for (int k = 0; k < 6; k++) {
            float v = dot(d, vec3(neighborOffset(k)));
            if (v > b1) { b2 = b1; n2 = n1; b1 = v; n1 = k; }
            else if (v > b2) { b2 = v; n2 = k; }
          }
          e1 = (1.0 - b1) * 0.5 * spacing;
          e2 = (1.0 - b2) * 0.5 * spacing;
          hexDelta = d;
          lattice = base + ivec3(hr);
          latticeFace = face;
          ownId = tileId(face, lattice);
          // The tiles across the two nearest edges (-1 beside a pentagon)
          nearId1 = tileId(face, lattice + neighborOffset(n1));
          nearId2 = tileId(face, lattice + neighborOffset(n2));
        }
      }

      // ── Tile terrain at city-area zoom (STORY-023): token colour, glyph and resource ──
      // Back to the continuous terrain once a tile fills a good part of the screen
      float typeFade = hexFade * (1.0 - smoothstep(0.18, 0.45, spacing / w / narrowPx));
      int code = ownId >= 0 ? tileCodeAt(ownId) : 0;
      // In the game a tile shows its terrain only once mapped (bit 5)
      bool tileMapped = fogOn < 0.5 || (code & 32) != 0;
      int ttype = typeFade > 0.0 && tileMapped ? code & 15 : 0;
      if (ttype > 0) {
        float spacingPx = spacing / w;
        vec3 tc = ttype == 1 ? mix(OCEAN_DEEP, terrainColors[0], clamp(1.0 + h / 0.5, 0.0, 1.0)) : terrainColors[ttype - 1];
        color = mix(color, tc * (0.82 + 0.18 * max(dot(n, sunDir), 0.0)), typeFade);
        // Coast (design: ink at 0.4) on edges between water and land tiles; the neighbours
        // are looked up only within reach of an edge
        bool nearEdge = e1 < 2.0 * w;
        int near1 = nearEdge && nearId1 >= 0 ? tileCodeAt(nearId1) & 15 : 0;
        int near2 = nearEdge && nearId2 >= 0 ? tileCodeAt(nearId2) & 15 : 0;
        float coast = 1e30;
        if (near1 > 0 && (near1 == 1) != (ttype == 1)) coast = e1;
        if (near2 > 0 && (near2 == 1) != (ttype == 1)) coast = min(coast, e2);
        color = mix(color, INK, 0.4 * typeFade * (1.0 - smoothstep(0.3 * w, 0.8 * w, coast)));
        float glyphFade = typeFade * smoothstep(18.0, 30.0, spacingPx);
        float surfaceFade = surfaceOn * surfaceIn * typeFade * smoothstep(24.0, 48.0, spacingPx);
        // Tile-local coordinates in circumradii, upright on the screen
        float s = spacing / 1.7320508;
        vec2 g = vec2(0.0);
        vec3 side = vec3(0.0);
        vec3 up = vec3(0.0);
        if (glyphFade > 0.0 || surfaceFade > 0.0) {
          vec3 rel = vLocal - radius * latticeLocal(latticeFace, hexBary[hq].xyz, hr - hexFrac[hq].xyz);
          up = normalize(screenUp - n * dot(screenUp, n));
          side = cross(up, n);
          g = vec2(dot(rel, side), dot(rel, up)) / s;
        }
        if (surfaceFade > 0.0) {
          // The terrain's surface pattern as light and shade on the token colour, a different
          // excerpt in every tile (the patterns do not tile); the mip level follows the tile's
          // size on the screen, so it does not jump at the hex edges
          uint hsh = uint(ownId) * 2654435761u;
          hsh ^= hsh >> 15;
          hsh *= 2246822519u;
          vec2 offset = 0.2 + 0.6 * vec2(float(hsh & 1023u), float((hsh >> 10) & 1023u)) / 1023.0;
          vec2 suv = offset + g * 0.175;
          vec2 so = surfaceOf[ttype - 1];
          vec4 mask = vec4(equal(vec4(so.x), vec4(0.0, 1.0, 2.0, 3.0)));
          float lod = log2(max(1.0, 0.175 * ${SURFACE_SIZE}.0 * w / s));
          float z = dot(textureLod(surfaceTex, suv, lod) - surfaceMean, mask) / dot(surfaceStd, mask);
          color *= 1.0 + so.y * surfaceFade * 0.12 * clamp(z, -2.5, 2.5);
        }
        if (glyphFade > 0.0) {
          bool hasResource = (code & 16) != 0;
          // Terrain glyph (design: stroke --ink-dark at 0.5), above the resource if there is one
          vec2 gu = (g - vec2(0.0, hasResource ? 0.5 : 0.0)) / GLYPH_CELL + 0.5;
          if (all(greaterThan(gu, vec2(0.0))) && all(lessThan(gu, vec2(1.0)))) {
            color = mix(color, INK_DARK, 0.5 * glyphFade * atlas(ttype - 1, gu, GLYPH_CELL * s / w));
          }
          if (hasResource) {
            // Marker (design): a dark disc of radius 0.36 with an ink ring and the ink icon
            vec2 rc = g - vec2(0.0, -0.12);
            float r = length(rc);
            float onePx = w / s;
            color = mix(color, MARKER_FILL, glyphFade * (1.0 - smoothstep(0.36 - 0.5 * onePx, 0.36 + 0.5 * onePx, r)));
            float ink = 1.0 - smoothstep(0.5 * onePx, 1.0 * onePx, abs(r - 0.36));
            if (r < 0.36) ink = max(ink, atlas(${TERRAINS.length} + ttype - 1, rc / ICON_CELL + 0.5, ICON_CELL * s / w));
            color = mix(color, INK, glyphFade * ink);
          }
        }
      }
      // --hex-edge: 0.6 px, only on mapped tiles (design 2b)
      color = mix(color, HEX_EDGE_COLOR, HEX_EDGE_ALPHA * hexFade * (tileMapped ? 1.0 : 0.0) * (1.0 - smoothstep(0.2 * w, 0.9 * w, e1)));

      // ── Fog of war (STORY-024, design: Kartografi) ──
      // Far away the coarse fog map gives a soft edge; where borders follow tile edges
      // (tiles of 4 → 8 px) each tile's own bit takes over, so the edge is exact hexes.
      float fogAmount = 0.0;
      float farMapped = 1.0;
      float farWidth = 1.0;
      if (fogOn > 0.5) {
        farMapped = texture(fogMap, fogUv(tileWorldCenter + vLocal)).r;
        farWidth = max(fwidth(farMapped), 1e-4);
        float nearMapped = (code & 32) != 0 ? 1.0 : 0.0;
        fogAmount = 1.0 - (ownId >= 0 ? mix(farMapped, nearMapped, snapT) : farMapped);
        if (fogAmount > 0.0) {
          vec3 fogged = mix(color, FOG, FOG_OPACITY);
          // --fog-hatch: ink at 0.11, 0.7 px lines every 7 px at 38°, on the screen
          float stripe = abs(fract(dot(gl_FragCoord.xy, vec2(0.788, 0.616)) / 7.0) - 0.5) * 7.0;
          fogged = mix(fogged, INK, 0.11 * (1.0 - smoothstep(0.35, 0.85, stripe)));
          // --fog-coast: the coastline hinted in the fog, ink at 0.4, dashed 2 / 3 px
          float coastPx = abs(h) / max(heightWidth, 1e-9);
          float dash = step(fract((gl_FragCoord.x + gl_FragCoord.y) / 5.0), 0.4);
          fogged = mix(fogged, INK, 0.4 * dash * (1.0 - smoothstep(0.4, 0.9, coastPx)));
          color = mix(color, fogged, fogAmount);
        }
      }

      // ── Region borders through the pixel (smooth great-circle arcs) ──
      // Per level (state, province, city area): the nearest region in the current slot
      // range and the distance to the nearest border plane within that range (siblings),
      // then descend into the winner's children. Only the states plus at most 7 + 7
      // entries are visited, and a level is skipped while its lines are invisible.
      // vHint is the exact border distance at the vertices; border distance changes no
      // faster than position, so if the interpolated hint minus the triangle size exceeds
      // the line width, the pixel is far from any border, the whole triangle lies in one
      // region, and the vertex's region slot is used without looping.
      float borders[3];
      borders[0] = 1e30; borders[1] = 1e30; borders[2] = 1e30;
      int slots[3];
      slots[0] = -1; slots[1] = -1; slots[2] = -1;
      int from = 0;
      int count = snapT < 1.0 ? stateCount : 0;
      for (int level = 0; level < 3; level++) {
        if (count == 0) break;
        if (level == 1 && provinceFade <= 0.0) break;
        if (level == 2 && cityFade <= 0.0) break;
        int slot = int(vSlot[level]);
        float border = 1e30;
        if (vHint[level] - hintSlack > 2.0 * w) {
          // Far from any border: the hint approximates the distance well enough for the glow
          borders[level] = vHint[level];
          slots[level] = slot;
          int code = int(regionData[slot].w);
          from = code / 8;
          count = code - from * 8;
          continue;
        }
        float best = 1e30;
        slot = from;
        for (int i = 0; i < MAX_REGIONS; i++) {
          if (i >= count) break;
          vec3 d = vLocal - regionData[from + i].xyz;
          float q = dot(d, d);
          if (q < best) { best = q; slot = from + i; }
        }
        vec3 own = regionData[slot].xyz;
        for (int j = 0; j < MAX_REGIONS; j++) {
          if (j >= count) break;
          if (from + j == slot) continue;
          vec3 c = regionData[from + j].xyz;
          vec3 d = vLocal - c;
          border = min(border, (dot(d, d) - best) / (2.0 * distance(c, own)));
        }
        borders[level] = border;
        slots[level] = slot;
        int code = int(regionData[slot].w);
        from = code / 8;
        count = code - from * 8;
      }

      // ── Region borders along tile edges ──
      // A tile belongs to the city area in the tile texture; its province is id / 7 and
      // its state id / 49. A border runs along a hex edge whose two tiles differ at that
      // level; the nearest two edges are checked.
      vec3 tileBorders = vHint;
      ivec3 tileRegion = ivec3(-1);
      if (snapT > 0.0) {
        int c0 = tileCity(ownId);
        int c1 = nearId1 >= 0 ? tileCity(nearId1) : c0;
        int c2 = nearId2 >= 0 ? tileCity(nearId2) : c0;
        tileRegion = ivec3(c0 / 49, c0 / 7, c0);
        ivec3 r1 = ivec3(c1 / 49, c1 / 7, c1);
        ivec3 r2 = ivec3(c2 / 49, c2 / 7, c2);
        for (int l = 0; l < 3; l++) {
          float b = 1e30;
          if (tileRegion[l] != r1[l]) b = e1;
          if (tileRegion[l] != r2[l]) b = min(b, e2);
          if (b < 1e30) tileBorders[l] = b;
        }
      }

      // w is the pixel size in world units from the smooth position, not fwidth(border):
      // border is V-shaped at the line, so its screen derivative vanishes there
      float stateLine = mix(1.0 - smoothstep(0.5 * w, 1.2 * w, borders[0]), 1.0 - smoothstep(0.5 * w, 1.2 * w, tileBorders[0]), snapT);
      float provinceLine = mix(1.0 - smoothstep(0.35 * w, 0.9 * w, borders[1]), 1.0 - smoothstep(0.35 * w, 0.9 * w, tileBorders[1]), snapT) * provinceFade;
      float cityLine = mix(1.0 - smoothstep(0.3 * w, 0.75 * w, borders[2]), 1.0 - smoothstep(0.3 * w, 0.75 * w, tileBorders[2]), snapT) * cityFade;
      float strength = max(borderStrength * stateLine, max(0.38 * provinceLine, 0.24 * cityLine));
      color = mix(color, borderColor, strength);

      // Selection and context use the tile regions once borders follow tile edges
      if (fogOn > 0.5) {
        // --fog-edge: ink, 1.6 px, hand-drawn. Near: the hex edges between a mapped tile and
        // a fogged one, displaced by a wave along the edge (the same on both sides). Far:
        // the halfway contour of the fog map.
        float nearLine = 0.0;
        // Only within reach of an edge (line 1.3 px plus the 1.2 px wave)
        if (snapT > 0.0 && ownId >= 0 && e1 < 3.0 * w) {
          bool own = (code & 32) != 0;
          bool m1 = nearId1 >= 0 && (tileCodeAt(nearId1) & 32) != 0;
          bool m2 = nearId2 >= 0 && (tileCodeAt(nearId2) & 32) != 0;
          float edgeDist = 1e30;
          int edgeDir = n1;
          if (nearId1 >= 0 && m1 != own) edgeDist = e1;
          if (nearId2 >= 0 && m2 != own && e2 < edgeDist) { edgeDist = e2; edgeDir = n2; }
          if (edgeDist < 1e29) {
            vec3 along = vec3(neighborOffset((edgeDir + 1) % 6) - neighborOffset((edgeDir + 5) % 6));
            // Position along the edge, -1 … 1: the same seen from either tile (along is
            // perpendicular to the neighbour direction, and both are negated from the other side)
            float wave = cos(dot(hexDelta, along) * 6.0);
            float offset = (own ? 1.0 : -1.0) * 1.2 * w * wave;
            nearLine = 1.0 - smoothstep(0.8 * w, 1.3 * w, abs(edgeDist + offset));
          }
        }
        float farLine = 1.0 - smoothstep(0.8, 1.6, abs(farMapped - 0.5) / farWidth);
        color = mix(color, INK, 0.95 * mix(farLine, nearLine, snapT));
      }

      bool byTile = snapT >= 0.5;
      if (contextLevel >= 0) {
        int cs = slots[contextLevel];
        bool inside = byTile ? tileRegion[contextLevel] == contextId : cs >= 0 && distance(regionData[cs].xyz, contextLocal) < 1e-4;
        if (!inside) {
          color = mix(color, vec3(dot(color, vec3(0.3, 0.59, 0.11))), 0.5) * 0.5;
        }
      }
      if (focusLevel >= 0) {
        int fs = slots[focusLevel];
        if (byTile ? tileRegion[focusLevel] == focusId : fs >= 0 && distance(regionData[fs].xyz, focusLocal) < 1e-4) {
          // Distance to the selected region's outline: its borders at its own and every upper level
          float d = byTile ? tileBorders[0] : borders[0];
          for (int l = 1; l < 3; l++) if (l <= focusLevel) d = min(d, byTile ? tileBorders[l] : borders[l]);
          float ring = 1.0 - smoothstep(1.5 * w, 3.0 * w, d);
          float glow = 0.3 * (1.0 - smoothstep(0.0, 24.0 * w, d));
          color = mix(color, accentColor, max(0.95 * ring, glow));
        }
      }
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;


/**
 * Hex data of a quadtree tile: every icosahedron face it may overlap (faces whose
 * centroid score is within the tile's reach of the best), with the lattice
 * coordinates at the tile centre split into integer and fraction (see the shader).
 */
function hexUniforms(node: TileNode, withHex: boolean) {
  const face = new Int32Array(MAX_HEX_FACES * 4);
  const frac = new Float32Array(MAX_HEX_FACES * 4);
  const bary = new Float32Array(MAX_HEX_FACES * 4);
  let count = 0;
  let scale = 1;
  if (withHex && node.tile.level >= HEX_FIRST_LEVEL) {
    const ranked = FACE_CENTROIDS.map((c, f) => [node.dir.dot(c), f]).sort((a, b) => b[0] - a[0]);
    // Moving by the tile's angular radius changes the difference of two scores by at most twice that
    const reach = 2.1 * Math.sin(node.angRadius);
    const faces = ranked.filter(([d]) => d >= ranked[0][0] - reach).slice(0, MAX_HEX_FACES).map(([, f]) => f);
    const c = node.center;
    faces.forEach((f, q) => {
      const u = c.clone().applyMatrix3(FACE_INVERSES[f]);
      const sum = u.x + u.y + u.z;
      const L = [(u.x / sum) * FREQUENCY, (u.y / sum) * FREQUENCY, (u.z / sum) * FREQUENCY];
      const b = L.map(Math.floor);
      face.set([b[0], b[1], b[2], f], q * 4);
      frac.set([L[0] - b[0], L[1] - b[1], L[2] - b[2], c.dot(FACE_CENTROIDS[f].clone().sub(FACE_CENTROIDS[faces[0]]))], q * 4);
      bary.set([u.x / sum, u.y / sum, u.z / sum, sum], q * 4);
    });
    count = faces.length;
    scale = latticeScale(c, faces[0]);
  }
  return {
    hexFaceCount: { value: count },
    hexFace: { value: face },
    hexFrac: { value: frac },
    hexBary: { value: bary },
    hexScale: { value: scale },
  };
}

/** Tile spacings per world unit around a point: lattice change over two tangent steps. */
function latticeScale(c: THREE.Vector3, f: number): number {
  const lattice = (p: THREE.Vector3) => {
    const u = p.clone().applyMatrix3(FACE_INVERSES[f]);
    const sum = u.x + u.y + u.z;
    return [u.x / sum, u.y / sum, u.z / sum].map(v => v * FREQUENCY);
  };
  const n = c.clone().normalize();
  const t1 = new THREE.Vector3(0, 1, 0).cross(n);
  if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0).cross(n);
  t1.normalize();
  const t2 = n.clone().cross(t1);
  const step = c.length() * 1e-4;
  const l0 = lattice(c);
  // A lattice difference v (sum 0) spans √(v·v / 2) spacings
  const spacings = (t: THREE.Vector3) => {
    const l = lattice(c.clone().addScaledVector(t, step));
    return Math.sqrt(((l[0] - l0[0]) ** 2 + (l[1] - l0[1]) ** 2 + (l[2] - l0[2]) ** 2) / 2);
  };
  return (spacings(t1) + spacings(t2)) / (2 * step);
}

/** A region to highlight: its level, id at that level and unit-sphere centre. */
export interface Highlight {
  level: number;
  id: number;
  center: THREE.Vector3;
}

export interface FrameStats {
  drawn: number;
  created: number;
  genMs: number;
  maxLevel: number;
  queue: number;
  meshes: number;
}

export class TileManager {
  readonly roots: TileNode[];
  readonly group = new THREE.Group();
  readonly sunDir = { value: new THREE.Vector3(1, 0.6, 0.8).normalize() };
  readonly tintAmount = { value: 0 };
  budgetMs = 4;
  /** Statistics of the most recent update. */
  lastStats: FrameStats = { drawn: 0, created: 0, genMs: 0, maxLevel: 0, queue: 0, meshes: 0 };

  private frame = 0;
  private drawn: TileNode[] = [];
  private prevDrawn: TileNode[] = [];
  private queue: TileNode[] = [];
  private meshCount = 0;
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly camPos = new THREE.Vector3();
  private readonly camDir = new THREE.Vector3();
  private horizonAngle = 0;
  private pxPerUnit = 0;
  readonly radius: number;

  private readonly regions: Regions | null;
  readonly borderColor = { value: new THREE.Color(0.85, 0.92, 1.0) };
  readonly borderStrength = { value: 0.55 };
  /** Selection and context as region level (-1: none) plus unit-sphere centre. */
  readonly focusLevel = { value: -1 };
  readonly contextLevel = { value: -1 };
  /** --c-accent #9184d9 as raw sRGB (the shader output is not colour-managed). */
  readonly accentColor = { value: new THREE.Vector3(0x91, 0x84, 0xd9).divideScalar(255) };
  /** Narrower side of the drawing buffer in device pixels (the shader measures in those). */
  readonly narrowPx = { value: 800 };
  private readonly focusCenter = new THREE.Vector3();
  private readonly focusId = { value: -1 };
  private readonly contextId = { value: -1 };
  private readonly faceTex = { value: faceTexture() };
  private readonly tileTex: { value: THREE.DataTexture | null } = { value: null };
  private readonly tileTypeTex = { value: codeTexture() };
  /** Terrain glyph and resource icon atlas (glyphAtlas.ts); set by the page, empty in tests. */
  readonly glyphAtlas: { value: THREE.Texture } = { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) };
  /** Surface patterns (surfacePatterns.ts) and their channel statistics; set by the page. */
  readonly surfaceTex: { value: THREE.Texture } = { value: new THREE.DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1) };
  readonly surfaceMean = { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) };
  /** 1 draws the surface patterns, 0 not (a switch for slow devices and measurements). */
  readonly surfaceOn = { value: 1 };
  /** Fades the patterns in when they arrive from the worker (0–1). */
  readonly surfaceIn = { value: 1 };
  readonly surfaceStd = { value: new THREE.Vector4(1, 1, 1, 1) };
  /** World direction that is up on the screen. */
  readonly screenUp = { value: new THREE.Vector3(0, 1, 0) };
  /** 1 draws the fog of war (the game), 0 not (?free). */
  readonly fogOn = { value: 0 };
  /** Coarse fog map (fogMap.ts): 255 where mapped. */
  private readonly fogMap = { value: createFogTexture() };
  private readonly contextCenter = new THREE.Vector3();

  private readonly seed: number;

  constructor(radius: number, regions: Regions | null = null, seed = DEFAULT_SEED) {
    this.radius = radius;
    this.regions = regions;
    this.seed = seed;
    if (regions) this.tileTex.value = tileTexture(regions.tileTable());
    this.roots = [0, 1, 2, 3, 4, 5].map(face => this.makeNode({ face, level: 0, x: 0, y: 0 }));
    for (const root of this.roots) this.build(root);
  }

  private makeNode(tile: Tile): TileNode {
    const R = this.radius;
    const dir = tileToSphere(tile, 0.5, 0.5);
    const center = dir.clone().multiplyScalar(R);
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => tileToSphere(tile, i, j));
    let bs = 0;
    let ang = 0;
    for (const c of corners) {
      bs = Math.max(bs, c.clone().multiplyScalar(R).distanceTo(center));
      ang = Math.max(ang, dir.angleTo(c));
    }
    const arc = corners[0].distanceTo(corners[1]) * R;
    return {
      tile, center, dir, bsRadius: bs * 1.1, angRadius: ang * 1.05, arc,
      mesh: null, material: null, kids: null, split: false, lastSplitFrame: 0, queued: false,
    };
  }

  private build(node: TileNode): void {
    const N = SEG;
    const R = this.radius;
    const grid = (N + 1) * (N + 1);
    const count = grid + 4 * N;
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const base = new Float32Array(count);
    const hint = new Float32Array(count * 3).fill(1e9);
    const slots = new Float32Array(count * 3).fill(0);
    const level = node.tile.level;
    const entries = this.regions ? this.regions.entriesForTile(node.tile) : [];
    const localEntries = entries.map(e => ({ ...e, center: e.center.clone().multiplyScalar(R).sub(node.center) }));
    const p = new THREE.Vector3();
    const d = new THREE.Vector3();
    const c = node.center;

    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const v = j * (N + 1) + i;
        tileToSphere(node.tile, i / N, j / N, d);
        pos[v * 3] = d.x * R - c.x;
        pos[v * 3 + 1] = d.y * R - c.y;
        pos[v * 3 + 2] = d.z * R - c.z;
        nrm[v * 3] = d.x; nrm[v * 3 + 1] = d.y; nrm[v * 3 + 2] = d.z;
        base[v] = heightRange(d, 0, level, this.seed);
        if (localEntries.length) {
          const hit = hierarchyAt(p.set(d.x * R - c.x, d.y * R - c.y, d.z * R - c.z), localEntries);
          for (let q = 0; q < 3; q++) {
            if (hit.slots[q] < 0) break;
            slots[v * 3 + q] = hit.slots[q];
            // Finite: with no sibling the distance is Infinity, and interpolating it can give NaN
            hint[v * 3 + q] = Math.min(hit.border[q], 1e9);
          }
        }
      }
    }

    // Perimeter loop of grid vertices, then a skirt vertex below each one
    const ring: number[] = [];
    for (let i = 0; i <= N; i++) ring.push(i);
    for (let j = 1; j <= N; j++) ring.push(j * (N + 1) + N);
    for (let i = N - 1; i >= 0; i--) ring.push(N * (N + 1) + i);
    for (let j = N - 1; j >= 1; j--) ring.push(j * (N + 1));
    const skirtDepth = node.arc * 0.15;
    ring.forEach((g, k) => {
      const s = grid + k;
      const nx = nrm[g * 3], ny = nrm[g * 3 + 1], nz = nrm[g * 3 + 2];
      pos[s * 3] = pos[g * 3] - nx * skirtDepth;
      pos[s * 3 + 1] = pos[g * 3 + 1] - ny * skirtDepth;
      pos[s * 3 + 2] = pos[g * 3 + 2] - nz * skirtDepth;
      for (let q = 0; q < 3; q++) nrm[s * 3 + q] = nrm[g * 3 + q];
      base[s] = base[g];
      for (let q = 0; q < 3; q++) {
        hint[s * 3 + q] = hint[g * 3 + q];
        slots[s * 3 + q] = slots[g * 3 + q];
      }
    });

    const idx: number[] = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, b = a + 1, cc = a + N + 1, dd = cc + 1;
        idx.push(a, b, dd, a, dd, cc);
      }
    }
    for (let k = 0; k < ring.length; k++) {
      const g0 = ring[k], g1 = ring[(k + 1) % ring.length];
      const s0 = grid + k, s1 = grid + ((k + 1) % ring.length);
      idx.push(g0, s0, s1, g0, s1, g1, g0, s1, s0, g0, g1, s1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('baseHeight', new THREE.BufferAttribute(base, 1));
    geo.setAttribute('borderHint', new THREE.BufferAttribute(hint, 3));
    geo.setAttribute('regionSlot', new THREE.BufferAttribute(slots, 3));
    geo.setIndex(idx);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sunDir: this.sunDir,
        radius: { value: R },
        ...this.noiseUniforms(node),
        tintAmount: this.tintAmount,
        tint: { value: new THREE.Color().setHSL(node.tile.level / (MAX_LEVEL + 1), 0.8, 0.5) },
        ...this.regionUniforms(entries, localEntries),
        // Diagonal of a grid cell plus margin: no triangle is larger
        hintSlack: { value: (node.arc / N) * 1.6 },
        borderColor: this.borderColor,
        borderStrength: this.borderStrength,
        focusLevel: this.focusLevel,
        focusLocal: { value: new THREE.Vector3() },
        contextLevel: this.contextLevel,
        contextLocal: { value: new THREE.Vector3() },
        accentColor: this.accentColor,
        narrowPx: this.narrowPx,
        ...hexUniforms(node, this.regions !== null),
        faceTex: this.faceTex,
        tileTex: this.tileTex,
        tileTypeTex: this.tileTypeTex,
        glyphAtlas: this.glyphAtlas,
        terrainColors: { value: terrainColors },
        surfaceOn: this.surfaceOn,
        surfaceIn: this.surfaceIn,
        surfaceTex: this.surfaceTex,
        surfaceMean: this.surfaceMean,
        surfaceStd: this.surfaceStd,
        surfaceOf: { value: surfaceOf },
        screenUp: this.screenUp,
        fogOn: this.fogOn,
        fogMap: this.fogMap,
        tileWorldCenter: { value: node.center },
        focusId: this.focusId,
        contextId: this.contextId,
      },
      vertexShader,
      fragmentShader,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(node.center);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    node.mesh = mesh;
    node.material = material;
    this.meshCount++;
  }

  /** Per-pixel octaves level..level+PIXEL_OCTAVES-1, split at the tile centre for float32 precision. */
  private noiseUniforms(node: TileNode) {
    const baseCells = new Int32Array(PIXEL_OCTAVES * 3);
    const frac = new Float32Array(PIXEL_OCTAVES * 3);
    const params = new Float32Array(PIXEL_OCTAVES * 3);
    for (let i = 0; i < PIXEL_OCTAVES; i++) {
      const o = octaveSplit(node.dir, node.tile.level + i, this.seed);
      baseCells.set(o.base, i * 3);
      frac.set(o.frac, i * 3);
      params.set([o.freq, o.amp, o.seed], i * 3);
    }
    return { noiseBase: { value: baseCells }, noiseFrac: { value: frac }, noiseParams: { value: params } };
  }

  /** Candidate region centres in tile-local coordinates (float64 here, small values for the GPU). */
  private regionUniforms(entries: RegionEntry[], localEntries: RegionEntry[]) {
    const data = new Float32Array(MAX_TILE_REGIONS * 4);
    const radii = new THREE.Vector2();
    if (!this.regions) return { stateCount: { value: 0 }, regionData: { value: data }, regionRadii: { value: radii } };
    localEntries.forEach((e, k) => data.set([e.center.x, e.center.y, e.center.z, e.firstChild * 8 + e.childCount], k * 4));
    radii.set(this.regions.inradius[1] * this.radius, this.regions.inradius[2] * this.radius);
    return { stateCount: { value: Regions.stateCount(entries) }, regionData: { value: data }, regionRadii: { value: radii } };
  }

  private dispose(node: TileNode): void {
    if (node.kids) for (const k of node.kids) this.dispose(k);
    node.kids = null;
    if (node.mesh) {
      this.group.remove(node.mesh);
      node.mesh.geometry.dispose();
      node.material!.dispose();
      node.mesh = null;
      node.material = null;
      this.meshCount--;
    }
    node.queued = false;
  }

  private isVisible(node: TileNode): boolean {
    const ang = Math.acos(Math.min(1, Math.max(-1, node.dir.dot(this.camDir))));
    if (ang > this.horizonAngle + node.angRadius) return false;
    return this.frustum.intersectsSphere(this.sphere.set(node.center, node.bsRadius));
  }

  private request(node: TileNode): void {
    if (!node.queued && !node.mesh) {
      node.queued = true;
      this.queue.push(node);
    }
  }

  private visit(node: TileNode): void {
    if (!this.isVisible(node)) return;
    const dist = Math.max(this.camPos.distanceTo(node.center) - node.bsRadius, 1e-12);
    const px = (node.arc / dist) * this.pxPerUnit;
    const wantSplit = node.tile.level < MAX_LEVEL && px > (node.split ? MERGE_PX : SPLIT_PX);

    if (wantSplit) {
      if (!node.kids) node.kids = children(node.tile).map(t => this.makeNode(t));
      if (node.kids.every(k => k.mesh)) {
        node.split = true;
        node.lastSplitFrame = this.frame;
        for (const k of node.kids) this.visit(k);
        return;
      }
      for (const k of node.kids) this.request(k);
    }

    node.split = false;
    node.mesh!.visible = true;
    this.drawn.push(node);
  }

  private prune(node: TileNode): void {
    if (!node.kids) return;
    // lastSplitFrame only advances while the node is visited split, so this also
    // frees subtrees that left the view while split
    if (this.frame - node.lastSplitFrame > PRUNE_AFTER_FRAMES) {
      for (const k of node.kids) this.dispose(k);
      node.kids = null;
      node.split = false;
      return;
    }
    for (const k of node.kids) this.prune(k);
  }

  update(camera: THREE.PerspectiveCamera, viewportHeight: number, _dt: number): FrameStats {
    this.frame++;
    camera.updateMatrixWorld();
    this.camPos.setFromMatrixPosition(camera.matrixWorld);
    this.camDir.copy(this.camPos).normalize();
    const D = this.camPos.length();
    this.horizonAngle = Math.acos(Math.min(1, this.radius / D));
    this.pxPerUnit = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);

    for (const n of this.prevDrawn) n.mesh && (n.mesh.visible = false);
    this.drawn = [];
    for (const root of this.roots) this.visit(root);

    // Generate requested tiles within the time budget, coarse levels first
    this.queue = this.queue.filter(n => n.queued && !n.mesh);
    this.queue.sort((a, b) => a.tile.level - b.tile.level);
    const t0 = performance.now();
    let created = 0;
    while (this.queue.length && (created === 0 || performance.now() - t0 < this.budgetMs)) {
      const n = this.queue.shift()!;
      n.queued = false;
      this.build(n);
      created++;
    }
    const genMs = performance.now() - t0;

    if (this.frame % 60 === 0) for (const root of this.roots) this.prune(root);

    for (const n of this.drawn) this.updateHighlight(n);
    this.prevDrawn = this.drawn;
    let maxLevel = 0;
    for (const n of this.drawn) maxLevel = Math.max(maxLevel, n.tile.level);
    this.lastStats = { drawn: this.drawn.length, created, genMs, maxLevel, queue: this.queue.length, meshes: this.meshCount };
    return this.lastStats;
  }

  /**
   * Highlight a selected region and dim everything outside the context region.
   * Centres are unit vectors from Regions.centers; null clears.
   */
  setHighlight(focus: Highlight | null, context: Highlight | null): void {
    this.focusLevel.value = focus ? focus.level : -1;
    this.focusId.value = focus ? focus.id : -1;
    if (focus) this.focusCenter.copy(focus.center);
    this.contextLevel.value = context ? context.level : -1;
    this.contextId.value = context ? context.id : -1;
    if (context) this.contextCenter.copy(context.center);
  }

  /** Same float64 arithmetic as the candidate list (centre × R − tile centre), so float32 values match. */
  private updateHighlight(node: TileNode): void {
    const u = node.material!.uniforms;
    const R = this.radius;
    if (this.focusLevel.value >= 0) u.focusLocal.value.copy(this.focusCenter).multiplyScalar(R).sub(node.center);
    if (this.contextLevel.value >= 0) u.contextLocal.value.copy(this.contextCenter).multiplyScalar(R).sub(node.center);
  }

  /** Per-tile codes behind the code texture (terrainTypes.ts TileTypeTable fills them). */
  get tileCodes(): Uint8Array {
    return this.tileTypeTex.value.image.data as Uint8Array;
  }

  /** Texels of the coarse fog map (fogMap.ts paintMapped writes them). */
  get fogData(): Uint8Array {
    return this.fogMap.value.image.data as Uint8Array;
  }

  /** Upload the fog map after it changed. */
  fogChanged(): void {
    this.fogMap.value.needsUpdate = true;
  }

  /** Upload the tile codes after they changed. */
  tileCodesChanged(): void {
    this.tileTypeTex.value.needsUpdate = true;
  }

  /** Tiles drawn in the last update. */
  drawnTiles(): Tile[] {
    return this.drawn.map(n => n.tile);
  }

  /** Drawn tile with the highest level, for precision measurements. */
  deepestDrawn(): TileNode | null {
    let best: TileNode | null = null;
    for (const n of this.drawn) if (!best || n.tile.level > best.tile.level) best = n;
    return best;
  }
}
