import { expect, test } from '@playwright/test';

test('Pronssityö opens the phalanx; a city builds one and it defends there', async ({ page }, testInfo) => {
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
  const phalanx = card.getByRole('radio', { name: /^Falangi/ });

  // Locked until Pronssityö
  await expect(phalanx).toBeDisabled();
  await expect(phalanx).toContainText('vaatii: Pronssityö');
  await page.evaluate(() => (window as any).globeDebug.learn('bronze'));
  await expect(phalanx).toBeEnabled();
  await expect(phalanx).toContainText('20 tuotantoa · Puolustaa kaupunkia, kaksi kertaa soturia vahvempi');

  // Bought, it is ready the next day and stays to defend
  await phalanx.click();
  await page.evaluate(() => (window as any).globeDebug.setGold(500));
  await card.locator('.city-buy').click();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.units.some((u: any) => u.kind === 'phalanx'), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const s = await page.evaluate(() => (window as any).globeGame.state);
  const unit = s.units.find((u: any) => u.kind === 'phalanx');
  expect([unit.name, unit.tile, unit.mode]).toEqual(['Falangi 1', s.cities[0].tile, 'defend']);
  await page.screenshot({ path: testInfo.outputPath('phalanx.png') });
  expect(errors).toEqual([]);
});
