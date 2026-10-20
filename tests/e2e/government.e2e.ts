import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

test('government: Despotism to start, a revolution once Monarchy is known, anarchy, then Monarchy', async ({ page }, testInfo) => {
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
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();

  // Despotism, and no revolution before Monarchy is known
  await page.getByRole('button', { name: 'Valitse tutkimus', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Tutkimus' });
  const gov = card.locator('.research-gov');
  const revolution = card.getByRole('button', { name: 'Vallankumous: Monarkiaan' });
  await expect(gov).toContainText('Hallitus: Itsevaltius');
  await expect(revolution).toBeHidden();
  expect((await state(page)).gov).toBe('despotism');

  // Monarchy known: the revolution starts anarchy of 1 to 5 days, with all trade luxury
  await page.evaluate(() => (window as any).globeDebug.learn('monarchy'));
  await expect(revolution).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('revolution.png') });
  await revolution.click();
  expect((await state(page)).gov).toBe('anarchy');
  await expect(gov).toContainText('Hallitus: Anarkia');
  await expect(card.locator('.research-rates')).toHaveText(/^Tiedettä \+0\/pv · kultaa /);
  await expect(revolution).toBeHidden();

  // Days pass, and Monarchy begins
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.gov === 'monarchy', null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(gov).toContainText('Hallitus: Monarkia');
  await expect(revolution).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('monarchy.png') });
  expect(errors).toEqual([]);
});
