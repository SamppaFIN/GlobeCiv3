import { expect, test } from '@playwright/test';

/**
 * STORY-006: precision at every level of the main game. From the planet framing the camera
 * halves its distance step by step down to the deepest level; at each step every drawn tile
 * must project within half a pixel of the exact float64 projection, and the depth range
 * must keep its precision.
 */
test('the surface stays in place from the planet down to level 17, with a sound depth range and stars of their own', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?free');
  await ready;

  const settle = () => page.waitForFunction(() => {
    const w = window as any;
    const s = w.globeTiles.lastStats;
    w.__stable = s.queue === 0 && s.created === 0 ? (w.__stable ?? 0) + 1 : 0;
    return w.__stable >= 5;
  }, null, { timeout: 120_000, polling: 'raf' });

  // A land point away from the poles, straight below the camera
  const { R, minDist, planetDist } = await page.evaluate(() => {
    const w = window as any;
    const node = w.globeNodes.find((n: any) => {
      const v = n.position.clone().normalize();
      return w.globeTerrain.terrainHeight(v, 30) > 0.05 && Math.abs(v.y) < 0.75;
    });
    w.globeCamera.target.copy(node.position.clone().normalize().multiplyScalar(w.globeCamera.R));
    w.globeTiles.budgetMs = 1e9;
    return { R: w.globeCamera.R, minDist: w.globeCamera.minDist, planetDist: w.globeLevels.state.frames[0] };
  });

  // Stars: a pass of their own around the planet, not cut by the globe's depth range
  await page.evaluate(d => { const w = window as any; w.globeCamera.dist = d; w.globeCamera.apply(); w.__stable = 0; }, 3 * R);
  await settle();
  const planet = await page.screenshot({ path: testInfo.outputPath('planet.png') });
  const stars = await page.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    // Bright pixels in the corners, well outside the planet's disc
    let bright = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (Math.hypot(x - c.width / 2, y - c.height / 2) < 0.45 * Math.hypot(c.width, c.height)) continue;
        const i = (y * c.width + x) * 4;
        if (data[i] + data[i + 1] + data[i + 2] > 360) bright++;
      }
    }
    return bright;
  }, planet.toString('base64'));
  expect(stars).toBeGreaterThan(5);

  const steps: { dist: number; level: number; levels: number[]; rtc: number; naive: number; near: number; far: number; altitude: number }[] = [];
  for (let dist = 4 * planetDist; ; dist = Math.max(dist / 2, minDist)) {
    await page.evaluate(d => { const w = window as any; w.globeCamera.dist = d; w.globeCamera.apply(); w.__stable = 0; }, dist);
    await settle();
    const p = await page.evaluate(() => (window as any).globePrecision());
    steps.push({ dist, ...p });
    if (dist === minDist) break;
  }
  console.log('[precision]', JSON.stringify(steps.map(s => [s.level, +s.rtc.toFixed(4), Math.round(s.naive), Math.round(s.far / s.near)])));

  // Every level from 1 to 17 is drawn and measured, the deepest at the closest distance
  const levels = new Set(steps.flatMap(s => s.levels));
  for (let l = 1; l <= 17; l++) expect(levels.has(l), `level ${l} drawn`).toBe(true);
  expect(steps.at(-1)!.level).toBe(17);
  for (const s of steps) {
    // Camera-relative float32 within half a pixel of exact at every level
    expect(s.rtc, `level ${s.level}`).toBeLessThan(0.5);
    // Near and far follow the altitude: the surface lies between them, and a 24-bit depth
    // buffer keeps far / near under 10⁵ apart (no z-fighting)
    expect(s.near).toBeLessThan(s.altitude);
    expect(s.far).toBeGreaterThan(s.altitude);
    expect(s.far / s.near, `level ${s.level}`).toBeLessThan(1e5);
  }
  // Absolute float32 coordinates would move the surface by pixels at the deepest level;
  // the camera-relative path is over a hundred times closer
  const deepest = steps.at(-1)!;
  expect(deepest.naive).toBeGreaterThan(100 * deepest.rtc);

  // At the deepest level a still camera draws the same frame twice: no jitter
  const first = await page.screenshot({ path: testInfo.outputPath('deepest.png') });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const second = await page.screenshot();
  expect(first.equals(second)).toBe(true);
  expect(errors).toEqual([]);
});
