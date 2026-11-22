/**
 * world.ts — the world a game is played on, without the view (STORY-095): the 362 regions of the
 * hex grid, the tile types worked out as needed, and what is mapped. The browser builds the same
 * from the same grid, its tile types writing into the code texture the shader reads.
 */
import { buildHexGrid } from '../globe/hexGrid';
import { Regions } from '../globe/regions';
import { TileTypeTable } from '../game/terrainTypes';
import { MapState } from '../game/mapping';

/** The globe's radius and its grid's detail: 362 nodes, 12 pentagons and 350 hexagons (STORY-008). */
export const RADIUS = 5;
export const DETAIL = 5;

export interface World { regions: Regions; tileTypes: TileTypeTable; mapState: MapState }

/** The regions of the grid; built once, they are the same in every game. */
let regions: Regions | null = null;

/** A world for a new game: the regions shared, the tile types and the map its own. */
export function createWorld(): World {
  regions ??= new Regions(buildHexGrid(RADIUS, DETAIL).nodes);
  return { regions, tileTypes: new TileTypeTable(), mapState: new MapState() };
}
