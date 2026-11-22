/**
 * relief.ts — how high the ground stands at the city level (STORY-069, STORY-071): the same for
 * the view (src/globe/cityView.ts) and for where buildings do best, so the simulation has it
 * without the view (STORY-095).
 */
import type { Terrain } from './terrainTypes';

/** Height of a terrain's land and how rough it is, in tile spacings (own). */
export const RELIEF: Record<Terrain, [number, number]> = {
  ocean: [0, 0], arctic: [0.3, 0.12], desert: [0.1, 0.06], forest: [0.28, 0.12], grassland: [0.16, 0.06],
  hills: [0.65, 0.25], jungle: [0.24, 0.1], mountains: [1.7, 0.55], plains: [0.14, 0.05], swamp: [0.05, 0.02], tundra: [0.2, 0.08],
};
/**
 * Height of the ground at a tile's centre in tile spacings, from its terrain and the relief
 * noise there: the same for the view and for where buildings do best (STORY-071).
 */
export const groundHeight = (t: Terrain, detail: number) => Math.max(0, RELIEF[t][0] + RELIEF[t][1] * detail);
