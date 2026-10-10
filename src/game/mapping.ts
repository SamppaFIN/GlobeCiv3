/**
 * mapping.ts — which hex tiles the player has mapped.
 *
 * Mapping is permanent: once seen, a tile stays mapped (the approved one-time
 * reveal, as in Polytopia). Everything else is drawn as fog.
 */
import { neighbors, TILE_COUNT } from '../globe/hexTiles';

export class MapState {
  readonly mapped = new Uint8Array(TILE_COUNT);
  /** Number of mapped tiles. */
  count = 0;

  /** Map tiles; returns those that were not mapped before. */
  reveal(ids: Iterable<number>): number[] {
    const fresh: number[] = [];
    for (const id of ids) {
      if (this.mapped[id]) continue;
      this.mapped[id] = 1;
      fresh.push(id);
    }
    this.count += fresh.length;
    return fresh;
  }

  isMapped(id: number): boolean {
    return this.mapped[id] === 1;
  }

  /** Share of the given tiles that are mapped. */
  share(tiles: readonly number[]): number {
    let n = 0;
    for (const id of tiles) n += this.mapped[id];
    return tiles.length ? n / tiles.length : 0;
  }
}

/** A tile and its neighbours: what the landing maps first (storyboard 2a). */
export function withNeighbors(id: number): number[] {
  return [id, ...neighbors(id)];
}
