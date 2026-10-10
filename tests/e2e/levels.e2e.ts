import { expect, test, type Page } from '@playwright/test';

interface Ref { level: number; id: number }
interface LevelState { level: number; path: Ref[]; selection: Ref | null; flying: boolean }

async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  // The engine without the start screen and the zoom lock (STORY-021)
  await page.goto('./?free');
  await ready;
  return errors;
}

const levelState = (page: Page) => page.evaluate(() => {
  const s = (window as any).globeLevels.state;
  return { level: s.level, path: s.path, selection: s.selection, flying: s.flying } as LevelState;
});

/** Region of a view level under a client pixel, computed apart from the game's tap handling. */
const regionUnder = (page: Page, x: number, y: number, level: number) => page.evaluate(([cx, cy, lv]) => {
  const w = window as any;
  const hit = w.globeCamera.raycast({ x: (cx / innerWidth) * 2 - 1, y: -((cy / innerHeight) * 2 - 1) });
  // A point belongs to the regions of its hex tile (the tile table)
  const city = w.globeRegions.cityOfTile(hit);
  return { level: lv, id: lv === 0 ? Math.floor(city / 49) : lv === 1 ? Math.floor(city / 7) : city } as Ref;
}, [x, y, level] as const);

/** Angle between the camera target and a region centre. */
const targetOffset = (page: Page, ref: Ref) => page.evaluate(r => {
  const w = window as any;
  return w.globeCamera.target.clone().normalize().angleTo(w.globeRegions.centers[r.level][r.id]);
}, ref);

/** Wait for the flight to end and for the tiles to settle, for meaningful screenshots. */
async function arrive(page: Page) {
  await page.waitForFunction(() => !(window as any).globeLevels.state.flying, null, { timeout: 15_000 });
  await page.evaluate(() => {
    const w = window as any;
    w.__stable = 0;
    w.globeTiles.budgetMs = 1e9;
  });
  await page.waitForFunction(() => {
    const w = window as any;
    const s = w.globeTiles.lastStats;
    w.__stable = s.queue === 0 && s.created === 0 ? w.__stable + 1 : 0;
    return w.__stable >= 5;
  }, null, { timeout: 30_000, polling: 'raf' });
}

test('a tap selects a region and a second tap dives in, level by level, and back returns', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = await openGame(page);
  const [x, y] = [640, 400];
  expect((await levelState(page)).level).toBe(0);
  const names = ['state', 'province', 'city'];

  for (let level = 0; level < 3; level++) {
    const expected = await regionUnder(page, x, y, level);
    await page.mouse.click(x, y);
    const selected = await levelState(page);
    expect(selected.selection).toEqual(expected);
    expect(selected.flying).toBe(false);
    await expect(page.locator('.level-hint')).toContainText('valittu');
    await page.screenshot({ path: testInfo.outputPath(`level-${level}-selected.png`) });

    await page.mouse.click(x, y);
    await arrive(page);
    const dived = await levelState(page);
    expect(dived.level).toBe(level + 1);
    expect(dived.path[level]).toEqual(expected);
    expect(dived.selection).toBeNull();
    expect(await targetOffset(page, expected)).toBeLessThan(1e-6);
    await page.screenshot({ path: testInfo.outputPath(`level-${level + 1}-${names[level]}.png`) });
  }

  // Back: city area → province → state → planet, centred on the parent each time
  const deepest = await levelState(page);
  for (let level = 2; level >= 0; level--) {
    const back = page.locator('.level-back');
    await expect(back).toBeVisible();
    const box = (await back.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await back.click();
    await arrive(page);
    const s = await levelState(page);
    expect(s.level).toBe(level);
    expect(s.path).toEqual(deepest.path.slice(0, level));
    if (level > 0) expect(await targetOffset(page, deepest.path[level - 1])).toBeLessThan(1e-6);
  }
  await expect(page.locator('.level-back')).toBeHidden();
  expect(errors).toEqual([]);
});

test('a drag pans without selecting a region', async ({ page }) => {
  const errors = await openGame(page);
  await page.mouse.move(640, 400);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(640 + i * 20, 400 + i * 4);
  await page.mouse.up();
  expect((await levelState(page)).selection).toBeNull();
  expect(errors).toEqual([]);
});

test.describe('on a phone-sized touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('two taps dive into a state and the level bar fits the screen', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const errors = await openGame(page);
    const [x, y] = [195, 422];
    const expected = await regionUnder(page, x, y, (await levelState(page)).level);
    await page.touchscreen.tap(x, y);
    expect((await levelState(page)).selection).toEqual(expected);
    await page.touchscreen.tap(x, y);
    await arrive(page);
    const s = await levelState(page);
    expect(s.level).toBe(expected.level + 1);
    expect(s.path[expected.level]).toEqual(expected);
    const bar = (await page.locator('.level-bar').boundingBox())!;
    expect(bar.x).toBeGreaterThanOrEqual(0);
    expect(bar.x + bar.width).toBeLessThanOrEqual(390);
    const title = page.locator('.level-title');
    expect(await title.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('phone-level.png') });
    expect(errors).toEqual([]);
  });
});
