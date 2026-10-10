import { expect, test, type Page } from '@playwright/test';

async function openGame(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./' + query);
  await ready;
  return errors;
}

const gameState = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const levelState = (page: Page) => page.evaluate(() => (window as any).globeLevels.state);

/** Radius in CSS pixels of the globe's silhouette, from the camera. */
const globeRadiusPx = (page: Page) => page.evaluate(() => {
  const rig = (window as any).globeCamera;
  const D = rig.camera.position.length();
  const half = Math.asin(rig.R / D);
  return (Math.tan(half) / Math.tan((rig.camera.fov * Math.PI) / 360)) * (innerHeight / 2);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the start screen shows the planet in a compass ring, the title and a new game button', async ({ page }, testInfo) => {
    const errors = await openGame(page);
    await expect(page.getByRole('heading', { name: 'GlobeCiv' })).toBeVisible();
    await expect(page.getByText('Kartta, joka piirtyy')).toBeVisible();
    await expect(page.getByText('Tuntematon maailma')).toBeVisible();
    await expect(page.getByText('Kartoitettu 0 %')).toBeVisible();
    const button = page.getByRole('button', { name: 'Uusi peli' });
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(52);
    expect(box.x).toBeCloseTo(28, 0);
    expect(box.x + box.width).toBeCloseTo(390 - 28, 0);
    // The planet fills 76 % of the width as in the design, and the ring is centred on it
    const r = await globeRadiusPx(page);
    expect(r).toBeGreaterThan(0.36 * 390);
    expect(r).toBeLessThan(0.4 * 390);
    const ring = (await page.locator('.start-ring').boundingBox())!;
    expect(ring.x + ring.width / 2).toBeCloseTo(195, 0);
    expect(ring.y + ring.height / 2).toBeCloseTo(422, 0);
    expect(ring.width).toBeCloseTo((340 / 140) * r, 0);
    // The level bar waits for the game
    await expect(page.locator('.level-bar')).toBeHidden();
    // The planet turns slowly
    const t0 = await page.evaluate(() => (window as any).globeCamera.target.toArray());
    await page.waitForTimeout(500);
    const turned = await page.evaluate(t => (window as any).globeCamera.target.angleTo((window as any).globeCamera.target.clone().fromArray(t)), t0);
    expect(turned).toBeGreaterThan(0.01);
    await page.screenshot({ path: testInfo.outputPath('start-phone.png') });
    expect(errors).toEqual([]);
  });
});

test('Uusi peli flies to the start city in about 3 s and locks zooming out at the city area', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await openGame(page, '?seed=42');
  await page.screenshot({ path: testInfo.outputPath('start-desktop.png') });
  await page.evaluate(() => {
    const w = window as any;
    w.__intro = {};
    document.querySelector('.start-new')!.addEventListener('click', () => { w.__intro.clickAt = performance.now(); });
    const watch = (t: number) => {
      if (w.__intro.prev) w.__intro.maxGap = Math.max(w.__intro.maxGap ?? 0, t - w.__intro.prev);
      w.__intro.prev = t;
      if (w.globeGame.state.screen === 'playing') {
        // The frame's time, before the landing work done in it
        w.__intro.landedAt = t;
        // A discovery (STORY-027) would stop the game and turn the camera; this test is about the start
        w.globeDebug.setDiscoveries(false);
      } else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  // Halfway through the descent the camera is over the target state
  await page.waitForFunction(() => (window as any).globeLevels.state.level >= 1, null, { timeout: 20_000, polling: 'raf' });
  await page.screenshot({ path: testInfo.outputPath('intro-state.png') });
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 30_000 });
  const { clickAt, landedAt, maxGap } = await page.evaluate(() => (window as any).__intro);
  // 1 s turn and 2 s descent of wall time. The turn starts on the first frame after the click,
  // the descent on the first frame after the turn, and the landing shows on the first frame
  // after the descent: three frame gaps at most
  expect(landedAt - clickAt).toBeGreaterThan(2900);
  expect(landedAt - clickAt, `frame gaps up to ${Math.round(maxGap)} ms`).toBeLessThan(3100 + 3 * maxGap);

  const game = await gameState(page);
  expect(game.seed).toBe(42);
  const landed = await levelState(page);
  expect(landed.level).toBe(3);
  expect(landed.path[2]).toEqual({ level: 2, id: game.startCity });
  expect(await page.evaluate(id => {
    const w = window as any;
    return w.globeCamera.target.clone().normalize().angleTo(w.globeRegions.centers[2][id]);
  }, game.startCity)).toBeLessThan(1e-6);
  // In the game the city-area HUD (design 2b, STORY-025) takes the top; no level bar or back button
  await expect(page.locator('.hud-top')).toBeVisible();
  await expect(page.locator('.level-bar')).toBeHidden();
  await expect(page.locator('.level-back')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('landed.png') });

  // Zooming out stops at the city-area level
  await page.mouse.move(640, 400);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 3000);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const after = await page.evaluate(() => ({ dist: (window as any).globeCamera.dist, level: (window as any).globeLevels.state.level }));
  expect(after.level).toBe(3);
  expect(after.dist).toBeLessThanOrEqual(game.lockDist * 1.000001);
  expect(errors).toEqual([]);
});

test('the same seed starts in the same city area', async ({ page }) => {
  const cities: number[] = [];
  for (let i = 0; i < 2; i++) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page, '?seed=7');
    await page.getByRole('button', { name: 'Uusi peli' }).click();
    await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 30_000 });
    cities.push((await gameState(page)).startCity);
  }
  expect(cities[0]).toBe(cities[1]);
});

test('with reduced motion the new game cuts straight to the start city', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page, '?seed=42');
  const t0 = await page.evaluate(() => (window as any).globeCamera.target.toArray());
  await page.waitForTimeout(300);
  // No rotation on the start screen
  expect(await page.evaluate(t => (window as any).globeCamera.target.angleTo((window as any).globeCamera.target.clone().fromArray(t)), t0)).toBe(0);
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 5_000 });
  expect((await levelState(page)).level).toBe(3);
  expect(errors).toEqual([]);
});

test('a drag turns the start planet under the pointer, so do the arrow keys, and the new game still starts', async ({ page }) => {
  test.setTimeout(120_000);
  // No slow spin while measuring
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page, '?seed=42');
  const { width, height } = page.viewportSize()!;
  const [cx, cy] = [width / 2, height / 2];
  const centre = await page.evaluate(() => (window as any).globeCamera.target.toArray());
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 30, { steps: 6 });
  await page.mouse.up();
  // The surface point that was at the centre is now under the pointer
  const at = await page.evaluate(p => {
    const w = window as any;
    const v = w.globeCamera.target.clone().fromArray(p).normalize().multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
    return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight];
  }, centre);
  expect(Math.abs(at[0] - (cx + 60))).toBeLessThan(3);
  expect(Math.abs(at[1] - (cy + 30))).toBeLessThan(3);

  const before = await page.evaluate(() => (window as any).globeCamera.target.toArray());
  await page.keyboard.press('ArrowLeft');
  const turned = await page.evaluate(t => (window as any).globeCamera.target.angleTo((window as any).globeCamera.target.clone().fromArray(t)), before);
  expect(turned).toBeGreaterThan(0.05);

  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  expect(errors).toEqual([]);
});
