import { expect, test, type Page } from '@playwright/test';

async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./');
  await ready;
  return errors;
}

/** Look at the border between state 100 and its first neighbour from the given multiple of the city-area framing distance. */
async function viewBorder(page: Page, k: number) {
  await page.evaluate(kk => {
    const w = window as any;
    const n = w.globeNodes[100];
    const a = n.position.clone().normalize();
    const b = w.globeNodes[n.neighbors[0]].position.clone().normalize();
    w.globeCamera.target.copy(a.add(b).normalize());
    w.globeCamera.dist = w.globeLevels.state.frames[3] * kk;
    w.globeCamera.apply();
    w.globeTiles.budgetMs = 1e9;
    w.__stable = 0;
  }, k);
  await page.waitForFunction(() => {
    const w = window as any;
    const s = w.globeTiles.lastStats;
    w.__stable = s.queue === 0 && s.created === 0 ? w.__stable + 1 : 0;
    return w.__stable >= 5;
  }, null, { timeout: 60_000, polling: 'raf' });
}

test('at city-area zoom the context region follows tile edges, not the smooth borders', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await openGame(page);
  await viewBorder(page, 1);
  const shot = await page.screenshot({ path: testInfo.outputPath('hex-border.png') });

  // Outside the city area the camera is in, the world is dimmed. Compare the brightness of
  // a grid of pixels with two memberships: by the pixel's tile centre and by the pixel itself.
  const result = await page.evaluate(async b64 => {
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
    const city = w.globeLevels.state.path[2].id;
    const r = w.globeRegions;
    const samples: { lum: number; byTile: boolean; byPixel: boolean }[] = [];
    for (let y = 100; y < innerHeight - 10; y += 12) {
      for (let x = 10; x < innerWidth - 10; x += 12) {
        const hit = w.globeCamera.raycast({ x: (x / innerWidth) * 2 - 1, y: -((y / innerHeight) * 2 - 1) });
        if (!hit) continue;
        const [pr, pg, pb] = ctx.getImageData(Math.floor(x * scale), Math.floor(y * scale), 1, 1).data;
        samples.push({
          lum: 0.3 * pr + 0.59 * pg + 0.11 * pb,
          byTile: r.cityOfTile(hit) === city,
          byPixel: r.cityOf(hit) === city,
        });
      }
    }
    const median = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
    const threshold = (median(samples.filter(s => s.byTile).map(s => s.lum)) + median(samples.filter(s => !s.byTile).map(s => s.lum))) / 2;
    const agree = (key: 'byTile' | 'byPixel') => samples.filter(s => (s.lum > threshold) === s[key]).length / samples.length;
    return { n: samples.length, inside: samples.filter(s => s.byTile).length, tile: agree('byTile'), pixel: agree('byPixel'), differ: samples.filter(s => s.byTile !== s.byPixel).length };
  }, shot.toString('base64'));
  console.log('[hex-context] ' + JSON.stringify(result));
  expect(result.inside).toBeGreaterThan(50);
  // Lines and hex edges disturb a few samples; the step zones along the border tell the two apart
  expect(result.differ).toBeGreaterThan(10);
  expect(result.tile).toBeGreaterThan(0.97);
  expect(result.tile).toBeGreaterThan(result.pixel + (result.differ / result.n) * 0.5);
  expect(errors).toEqual([]);
});

test('hex tiles stay exact from the city-area view down to the deepest level', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await openGame(page);
  for (const [name, k] of [['city', 1], ['tile', 1 / 8], ['deep', 1 / 200], ['deepest', 1e-3]] as const) {
    await viewBorder(page, k);
    await page.screenshot({ path: testInfo.outputPath(`hex-${name}.png`) });
  }
  expect(errors).toEqual([]);
});
