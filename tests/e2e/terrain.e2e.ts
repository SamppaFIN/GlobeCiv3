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
  // The token colours themselves; the surface patterns' light and shade has its own test
  await page.evaluate(() => { (window as any).globeTiles.surfaceOn.value = 0; });
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

test('at city-area zoom the surface patterns shade the tiles, without changing their colour', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await openGame(page);
  // The first land state away from the poles, at the city-area framing distance
  const surfaced = page.waitForEvent('console', { predicate: m => m.text().includes('Surface patterns'), timeout: 60_000 });
  await page.evaluate(() => {
    const w = window as any;
    const node = w.globeNodes.find((n: any) => {
      const v = n.position.clone().normalize();
      return w.globeTerrain.terrainHeight(v, 30) > 0.05 && Math.abs(v.y) < 0.75;
    });
    w.globeCamera.target.copy(node.position.clone().normalize());
    // Half the city-area framing distance: the patterns fade in from 24 to 48 device pixels
    // per tile, and CI renders at half the pixel ratio
    w.globeCamera.dist = w.globeLevels.state.frames[3] * 0.5;
    w.globeCamera.apply();
    w.globeTiles.budgetMs = 1e9;
  });
  // The patterns are computed in a worker once the city-area level is reached
  await surfaced;
  const settle = () => page.waitForFunction(() => {
    const w = window as any;
    const st = w.globeTiles.lastStats;
    w.__stable = st.queue === 0 && st.created === 0 ? (w.__stable ?? 0) + 1 : 0;
    return w.__stable >= 5;
  }, null, { timeout: 60_000, polling: 'raf' });
  const shot = async (on: number) => {
    await page.evaluate(v => { (window as any).globeTiles.surfaceOn.value = v; (window as any).__stable = 0; }, on);
    await settle();
    return (await page.screenshot({ clip: { x: 440, y: 250, width: 400, height: 300 } })).toString('base64');
  };
  const plain = await shot(0);
  const shaded = await shot(1);
  // Per pixel: how much brighter or darker, and how much the hue moved
  const diff = await page.evaluate(async ([a, b]) => {
    const pixels = async (b64: string) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };
    const p = await pixels(a);
    const q = await pixels(b);
    let changed = 0, hueShift = 0, n = 0;
    for (let i = 0; i < p.length; i += 4) {
      const lp = p[i] + p[i + 1] + p[i + 2];
      const lq = q[i] + q[i + 1] + q[i + 2];
      n++;
      if (Math.abs(lp - lq) > 9) changed++;
      // Shading scales the colour: the channel ratios stay
      if (lp > 60 && lq > 60) hueShift += Math.abs(p[i] / lp - q[i] / lq) + Math.abs(p[i + 1] / lp - q[i + 1] / lq);
    }
    return { changed: changed / n, hueShift: hueShift / n };
  }, [plain, shaded] as const);
  console.log('[surface]', JSON.stringify(diff));
  expect(diff.changed).toBeGreaterThan(0.3);
  expect(diff.hueShift).toBeLessThan(0.02);
  expect(errors).toEqual([]);
});
