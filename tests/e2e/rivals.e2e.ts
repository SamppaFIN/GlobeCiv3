import { expect, test, type Page } from '@playwright/test';

interface RivalState { id: number; name: string; start: number; cities: { name: string; tile: number; size: number; build: string }[]; units: string[] }
const rivals = (page: Page) => page.evaluate(() => (window as any).globeDebug.rivals() as RivalState[]);

const start = async (page: Page, button: 'Uusi peli' | 'Jatka') => {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: button }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
};

test('rivals start two states from home with a capital, grow and spread by the player\'s rules, show once mapped and keep in the save', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, 'Uusi peli');
  await page.evaluate(() => (window as any).globeDebug.fastForward(8));
  await page.waitForFunction(() => (window as any).globeDebug.rivals().every((r: RivalState) => r.cities.length > 0), null, { timeout: 60_000 });

  // Two or three, each with its capital in its start state, two steps from home
  const first = await rivals(page);
  expect(first.length).toBeGreaterThanOrEqual(2);
  expect(first.length).toBeLessThanOrEqual(3);
  const geo = await page.evaluate(() => {
    const w = window as any;
    return { home: Math.floor(w.globeGame.state.startCity / 49), neighbors: w.globeRegions.neighbors as number[][], table: null };
  });
  for (const r of first) {
    expect(r.start === geo.home || geo.neighbors[geo.home].includes(r.start)).toBe(false);
    expect(geo.neighbors[geo.home].some(n => geo.neighbors[n].includes(r.start))).toBe(true);
    const state = await page.evaluate(t => Math.floor((window as any).globeRegions.tileTable()[t] / 49), r.cities[0].tile);
    expect(state).toBe(r.start);
    expect(r.cities[0].name).toMatch(/^(Sariola|Mielikkälä|Vellamola)$/);
  }

  // They grow and found more cities
  await page.evaluate(() => (window as any).globeDebug.fastForward(32));
  await page.waitForFunction(() => (window as any).globeDebug.rivals().some((r: RivalState) => r.cities.length >= 2), null, { timeout: 120_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const grown = await rivals(page);
  const big = grown.find(r => r.cities.length >= 2)!;
  testInfo.annotations.push({ type: 'rivals', description: grown.map(r => `${r.name}: ${r.cities.map(c => `${c.name} ${c.size}`).join(', ')}`).join(' · ') + ` (päivä ${await page.evaluate(() => (window as any).globeGame.state.day)})` });

  // Mapped, a rival city shows in its colour with a label of its own, and its hex card tells whose it is
  const city = big.cities[1];
  await page.evaluate(t => {
    const w = window as any;
    w.globeDebug.reveal([t, ...w.globeHexTiles.neighbors(t)]);
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(t), w.globeCamera.dist, 0);
  }, city.tile);
  // A slow runner may have mapped the home province by now: its unlock card set aside
  if (await page.getByRole('button', { name: 'Myöhemmin' }).isVisible()) await page.getByRole('button', { name: 'Myöhemmin' }).click();
  const label = page.locator('.city-label-rival:visible', { hasText: city.name });
  await expect(label).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('rival.png') });
  await label.click();
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  await expect(card.locator('.tile-rows')).toContainText(new RegExp(`Kilpailija\\s*${big.name}: ${city.name}, koko \\d+`));

  // The save keeps them (at a speed the player can choose: the save refuses the test's 32)
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);
  const saved = (await rivals(page)).map(r => r.cities.map(c => c.tile));
  await start(page, 'Jatka');
  expect((await rivals(page)).map(r => r.cities.map(c => c.tile))).toEqual(saved);
  expect(errors).toEqual([]);
});
