import { expect, test, type Page } from '@playwright/test';

/** Wait until every state next to home has its city-states found (a state a day). */
const allFound = (page: Page) => page.waitForFunction(() => {
  const w = window as any;
  const home = Math.floor(w.globeGame.state.startCity / 49);
  const states = new Set(w.globeDebug.natives().map((n: { state: number }) => n.state));
  return w.globeRegions.neighbors[home].every((s: number) => states.has(s));
}, null, { timeout: 60_000 });

const start = async (page: Page, button: 'Uusi peli' | 'Jatka') => {
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
  await ready;
  await page.evaluate(() => (window as any).globeDebug.setDiscoveries(false));
  await page.getByRole('button', { name: button }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.screen === 'playing', null, { timeout: 10_000 });
  await page.evaluate(() => (window as any).globeDebug.fastForward(4));
  await allFound(page);
  await page.getByRole('button', { name: 'Tauko' }).click();
};

test('city-states: 2 to 4 in each state next to home, shown once mapped, the same after a reload', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, 'Uusi peli');

  const found = await page.evaluate(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 49);
    return { home, neighbours: w.globeRegions.neighbors[home] as number[], natives: w.globeDebug.natives() as { tile: number; state: number; name: string; mapped: boolean; size: number }[], ms: w.globeDebug.nativeMs() as number };
  });
  for (const s of found.neighbours) {
    const n = found.natives.filter(c => c.state === s).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(4);
  }
  expect(found.natives.some(c => c.state === found.home)).toBe(false);
  expect(found.natives.every(c => found.neighbours.includes(c.state))).toBe(true);
  testInfo.annotations.push({ type: 'natives', description: `${found.natives.length} kaupunkivaltiota ${found.neighbours.length} naapurivaltiossa, pisin framen haku ${found.ms.toFixed(1)} ms` });

  // Unmapped, a city-state is not shown; mapped, it is: houses, a label of its own and its card
  const n = found.natives.find(c => !c.mapped)!;
  const label = page.locator('.city-label-native', { hasText: n.name });
  await expect(label).toHaveCount(0);
  await page.evaluate(t => {
    const w = window as any;
    w.globeDebug.reveal([t, ...w.globeHexTiles.neighbors(t)]);
    w.globeCamera.flyTo(w.globeHexTiles.tileCenter(t), w.globeCamera.dist, 0);
  }, n.tile);
  await expect(label).toBeVisible();
  await expect(label.locator('.city-label-size')).toHaveText(String(n.size));
  await page.screenshot({ path: testInfo.outputPath('city-state.png') });
  await label.click();
  const card = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('.tile-rows') });
  await expect(card).toBeVisible();
  await expect(card.locator('.tile-rows')).toContainText(new RegExp(`Kaupunkivaltio\\s*${n.name}, koko \\d+ · \\d+ (soturi|soturia|falangi|falangia)`));
  await expect(card.locator('.tile-rows')).not.toContainText('Kaupunkiei kaupungin alueella');

  // The seed decides them: the same city-states after a reload
  expect(await page.evaluate(() => (window as any).globeDebug.saveNow())).toBe(true);
  await start(page, 'Jatka');
  const again = await page.evaluate(() => (window as any).globeDebug.natives().map((c: { tile: number; name: string }) => `${c.tile} ${c.name}`).sort());
  expect(again).toEqual(found.natives.map(c => `${c.tile} ${c.name}`).sort());
  expect(errors).toEqual([]);
});
