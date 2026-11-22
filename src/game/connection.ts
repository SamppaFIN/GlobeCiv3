/**
 * connection.ts — strategic resources joined to the cities by road (STORY-093, PLAN-090;
 * Sami 2026-11-22).
 *
 * Own rules after Civ III's strategic resources (Freeciv civ2civ3 has none): hevoset, hiili
 * and öljy are strategic. One is connected when its kind is known, its tile is inside the
 * player's border (culture.ts) and a chain of roads runs from it to a city of the player's
 * (a city's own tile has a road, STORY-040). A connected kind serves the whole province its
 * tile is in, whichever city the road reaches: every city of that province without the kind's
 * own building gets that building's shields a day (the own numbers of STORY-073: talli 1,
 * paja 2, öljylähde 3). A kind counts once in a province, however many of its tiles are joined.
 * The resource buildings of the city area go on as before.
 */
import { RESOURCE_BUILDINGS, type ResourceBuilding } from './cities';
import type { ResourceKind } from './terrainTypes';

export const STRATEGIC = ['horses', 'coal', 'oil'] as const;
export type StrategicKind = (typeof STRATEGIC)[number];
export const isStrategic = (k: ResourceKind | null): k is StrategicKind => k !== null && (STRATEGIC as readonly string[]).includes(k);

/** Each strategic kind's own building in a city (STORY-073). */
export const KIND_BUILDING: Record<StrategicKind, ResourceBuilding> = { horses: 'stable', coal: 'forge', oil: 'oilwell' };
/** Shields a connected kind gives a city of its province a day: its building's. */
export const CONNECTED_SHIELD: Record<StrategicKind, number> = {
  horses: RESOURCE_BUILDINGS.stable.shield ?? 0,
  coal: RESOURCE_BUILDINGS.forge.shield ?? 0,
  oil: RESOURCE_BUILDINGS.oilwell.shield ?? 0,
};

/** Tiles joined to the cities by road: the cities' own tiles and the roads that reach them. */
export function roadNetwork(cityTiles: readonly number[], hasRoad: (tile: number) => boolean, neighbors: (tile: number) => readonly number[]): Set<number> {
  const joined = new Set(cityTiles);
  const frontier = [...cityTiles];
  while (frontier.length) {
    const t = frontier.pop()!;
    for (const n of neighbors(t)) if (!joined.has(n) && hasRoad(n)) { joined.add(n); frontier.push(n); }
  }
  return joined;
}

/** A known strategic resource inside the border, and the province it is in. */
export interface StrategicTile {
  tile: number;
  kind: StrategicKind;
  province: number;
}

/** The known strategic resources among the tiles of the border, in tile order; `kindOf` gives only known kinds. */
export function strategicTiles(owned: Iterable<number>, kindOf: (tile: number) => ResourceKind | null, provinceOf: (tile: number) => number): StrategicTile[] {
  const out: StrategicTile[] = [];
  for (const tile of owned) {
    const kind = kindOf(tile);
    if (isStrategic(kind)) out.push({ tile, kind, province: provinceOf(tile) });
  }
  return out.sort((a, b) => a.tile - b.tile);
}

/** The kinds connected in each province. */
export function connectedKinds(resources: readonly StrategicTile[], network: ReadonlySet<number>): Map<number, Set<StrategicKind>> {
  const out = new Map<number, Set<StrategicKind>>();
  for (const r of resources) {
    if (!network.has(r.tile)) continue;
    if (!out.has(r.province)) out.set(r.province, new Set());
    out.get(r.province)!.add(r.kind);
  }
  return out;
}

/** Strategic resources inside the border still waiting for a road, in tile order. */
export const unconnected = (resources: readonly StrategicTile[], network: ReadonlySet<number>) =>
  resources.filter(r => !network.has(r.tile)).sort((a, b) => a.tile - b.tile);

/** Shields a city gets a day from its province's connected kinds. */
export function connectedShields(kinds: ReadonlySet<StrategicKind> | undefined, buildings: readonly string[]): number {
  let sum = 0;
  for (const k of kinds ?? []) if (!buildings.includes(KIND_BUILDING[k])) sum += CONNECTED_SHIELD[k];
  return sum;
}
