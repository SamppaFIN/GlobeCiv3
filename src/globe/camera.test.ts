import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GlobeCamera, wheelFactor } from './camera';

const R = 5;
const W = 1280;
const H = 800;

function makeRig(dist: number, minDist = R * 2e-5, maxDist = R * 6) {
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  const rig = new GlobeCamera(R, camera, { minDist, maxDist, startDist: dist });
  rig.target.set(0.35, 0.42, 0.84).normalize();
  rig.forward.set(0, 1, 0);
  rig.apply();
  return rig;
}

const CURSORS: [number, number][] = [[0, 0], [0.3, 0.2], [-0.4, -0.1], [0.1, -0.5]];
const DISTANCES = [R * 3, R * 0.5, R * 0.02, R * 1e-4]; // the last two are tilted

describe('GlobeCamera', () => {
  it('scales the distance by the same factor per wheel notch at every altitude', () => {
    const f = wheelFactor(-100, 0);
    expect(f).toBeCloseTo(Math.exp(-0.2), 12);
    for (const d of DISTANCES) {
      const rig = makeRig(d);
      rig.zoomAt(new THREE.Vector2(0.3, 0.2), f);
      expect(rig.dist / d).toBeCloseTo(f, 10);
    }
  });

  it('treats line and page wheel modes as larger steps in the same direction', () => {
    expect(wheelFactor(3, 1)).toBeCloseTo(Math.exp(3 * 33 * 0.002), 12);
    expect(wheelFactor(-1, 2)).toBeLessThan(1);
  });

  it('keeps the surface point under the cursor while zooming in', () => {
    let checked = 0;
    for (const d of DISTANCES) {
      for (const [x, y] of CURSORS) {
        const rig = makeRig(d);
        const ndc = new THREE.Vector2(x, y);
        const p = rig.zoomAt(ndc, 0.7);
        if (!p) continue; // cursor on empty space, covered below
        expect(rig.screenErrorPx(p, ndc, W, H)).toBeLessThan(0.01);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(13);
  });

  it('keeps the point under the cursor when zooming out, whenever the cursor still sees the globe', () => {
    // Zooming out shrinks the globe on screen. Rotating the rig cannot move the
    // silhouette, so near the limb the point can leave the cursor; that is geometry.
    let checked = 0;
    for (const d of DISTANCES) {
      for (const [x, y] of CURSORS) {
        const rig = makeRig(d);
        const ndc = new THREE.Vector2(x, y);
        const p = rig.zoomAt(ndc, 1.4);
        if (!p || !rig.raycast(ndc)) continue;
        expect(rig.screenErrorPx(p, ndc, W, H)).toBeLessThan(0.01);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(12);
  });

  it('still zooms when the cursor points at empty space', () => {
    const rig = makeRig(R * 5);
    const p = rig.zoomAt(new THREE.Vector2(0.98, 0.98), 0.5);
    expect(p).toBeNull();
    expect(rig.dist).toBeCloseTo(R * 2.5, 10);
  });

  it('pinch scales by the finger spread and keeps the grabbed point under the midpoint', () => {
    for (const d of DISTANCES) {
      const rig = makeRig(d);
      const from = new THREE.Vector2(0.1, 0.1);
      const grabbed = rig.raycast(from)!;
      const to = new THREE.Vector2(0.15, 0.05);
      rig.pinch(grabbed, 100, 200, to); // fingers twice as far apart → half the distance
      expect(rig.dist / d).toBeCloseTo(Math.max(0.5, (R * 2e-5) / d), 10);
      expect(rig.screenErrorPx(grabbed, to, W, H)).toBeLessThan(0.01);
    }
  });

  it('clamps the distance to its limits', () => {
    const rig = makeRig(R, R * 0.01, R * 6);
    for (let i = 0; i < 200; i++) rig.zoomAt(new THREE.Vector2(0, 0), 0.5);
    expect(rig.dist).toBeCloseTo(R * 0.01, 12);
    for (let i = 0; i < 200; i++) rig.zoomAt(new THREE.Vector2(0, 0), 2);
    expect(rig.dist).toBeCloseTo(R * 6, 12);
  });

  it('tilts continuously and monotonically toward the horizon as it descends', () => {
    const rig = makeRig(R * 6);
    expect(rig.tilt()).toBe(0);
    let prev = 0;
    const steps = 2000;
    for (let i = 0; i <= steps; i++) {
      rig.dist = Math.exp(Math.log(R * 6) + ((Math.log(R * 2e-5) - Math.log(R * 6)) * i) / steps);
      const t = rig.tilt();
      expect(t).toBeGreaterThanOrEqual(prev);
      expect(t - prev).toBeLessThan(0.01);
      prev = t;
    }
    expect(prev).toBeCloseTo(THREE.MathUtils.degToRad(60), 6);
  });

  it('keeps near and far around the visible surface', () => {
    for (const d of DISTANCES) {
      const rig = makeRig(d);
      const h = rig.altitude();
      expect(rig.camera.near).toBeLessThanOrEqual(h);
      expect(rig.camera.far).toBeGreaterThan(rig.camera.near);
      // Far reaches at least the horizon
      const D = rig.camera.position.length();
      expect(rig.camera.far).toBeGreaterThanOrEqual(Math.sqrt(D * D - R * R));
    }
  });
});
