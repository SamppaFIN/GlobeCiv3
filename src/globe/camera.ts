/**
 * camera.ts — globe camera rig.
 *
 * The rig is (target point on the unit sphere, forward tangent, distance from
 * the target). Zoom and pan rotate the rig rigidly around the globe so that the
 * surface point under the cursor stays under the cursor ("grab the globe").
 * The camera tilts toward the horizon as it descends, and near/far follow the
 * altitude so that the depth buffer keeps its precision at every zoom level.
 */
import * as THREE from 'three';

/** ln(zoom factor) per wheel pixel: every notch scales the distance by the same factor. */
export const WHEEL_ZOOM_RATE = 0.002;
const MAX_TILT = THREE.MathUtils.degToRad(60);

/** Wheel event delta → distance multiplier (> 1 zooms out). */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  const px = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 800 : deltaY;
  return Math.exp(px * WHEEL_ZOOM_RATE);
}

export interface GlobeCameraOptions {
  minDist: number;
  maxDist: number;
  startDist: number;
}

export class GlobeCamera {
  readonly R: number;
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3(0, 0, 1);
  readonly forward = new THREE.Vector3(0, 1, 0);
  dist: number;
  minDist: number;
  maxDist: number;

  private readonly raycaster = new THREE.Raycaster();
  private readonly q = new THREE.Quaternion();

  constructor(R: number, camera: THREE.PerspectiveCamera, opts: GlobeCameraOptions) {
    this.R = R;
    this.camera = camera;
    this.minDist = opts.minDist;
    this.maxDist = opts.maxDist;
    this.dist = opts.startDist;
  }

  /** Tilt from the vertical: 0 far out, rising smoothly to 60° close to the surface. */
  tilt(): number {
    const hi = Math.log(this.R * 0.5);
    const lo = Math.log(this.R * 0.002);
    const t = Math.min(1, Math.max(0, (hi - Math.log(this.dist)) / (hi - lo)));
    return MAX_TILT * t * t * (3 - 2 * t);
  }

  apply(): void {
    const { camera, target, forward, R } = this;
    target.normalize();
    forward.addScaledVector(target, -forward.dot(target)).normalize();
    const tau = this.tilt();
    const surface = target.clone().multiplyScalar(R);
    const offset = target.clone().multiplyScalar(Math.cos(tau)).addScaledVector(forward, -Math.sin(tau));
    camera.position.copy(surface).addScaledVector(offset, this.dist);
    camera.up.copy(forward).multiplyScalar(Math.cos(tau)).addScaledVector(target, Math.sin(tau));
    camera.lookAt(surface);

    // Nearest surface point is at least the altitude away; the horizon is the farthest
    const D = camera.position.length();
    const h = Math.max(D - R, 0);
    camera.near = Math.max(h * 0.5, R * 1e-9);
    camera.far = Math.sqrt(Math.max(D * D - R * R, 0)) * 1.02 + R * 1e-6;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  altitude(): number {
    return this.camera.position.length() - this.R;
  }

  /** Surface point seen at the given NDC, or null if the ray misses the globe. */
  raycast(ndc: THREE.Vector2): THREE.Vector3 | null {
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    const b = origin.dot(direction);
    const c = origin.lengthSq() - this.R * this.R;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    return origin.clone().addScaledVector(direction, t);
  }

  /** Rotate the rig so that the given surface point appears at the given NDC. */
  grab(ndc: THREE.Vector2, point: THREE.Vector3): void {
    const seen = this.raycast(ndc);
    if (!seen) return;
    this.q.setFromUnitVectors(seen.normalize(), point.clone().normalize());
    this.target.applyQuaternion(this.q);
    this.forward.applyQuaternion(this.q);
    this.apply();
  }

  private scaleDist(factor: number): void {
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * factor));
    this.apply();
  }

  /** Multiply the distance by factor, keeping the surface point under ndc fixed. Returns that point. */
  zoomAt(ndc: THREE.Vector2, factor: number): THREE.Vector3 | null {
    const point = this.raycast(ndc);
    this.scaleDist(factor);
    if (point) this.grab(ndc, point);
    return point;
  }

  /**
   * Two-finger pinch: the fingers moved apart from fromSpread to toSpread pixels and
   * their midpoint from fromMid to toMid. The grabbed point follows the midpoint.
   */
  pinch(grabbed: THREE.Vector3 | null, fromSpread: number, toSpread: number, toMid: THREE.Vector2): void {
    if (fromSpread > 0 && toSpread > 0) this.scaleDist(fromSpread / toSpread);
    if (grabbed) this.grab(toMid, grabbed);
  }

  /** Pixel distance between where a world point projects and the given NDC. */
  screenErrorPx(point: THREE.Vector3, ndc: THREE.Vector2, width: number, height: number): number {
    const p = point.clone().project(this.camera);
    return Math.hypot(((p.x - ndc.x) * width) / 2, ((p.y - ndc.y) * height) / 2);
  }
}

/** Mouse wheel, one-finger/mouse drag and two-finger pinch. Returns a detach function. */
export function attachInput(el: HTMLElement, rig: GlobeCamera): () => void {
  const pointers = new Map<number, { ndc: THREE.Vector2; x: number; y: number }>();
  let grabbed: THREE.Vector3 | null = null;
  let spread = 0;

  const toNdc = (x: number, y: number) => {
    const r = el.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };
  const pair = () => [...pointers.values()];
  const midNdc = () => {
    const [a, b] = pair();
    return a.ndc.clone().add(b.ndc).multiplyScalar(0.5);
  };
  const spreadPx = () => {
    const [a, b] = pair();
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    rig.zoomAt(toNdc(e.clientX, e.clientY), wheelFactor(e.deltaY, e.deltaMode));
  };
  const onDown = (e: PointerEvent) => {
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
    pointers.set(e.pointerId, { ndc: toNdc(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
    if (pointers.size === 1) grabbed = rig.raycast(pointers.get(e.pointerId)!.ndc);
    if (pointers.size === 2) { grabbed = rig.raycast(midNdc()); spread = spreadPx(); }
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.ndc = toNdc(e.clientX, e.clientY);
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 1 && grabbed) {
      rig.grab(p.ndc, grabbed);
    } else if (pointers.size === 2) {
      const now = spreadPx();
      rig.pinch(grabbed, spread, now, midNdc());
      spread = now;
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    spread = 0;
    grabbed = pointers.size === 1 ? rig.raycast(pair()[0].ndc) : null;
  };

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
  };
}
