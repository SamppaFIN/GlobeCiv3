/**
 * levels.ts — view levels of the globe: planet, state, province, city area.
 *
 * Each level has a framing distance at which one of its regions (or the whole
 * planet) fills FILL of the narrower screen dimension. The current level follows
 * from the camera distance, so the wheel, pinch and tap navigation always agree.
 * Tapping a region at the current level selects it; diving flies to its centre at
 * the next level's framing distance.
 */
import * as THREE from 'three';
import { CHILDREN, type RegionLevel, type Regions } from './regions';

/** 0 planet, 1 state, 2 province, 3 city area. */
export type ViewLevel = 0 | 1 | 2 | 3;
export const LEVEL_NAMES = ['Planeetta', 'Valtio', 'Lääni', 'Kaupunkialue'] as const;
/** Share of the narrower screen dimension that a framed region spans. */
export const FILL = 0.7;
/** Circumradius of a hexagon over its inradius. */
const CIRCUM = 2 / Math.sqrt(3);

export interface RegionRef {
  level: RegionLevel;
  id: number;
}

/** Half-angle of the narrower screen dimension. */
export function narrowHalfFov(fovYDeg: number, aspect: number): number {
  return Math.atan(Math.tan(THREE.MathUtils.degToRad(fovYDeg) / 2) * Math.min(1, aspect));
}

/**
 * Camera distances from the surface that frame each view level, far to near. A region
 * of angular circumradius b seen from height h above its centre spans the angle
 * atan(R sin b / (h + R (1 - cos b))); solve for the angle whose tangent is FILL of the
 * narrow half-field. The planet level fits the whole globe the same way.
 */
export function frameDistances(R: number, inradius: readonly number[], fovYDeg: number, aspect: number): [number, number, number, number] {
  const t = Math.tan(narrowHalfFov(fovYDeg, aspect)) * FILL;
  const region = (alpha: number) => {
    const b = alpha * CIRCUM;
    return (R * Math.sin(b)) / t - R * (1 - Math.cos(b));
  };
  const planet = R / Math.sin(Math.atan(t)) - R;
  return [planet, region(inradius[0]), region(inradius[1]), region(inradius[2])];
}

/** View level for a camera distance: the level whose framing distance is nearest on a log scale. */
export function levelForDist(dist: number, frames: readonly number[]): ViewLevel {
  let level = 0;
  for (let i = 0; i < 3; i++) if (dist < Math.sqrt(frames[i] * frames[i + 1])) level = i + 1;
  return level as ViewLevel;
}

/** Regions containing a point, from the state down: depth 1 gives the state only, 3 all three. */
export function regionPath(regions: Regions, p: THREE.Vector3, depth: number): RegionRef[] {
  const path: RegionRef[] = [];
  if (depth >= 1) path.push({ level: 0, id: regions.stateOf(p) });
  if (depth >= 2) path.push({ level: 1, id: regions.provinceOf(p) });
  if (depth >= 3) path.push({ level: 2, id: regions.cityOf(p) });
  return path;
}

/** The region a tap selects at a view level, or null at the city-area level (tiles come later). */
export function regionAt(regions: Regions, p: THREE.Vector3, view: ViewLevel): RegionRef | null {
  if (view >= 3) return null;
  return regionPath(regions, p, view + 1)[view];
}

export function sameRegion(a: RegionRef | null, b: RegionRef | null): boolean {
  return !!a && !!b && a.level === b.level && a.id === b.id;
}

export function regionCenter(regions: Regions, ref: RegionRef): THREE.Vector3 {
  return regions.centers[ref.level][ref.id];
}

/** Short label: states are numbered globally, provinces and city areas within their parent. */
export function regionLabel(ref: RegionRef): string {
  if (ref.level === 0) return `Valtio ${ref.id + 1}`;
  return `${ref.level === 1 ? 'Lääni' : 'Alue'} ${(ref.id % CHILDREN) + 1}`;
}

export interface FlightTarget {
  point: THREE.Vector3;
  dist: number;
  level: ViewLevel;
}

/** Diving into a region flies to its centre at the next level's framing distance. */
export function diveTarget(regions: Regions, ref: RegionRef, frames: readonly number[]): FlightTarget {
  const level = (ref.level + 1) as ViewLevel;
  return { point: regionCenter(regions, ref).clone(), dist: frames[level], level };
}

/**
 * One level up from the given view level: centred on the region that contains the
 * current point at the new level's context (the planet keeps the current point).
 */
export function backTarget(regions: Regions, target: THREE.Vector3, view: ViewLevel, frames: readonly number[]): FlightTarget | null {
  if (view === 0) return null;
  const level = (view - 1) as ViewLevel;
  const point = level === 0 ? target.clone().normalize() : regionCenter(regions, regionPath(regions, target, level)[level - 1]).clone();
  return { point, dist: frames[level], level };
}
