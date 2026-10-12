import { expect, test } from '@playwright/test';

test('a goal leads the way: its hint on a tap, and its gold when reached', async ({ page }, testInfo) => {
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

  // The first goal, and its hint
  const goal = page.locator('.hud-goal');
  await expect(goal).toHaveText('TavoitePerusta ensimmäinen kaupunki+20 kultaa');
  await goal.click();
  await expect(page.getByRole('status')).toHaveText(/^Valitse uudisasukas ja paina Perusta kaupunki tähän/);
  await page.screenshot({ path: testInfo.outputPath('goal.png') });

  // Keep every notice: the goal's comes as the city is founded
  await page.evaluate(() => {
    const w = window as any;
    w.notices = [];
    new MutationObserver(() => w.notices.push(document.querySelector('.hud-notice')!.textContent)).observe(document.querySelector('.hud-notice')!, { childList: true, characterData: true, subtree: true });
  });
  const name = page.locator('.hud-unit-name');
  for (let i = 0; i < 3 && (await name.textContent()) !== 'Uudisasukas'; i++) {
    const prev = (await name.textContent())!;
    await page.locator('.hud-unit').click();
    await expect(name).not.toHaveText(prev);
  }
  await page.getByRole('button', { name: 'Perusta kaupunki tähän' }).click();
  await page.locator('.hud-speed label', { hasText: '4×' }).click();
  await page.waitForFunction(() => (window as any).globeGame.state.goal === 1, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Tauko' }).click();
  expect(await page.evaluate(() => (window as any).notices)).toContain('Tavoite saavutettu: Perusta ensimmäinen kaupunki · +20 kultaa');
  await page.getByRole('dialog', { name: 'Aamuranta' }).getByRole('button', { name: 'Sulje' }).click();
  await expect(goal).toContainText('Valitse tutkimus');

  // Choosing research reaches the next one
  const gold = (await page.evaluate(() => (window as any).globeGame.state)).gold;
  await page.getByRole('button', { name: 'Valitse tutkimus', exact: true }).click();
  await page.getByRole('dialog', { name: 'Tutkimus' }).getByRole('radio').first().click();
  await page.waitForFunction(() => (window as any).globeGame.state.goal === 2);
  expect((await page.evaluate(() => (window as any).globeGame.state)).gold).toBe(gold + 10);
  await expect(goal).toContainText('Kasvata kaupunki kokoon 2');
  expect(errors).toEqual([]);
});
