/**
 * unitLayer.ts — units on the map (design 2b): a figure at each unit's tile centre,
 * an accent ring at the selected unit's feet, scout paths as dotted ink, the settler's
 * way as an accent dash to a dashed circle at the city site, and the exploration flag.
 * Improvements (STORY-033): roads as ink ribbons between tile centres, irrigation and mines
 * as marks beside the tile centre.
 *
 * Every object sits at a tile centre with its geometry relative to it, so the float64
 * object matrix keeps positions exact at deep zoom (as the surface tiles do).
 */
import * as THREE from 'three';
import { neighbors, tileCenter } from './hexTiles';
import { oklchToSrgb } from './colors';
import type { Unit } from '../game/units';
import type { ImprovementKind } from '../game/improvements';

const INK = new THREE.Color().setRGB(...oklchToSrgb(0.82, 0.04, 80), THREE.SRGBColorSpace);
const INK_DARK = `rgb(${oklchToSrgb(0.26, 0.03, 60).map(v => Math.round(v * 255)).join(',')})`;
const INK_CSS = `rgb(${oklchToSrgb(0.82, 0.04, 80).map(v => Math.round(v * 255)).join(',')})`;
const ACCENT = '#9184d9';
const ACCENT_LIGHT = '#b5abfc';
const WATER_CSS = `rgb(${oklchToSrgb(0.72, 0.11, 230).map(v => Math.round(v * 255)).join(',')})`;
/** Height above the surface, in radii: keeps the layer over the terrain without visible float. */
const LIFT = 1e-6;

type Figure = 'scout' | 'settler' | 'warrior' | 'city' | 'ring' | 'flag' | 'irrigation' | 'mine';

/**
 * Simple figures drawn once: a pawn with a staff (scout), a pack (settler) or a spear and
 * a shield (soldier), a city of three houses, the ring and the flag.
 */
function figureTexture(kind: Figure): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.lineJoin = g.lineCap = 'round';
  if (kind === 'ring') {
    g.strokeStyle = ACCENT_LIGHT;
    g.lineWidth = 7;
    g.beginPath();
    g.ellipse(64, 64, 54, 24, 0, 0, Math.PI * 2);
    g.stroke();
  } else if (kind === 'flag') {
    g.strokeStyle = INK_DARK;
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(52, 118); g.lineTo(52, 18); g.stroke();
    g.fillStyle = ACCENT;
    g.beginPath(); g.moveTo(52, 20); g.quadraticCurveTo(80, 10, 104, 24); g.quadraticCurveTo(80, 40, 52, 56); g.closePath(); g.fill();
    g.stroke();
  } else if (kind === 'irrigation') {
    // Three furrows of water, outlined in dark ink
    g.lineWidth = 16;
    g.strokeStyle = INK_DARK;
    for (const y of [40, 64, 88]) { g.beginPath(); g.moveTo(24, y + 10); g.lineTo(104, y - 10); g.stroke(); }
    g.lineWidth = 8;
    g.strokeStyle = WATER_CSS;
    for (const y of [40, 64, 88]) { g.beginPath(); g.moveTo(24, y + 10); g.lineTo(104, y - 10); g.stroke(); }
  } else if (kind === 'mine') {
    // A dark heap with a light pick
    g.fillStyle = INK_DARK;
    g.beginPath(); g.moveTo(10, 112); g.quadraticCurveTo(64, 20, 118, 112); g.closePath(); g.fill();
    g.strokeStyle = INK_CSS;
    g.lineWidth = 8;
    g.beginPath(); g.moveTo(46, 100); g.lineTo(80, 50); g.stroke();
    g.beginPath(); g.moveTo(58, 46); g.quadraticCurveTo(82, 38, 98, 58); g.stroke();
  } else if (kind === 'city') {
    // Three houses on a shadow, light from the top left: lit walls in ink, dark roofs
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(64, 112, 58, 12, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK_DARK;
    g.lineWidth = 5;
    for (const [x, y, w, h] of [[14, 70, 34, 38], [46, 50, 38, 58], [82, 72, 32, 36]]) {
      g.fillStyle = INK_CSS;
      g.fillRect(x, y, w, h);
      g.strokeRect(x, y, w, h);
      g.fillStyle = INK_DARK;
      g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + w / 2, y - h * 0.45); g.lineTo(x + w + 4, y); g.closePath(); g.fill();
    }
  } else {
    // Shadow at the feet, body, head; light from the top left (design)
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(64, 116, 28, 8, 0, 0, Math.PI * 2); g.fill();
    if (kind === 'settler') {
      g.fillStyle = INK_DARK;
      g.fillRect(70, 52, 26, 34);
    }
    g.fillStyle = INK_CSS;
    g.strokeStyle = INK_DARK;
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(46, 114); g.lineTo(52, 60); g.quadraticCurveTo(64, 50, 76, 60); g.lineTo(82, 114); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(64, 38, 15, 0, Math.PI * 2); g.fill(); g.stroke();
    if (kind === 'scout') {
      g.beginPath(); g.moveTo(92, 26); g.lineTo(84, 116); g.stroke();
    }
    if (kind === 'warrior') {
      g.beginPath(); g.moveTo(96, 8); g.lineTo(88, 116); g.stroke();
      g.fillStyle = INK_DARK;
      g.beginPath(); g.ellipse(42, 82, 14, 20, 0, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sprite(map: THREE.Texture, order: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false, transparent: true }));
  s.center.set(0.5, 0.08);
  s.renderOrder = order;
  return s;
}

export interface UnitView {
  units: readonly Unit[];
  /** Tiles of the cities (STORY-028). */
  cities: readonly number[];
  selected: number | null;
  flag: number | null;
  site: number | null;
  /** The settler is on its way to the site: its path is drawn. */
  founding: boolean;
  /** Tiles with improvements, and what (STORY-033). */
  improvements: readonly (readonly [number, readonly ImprovementKind[]])[];
  /** Distance between tile centres in world units, for sizes. */
  spacing: number;
}

export class UnitLayer {
  readonly group = new THREE.Group();
  private readonly radius: number;
  private readonly textures: Record<Figure, THREE.CanvasTexture>;
  private readonly figures: THREE.Sprite[] = [];
  private readonly cities: THREE.Sprite[] = [];
  private readonly marks: THREE.Sprite[] = [];
  private readonly roads = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(INK_DARK), depthTest: false, side: THREE.DoubleSide }));
  private lastRoads = '';
  private readonly ring: THREE.Sprite;
  private readonly flag: THREE.Sprite;
  private readonly paths = new THREE.Group();
  private readonly site: THREE.LineLoop;
  private readonly dotted = new THREE.LineDashedMaterial({ color: INK, depthTest: false, transparent: true, opacity: 0.85 });
  private readonly dashed = new THREE.LineDashedMaterial({ color: new THREE.Color(ACCENT), depthTest: false });
  private lastPaths = '';

  constructor(radius: number) {
    this.radius = radius;
    this.textures = {
      scout: figureTexture('scout'), settler: figureTexture('settler'), warrior: figureTexture('warrior'),
      city: figureTexture('city'), ring: figureTexture('ring'), flag: figureTexture('flag'),
      irrigation: figureTexture('irrigation'), mine: figureTexture('mine'),
    };
    this.roads.renderOrder = 6;
    this.ring = sprite(this.textures.ring, 10);
    this.ring.center.set(0.5, 0.5);
    this.flag = sprite(this.textures.flag, 11);
    this.site = new THREE.LineLoop(new THREE.BufferGeometry(), this.dashed);
    this.site.renderOrder = 9;
    this.group.add(this.roads, this.paths, this.site, this.ring, this.flag);
  }

  /** World position of a tile centre, lifted a little. */
  private at(tile: number, out = new THREE.Vector3()): THREE.Vector3 {
    return tileCenter(tile, out).multiplyScalar(this.radius * (1 + LIFT));
  }

  /** Place everything; figures on the far side of the globe (from cameraPos) are hidden. */
  update(view: UnitView, cameraPos: THREE.Vector3): void {
    const size = view.spacing * 0.8;
    const facing = (p: THREE.Vector3) => p.dot(cameraPos) > this.radius * this.radius;
    while (this.figures.length < view.units.length) {
      const s = sprite(this.textures.scout, 12);
      this.figures.push(s);
      this.group.add(s);
    }
    view.units.forEach((u, i) => {
      const s = this.figures[i];
      s.material.map = this.textures[u.kind];
      this.at(u.tile, s.position);
      s.scale.set(size, size, 1);
      s.visible = facing(s.position);
    });
    // A settler that founded a city is gone: hide its figure
    for (let i = view.units.length; i < this.figures.length; i++) this.figures[i].visible = false;
    while (this.cities.length < view.cities.length) {
      const s = sprite(this.textures.city, 7);
      this.cities.push(s);
      this.group.add(s);
    }
    this.cities.forEach((s, i) => {
      s.visible = i < view.cities.length;
      if (!s.visible) return;
      this.at(view.cities[i], s.position);
      s.scale.set(size * 1.25, size * 1.25, 1);
      s.visible = facing(s.position);
    });
    this.ring.visible = view.selected !== null;
    if (view.selected !== null) {
      this.at(view.units[view.selected].tile, this.ring.position);
      this.ring.scale.set(size * 0.9, size * 0.9, 1);
    }
    this.flag.visible = view.flag !== null;
    if (view.flag !== null) {
      this.at(view.flag, this.flag.position);
      this.flag.scale.set(size * 0.8, size * 0.8, 1);
    }
    this.updateImprovements(view, size, facing);
    this.updatePaths(view);
  }

  /** Irrigation and mine marks at the lower right of their tiles, and the road ribbons. */
  private updateImprovements(view: UnitView, size: number, facing: (p: THREE.Vector3) => boolean): void {
    const marked = view.improvements.flatMap(([tile, kinds]) => kinds.filter(k => k !== 'road').map(k => [tile, k] as const));
    while (this.marks.length < marked.length) {
      const s = sprite(this.textures.irrigation, 7);
      s.center.set(-0.25, 1.1);
      this.marks.push(s);
      this.group.add(s);
    }
    this.marks.forEach((s, i) => {
      s.visible = i < marked.length;
      if (!s.visible) return;
      s.material.map = this.textures[marked[i][1] as Figure];
      this.at(marked[i][0], s.position);
      s.scale.set(size * 0.42, size * 0.42, 1);
      s.visible = facing(s.position);
    });
    const roads = view.improvements.filter(([, kinds]) => kinds.includes('road')).map(([tile]) => tile);
    const key = JSON.stringify([roads, view.cities, view.spacing.toPrecision(3)]);
    if (key === this.lastRoads) return;
    this.lastRoads = key;
    this.roads.geometry.dispose();
    this.roads.geometry = new THREE.BufferGeometry();
    if (!roads.length) return;
    // A road joins its neighbours with roads or cities; alone, it heads toward the nearest city
    const linked = new Set([...roads, ...view.cities]);
    const segments: [number, number, number][] = [];
    for (const t of roads) {
      const near = neighbors(t);
      const ends = near.filter(n => linked.has(n) && (view.cities.includes(n) || n > t));
      for (const n of ends) segments.push([t, n, 1]);
      if (near.some(n => linked.has(n)) || !view.cities.length) continue;
      const toward = (n: number) => Math.min(...view.cities.map(c => tileCenter(c).angleTo(tileCenter(n))));
      segments.push([t, near.reduce((a, b) => (toward(b) < toward(a) ? b : a)), 0.5]);
    }
    const origin = this.at(roads[0]);
    const half = view.spacing * 0.035;
    const pts: number[] = [];
    for (const [a, b, part] of segments) {
      const p = this.at(a).sub(origin);
      const q = this.at(b).sub(origin).sub(p).multiplyScalar(part).add(p);
      const side = q.clone().sub(p).cross(this.at(a)).normalize().multiplyScalar(half);
      const [p1, p2, q1, q2] = [p.clone().add(side), p.clone().sub(side), q.clone().add(side), q.clone().sub(side)];
      for (const v of [p1, p2, q1, q1, p2, q2]) pts.push(v.x, v.y, v.z);
    }
    this.roads.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.roads.position.copy(origin);
  }

  /** Rebuild the path lines when they change (paths change once a day at most). */
  private updatePaths(view: UnitView): void {
    const key = JSON.stringify([view.units.map(u => [u.tile, u.kind === 'settler' && u.task === 'found' && !view.founding ? [] : u.path]), view.site, view.spacing.toPrecision(3)]);
    if (key === this.lastPaths) return;
    this.lastPaths = key;
    for (const child of [...this.paths.children]) {
      this.paths.remove(child);
      (child as THREE.Line).geometry.dispose();
    }
    const unitScale = view.spacing;
    this.dotted.dashSize = unitScale * 0.06;
    this.dotted.gapSize = unitScale * 0.1;
    this.dashed.dashSize = unitScale * 0.2;
    this.dashed.gapSize = unitScale * 0.12;
    const active = view.units.find(u => u.kind === 'settler' && u.task === 'found');
    for (const u of view.units) {
      const founder = u.kind === 'settler' && u.task === 'found';
      if (founder && u !== active) continue;
      const tiles = founder ? (view.founding ? [u.tile, ...u.path] : view.site !== null && view.site !== u.tile ? [u.tile, view.site] : []) : [u.tile, ...u.path];
      if (tiles.length < 2) continue;
      this.paths.add(this.line(tiles, founder ? this.dashed : this.dotted));
    }
    // The city site: a dashed circle in the tangent plane
    this.site.visible = view.site !== null;
    if (view.site !== null) {
      const centre = this.at(view.site);
      const n = centre.clone().normalize();
      const e1 = new THREE.Vector3(0, 1, 0).cross(n).normalize();
      const e2 = n.clone().cross(e1);
      const r = view.spacing * 0.45;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        pts.push(e1.clone().multiplyScalar(Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r));
      }
      this.site.geometry.dispose();
      this.site.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      this.site.position.copy(centre);
      this.site.computeLineDistances();
    }
  }

  /** A line through tile centres, relative to its first point. */
  private line(tiles: number[], material: THREE.LineDashedMaterial): THREE.Line {
    const origin = this.at(tiles[0]);
    const pts = tiles.map(t => this.at(t).sub(origin));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
    line.position.copy(origin);
    line.computeLineDistances();
    line.renderOrder = 8;
    return line;
  }

  /**
   * The unit whose figure is nearest to a screen point within maxPx, or null. A figure
   * stands on its tile and rises toward the top of the screen, so the distance is to the
   * segment from its feet to its head.
   */
  pick(units: readonly Unit[], camera: THREE.Camera, x: number, y: number, width: number, height: number, maxPx: number, spacing: number): number | null {
    let best: number | null = null;
    let bestD = maxPx;
    const feet = new THREE.Vector3();
    const head = new THREE.Vector3();
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const toScreen = (v: THREE.Vector3) => [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
    units.forEach((u, i) => {
      this.at(u.tile, feet);
      head.copy(feet).addScaledVector(up, spacing * 0.8 * 0.85);
      feet.project(camera);
      head.project(camera);
      if (feet.z > 1) return;
      const [fx, fy] = toScreen(feet);
      const [hx, hy] = toScreen(head);
      const len2 = (hx - fx) ** 2 + (hy - fy) ** 2;
      const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - fx) * (hx - fx) + (y - fy) * (hy - fy)) / len2)) : 0;
      const d = Math.hypot(fx + t * (hx - fx) - x, fy + t * (hy - fy) - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }
}
