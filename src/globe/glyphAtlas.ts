/**
 * glyphAtlas.ts — terrain glyphs and resource icons for the tile shader, drawn once
 * into a canvas from the Claude Design handoff's paths (Kartografi: `glyph()` for
 * terrains, the 24-grid `RI` icons for resources). White strokes; the shader reads
 * the alpha as coverage and colours it.
 *
 * Layout: 8 columns × 3 rows of 64 px cells. Cells 0–10 are the terrain glyphs and
 * 11–21 the resource icons, both in the order of terrainTypes.ts TERRAINS.
 */
import * as THREE from 'three';
import { TERRAINS, TERRAIN_RULES, type ResourceKind, type Terrain } from '../game/terrainTypes';

export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 3;
const CELL = 64;
/** Glyph half-size in the cell, as `g` in the design's glyph(x, y, g). */
const G = 20;

/** The design's terrain glyph path around (x, y) with size g (handoff "Kartografi – näkymät"). */
function glyphPath(t: Terrain, x: number, y: number, g: number): string {
  const f = (n: number) => n.toFixed(1);
  switch (t) {
    case 'forest': return `M${f(x - g)} ${f(y + g * 0.6)}L${f(x - g * 0.45)} ${f(y - g * 0.6)}L${f(x + 0.1)} ${f(y + g * 0.6)}ZM${f(x + 0.1)} ${f(y + g * 0.6)}L${f(x + g * 0.55)} ${f(y - g * 0.3)}L${f(x + g)} ${f(y + g * 0.6)}`;
    case 'jungle': return `M${f(x - g)} ${f(y + g * 0.5)}Q${f(x - g * 0.5)} ${f(y - g)} ${f(x)} ${f(y + g * 0.5)}Q${f(x + g * 0.5)} ${f(y - g)} ${f(x + g)} ${f(y + g * 0.5)}`;
    case 'mountains': return `M${f(x - g * 1.1)} ${f(y + g * 0.6)}L${f(x - g * 0.25)} ${f(y - g * 0.8)}L${f(x + g * 0.35)} ${f(y + g * 0.1)}L${f(x + g * 0.7)} ${f(y - g * 0.35)}L${f(x + g * 1.2)} ${f(y + g * 0.6)}`;
    case 'hills': return `M${f(x - g)} ${f(y + g * 0.4)}Q${f(x - g * 0.4)} ${f(y - g * 0.6)} ${f(x + g * 0.2)} ${f(y + g * 0.4)}M${f(x)} ${f(y + g * 0.1)}Q${f(x + g * 0.5)} ${f(y - g * 0.7)} ${f(x + g)} ${f(y + g * 0.4)}`;
    case 'swamp': return `M${f(x - g)} ${f(y - g * 0.3)}h${f(g * 0.9)}M${f(x - g * 0.4)} ${f(y + g * 0.1)}h${f(g * 1.2)}M${f(x - g * 0.8)} ${f(y + g * 0.5)}h${f(g * 0.9)}`;
    case 'grassland': return `M${f(x - g)} ${f(y - g * 0.2)}l${f(g * 0.25)} ${f(g * 0.5)}l${f(g * 0.25)} ${f(-g * 0.5)}M${f(x + g * 0.1)} ${f(y - g * 0.2)}l${f(g * 0.25)} ${f(g * 0.5)}l${f(g * 0.25)} ${f(-g * 0.5)}`;
    case 'plains': return `M${f(x - g)} ${f(y + g * 0.2)}h${f(g * 2)}M${f(x - g * 0.3)} ${f(y - g * 0.2)}h${f(g * 0.9)}`;
    case 'desert': return `M${f(x - g)} ${f(y + g * 0.3)}Q${f(x - g * 0.3)} ${f(y - g * 0.3)} ${f(x + g * 0.2)} ${f(y + g * 0.3)}M${f(x + g * 0.1)} ${f(y - g * 0.1)}Q${f(x + g * 0.6)} ${f(y - g * 0.6)} ${f(x + g)} ${f(y - g * 0.1)}`;
    case 'tundra': return `M${f(x - g)} ${f(y)}h${f(g * 0.4)}M${f(x - g * 0.2)} ${f(y)}h${f(g * 0.4)}M${f(x + g * 0.6)} ${f(y)}h${f(g * 0.4)}`;
    case 'arctic': return `M${f(x - g * 0.7)} ${f(y)}h${f(g * 1.4)}M${f(x - g * 0.35)} ${f(y - g * 0.6)}l${f(g * 0.7)} ${f(g * 1.2)}M${f(x + g * 0.35)} ${f(y - g * 0.6)}l${f(-g * 0.7)} ${f(g * 1.2)}`;
    case 'ocean': return `M${f(x - g)} ${f(y)}q${f(g * 0.5)} ${f(-g * 0.5)} ${f(g)} 0t${f(g)} 0`;
  }
}

/** The design's resource icons on a 24-unit grid (handoff "Kartografi – yksiköt ja detailit", RI). */
const RESOURCE_ICONS: Record<ResourceKind, string> = {
  fish: 'M3 12 Q10 6 16 12 Q10 18 3 12 Z M16 12 L21 8 V16 Z',
  seals: 'M4 17 Q6 9 13 9 Q17 9 18 6 Q20 8 19 11 Q18 15 12 16 Q8 17 4 17 Z M3 20 H21',
  oasis: 'M12 20 Q11 14 12 9 M12 9 Q8 6 5 8 M12 9 Q16 6 19 8 M12 9 Q10 4 7 4 M12 9 Q14 4 17 4 M5 20 Q12 17 19 20',
  game: 'M12 21 V12 M12 12 L7 5 M9 8 L5 8 M12 12 L17 5 M15 8 L19 8 M9 15 Q12 20 15 15',
  reindeer: 'M5 19 Q5 13 10 13 H15 Q17 13 17 10 M8 19 V15 M14 19 V15 M17 10 L15 5 M17 10 L21 6 M16 7 L19 3',
  fertile: 'M12 21 V11 M12 14 C8 14 6 11 6 8 C10 8 12 11 12 14 M12 11 C16 11 18 8 18 5 C14 5 12 8 12 11 M5 21 H19',
  coal: 'M5 17 L8 11 L13 12 L15 17 Z M12 17 L15 10 L20 12 L19 17 Z M4 20 H20',
  gems: 'M7 5 H17 L21 10 L12 20 L3 10 Z M3 10 H21 M9 5 L12 10 L15 5 M12 10 V20',
  gold: 'M4 19 L6 15 H12 L14 19 Z M10 19 L12 15 H18 L20 19 Z M7 15 L9 11 H15 L17 15',
  horses: 'M7 20 V12 A5 5 0 0 1 17 12 V20 M5 20 H9 M15 20 H19',
  oil: 'M12 3 Q18 11 18 15 A6 6 0 0 1 6 15 Q6 11 12 3 Z',
};

export function createGlyphAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLUMNS * CELL;
  canvas.height = ATLAS_ROWS * CELL;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const cellOrigin = (c: number) => [(c % ATLAS_COLUMNS) * CELL, Math.floor(c / ATLAS_COLUMNS) * CELL];
  TERRAINS.forEach((t, i) => {
    const [x, y] = cellOrigin(i);
    // The design strokes glyphs 1.2 px wide at g = 0.26 × 24 px: scale that to G
    ctx.lineWidth = (1.2 * G) / (0.26 * 24);
    ctx.stroke(new Path2D(glyphPath(t, x + CELL / 2, y + CELL / 2, G)));
  });
  TERRAINS.forEach((t, i) => {
    const [x, y] = cellOrigin(TERRAINS.length + i);
    // The 24-unit icon fills 48 px in the middle of the cell
    ctx.save();
    ctx.translate(x + 8, y + 8);
    ctx.scale(2, 2);
    ctx.lineWidth = 2;
    ctx.stroke(new Path2D(RESOURCE_ICONS[TERRAIN_RULES[t].resource]));
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}
