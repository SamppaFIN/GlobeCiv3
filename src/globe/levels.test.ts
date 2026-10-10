import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GlobeCamera } from './camera';
import { buildHexGrid } from './hexGrid';
import { backTarget, cityFill, diveTarget, frameDistances, levelForDist, regionAt, regionFill, regionPath, sameRegion, type ViewLevel } from './levels';
import { CHILDREN, Regions } from './regions';

const R = 5;
const regions = new Regions(buildHexGrid(R, 5).nodes);
const PORTRAIT = 390 / 844;
const LANDSCAPE = 1280 / 800;

/** Rig looking at a state centre from the given distance. */
function rigAt(dist: number, aspect: number, target: THREE.Vector3) {
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  const rig = new GlobeCamera(R, camera, { minDist: R * 2e-5, maxDist: R * 6, startDist: dist });
  rig.target.copy(target);
  rig.forward.set(0, 1, 0);
  rig.apply();
  return rig;
}

/** Point at angle b from the target, along the camera's screen axis (x or y). */
function edgePoint(rig: GlobeCamera, b: number, axis: 'x' | 'y') {
  const t = rig.target.clone().normalize();
  const screenAxis = new THREE.Vector3().setFromMatrixColumn(rig.camera.matrixWorld, axis === 'x' ? 0 : 1);
  const tangent = screenAxis.addScaledVector(t, -screenAxis.dot(t)).normalize();
  return t.multiplyScalar(Math.cos(b)).addScaledVector(tangent, Math.sin(b)).multiplyScalar(R);
}

describe('view levels', () => {
  it('frames each level nearer than the one above, and portrait farther than landscape', () => {
    const p = frameDistances(R, regions.inradius, 45, PORTRAIT);
    const l = frameDistances(R, regions.inradius, 45, LANDSCAPE);
    for (let i = 1; i < 4; i++) {
      expect(p[i]).toBeLessThan(p[i - 1]);
      expect(l[i]).toBeLessThan(l[i - 1]);
    }
    for (let i = 0; i < 4; i++) expect(p[i]).toBeGreaterThan(l[i]);
  });

  it('makes a framed region span its fill of the narrower screen dimension', () => {
    const state = regions.centers[0][100];
    for (const [aspect, axis] of [[PORTRAIT, 'x'], [LANDSCAPE, 'y']] as const) {
      const frames = frameDistances(R, regions.inradius, 45, aspect);
      for (let level = 1; level < 4; level++) {
        const rig = rigAt(frames[level], aspect, state);
        const b = (regions.inradius[level - 1] * 2) / Math.sqrt(3);
        const ndc = edgePoint(rig, b, axis).project(rig.camera);
        // The camera tilts toward the horizon close to the surface, which shortens the
        // vertical extent a little; the horizontal extent stays exact
        const span = Math.abs(axis === 'x' ? ndc.x : ndc.y);
        const fill = level === 3 ? cityFill(aspect) : regionFill(aspect);
        if (axis === 'x') expect(span).toBeCloseTo(fill, 1);
        else expect(span).toBeGreaterThan(fill * 0.75);
        expect(span).toBeLessThan(fill * 1.1);
      }
    }
  });

  it('derives the level from the distance with boundaries between the framing distances', () => {
    const frames = frameDistances(R, regions.inradius, 45, LANDSCAPE);
    for (let i = 0; i < 4; i++) {
      expect(levelForDist(frames[i], frames)).toBe(i);
      expect(levelForDist(frames[i] * 1.3, frames)).toBe(i);
      expect(levelForDist(frames[i] / 1.3, frames)).toBe(i);
    }
    expect(levelForDist(frames[0] * 10, frames)).toBe(0);
    expect(levelForDist(frames[3] / 1000, frames)).toBe(3);
  });

  it('nests the region path and selects the region of the view level', () => {
    const rand = (() => { let s = 3; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); })();
    for (let k = 0; k < 200; k++) {
      const p = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const path = regionPath(regions, p, 3);
      expect(Math.floor(path[1].id / CHILDREN)).toBe(path[0].id);
      expect(Math.floor(path[2].id / CHILDREN)).toBe(path[1].id);
      for (let view = 0; view < 3; view++) expect(regionAt(regions, p, view as ViewLevel)).toEqual(path[view]);
      expect(regionAt(regions, p, 3)).toBeNull();
    }
    expect(sameRegion({ level: 1, id: 4 }, { level: 1, id: 4 })).toBe(true);
    expect(sameRegion({ level: 1, id: 4 }, { level: 2, id: 4 })).toBe(false);
    expect(sameRegion(null, { level: 2, id: 4 })).toBe(false);
  });

  it('dives into a region at the next level and goes back to the parent centre', () => {
    const frames = frameDistances(R, regions.inradius, 45, PORTRAIT);
    const province = { level: 1 as const, id: 100 * CHILDREN + 3 };
    const dive = diveTarget(regions, province, frames);
    expect(dive.level).toBe(2);
    expect(dive.dist).toBe(frames[2]);
    expect(dive.point.distanceTo(regions.centers[1][province.id])).toBe(0);

    // From the province view inside that province, back goes to its state's centre
    const back = backTarget(regions, dive.point, 2, frames)!;
    expect(back.level).toBe(1);
    expect(back.dist).toBe(frames[1]);
    expect(back.point.distanceTo(regions.centers[0][100])).toBeLessThan(1e-12);
    // From the state view, back goes to the planet keeping the point
    const planet = backTarget(regions, back.point, 1, frames)!;
    expect(planet.level).toBe(0);
    expect(planet.point.distanceTo(back.point)).toBeLessThan(1e-12);
    expect(backTarget(regions, back.point, 0, frames)).toBeNull();
  });
});
