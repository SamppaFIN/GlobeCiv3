import { expect, test, type Page } from '@playwright/test';

async function openGame(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./' + query);
  await ready;
  return errors;
}

const settle = (page: Page) => page.waitForFunction(() => {
  const w = window as any;
  const s = w.globeTiles.lastStats;
  w.__stable = s.queue === 0 && s.created === 0 ? (w.__stable ?? 0) + 1 : 0;
  return w.__stable >= 5;
}, null, { timeout: 60_000, polling: 'raf' });

/** Luminance (0–1) of the screenshot pixels at the screen projections of unit-sphere points. */
async function luminanceAt(page: Page, shot: Buffer, points: number[][]): Promise<number[]> {
  return page.evaluate(async ([b64, pts]) => {
    const w = window as any;
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const scale = img.width / innerWidth;
    return pts.map(([x, y, z]) => {
      const p = w.globeCamera.target.clone().set(x, y, z).multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
      const px = ctx.getImageData(Math.round(((p.x + 1) / 2) * innerWidth * scale), Math.round(((1 - p.y) / 2) * innerHeight * scale), 1, 1).data;
      return (0.3 * px[0] + 0.59 * px[1] + 0.11 * px[2]) / 255;
    });
  }, [shot.toString('base64'), points] as const);
}

test('a new game maps the start city area and leaves the rest of its province in fog', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page, '?seed=42');
  expect((await page.evaluate(() => (window as any).globeGame.state)).mapped).toBe(0);
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // Every tile of the start city area is mapped, and its neighbours' tiles are not
  const counts = await page.evaluate(() => {
    const w = window as any;
    const city = w.globeGame.state.startCity;
    const ht = w.globeHexTiles;
    const table = w.globeRegions.tileTable();
    const start = ht.pointToTile(w.globeRegions.centers[2][city]);
    // Walk the tiles around the start city
    const seen = new Set([start]);
    const queue = [start];
    let inside = 0, insideMapped = 0, outside = 0, outsideMapped = 0;
    while (queue.length && seen.size < 600) {
      const id = queue.shift();
      const own = table[id] === city;
      if (own) { inside++; if (w.globeMap.isMapped(id)) insideMapped++; }
      else { outside++; if (w.globeMap.isMapped(id)) outsideMapped++; }
      for (const n of ht.neighbors(id)) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    return { inside, insideMapped, outside, outsideMapped, mapped: w.globeGame.state.mapped };
  });
  expect(counts.inside).toBeGreaterThan(30);
  expect(counts.insideMapped).toBe(counts.inside);
  // Since STORY-025 the scouts map their sight from the first day, so a few tiles beyond
  // the start area may be mapped already; most of the surroundings are still fog
  expect(counts.outsideMapped).toBeLessThan(counts.outside * 0.15);
  expect(counts.mapped).toBeGreaterThanOrEqual(counts.inside);

  // From the province level (the lock is lifted for the test), the start city is lit and
  // a sibling city area of the same province is in fog
  const centres = await page.evaluate(() => {
    const w = window as any;
    w.globeCamera.maxDist = w.globeCamera.R * 8;
    w.globeCamera.dist = w.globeLevels.state.frames[2];
    w.globeCamera.apply();
    w.globeTiles.budgetMs = 1e9;
    w.__stable = 0;
    const city = w.globeGame.state.startCity;
    const sibling = Math.floor(city / 7) * 7 + ((city % 7) + 1) % 7;
    return [w.globeRegions.centers[2][city], w.globeRegions.centers[2][sibling]].map((v: any) => [v.x, v.y, v.z]);
  });
  await settle(page);
  const shot = await page.screenshot({ path: testInfo.outputPath('fog-province.png') });
  const [mapped, fogged] = await luminanceAt(page, shot, centres);
  console.log(`[fog] mapped ${mapped.toFixed(3)}, fogged ${fogged.toFixed(3)}`);
  expect(mapped).toBeGreaterThan(fogged * 1.8);
  expect(errors).toEqual([]);
});

test('the start screen planet is a dark silhouette, and ?free has no fog', async ({ page }) => {
  await openGame(page, '');
  const fog = await page.evaluate(() => ({ on: (window as any).globeTiles.fogOn.value, mapped: (window as any).globeGame.state.mapped }));
  expect(fog).toEqual({ on: 1, mapped: 0 });
  const shot = await page.screenshot();
  // The globe's centre is fogged: dark
  const [centre] = await luminanceAt(page, shot, [await page.evaluate(() => (window as any).globeCamera.target.toArray())]);
  expect(centre).toBeLessThan(0.25);

  await openGame(page, '?free');
  expect(await page.evaluate(() => (window as any).globeTiles.fogOn.value)).toBe(0);
});
