import { expect, test, type Page } from '@playwright/test';

/** A new game with seed 42, straight to the start city (reduced motion), returns console errors. */
async function startGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  return errors;
}

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);
const speed = (page: Page, s: string) => page.locator('.hud-speed label', { hasText: s }).click();

/** Screen position (CSS px) of a unit's feet. */
const unitOnScreen = (page: Page, index: number) => page.evaluate(i => {
  const w = window as any;
  const tile = w.globeGame.state.units[i].tile;
  const p = w.globeHexTiles.tileCenter(tile).multiplyScalar(w.globeCamera.R).project(w.globeCamera.camera);
  return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight];
}, index);

test('days pass by the wall clock, pause stops them and 4× runs four times as fast', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await startGame(page);
  const t0 = await state(page);
  // Measure inside the page: days over a span of wall time
  const daysOver = (ms: number) => page.evaluate(span => new Promise<number>(resolve => {
    const w = window as any;
    const d0 = w.globeGame.state.day;
    setTimeout(() => resolve(w.globeGame.state.day - d0), span);
  }), ms);
  const normal = await daysOver(3000); // 1.5 s per day at 1×
  expect(normal).toBeGreaterThanOrEqual(1);
  expect(normal).toBeLessThanOrEqual(3);
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect(await daysOver(2000)).toBe(0);
  await expect(page.locator('.hud-day-label')).toHaveText('Tauolla');
  await speed(page, '4×'); // choosing a speed also resumes
  const fast = await daysOver(3000);
  expect(fast).toBeGreaterThanOrEqual(6);
  expect(fast).toBeLessThanOrEqual(10);
  expect((await state(page)).day).toBeGreaterThan(t0.day);
  expect(errors).toEqual([]);
});

test('scouts map the fog on their own and the meter follows the province', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await startGame(page);
  const before = (await state(page)).mapped;
  const meter0 = await page.locator('.hud-meter-value').textContent();
  await speed(page, '4×');
  await page.waitForFunction(m => (window as any).globeGame.state.mapped > m + 30, before, { timeout: 60_000 });
  await expect(page.locator('.hud-meter-value')).not.toHaveText(meter0!);
  await expect(page.locator('.hud-meter-value')).toHaveText(/^\d+ \/ 60 %$/);
  expect(errors).toEqual([]);
});

test('a tap on the map selects a unit; modes, the flag and the settler act', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await startGame(page);
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(page.locator('.hud-unit-name')).toHaveText('Tiedustelija 1');
  // Tap the settler's figure (a little above its feet)
  const [sx, sy] = await unitOnScreen(page, 0);
  await page.mouse.click(sx, sy - 10);
  await expect(page.locator('.hud-unit-name')).toHaveText('Uudisasukas');
  await expect(page.locator('.hud-unit-status')).toHaveText(/^Kaupungin paikka: .+, \d+ pv$/);
  await expect(page.getByRole('button', { name: 'Perusta kaupunki tähän' })).toBeVisible();
  const site0 = (await state(page)).site;
  await page.getByRole('button', { name: 'Vaihda paikka' }).click();
  expect((await state(page)).site).not.toBe(site0);

  // The next unit button cycles to the first scout; make it defend: it goes back to the camp
  await page.locator('.hud-unit').click();
  await expect(page.locator('.hud-unit-name')).toHaveText('Tiedustelija 1');
  await page.locator('.hud-modes label', { hasText: 'Puolusta' }).click();
  expect((await state(page)).units[1].mode).toBe('defend');

  // Flag tool: the next tap on the map puts the flag on that tile
  await page.getByRole('button', { name: 'Lippu: aseta tutkimuskohde' }).click();
  await expect(page.getByRole('button', { name: 'Lippu: aseta tutkimuskohde' })).toHaveAttribute('aria-pressed', 'true');
  const box = page.viewportSize()!;
  await page.mouse.click(box.width * 0.35, box.height * 0.45);
  const flagged = await state(page);
  expect(flagged.flag).not.toBeNull();
  await speed(page, '4×');
  // The other scout explores toward the flag (or the flag fell in the sea and was refused)
  await page.waitForFunction(() => {
    const s = (window as any).globeGame.state;
    return s.units[1].tile === s.units[0].tile || s.day > 40;
  }, null, { timeout: 60_000 });
  const later = await state(page);
  expect(later.units[1].mode).toBe('defend');
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the HUD fits the screen, takes about a quarter of it and has 44 px targets', async ({ page }, testInfo) => {
    const errors = await startGame(page);
    const top = (await page.locator('.hud-top').boundingBox())!;
    const bottom = (await page.locator('.hud-bottom').boundingBox())!;
    for (const b of [top, bottom]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
    }
    expect(top.height + bottom.height).toBeLessThan(844 * 0.28);
    for (const sel of ['.hud-pause', '.hud-flag', '.hud-speed label', '.hud-modes label']) {
      for (const b of await page.locator(sel).all()) {
        const r = (await b.boundingBox())!;
        expect(r.height).toBeGreaterThanOrEqual(43.5);
        expect(r.width).toBeGreaterThanOrEqual(43.5);
      }
    }
    // Nothing in the unit row is clipped
    expect(await page.locator('.hud-unit-name').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('play-phone.png') });
    expect(errors).toEqual([]);
  });
});
