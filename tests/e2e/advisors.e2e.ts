import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

test('advisors: the city area level has three to choose from, and the chosen one runs the cities and units', async ({ page }, testInfo) => {
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

  // None at first; the card offers three and Oma ohjaus
  const open = page.getByRole('button', { name: 'Neuvonantaja: Oma ohjaus' });
  await open.click();
  const card = page.getByRole('dialog', { name: 'Neuvonantaja' });
  await expect(card).toBeVisible();
  await expect(card.locator('.advisor-level')).toHaveText('Kaupunkialue');
  const options = card.getByRole('radio');
  await expect(options).toHaveCount(4);
  await expect(options.nth(0)).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: testInfo.outputPath('advisors.png') });

  // Kartoittaja: the scouts explore toward the home province's least mapped area
  await options.filter({ hasText: 'Kartoittaja' }).click();
  expect((await state(page)).cityAdvisor).toBe('explore');
  await page.getByRole('button', { name: 'Jatka' }).click();
  await expect(card.locator('.advisor-log')).toContainText('tiedustelijat kohti:', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect((await state(page)).units.filter((u: { name: string; mode: string }) => u.name.startsWith('Tiedustelija')).every((u: { mode: string }) => u.mode === 'explore')).toBe(true);

  // Vartija: production focus, a note on the city card, and it answers the bandits itself
  await options.filter({ hasText: 'Vartija' }).click();
  await expect(page.getByRole('button', { name: 'Neuvonantaja: Vartija' })).toBeVisible();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities[0].focus === 'production', null, { timeout: 30_000 });
  await page.evaluate(() => (window as any).globeDebug.raidNow(0));
  await expect(card.locator('.advisor-log')).toContainText('Aamuranta rakentaa sotilaan rosvoja vastaan', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(page.getByRole('dialog', { name: 'Rosvoja liikkeellä' })).toHaveCount(0);
  expect((await state(page)).raidAlert).toBe(false);
  await card.getByRole('button', { name: 'Sulje' }).click();
  await page.getByRole('button', { name: 'Luettelo: kaupungit, yksiköt, talous ja diplomatia' }).click();
  await page.getByRole('dialog', { name: 'Luettelo' }).locator('.list-row').filter({ hasText: 'Aamuranta' }).click();
  await expect(page.getByRole('dialog', { name: 'Aamuranta' }).locator('.city-advisor')).toHaveText('Neuvonantaja Vartija hoitaa painotuksen ja rakentamisen.');
  await page.screenshot({ path: testInfo.outputPath('city-advisor.png') });
  expect(errors).toEqual([]);
});
