/**
 * conquest.ts — provinces held and states conquered (STORY-016; Sami 2026-10-13: a city in a
 * province holds it). A state is conquered when all seven of its provinces are held; the
 * home state, the conquered states and their neighbours are open, and the rest are locked:
 * scouts, flags and city sites stay in the open states. Conquering the home state opens the
 * planet level. Areas are numbered so that area / 7 is the province and area / 49 the state.
 */
export const PROVINCES_PER_STATE = 7;

export interface Conquest {
  held: Set<number>;
  conquered: Set<number>;
  open: Set<number>;
}

/** What the cities in these areas hold, conquer and open, from the home state and the state neighbours. */
export function conquest(cityAreas: readonly number[], homeState: number, neighbors: readonly (readonly number[])[]): Conquest {
  const held = new Set(cityAreas.map(a => Math.floor(a / 7)));
  const states = new Set([...held].map(p => Math.floor(p / 7)));
  const conquered = new Set([...states].filter(s => Array.from({ length: PROVINCES_PER_STATE }, (_, k) => s * 7 + k).every(p => held.has(p))));
  const open = new Set([homeState, ...conquered]);
  for (const s of conquered) for (const n of neighbors[s]) open.add(n);
  return { held, conquered, open };
}

/** Provinces of a state held, of seven. */
export const heldIn = (c: Conquest, state: number) =>
  Array.from({ length: PROVINCES_PER_STATE }, (_, k) => state * 7 + k).filter(p => c.held.has(p)).length;
