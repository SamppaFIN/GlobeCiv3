import { expect, test } from '@playwright/test';

test('one goal at a time: the level\'s own, its hint on a tap, its count on the meter and its gold at the rise (STORY-087)', async ({ page }, testInfo) => {
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

  // The city area's goal, its hint, and its count on the meter
  const goal = page.locator('.hud-goal');
  await expect(goal).toHaveText('TavoitePerusta kolme kaupunkia+60 kultaa');
  await expect(page.locator('.hud-meter-name')).toHaveText('Kaupungit');
  await expect(page.locator('.hud-meter-value')).toHaveText('0 / 3 kaupunkia');
  await goal.click();
  await expect(page.getByRole('status')).toHaveText(/^Tiedustelija ehdottaa hyviä paikkoja/);
  await page.screenshot({ path: testInfo.outputPath('goal.png') });

  // The settler founds the first city: the count goes up, and nothing else is a goal
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
  await expect(page.locator('.hud-meter-value')).toHaveText('1 / 3 kaupunkia');
  await expect(goal).toContainText('Perusta kolme kaupunkia');

  // Two more: the goal is reached, its gold paid, and the province's goal is next
  const gold = (await page.evaluate(() => (window as any).globeGame.state)).gold;
  await page.evaluate(() => {
    const w = window as any;
    const home = Math.floor(w.globeGame.state.startCity / 7);
    w.globeDebug.foundIn(home);
    w.globeDebug.foundIn(home);
  });
  await expect(page.getByRole('heading', { name: 'Lääni avautui, zoomaa ulos' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Tavoite saavutettu: Perusta kolme kaupunkia · +60 kultaa');
  expect((await page.evaluate(() => (window as any).globeGame.state)).gold).toBe(gold + 60);
  await page.getByRole('button', { name: 'Myöhemmin' }).click();
  await expect(goal).toHaveText('TavoitePidä neljä kotivaltion lääniä+80 kultaa');
  await expect(page.locator('.hud-meter-value')).toHaveText(/^[1-3] \/ 4 hallussa$/);
  expect(errors).toEqual([]);
});
