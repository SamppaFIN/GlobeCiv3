import { expect, test } from '@playwright/test';

test('the list shows the cities and the units; a row opens the city or selects the unit', async ({ page }, testInfo) => {
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

  const open = page.getByRole('button', { name: 'Luettelo: kaupungit ja yksiköt' });
  const list = page.getByRole('dialog', { name: 'Luettelo' });
  // Before a city: no cities, three units
  await open.click();
  await expect(list).toBeVisible();
  await expect(list.locator('.list-tab-cities')).toHaveText('Kaupungit (0)');
  await expect(list).toContainText('Ei vielä kaupunkeja');
  await list.getByText('Yksiköt (3)').click();
  const rows = list.locator('.list-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('Uudisasukas');
  await expect(rows.first()).toContainText('uudisasukas');

  // A unit row selects the unit
  await rows.filter({ hasText: 'Tiedustelija 2' }).click();
  await expect(list).toBeHidden();
  await expect(page.locator('.hud-unit-name')).toHaveText('Tiedustelija 2');

  // The capital
  await open.click();
  await rows.filter({ hasText: 'Uudisasukas' }).click();
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.cities.length === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();

  // A city row: its size, build and food; it opens the card
  await open.click();
  await list.getByText('Kaupungit (1)').click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(/^AamurantaKoko 1.+ · ruokaa [+−]\d+/);
  await page.screenshot({ path: testInfo.outputPath('list.png') });
  await rows.first().click();
  await expect(list).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Aamuranta' })).toBeVisible();
  expect(errors).toEqual([]);
});
