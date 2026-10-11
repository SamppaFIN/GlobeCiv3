/**
 * improvements.ts — terrain improvements: irrigation, mines and roads (STORY-033).
 *
 * Civilization I's rules, with the numbers from Freeciv (GPL, data/civ1, commit 75451811f4):
 *  - irrigation adds terrain.ruleset irrigation_food_incr food (desert, grassland, hills,
 *    plains: 1) and takes irrigation_time days (5; hills 10); it needs ocean, a river or
 *    irrigated land sharing an edge with the tile (actions.ruleset "Build Irrigation")
 *  - a mine adds mining_shield_incr shields (desert 1, hills 3, mountains 1) and takes
 *    mining_time days (5; hills and mountains 10)
 *  - irrigation and a mine exclude each other (extra conflicts), the newer one stays
 *  - a road adds trade_incr 1 × road_trade_incr_pct (desert, grassland, plains: 100 %) and
 *    takes road_time days (2 to 6)
 * One turn is one day. Own simplification: roads do not speed movement yet (movement is
 * counted in whole days). The city centre's free irrigation is in cities.ts.
 */
import type { Terrain, Yield } from './terrainTypes';

export type ImprovementKind = 'irrigation' | 'mine' | 'road';
export const IMPROVEMENT_NAMES: Record<ImprovementKind, string> = { irrigation: 'Kastelu', mine: 'Kaivos', road: 'Tie' };

interface TerrainWork { irrigation: [number, number]; mine: [number, number]; road: [number, number] }
/** Per terrain: [bonus, days] for irrigation (food), a mine (shields) and a road (trade). */
const WORK: Record<Terrain, TerrainWork> = {
  ocean: { irrigation: [0, 0], mine: [0, 0], road: [0, 0] },
  arctic: { irrigation: [0, 0], mine: [0, 0], road: [0, 4] },
  desert: { irrigation: [1, 5], mine: [1, 5], road: [1, 2] },
  forest: { irrigation: [0, 0], mine: [0, 0], road: [0, 4] },
  grassland: { irrigation: [1, 5], mine: [0, 0], road: [1, 2] },
  hills: { irrigation: [1, 10], mine: [3, 10], road: [0, 4] },
  jungle: { irrigation: [0, 0], mine: [0, 0], road: [0, 4] },
  mountains: { irrigation: [0, 0], mine: [1, 10], road: [0, 6] },
  plains: { irrigation: [1, 5], mine: [0, 0], road: [1, 2] },
  swamp: { irrigation: [0, 0], mine: [0, 0], road: [0, 4] },
  tundra: { irrigation: [0, 0], mine: [0, 0], road: [0, 2] },
};

/** Days of work on this terrain. */
export const workDays = (kind: ImprovementKind, terrain: Terrain) => WORK[terrain][kind][1];
/** What it adds on this terrain: food, shields or trade; 0 where it brings nothing. */
const bonus = (kind: ImprovementKind, terrain: Terrain) => WORK[terrain][kind][0];

/** The yield an improvement adds on this terrain. */
export function improvementYield(kind: ImprovementKind, terrain: Terrain): Yield {
  const n = bonus(kind, terrain);
  return { food: kind === 'irrigation' ? n : 0, shield: kind === 'mine' ? n : 0, trade: kind === 'road' ? n : 0 };
}

const BIT: Record<ImprovementKind, number> = { irrigation: 1, mine: 2, road: 4 };

/** The improvements built on tiles (player data: kept in the save, not generated). */
export class Improvements {
  private readonly bits = new Map<number, number>();

  has(tile: number, kind: ImprovementKind): boolean {
    return ((this.bits.get(tile) ?? 0) & BIT[kind]) !== 0;
  }

  /** Build one; irrigation and a mine replace each other. */
  add(tile: number, kind: ImprovementKind): void {
    let b = this.bits.get(tile) ?? 0;
    if (kind === 'irrigation') b &= ~BIT.mine;
    if (kind === 'mine') b &= ~BIT.irrigation;
    this.bits.set(tile, b | BIT[kind]);
  }

  /** Tiles with something built, and what. */
  entries(): [number, ImprovementKind[]][] {
    return [...this.bits].map(([tile, b]) => [tile, (Object.keys(BIT) as ImprovementKind[]).filter(k => b & BIT[k])]);
  }

  /** Extra yield of a tile's improvements. */
  yieldOf(tile: number, terrain: Terrain): Yield {
    const y = { food: 0, shield: 0, trade: 0 };
    for (const kind of ['irrigation', 'mine', 'road'] as const) {
      if (!this.has(tile, kind)) continue;
      const add = improvementYield(kind, terrain);
      y.food += add.food;
      y.shield += add.shield;
      y.trade += add.trade;
    }
    return y;
  }

  /**
   * Whether an improvement is worth building: it adds something on this terrain, it is not
   * there yet, and irrigation has water beside it. (Roads where they add no trade wait
   * until roads speed movement.)
   */
  canBuild(tile: number, kind: ImprovementKind, terrain: Terrain, neighbours: readonly number[], isWater: (id: number) => boolean): boolean {
    if (this.has(tile, kind) || bonus(kind, terrain) === 0) return false;
    if (kind === 'irrigation') return neighbours.some(n => isWater(n) || this.has(n, 'irrigation'));
    return true;
  }
}

export interface Job {
  tile: number;
  kind: ImprovementKind;
  days: number;
}

/**
 * The most worthwhile job among tiles a city works: the most yield per day of work, with
 * food counted twice as cities weigh tiles. A job never undoes another: no mine where
 * irrigation is, no irrigation where a mine is.
 */
export function bestJob(
  tiles: readonly number[], improvements: Improvements, terrainOf: (id: number) => Terrain,
  neighboursOf: (id: number) => readonly number[], isWater: (id: number) => boolean,
): Job | null {
  let best: Job | null = null;
  let bestValue = 0;
  for (const tile of tiles) {
    const terrain = terrainOf(tile);
    for (const kind of ['irrigation', 'mine', 'road'] as const) {
      if (kind !== 'road' && improvements.has(tile, kind === 'mine' ? 'irrigation' : 'mine')) continue;
      if (!improvements.canBuild(tile, kind, terrain, neighboursOf(tile), isWater)) continue;
      const y = improvementYield(kind, terrain);
      const days = workDays(kind, terrain);
      const value = (2 * y.food + y.shield + y.trade) / days;
      if (value > bestValue) {
        bestValue = value;
        best = { tile, kind, days };
      }
    }
  }
  return best;
}
