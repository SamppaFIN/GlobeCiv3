import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

/**
 * The iron age's wonder and the caravan (STORY-121): the Oracle is offered once Mysticism is
 * known, and a caravan's button in the unit panel sends it to the wonder, as a command; it
 * gives the wonder its 50 shields on arrival.
 */
test('the Oracle is built with a caravan\'s help, sent from the unit panel (STORY-121)', async ({ page }, testInfo) => {
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
  await expect(card).toBeVisible();

  // The Oracle waits for Mysticism, then is a wonder of 300 shields
  const oracle = card.getByRole('radio', { name: /^Ennustajan temppeli/ });
  await expect(oracle).toContainText('vaatii: Mystiikka');
  await page.evaluate(() => { const d = (window as any).globeDebug; for (const a of ['ceremonial', 'mysticism', 'bronze', 'alphabet', 'currency', 'law', 'trade']) d.learn(a); });
  await expect(oracle).toContainText('300 tuotantoa · Ihme: jokaisen kaupungin temppeli rauhoittaa yhden lisää');
  await oracle.click();
  await expect.poll(async () => (await state(page)).cities[0].build).toBe('oracle');
  await card.getByRole('button', { name: 'Sulje' }).click();

  // A caravan in the capital: its button names the city whose wonder it goes to
  await page.evaluate(() => (window as any).globeDebug.spawnUnit('caravan', 0));
  const unit = page.locator('.hud-unit');
  for (let i = 0; i < 8 && !/^Karavaani/.test((await name.textContent()) ?? ''); i++) {
    const prev = (await name.textContent())!;
    await unit.click();
    await expect(name).not.toHaveText(prev);
  }
  await expect(name).toHaveText(/^Karavaani/);
  await expect(page.locator('.hud-unit-status')).toHaveText('Odottaa · vie tuotanto ihmeeseen');
  const help = page.getByRole('button', { name: 'Vie ihmeeseen: Aamuranta' });
  await expect(help).toBeVisible();
  const box = await help.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath('caravan.png') });
  const before = (await state(page)).cities[0].shields;
  await help.click();
  expect((await state(page)).commands.at(-1)).toMatchObject({ by: 'player', kind: 'help' });
  await expect(help).toBeHidden();

  // The next day the wonder has its shields and the caravan is gone
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => !(window as any).globeGame.state.units.some((u: { kind: string }) => u.kind === 'caravan'), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  const after = (await state(page)).cities[0];
  expect(after.shields - before).toBeGreaterThanOrEqual(50);
  expect(after.build).toBe('oracle');
  await page.screenshot({ path: testInfo.outputPath('caravan-arrived.png') });
  expect(errors).toEqual([]);
});
