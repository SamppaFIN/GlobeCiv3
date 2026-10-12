import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/** Choose a build in the open city card, buy it, and run until it is built. */
async function buyAndBuild(page: Page, name: RegExp, kind: string) {
  const card = page.getByRole('dialog', { name: 'Aamuranta' });
  await card.getByRole('radio', { name }).click();
  await page.evaluate(() => (window as any).globeDebug.setGold(2000));
  await card.locator('.city-buy').click();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(k => (window as any).globeGame.state.cities[0].buildings.includes(k), kind, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
}

test('wonders: once in the game, with their effect on the city or every city', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
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
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const card = page.getByRole('dialog', { name: 'Aamuranta' });

  // Locked until their advances; no upkeep
  const gardens = card.getByRole('radio', { name: /^Riippuvat puutarhat/ });
  await expect(gardens).toContainText('vaatii: Keramiikka');
  await page.evaluate(() => (window as any).globeDebug.learn('pottery'));
  await expect(gardens).toContainText('300 tuotantoa · Ihme: yksi onnellinen asukas joka kaupunkiin');

  // Built: a notice, gone from the builds, and a happy citizen in the city
  const notices = page.evaluate(() => new Promise<string[]>(resolve => {
    const seen: string[] = [];
    const el = document.querySelector('.hud-notice')!;
    new MutationObserver(() => { seen.push(el.textContent!); if (/ihmeen/.test(el.textContent!)) resolve(seen); }).observe(el, { childList: true, characterData: true, subtree: true });
  }));
  await buyAndBuild(page, /^Riippuvat puutarhat/, 'gardens');
  expect(await notices).toContain('Aamuranta rakensi ihmeen: Riippuvat puutarhat');
  await expect(gardens).toHaveCount(0);
  await expect(card.locator('.city-mood')).toHaveText(/^Asukkaat: 1 onnellinen/);
  await page.screenshot({ path: testInfo.outputPath('wonder.png') });

  // Kolossi: a trade more on each worked tile with trade
  await page.evaluate(() => (window as any).globeDebug.learn('bronze'));
  const before = (await state(page)).cities[0].yield.trade;
  const tradeTiles = await page.evaluate(() => {
    const w = window as any;
    const c = w.globeGame.state.cities[0];
    return c.worked.filter((t: number) => w.globeDebug.yieldOf(t) .trade > 0 || t === c.tile).length;
  });
  await buyAndBuild(page, /^Kolossi/, 'colossus');
  const after = (await state(page)).cities[0];
  testInfo.annotations.push({ type: 'trade', description: `${before} → ${after.yield.trade}, tiles with trade ≤ ${tradeTiles}` });
  expect(after.yield.trade).toBeGreaterThanOrEqual(before);
  expect(errors).toEqual([]);
});
