import { expect, test, type Page } from '@playwright/test';
import { oklchToSrgb } from '../../src/globe/colors';

// tokens.css --terrain-* in terrainTypes.ts TERRAINS order (ocean: its shallow end)
const TOKENS: [string, [number, number, number]][] = [
  ['ocean', [0.47, 0.072, 228]], ['arctic', [0.9, 0.02, 240]], ['desert', [0.8, 0.08, 82]], ['forest', [0.5, 0.09, 148]],
  ['grassland', [0.67, 0.12, 132]], ['hills', [0.63, 0.07, 92]], ['jungle', [0.45, 0.11, 162]], ['mountains', [0.6, 0.02, 60]],
  ['plains', [0.75, 0.09, 105]], ['swamp', [0.48, 0.06, 122]], ['tundra', [0.66, 0.04, 160]],
];

async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?free');
  await ready;
  return errors;
}

test('at city-area zoom a tile shows the colour of its terrain type', async ({ page }, testInfo) => {
  // Four views; the software renderer in CI needs about 30 s per view
  test.setTimeout(240_000);
  const errors = await openGame(page);
  // Land states away from the poles: look at each from the city-area framing distance
  const starts: number[] = await page.evaluate(() => {
    const w = window as any;
    const out: number[] = [];
    w.globeNodes.forEach((n: any, i: number) => {
      const v = n.position.clone().normalize();
      if (w.globeTerrain.terrainHeight(v, 30) > 0.05 && Math.abs(v.y) < 0.75 && out.length < 4) out.push(i);
    });
    return out;
  });
  let checked = 0;
  let matched = 0;
  const kinds = new Set<string>();
  for (const node of starts) {
    await page.evaluate(i => {
      const w = window as any;
      w.globeCamera.target.copy(w.globeNodes[i].position.clone().normalize());
      w.globeCamera.dist = w.globeLevels.state.frames[3];
      w.globeCamera.apply();
      w.globeTiles.budgetMs = 1e9;
      w.__stable = 0;
    }, node);
    // Tiles settled and the type codes around the view computed and uploaded
    await page.waitForFunction(() => {
      const w = window as any;
      const s = w.globeTiles.lastStats;
      w.__stable = s.queue === 0 && s.created === 0 ? w.__stable + 1 : 0;
      return w.__stable >= 5 && w.globeTileTypes.codes[w.globeHexTiles.pointToTile(w.globeCamera.target)] !== 0;
    }, null, { timeout: 60_000, polling: 'raf' });
    await page.waitForTimeout(400);
    const shot = await page.screenshot({ path: testInfo.outputPath(`terrain-${node}.png`) });
    // Sample 0.6 circumradii left of tile centres (clear of glyph, marker and edges): the
    // centre tile and its neighbours within its city area (outside it the view is dimmed)
    const samples = await page.evaluate(async b64 => {
      const w = window as any;
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const ht = w.globeHexTiles;
      const R = w.globeCamera.R;
      const project = (v: any) => {
        const p = v.clone().multiplyScalar(R).project(w.globeCamera.camera);
        return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight];
      };
      const centre = ht.pointToTile(w.globeCamera.target);
      const city = w.globeRegions.cityOfTile(ht.tileCenter(centre));
      const ids = new Set<number>([centre]);
      for (const n of ht.neighbors(centre)) { ids.add(n); for (const m of ht.neighbors(n)) ids.add(m); }
      const scale = img.width / innerWidth;
      const out: { terrain: string; rgb: number[] }[] = [];
      for (const id of ids) {
        if (w.globeRegions.cityOfTile(ht.tileCenter(id)) !== city || !w.globeTileTypes.codes[id]) continue;
        const [cx, cy] = project(ht.tileCenter(id));
        const [nx, ny] = project(ht.tileCenter(ht.neighbors(id)[0]));
        const s = Math.hypot(nx - cx, ny - cy) / Math.sqrt(3);
        const px = ctx.getImageData(Math.round((cx - 0.6 * s) * scale), Math.round(cy * scale), 1, 1).data;
        out.push({ terrain: w.globeTileTypes.tileInfo(id).terrain, rgb: [px[0] / 255, px[1] / 255, px[2] / 255] });
      }
      return out;
    }, shot.toString('base64'));
    for (const sample of samples) {
      if (sample.terrain === 'ocean') continue; // ocean shades with depth
      // The nearest token colour (with the shading factor between 0.8 and 1) is the tile's own
      const nearest = TOKENS.map(([name, lch]) => {
        const c = oklchToSrgb(...lch);
        let best = Infinity;
        for (let f = 0.8; f <= 1.001; f += 0.02) best = Math.min(best, Math.hypot(...c.map((v, k) => v * f - sample.rgb[k])));
        return [name, best] as const;
      }).sort((x, y) => x[1] - y[1]);
      if (nearest[0][0] === sample.terrain && nearest[0][1] < 0.06) matched++;
      checked++;
      kinds.add(sample.terrain);
    }
  }
  console.log(`[terrain] ${matched} / ${checked} land tiles match, types: ${[...kinds].join(', ')}`);
  expect(kinds.size).toBeGreaterThanOrEqual(3);
  expect(matched / checked).toBeGreaterThan(0.95);
  expect(checked).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});
