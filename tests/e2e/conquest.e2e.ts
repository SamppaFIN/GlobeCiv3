import { expect, test, type Page } from '@playwright/test';

/** Map a share of the home province or state through the test hook. */
const mapShare = (page: Page, region: 'province' | 'state', share: number) => page.evaluate(([r, s]) => {
  const w = window as any;
  const div = r === 'province' ? 7 : 49;
  const home = Math.floor(w.globeGame.state.startCity / div);
  const table = w.globeRegions.tileTable();
  const ids: number[] = [];
  for (let id = 0; id < table.length; id++) if (Math.floor(table[id] / div) === home) ids.push(id);
  const target = Math.ceil(ids.length * (s as number));
  const missing = ids.filter(id => !w.globeMap.isMapped(id));
  w.globeDebug.reveal(missing.slice(0, Math.max(0, target - (ids.length - missing.length))));
}, [region, share] as const);

const arrive = (page: Page, level: number) => page.waitForFunction(l => {
  const s = (window as any).globeLevels.state;
  return s.level === l && !s.flying;
}, level, { timeout: 20_000 });

/** A land tile of a neighbouring state, and whether the scouts may be sent there now. */
const sendNeighbour = (page: Page) => page.evaluate(() => {
  const w = window as any;
  const home = Math.floor(w.globeGame.state.startCity / 49);
  const next = w.globeRegions.neighbors[home][0];
  const table = w.globeRegions.tileTable();
  for (let id = 0; id < table.length; id++) {
    if (Math.floor(table[id] / 49) === next && Number.isFinite(w.globeDebug.yieldOf(id).food) && w.globeDebug.sendTo(id)) return true;
  }
  return false;
});

test('a city holds its province; all seven conquer the home state, which opens the planet and the neighbouring states', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: 'Uusi peli' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await mapShare(page, 'province', 0.61);
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await page.keyboard.press('-');
  await arrive(page, 2);
  await mapShare(page, 'state', 0.61);
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 1);

  // The meter counts the home state's provinces held; other states are locked
  await expect(page.locator('.hud-meter-value')).toHaveText('0 / 7 hallussa');
  expect(await sendNeighbour(page)).toBe(false);

  // A city in six provinces: they are held, and the state is not conquered yet
  const provinces = await page.evaluate(() => {
    const home = Math.floor((window as any).globeGame.state.startCity / 49);
    return Array.from({ length: 7 }, (_, k) => home * 7 + k);
  });
  for (const p of provinces.slice(0, 6)) expect(await page.evaluate(id => (window as any).globeDebug.foundIn(id), p)).not.toBeNull();
  await expect(page.locator('.hud-meter-value')).toHaveText('6 / 7 hallussa');
  await expect(page.locator('.chip-sub', { hasText: 'Hallussa' }).first()).toBeVisible();
  expect((await page.evaluate(() => (window as any).globeGame.state)).openLevel).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('held.png') });

  // The seventh conquers the state: the planet opens, and so do the neighbouring states
  await page.evaluate(id => (window as any).globeDebug.foundIn(id), provinces[6]);
  await expect(page.getByRole('heading', { name: 'Valtio vallattu, zoomaa ulos' })).toBeVisible();
  expect((await page.evaluate(() => (window as any).globeGame.state)).openLevel).toBe(0);
  await page.getByRole('button', { name: 'Zoomaa ulos' }).click();
  await arrive(page, 0);
  const neighbours = await page.evaluate(() => {
    const w = window as any;
    return w.globeRegions.neighbors[Math.floor(w.globeGame.state.startCity / 49)].length as number;
  });
  await expect(page.locator('.chip-name', { hasText: 'Kotivaltio' })).toBeVisible();
  await expect(page.locator('.chip:not([hidden])').filter({ hasText: 'Kotivaltio' })).toContainText('Vallattu');
  await expect(page.locator('.chip:not([hidden])').filter({ hasText: 'Lääniä hallussa 0/7' }).first()).toBeAttached();
  expect(await page.locator('.chip').count()).toBeGreaterThanOrEqual(1 + neighbours);
  await expect(page.locator('.hud-meter-value')).toHaveText('1 vallattu');
  expect(await sendNeighbour(page)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('planet.png') });
  expect(errors).toEqual([]);
});
