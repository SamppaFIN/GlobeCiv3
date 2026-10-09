/**
 * camera.ts — globe camera rig: log zoom toward the cursor, grab-to-pan,
 * pinch, altitude-driven tilt and dynamic near/far.
 *
 * The rig is (target point on the unit sphere, forward tangent, distance).
 * Zoom and pan rotate the rig rigidly around the globe so that the surface
 * point under the cursor stays under the cursor.
 */
import * as THREE from 'three';

const MAX_TILT = THREE.MathUtils.degToRad(60);

export class GlobeCamera {
  readonly R: number;
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3(0, 0, 1);
  readonly forward = new THREE.Vector3(0, 1, 0);
  dist: number;
  readonly minDist: number;
  readonly maxDist: number;

  private readonly raycaster = new THREE.Raycaster();
  private readonly q = new THREE.Quaternion();

  constructor(R: number, camera: THREE.PerspectiveCamera) {
    this.R = R;
    this.camera = camera;
    this.dist = R * 4;
    this.minDist = R * 2e-5;
    this.maxDist = R * 6;
  }

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

  /** Multiply the distance by factor, keeping the point under ndc fixed. Returns the fixed point. */
  zoomAt(ndc: THREE.Vector2, factor: number, anchorNdc = ndc): THREE.Vector3 | null {
    const point = this.raycast(anchorNdc);
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * factor));
    this.apply();
    if (point) this.grab(ndc, point);
    return point;
  }

  /** Screen-space distance in pixels between where a point projects and where it should be. */
  screenErrorPx(point: THREE.Vector3, ndc: THREE.Vector2, width: number, height: number): number {
    const p = point.clone().project(this.camera);
    return Math.hypot(((p.x - ndc.x) * width) / 2, ((p.y - ndc.y) * height) / 2);
  }
}

/** Mouse wheel, drag and two-finger pinch on the canvas. */
export function attachInput(el: HTMLElement, rig: GlobeCamera, onUserInput: () => void): void {
  const pointers = new Map<number, THREE.Vector2>();
  let grabbed: THREE.Vector3 | null = null;
  let pinchDist = 0;

  const toNdc = (x: number, y: number) => {
    const r = el.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };
  const mid = () => {
    const [a, b] = [...pointers.values()];
    return a.clone().add(b).multiplyScalar(0.5);
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    const r = el.getBoundingClientRect();
    return Math.hypot(((a.x - b.x) * r.width) / 2, ((a.y - b.y) * r.height) / 2);
  };

  el.addEventListener('wheel', e => {
    e.preventDefault();
    onUserInput();
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    rig.zoomAt(toNdc(e.clientX, e.clientY), Math.exp(delta * 0.002));
  }, { passive: false });

  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    onUserInput();
    pointers.set(e.pointerId, toNdc(e.clientX, e.clientY));
    if (pointers.size === 1) grabbed = rig.raycast(pointers.get(e.pointerId)!);
    if (pointers.size === 2) { grabbed = rig.raycast(mid()); pinchDist = spread(); }
  });

  el.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, toNdc(e.clientX, e.clientY));
    if (pointers.size === 1 && grabbed) {
      rig.grab(pointers.get(e.pointerId)!, grabbed);
    } else if (pointers.size === 2) {
      const d = spread();
      if (pinchDist > 0 && d > 0) {
        rig.dist = Math.min(rig.maxDist, Math.max(rig.minDist, rig.dist * (pinchDist / d)));
        rig.apply();
        if (grabbed) rig.grab(mid(), grabbed);
      }
      pinchDist = d;
    }
  });

  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinchDist = 0;
    grabbed = pointers.size === 1 ? rig.raycast([...pointers.values()][0]) : null;
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}
