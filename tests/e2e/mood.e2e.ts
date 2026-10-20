import { expect, test } from '@playwright/test';

test('a big city riots without a soldier or a temple; a temple calms it', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ready = page.waitForEvent('console', { predicate: m => m.text().includes('3D globe ready'), timeout: 20_000 });
  await page.goto('./?classic&seed=42');
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
  await expect(card.locator('.city-mood')).toHaveText('Asukkaat: 1 tyytyväinen');
  await expect(card.locator('.city-disorder')).toBeHidden();

  // Size 4 + soldiers + 1: one more than four content and the soldiers can calm
  const soldiers = (await page.evaluate(() => (window as any).globeGame.state)).units.filter((u: any) => u.kind === 'warrior').length;
  await page.evaluate(n => (window as any).globeDebug.setCitySize(0, n), 5 + soldiers);
  await expect(card.locator('.city-mood')).toHaveText(new RegExp(`^Asukkaat: ${4 + soldiers} tyytyväistä · 1 tyytymätön`));
  await expect(card.locator('.city-disorder')).toBeVisible();
  let s = await page.evaluate(() => (window as any).globeGame.state);
  expect(s.cities[0].yield.disorder).toBe(true);
  expect([s.cities[0].yield.surplus <= 0, s.cities[0].yield.shield <= 0]).toEqual([true, true]);
  await page.screenshot({ path: testInfo.outputPath('disorder.png') });

  // A temple (Hautajaisriitit) calms one: bought, it is there the next day
  await page.evaluate(() => { const d = (window as any).globeDebug; d.learn('ceremonial'); d.setGold(500); });
  const temple = card.getByRole('radio', { name: /^Temppeli/ });
  await expect(temple).toContainText('40 tuotantoa, 1 kulta/pv · Rauhoittaa yhden tyytymättömän asukkaan');
  await temple.click();
  await card.locator('.city-buy').click();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities[0].buildings.includes('temple'), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  s = await page.evaluate(() => (window as any).globeGame.state);
  expect(s.cities[0].yield.disorder).toBeFalsy();
  await expect(card.locator('.city-disorder')).toBeHidden();
  expect(errors).toEqual([]);
});
