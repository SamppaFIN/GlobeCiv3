/**
 * tiles.ts — quadtree LOD over the cube sphere.
 *
 * Tile vertices are stored relative to the tile centre, and the centre lives in
 * mesh.position as a float64 JS number. Three.js multiplies view × model on the
 * CPU in float64, so the GPU only sees small camera-relative values.
 */
import * as THREE from 'three';
import { children, MAX_LEVEL, tileToSphere, type Tile } from './cubeSphere';
import { MAX_TILE_REGIONS, type Regions } from './regions';
import { terrainColors } from './terrain';

const SEG = 16;
export const SPLIT_PX = 256;
export const MERGE_PX = 128;
const MERGE_FADE_S = 0.3;
const PRUNE_AFTER_FRAMES = 300;

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
  mergeHold: number;
  queued: boolean;
}

const vertexShader = /* glsl */ `
  attribute vec3 colorA;
  attribute vec3 colorB;
  uniform float morph;
  uniform vec3 sunDir;
  uniform vec3 tint;
  uniform float tintAmount;
  varying vec3 vColor;
  varying vec3 vLocal;
  void main() {
    vec3 c = mix(mix(colorA, colorB, morph), tint, tintAmount);
    float light = 0.3 + 0.7 * max(dot(normal, sunDir), 0.0);
    vColor = c * light;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Region borders per pixel. Positions and candidate centres are in tile-local
// coordinates, so precision holds at every level. The border between regions i
// and j is the plane bisecting their centres; the signed distance from p is
// (|p - cj|² - |p - ci|²) / (2 |cj - ci|), a true distance in world units, so the
// line width is set from the world size of one pixel and stays ~1.5 px at every zoom.
const fragmentShader = /* glsl */ `
  #define MAX_REGIONS ${MAX_TILE_REGIONS}
  uniform int regionCount;
  uniform vec3 regionCenters[MAX_REGIONS];
  uniform vec3 borderColor;
  uniform float borderStrength;
  varying vec3 vColor;
  varying vec3 vLocal;
  void main() {
    vec3 color = vColor;
    if (regionCount > 1) {
      float best = 1e30;
      int nearest = 0;
      for (int i = 0; i < MAX_REGIONS; i++) {
        if (i >= regionCount) break;
        vec3 d = vLocal - regionCenters[i];
        float q = dot(d, d);
        if (q < best) { best = q; nearest = i; }
      }
      vec3 own = regionCenters[nearest];
      float border = 1e30;
      for (int j = 0; j < MAX_REGIONS; j++) {
        if (j >= regionCount) break;
        if (j == nearest) continue;
        vec3 d = vLocal - regionCenters[j];
        border = min(border, (dot(d, d) - best) / (2.0 * distance(regionCenters[j], own)));
      }
      // Pixel size in world units from the smooth position, not fwidth(border):
      // border is V-shaped at the line, so its screen derivative vanishes there
      float w = max(length(dFdx(vLocal)), length(dFdy(vLocal)));
      float line = 1.0 - smoothstep(0.5 * w, 1.2 * w, border);
      color = mix(color, borderColor, borderStrength * line);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
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
  private dt = 0;
  readonly radius: number;

  private readonly regions: Regions | null;
  readonly borderColor = { value: new THREE.Color(0.85, 0.92, 1.0) };
  readonly borderStrength = { value: 0.55 };

  constructor(radius: number, regions: Regions | null = null) {
    this.radius = radius;
    this.regions = regions;
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
      mesh: null, material: null, kids: null, split: false, lastSplitFrame: 0, mergeHold: 0, queued: false,
    };
  }

  private build(node: TileNode): void {
    const N = SEG;
    const R = this.radius;
    const grid = (N + 1) * (N + 1);
    const count = grid + 4 * N;
    const pos = new Float32Array(count * 3);
    const nrm = new Float32Array(count * 3);
    const colA = new Float32Array(count * 3);
    const colB = new Float32Array(count * 3);
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
        terrainColors(d.x, d.y, d.z, node.tile.level, colA, colB, v * 3);
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
      for (let q = 0; q < 3; q++) {
        nrm[s * 3 + q] = nrm[g * 3 + q];
        colA[s * 3 + q] = colA[g * 3 + q];
        colB[s * 3 + q] = colB[g * 3 + q];
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
    geo.setAttribute('colorA', new THREE.BufferAttribute(colA, 3));
    geo.setAttribute('colorB', new THREE.BufferAttribute(colB, 3));
    geo.setIndex(idx);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        morph: { value: 0 },
        sunDir: this.sunDir,
        tintAmount: this.tintAmount,
        tint: { value: new THREE.Color().setHSL(node.tile.level / (MAX_LEVEL + 1), 0.8, 0.5) },
        ...this.regionUniforms(node),
        borderColor: this.borderColor,
        borderStrength: this.borderStrength,
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

  /** Candidate region centres in tile-local coordinates (float64 here, small values for the GPU). */
  private regionUniforms(node: TileNode) {
    const centers = Array.from({ length: MAX_TILE_REGIONS }, () => new THREE.Vector3());
    if (!this.regions) return { regionCount: { value: 0 }, regionCenters: { value: centers } };
    const ids = this.regions.candidatesForTile(node.tile);
    ids.forEach((id, k) => centers[k].copy(this.regions!.centers[id]).multiplyScalar(this.radius).sub(node.center));
    return { regionCount: { value: ids.length }, regionCenters: { value: centers } };
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

    if (node.split) node.mergeHold = 1; // just merged: keep the finer colour and fade it out
    node.split = false;
    node.mergeHold = Math.max(0, node.mergeHold - this.dt / MERGE_FADE_S);
    node.material!.uniforms.morph.value = Math.max(smoothstep(MERGE_PX, SPLIT_PX, px), node.mergeHold);
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

  update(camera: THREE.PerspectiveCamera, viewportHeight: number, dt: number): FrameStats {
    this.frame++;
    this.dt = dt;
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

    this.prevDrawn = this.drawn;
    let maxLevel = 0;
    for (const n of this.drawn) maxLevel = Math.max(maxLevel, n.tile.level);
    this.lastStats = { drawn: this.drawn.length, created, genMs, maxLevel, queue: this.queue.length, meshes: this.meshCount };
    return this.lastStats;
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
