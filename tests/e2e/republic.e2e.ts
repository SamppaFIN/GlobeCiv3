import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => (window as any).globeGame.state);

test('the Republic: a revolution to it from Monarchy, anarchy, then its trade and its words (STORY-125)', async ({ page }, testInfo) => {
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

  // Monarchy first, by the player's revolution
  await page.evaluate(() => (window as any).globeDebug.learn('monarchy'));
  await page.getByRole('button', { name: 'Valitse tutkimus', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Tutkimus' });
  const gov = card.locator('.research-gov');
  const toMonarchy = card.getByRole('button', { name: 'Vallankumous: Monarkiaan' });
  const toRepublic = card.getByRole('button', { name: 'Vallankumous: Tasavaltaan' });
  await expect(toRepublic).toBeHidden();
  await toMonarchy.click();
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.gov === 'monarchy', null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();

  // The Republic known: its button only, a command with its target, and anarchy
  for (const a of ['alphabet', 'writing', 'law', 'literacy', 'republic']) await page.evaluate(x => (window as any).globeDebug.learn(x), a);
  await expect(toRepublic).toBeVisible();
  await expect(toMonarchy).toBeHidden();
  const box = await toRepublic.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath('republic-revolution.png') });
  await toRepublic.click();
  const s = await state(page);
  expect(s.gov).toBe('anarchy');
  expect(s.revolutionTo).toBe('republic');
  expect(s.commands.at(-1)).toMatchObject({ by: 'player', kind: 'revolution' });
  await expect(gov).toContainText('Hallitus: Anarkia');
  await expect(toRepublic).toBeHidden();

  // Days pass, and the Republic begins: its words, and a revolution back to Monarchy is open
  await page.getByRole('button', { name: 'Jatka' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.gov === 'republic', null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  await expect(gov).toContainText('Hallitus: Tasavalta · +1 kauppaa ruutuun, jolla on kauppaa');
  await expect(toMonarchy).toBeVisible();
  await expect(toRepublic).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('republic.png') });
  expect(errors).toEqual([]);
});
