/**
 * names.ts — names of city areas and provinces (design 6a/7a: Kotialue, Itäranta,
 * Etelälaakso, Lounaissuo, Länsimetsä, Pohjoisharju, Koillisniemi; Kotilääni, Itälääni,
 * Rannikkolääni, Suolääni, Tunturilääni).
 *
 * A name is the region's place in its parent (the compass direction from the parent's
 * centre, or "Keski-" for the middle one) plus its dominant landscape; home itself is
 * "Koti-". The six outer children lie 60° apart, so they never share a direction.
 * The illative ("Lähetä retkikunta Itärantaan") comes with the name.
 */
import { tileCenter } from '../globe/hexTiles';
import type { Terrain } from './terrainTypes';

/** Compass prefixes (0 = north, clockwise in eighths) and 8 for the middle child. */
const PREFIX = ['Pohjois', 'Koillis', 'Itä', 'Kaakkois', 'Etelä', 'Lounais', 'Länsi', 'Luoteis', 'Keski'];
export const MIDDLE = 8;

interface Word { base: string; illative: string }
/** Landscape words for city areas, by the dominant terrain. */
const AREA_WORDS: Record<string, Word> = {
  coast: { base: 'ranta', illative: 'rantaan' },
  forest: { base: 'metsä', illative: 'metsään' },
  hills: { base: 'harju', illative: 'harjuun' },
  mountains: { base: 'tunturi', illative: 'tunturiin' },
  swamp: { base: 'suo', illative: 'suohon' },
  lowland: { base: 'laakso', illative: 'laaksoon' },
  desert: { base: 'hietikko', illative: 'hietikkoon' },
  north: { base: 'kaira', illative: 'kairaan' },
  cape: { base: 'niemi', illative: 'niemeen' },
};

export interface RegionName { name: string; illative: string }

/** Compass direction (0 = north, clockwise in eighths) from one unit point to another. */
export function compassIndex(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): number {
  // North and east in the tangent plane at `from`
  const nx = -from.x * from.y, ny = 1 - from.y * from.y, nz = -from.z * from.y;
  const nl = Math.hypot(nx, ny, nz) || 1;
  const ex = (ny * from.z - nz * from.y) / nl, ey = (nz * from.x - nx * from.z) / nl, ez = (nx * from.y - ny * from.x) / nl;
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const angle = Math.atan2(dx * ex + dy * ey + dz * ez, (dx * nx + dy * ny + dz * nz) / nl);
  return (Math.round((angle / (2 * Math.PI)) * 8) + 8) % 8;
}

/** The landscape word of a city area from its tiles' terrain shares. */
export function landscapeOf(terrains: readonly Terrain[]): keyof typeof AREA_WORDS {
  const count = (pred: (t: Terrain) => boolean) => terrains.filter(pred).length / Math.max(1, terrains.length);
  const water = count(t => t === 'ocean');
  if (water > 0.6) return 'cape';
  if (water > 0.25) return 'coast';
  const share: [keyof typeof AREA_WORDS, number][] = [
    ['forest', count(t => t === 'forest' || t === 'jungle')],
    ['hills', count(t => t === 'hills')],
    ['mountains', count(t => t === 'mountains')],
    ['swamp', count(t => t === 'swamp')],
    ['desert', count(t => t === 'desert')],
    ['north', count(t => t === 'tundra' || t === 'arctic')],
    ['lowland', count(t => t === 'grassland' || t === 'plains')],
  ];
  share.sort((a, b) => b[1] - a[1]);
  return share[0][0];
}

/** Name of a city area: "Kotialue" at home, else direction + landscape ("Itäranta"). */
export function areaName(home: boolean, direction: number, landscape: keyof typeof AREA_WORDS): RegionName {
  if (home) return { name: 'Kotialue', illative: 'Kotialueelle' };
  const w = AREA_WORDS[landscape];
  return { name: PREFIX[direction] + w.base, illative: PREFIX[direction] + w.illative };
}

/** Name of a province: "Kotilääni" at home, else by landscape or direction ("Itälääni"). */
export function provinceName(home: boolean, direction: number, landscape: keyof typeof AREA_WORDS): RegionName {
  if (home) return { name: 'Kotilääni', illative: 'Kotilääniin' };
  const byLand: Partial<Record<keyof typeof AREA_WORDS, string>> = { coast: 'Rannikko', cape: 'Rannikko', swamp: 'Suo', mountains: 'Tunturi', north: 'Kaira' };
  const first = byLand[landscape] ?? PREFIX[direction];
  return { name: `${first}lääni`, illative: `${first}lääniin` };
}

/** Names for sibling regions: if two would be equal, the later ones take the direction instead. */
export function distinctNames(names: RegionName[], directions: number[], kind: 'area' | 'province'): RegionName[] {
  const seen = new Set<string>();
  return names.map((n, i) => {
    if (!seen.has(n.name)) { seen.add(n.name); return n; }
    const fallback = kind === 'province'
      ? { name: `${PREFIX[directions[i]]}lääni`, illative: `${PREFIX[directions[i]]}lääniin` }
      : { name: `${PREFIX[directions[i]]}alue`, illative: `${PREFIX[directions[i]]}alueelle` };
    seen.add(fallback.name);
    return fallback;
  });
}

/** Direction from a home centre to a region centre (unit vectors as tile centres). */
export function directionFrom(home: number, tile: number): number {
  return compassIndex(tileCenter(home), tileCenter(tile));
}
